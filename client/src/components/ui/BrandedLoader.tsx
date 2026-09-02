import { BrandLogo } from '../BrandLogo'

type BrandedLoaderProps = {
  statusMessage?: string
  fullScreen?: boolean
}

export function BrandedLoader({ statusMessage = 'Loading\u2026', fullScreen = false }: BrandedLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={statusMessage}
      className={`flex flex-col items-center justify-center gap-5 ${fullScreen ? 'min-h-dvh' : 'py-24'}`}
    >
      <div className="relative flex flex-col items-center">
        <div className="relative flex items-end gap-1.5">
          <div className="flex flex-col gap-1.5">
            <span className="rl-bar rl-bar-1 block h-2 w-[22px] rounded-full bg-slate-900" />
            <span className="rl-bar rl-bar-2 block h-2 w-[16px] rounded-full bg-slate-900" />
            <span className="rl-bar rl-bar-3 block h-2 w-[10px] rounded-full bg-slate-900" />
          </div>
          <span className="rl-mark block h-8 w-8">
            <BrandLogo compact className="h-8 w-8" />
          </span>
        </div>

        <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
          <span className="loading-dot loading-dot-1 inline-block h-1.5 w-1.5 rounded-full bg-slate-300" />
          <span className="loading-dot loading-dot-2 inline-block h-1.5 w-1.5 rounded-full bg-slate-300" />
          <span className="loading-dot loading-dot-3 inline-block h-1.5 w-1.5 rounded-full bg-slate-300" />
        </div>
      </div>

      <p className="text-sm font-semibold text-slate-400">{statusMessage}</p>

      <style>{`
        .rl-bar {
          transform: scaleX(0);
          transform-origin: left;
          animation: rep-bar-in 0.3s ease-out forwards;
        }
        .rl-bar-1 { animation-delay: 0s; }
        .rl-bar-2 { animation-delay: 0.15s; }
        .rl-bar-3 { animation-delay: 0.3s; }

        .rl-mark {
          transform: translateY(6px);
          opacity: 0;
          animation: rep-mark-lift 0.35s ease-out 0.5s forwards;
        }

        .loading-dot {
          opacity: 0.3;
          animation: loading-dot-pulse 1.2s ease-in-out infinite;
        }
        .loading-dot-1 { animation-delay: 0s; }
        .loading-dot-2 { animation-delay: 0.2s; }
        .loading-dot-3 { animation-delay: 0.4s; }

        @keyframes rep-bar-in {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }

        @keyframes rep-mark-lift {
          from { transform: translateY(6px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        @keyframes loading-dot-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .rl-bar {
            animation: none;
            transform: scaleX(1);
          }
          .rl-mark {
            animation: none;
            transform: translateY(0);
            opacity: 1;
          }
          .loading-dot {
            animation: none;
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  )
}
