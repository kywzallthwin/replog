function App() {
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

          <div className="p-5">
            <div className="mb-5 flex rounded-[10px] bg-slate-100 p-1">
              <button
                type="button"
                className="flex-1 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
              >
                Login
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-500"
              >
                Register
              </button>
            </div>

            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                type="email"
                placeholder="you@email.com"
                className="w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900 outline-none transition focus:border-slate-900"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900 outline-none transition focus:border-slate-900"
              />
            </div>

            <div className="mb-4 mt-1">
              <button
                type="button"
                className="w-full rounded-[13px] bg-slate-900 px-5 py-[15px] text-[15px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.2),0_4px_12px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.07)] transition hover:bg-slate-800"
              >
                Login {String.fromCharCode(0x2192)}
              </button>
            </div>

            <div className="mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-medium text-slate-400">or</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              className="mb-5 flex w-full items-center justify-center gap-3 rounded-[13px] border border-[#dadce0] bg-white px-5 py-[13px] text-[15px] font-medium text-[#3c4043] shadow-[0_1px_3px_rgba(60,64,67,0.12),0_2px_6px_rgba(60,64,67,0.06)] transition hover:bg-slate-50"
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
                <path fill="none" d="M0 0h48v48H0z" />
              </svg>
              Continue with Google
            </button>

            <p className="text-center text-sm text-slate-500">
              Don&apos;t have an account?{' '}
              <span className="font-semibold text-slate-900">Register</span>
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}

export default App
