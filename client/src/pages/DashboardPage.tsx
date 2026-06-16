export function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-500">RepLog</p>
            <h1 className="mt-1 text-3xl font-bold tracking-[-0.03em] text-slate-900">
              Dashboard
            </h1>
          </div>
        </header>

        <section className="rounded-[28px] bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
            Welcome
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-[-0.02em] text-slate-900">
            You are signed in.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
            This is a temporary dashboard destination for the auth flow. Workout
            tracking screens will replace this placeholder as the app build
            continues.
          </p>
        </section>
      </div>
    </main>
  )
}
