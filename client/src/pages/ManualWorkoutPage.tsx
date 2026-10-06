import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Dumbbell, Plus } from 'lucide-react'
import { createManualSession, getManualDraft, sessionQueryKey } from '../lib/sessions'
import { ManualProgramPickerDialog } from '../components/programs/ManualProgramPickerDialog'
import { BottomTabBar } from '../components/nav/BottomTabBar'
import { TopNav } from '../components/nav/TopNav'
import { BrandLogo } from '../components/BrandLogo'

function localDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function ManualWorkoutPage() {
  const [params, setParams] = useSearchParams()
  const [isProgramPickerOpen, setProgramPickerOpen] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fromProgramButtonRef = useRef<HTMLButtonElement>(null)
  const date = params.get('date') || localDate()
  const draftQuery = useQuery({ queryKey: ['sessions', 'manual-draft'], queryFn: getManualDraft, retry: false })

  const createMutation = useMutation({
    mutationFn: (dayId?: string) => createManualSession({ dayId, workoutDate: date }),
    onSuccess: async (session) => {
      queryClient.setQueryData(sessionQueryKey(session.id), session)
      await queryClient.invalidateQueries({ queryKey: ['sessions', 'manual-draft'] })
      navigate(`/workout/${session.id}?from=manual`)
    },
  })

  function updateDate(workoutDate: string) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (workoutDate) next.set('date', workoutDate)
      else next.delete('date')
      return next
    }, { replace: true })
  }

  return (
    <main className="min-h-dvh w-full min-w-0 overflow-x-hidden bg-slate-100 px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-8">
      <div className="mx-auto w-full min-w-0 max-w-3xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <button type="button" onClick={() => navigate('/history')} aria-label="Back to History" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 focus-visible:ring-offset-2">
            <ArrowLeft aria-hidden="true" size={20} strokeWidth={2.25} />
          </button>
          <Link to="/dashboard" aria-label="RepLog home" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 focus-visible:ring-offset-2">
            <BrandLogo className="h-6 w-auto" />
          </Link>
          <TopNav />
        </header>
        <h1 className="mb-5 min-w-0 break-words text-3xl font-extrabold tracking-[-0.04em] text-slate-900 [overflow-wrap:anywhere]">Log Workout</h1>

        <>
          <label className="mb-5 block rounded-[18px] bg-white p-4 shadow-sm">
            <span className="mb-2 block text-sm font-bold text-slate-700">Workout date</span>
            <input aria-label="Workout date" type="date" max={localDate()} value={date} onChange={(event) => updateDate(event.target.value)} className="min-h-11 w-full rounded-[12px] border border-slate-200 px-3 font-semibold text-slate-800" />
          </label>
          {draftQuery.data ? <Link to={`/workout/${draftQuery.data.id}?from=manual`} className="mb-3 flex min-h-[68px] min-w-0 items-center justify-between gap-3 rounded-[18px] bg-white px-5 py-3 font-bold text-slate-900 shadow-sm transition hover:shadow-md"><span className="min-w-0 line-clamp-2 break-words [overflow-wrap:anywhere]">Resume draft</span><span aria-hidden="true" className="shrink-0 text-xl text-slate-400">›</span></Link> : null}
          <button ref={fromProgramButtonRef} type="button" onClick={() => setProgramPickerOpen(true)} className="mb-3 flex min-h-[76px] w-full min-w-0 items-center gap-4 rounded-[18px] border border-slate-200 bg-white px-5 py-4 text-left font-extrabold text-slate-900 shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-slate-100 text-slate-800"><Dumbbell aria-hidden="true" size={20} /></span><span className="min-w-0 flex-1">From Program</span><ChevronRight aria-hidden="true" size={20} className="shrink-0 text-slate-500" /></button>
          <button type="button" onClick={() => createMutation.mutate(undefined)} disabled={createMutation.isPending} className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-[16px] border border-slate-200/80 bg-slate-50 px-5 py-3 text-left text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 disabled:cursor-wait disabled:opacity-60"><Plus aria-hidden="true" size={18} className="shrink-0 text-slate-400" /><span className="min-w-0 flex-1">Blank Workout</span><ChevronRight aria-hidden="true" size={18} className="shrink-0 text-slate-400" /></button>
        </>

        {createMutation.isError && !isProgramPickerOpen ? <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">Unable to start a manual workout. Resume or discard the existing draft, then try again.</p> : null}
      </div>
      {isProgramPickerOpen ? <ManualProgramPickerDialog
        onClose={() => setProgramPickerOpen(false)}
        onSelectWorkout={(dayId) => createMutation.mutate(dayId)}
        isCreating={createMutation.isPending}
        createError={createMutation.isError}
        triggerRef={fromProgramButtonRef}
      /> : null}
      <BottomTabBar />
    </main>
  )
}
