import { NavLink } from 'react-router-dom'
import { AuthShell } from '../components/auth/AuthShell'
import { GoogleButton } from '../components/auth/GoogleButton'

export function LoginPage() {
  return (
    <AuthShell>
      <div className="mb-5 flex rounded-[10px] bg-slate-100 p-1">
        <NavLink
          to="/login"
          className="flex-1 rounded-lg bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
        >
          Login
        </NavLink>
        <NavLink
          to="/register"
          className="flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-semibold text-slate-500"
        >
          Register
        </NavLink>
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

      <div className="mb-5">
        <GoogleButton label="Continue with Google" />
      </div>

      <p className="text-center text-sm text-slate-500">
        Don&apos;t have an account?{' '}
        <NavLink to="/register" className="font-semibold text-slate-900">
          Register
        </NavLink>
      </p>
    </AuthShell>
  )
}
