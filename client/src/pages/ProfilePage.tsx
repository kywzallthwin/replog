import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { authMeQueryKey, clearPrivateQueries, getCurrentUser, logoutUser } from '../lib/auth'
import { dashboardQueryKey, getDashboard } from '../lib/dashboard'
import { BrandLogo } from '../components/BrandLogo'
import { BottomTabBar } from '../components/nav/BottomTabBar'
import { TopNav } from '../components/nav/TopNav'

function formatMemberSince(createdAt?: string) {
  if (!createdAt) {
    return 'Member'
  }

  return `Member since ${new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(createdAt))}`
}

export function ProfilePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: user } = useQuery({
    queryKey: authMeQueryKey,
    queryFn: getCurrentUser,
    retry: false,
  })
  const { data: dashboard } = useQuery({
    queryKey: dashboardQueryKey,
    queryFn: getDashboard,
    retry: false,
  })
  const logoutMutation = useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      clearPrivateQueries(queryClient)
      queryClient.removeQueries({ queryKey: authMeQueryKey })
      navigate('/login', { replace: true })
    },
  })

  return (
    <main className="min-h-dvh bg-slate-100 px-4 pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-10 lg:py-10">
      <div className="mx-auto mb-4 hidden max-w-3xl items-center justify-between lg:flex">
        <Link to="/dashboard" aria-label="Back to dashboard" className="inline-flex min-h-11 items-center">
          <BrandLogo className="h-6 w-auto" />
        </Link>
        <TopNav />
      </div>
      <div className="mx-auto max-w-3xl overflow-hidden rounded-[28px] bg-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <Link to="/dashboard" className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-900">
            Back
          </Link>
          <h1 className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
            <BrandLogo compact alt="" className="h-5 w-5" />
            Profile
          </h1>
          <Link to="/profile/edit" className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-500">
            Edit
          </Link>
        </header>

        <section className="border-b border-slate-100 px-5 py-7 text-center">
          <div className="mx-auto mb-3 flex h-[76px] w-[76px] items-center justify-center rounded-full bg-slate-900 text-[28px] font-extrabold tracking-[-0.02em] text-white">
            {user?.avatarInitial ?? 'U'}
          </div>
          <h2 className="text-xl font-extrabold tracking-[-0.03em] text-slate-900">
            {user?.username ?? 'User'}
          </h2>
          <p className="mt-1 break-all text-sm text-slate-500">{user?.email ?? 'Loading...'}</p>
          <p className="mt-1 text-xs font-medium text-slate-400">
            {formatMemberSince(user?.createdAt)}
          </p>
        </section>

        <section className="grid grid-cols-3 border-b border-slate-100">
          <div className="border-r border-slate-100 px-2 py-4 text-center">
            <div className="text-[22px] font-extrabold tracking-[-0.03em] text-slate-900">
              {dashboard?.stats.workoutCount ?? 0}
            </div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">Workouts</div>
          </div>
          <div className="border-r border-slate-100 px-2 py-4 text-center">
            <div className="text-[22px] font-extrabold tracking-[-0.03em] text-slate-900">
              {dashboard?.stats.setCount ?? 0}
            </div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">Sets</div>
          </div>
          <div className="px-2 py-4 text-center">
            <div className="text-[22px] font-extrabold tracking-[-0.03em] text-slate-900">
              {Math.round(dashboard?.stats.totalVolumeKg ?? 0)}kg
            </div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">Lifted</div>
          </div>
        </section>

        <section className="px-5 py-5">
          <p className="mb-3 text-[13px] font-semibold text-slate-500">Settings</p>
          <div className="overflow-hidden rounded-[14px] border border-slate-200">
            <Link data-press="row" to="/profile/edit" className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-4">
              <span className="text-sm font-medium text-slate-900">Edit Profile</span>
              <span className="text-slate-300">{String.fromCharCode(0x203a)}</span>
            </Link>
            <Link data-press="row" to="/profile/password" className="flex min-h-11 items-center justify-between border-b border-slate-100 bg-white px-4 py-4">
              <span className="text-sm font-medium text-slate-900">Change Password</span>
              <span className="text-slate-300">{String.fromCharCode(0x203a)}</span>
            </Link>
            <Link data-press="row" to="/program" className="flex min-h-11 items-center justify-between bg-white px-4 py-4">
              <span className="text-sm font-medium text-slate-900">Programs</span>
              <span className="text-slate-300">{String.fromCharCode(0x203a)}</span>
            </Link>
          </div>

          <p className="mb-3 mt-5 text-[13px] font-semibold text-slate-500">Account</p>
          <button
            type="button"
            disabled={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate()}
            className="flex min-h-11 w-full items-center rounded-[14px] border border-red-200 bg-white px-4 py-4 text-sm font-semibold text-red-500 disabled:cursor-not-allowed disabled:text-red-300"
          >
            {logoutMutation.isPending ? 'Logging out...' : 'Log Out'}
          </button>
          {logoutMutation.isError ? (
            <p role="alert" className="mt-4 rounded-[10px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              Unable to log out. Please try again.
            </p>
          ) : null}
        </section>
      </div>
      <BottomTabBar />
    </main>
  )
}
