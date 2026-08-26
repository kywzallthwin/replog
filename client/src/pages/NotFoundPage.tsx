import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-5 py-10">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">404</p>
        <h1 className="mt-3 text-2xl font-bold tracking-[-0.03em] text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-500">That RepLog page does not exist.</p>
        <Link
          to="/"
          className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Back to RepLog
        </Link>
      </section>
    </main>
  )
}
