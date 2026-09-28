export interface Env {
    ASSETS: {
        fetch(request: Request): Promise<Response>;
    };
    API_UPSTREAM_ORIGIN?: string;
    PUBLIC_APP_ORIGINS?: string;
    EDGE_PROXY_SECRET?: string;
}
export declare function isProxyPath(pathname: string): boolean;
export declare function parseOrigin(value: string | undefined): URL | null;
declare const _default: {
    fetch(request: Request, env: Env): Promise<Response>;
};
export default _default;
//# sourceMappingURL=index.d.ts.map