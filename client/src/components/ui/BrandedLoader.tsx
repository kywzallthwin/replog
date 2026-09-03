type BrandedLoaderProps = {
  statusMessage?: string
  fullScreen?: boolean
}

export function BrandedLoader({ statusMessage = 'Loading...', fullScreen = false }: BrandedLoaderProps) {
  return (
    <div
      className={`replog-loader grid justify-items-center gap-3 text-center ${fullScreen ? 'min-h-dvh place-content-center' : ''}`}
    >
      <div className={`inline-flex items-center ${fullScreen ? 'gap-2.5' : ''}`}>
        <svg
          viewBox="0 0 80 80"
          aria-hidden="true"
          focusable="false"
          className={fullScreen ? 'h-[42px] w-[42px]' : 'h-[54px] w-[54px]'}
        >
          <g fill="#0f172a">
            <rect data-loader-bar x="7" y="17" width="25" height="8" rx="4" />
            <rect data-loader-bar x="7" y="31" width="19" height="8" rx="4" />
            <rect data-loader-bar x="7" y="45" width="13" height="8" rx="4" />
          </g>
          <g
            data-loader-monogram
            fill="none"
            stroke="#0f172a"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="7"
          >
            <path d="M38 56V14h14c8.5 0 14 4.3 14 11s-5.5 11-14 11H38m14 0 14 20" />
            <path d="M57 14v42h17" />
          </g>
        </svg>
        {fullScreen ? (
          <strong className="text-[23px] font-extrabold tracking-[-0.04em] text-slate-900">RepLog</strong>
        ) : null}
      </div>

      <p
        role="status"
        aria-live="polite"
        aria-label={statusMessage}
        className="text-[13px] font-bold text-slate-500"
      >
        {statusMessage}
      </p>

      <span className="replog-loading-dots inline-flex min-h-2 items-center gap-1" aria-hidden="true">
        <span className="h-1 w-1 rounded-full bg-slate-400" />
        <span className="h-1 w-1 rounded-full bg-slate-400" />
        <span className="h-1 w-1 rounded-full bg-slate-400" />
      </span>
    </div>
  )
}
