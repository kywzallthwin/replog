import type { ReactNode } from 'react'

type AuthShellProps = {
  children: ReactNode
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 text-center sm:mb-10">
          <h1 className="mb-2 text-3xl font-bold tracking-[-0.03em] text-slate-900">
            RepLog
          </h1>
          <p className="text-sm text-slate-500">Workout Tracker</p>
        </header>

        <section className="mx-auto w-full max-w-[375px] overflow-hidden rounded-[28px] bg-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
          <div className="bg-slate-900 px-6 py-10 text-center">
            <div className="text-2xl font-bold tracking-[-0.02em] text-white">
              RepLog
            </div>
            <p className="mt-2 text-sm text-slate-300">Track every lift.</p>
          </div>

          <div className="p-5">{children}</div>
        </section>
      </div>
    </main>
  )
}
