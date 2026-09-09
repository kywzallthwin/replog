import { useEffect, useState, type ReactNode } from 'react'
import { apiBaseUrl } from '../../lib/api'
import { waitForApiReadiness } from '../../lib/apiReadiness'
import { BrandedLoader } from '../ui/BrandedLoader'

type ApiStartupGateProps = {
  children: ReactNode
}

export function ApiStartupGate({ children }: ApiStartupGateProps) {
  const [retryCount, setRetryCount] = useState(0)
  const [state, setState] = useState<'checking' | 'ready' | 'failed'>('checking')

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    void waitForApiReadiness({ apiBaseUrl, signal: controller.signal }).then(
      () => {
        if (active) setState('ready')
      },
      (error: unknown) => {
        if (active && !(error instanceof DOMException && error.name === 'AbortError')) {
          setState('failed')
        }
      },
    )

    return () => {
      active = false
      controller.abort()
    }
  }, [retryCount])

  if (state === 'checking') {
    return (
      <main className="min-h-dvh bg-slate-100 px-4">
        <BrandedLoader fullScreen statusMessage="Starting RepLog..." />
      </main>
    )
  }

  if (state === 'failed') {
    return (
      <main className="grid min-h-dvh place-content-center bg-slate-100 px-6 text-center">
        <div className="mx-auto max-w-sm rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">RepLog is starting slowly</h1>
          <p className="mt-2 text-sm text-slate-600">The server is taking longer than expected to start.</p>
          <button
            type="button"
            className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
            onClick={() => {
              setState('checking')
              setRetryCount((count) => count + 1)
            }}
          >
            Retry
          </button>
        </div>
      </main>
    )
  }

  return children
}
