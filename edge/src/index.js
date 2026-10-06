const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);
const SPOOFABLE = new Set(['host', 'forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-forwarded-port', 'x-real-ip', 'true-client-ip', 'cf-connecting-ip', 'cf-connecting-ip', 'x-edge-proxy-secret', 'x-request-id']);
export function isProxyPath(pathname) {
    if (pathname.includes('%'))
        return false;
    return pathname === '/api' || pathname.startsWith('/api/') || pathname === '/ready';
}
function readinessFailure(status = 503) {
    return json(status, { ok: false, code: 'API_STARTING' }, { 'Retry-After': '5' });
}
export function parseOrigin(value) {
    if (!value)
        return null;
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
            return null;
        return url;
    }
    catch {
        return null;
    }
}
function json(status, body, headers = {}) {
    const result = new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });
    result.headers.set('Cache-Control', 'no-store');
    return result;
}
function unavailable(status = 502) {
    return json(status, { error: 'The RepLog service is temporarily unavailable', code: 'UPSTREAM_UNAVAILABLE', retryable: true });
}
function copyResponseHeaders(source) {
    const headers = new Headers();
    source.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (!HOP_BY_HOP.has(lower) && lower !== 'set-cookie')
            headers.append(key, value);
    });
    const cookies = source.getSetCookie?.() ?? (source.get('Set-Cookie') ? [source.get('Set-Cookie')] : []);
    for (const cookie of cookies)
        headers.append('Set-Cookie', cookie);
    headers.set('Cache-Control', 'no-store');
    return headers;
}
function allowedOrigin(request, env) {
    const origins = (env.PUBLIC_APP_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean);
    return origins.includes(new URL(request.url).origin);
}
function requestId(request) {
    const ray = request.headers.get('CF-Ray') ?? 'edge';
    return `cf-${ray.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 100) || 'edge'}`;
}
function upstreamRequest(request, origin, env) {
    const incoming = new URL(request.url);
    const target = new URL(origin.origin);
    target.pathname = incoming.pathname;
    target.search = incoming.search;
    const headers = new Headers();
    request.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (!HOP_BY_HOP.has(lower) && !SPOOFABLE.has(lower))
            headers.set(key, value);
    });
    headers.set('X-Edge-Proxy-Secret', env.EDGE_PROXY_SECRET ?? '');
    headers.set('X-Request-ID', requestId(request));
    headers.set('X-Forwarded-Host', incoming.host);
    headers.set('X-Forwarded-Proto', 'https');
    const clientIp = request.headers.get('CF-Connecting-IP');
    if (clientIp)
        headers.set('X-Forwarded-For', clientIp);
    const init = { method: request.method, headers, redirect: 'manual' };
    if (request.method !== 'GET' && request.method !== 'HEAD' && request.body) {
        init.body = request.body;
        init.duplex = 'half';
    }
    return new Request(target, init);
}
async function proxy(request, env) {
    const pathname = new URL(request.url).pathname;
    if (!allowedOrigin(request, env))
        return json(503, { error: 'This preview cannot access the API', code: 'PREVIEW_API_DISABLED', retryable: false });
    const origin = parseOrigin(env.API_UPSTREAM_ORIGIN);
    const id = requestId(request);
    const startedAt = Date.now();
    const report = (status, category) => console.warn(JSON.stringify({ event: 'upstream_failure', requestId: id, durationMs: Date.now() - startedAt, status, category }));
    if (!origin || !env.EDGE_PROXY_SECRET) {
        report(503, 'configuration');
        return unavailable(503);
    }
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), new URL(request.url).pathname === '/ready' ? 12000 : 30000);
    try {
        const upstream = await fetch(upstreamRequest(request, origin, env), { signal: timeout.signal, redirect: 'manual' });
        const contentType = upstream.headers.get('content-type')?.toLowerCase() ?? '';
        if (contentType.includes('text/html')) {
            report(503, 'unexpected_html');
            return pathname === '/ready' ? readinessFailure() : unavailable(503);
        }
        if (pathname === '/ready') {
            if (!upstream.ok) {
                report(upstream.status, 'upstream_not_ready');
                return readinessFailure();
            }
            let payload;
            try {
                payload = await upstream.clone().json();
            }
            catch {
                report(503, 'invalid_readiness_json');
                return readinessFailure();
            }
            if (!payload || typeof payload !== 'object' || !('ok' in payload) || payload.ok !== true) {
                report(503, 'invalid_readiness_payload');
                return readinessFailure();
            }
        }
        return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: copyResponseHeaders(upstream.headers) });
    }
    catch (error) {
        const timedOut = error instanceof Error && error.name === 'AbortError';
        const status = timedOut ? 504 : 502;
        report(status, timedOut ? 'timeout' : 'network_error');
        if (pathname === '/ready')
            return readinessFailure(timedOut ? 504 : 503);
        return unavailable(status);
    }
    finally {
        clearTimeout(timer);
    }
}
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if ((url.pathname.startsWith('/api') || url.pathname === '/ready') && !isProxyPath(url.pathname))
            return new Response('Not Found', { status: 404 });
        if (isProxyPath(url.pathname))
            return proxy(request, env);
        return env.ASSETS.fetch(request);
    },
};
//# sourceMappingURL=index.js.map