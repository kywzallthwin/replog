import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { createManualSession, getManualDraft, sessionQueryKey } from '../lib/sessions'
import { getProgram, getPrograms } from '../lib/programs'
import { BottomTabBar } from '../components/nav/BottomTabBar'
import { TopNav } from '../components/nav/TopNav'
import { BrandLogo } from '../components/BrandLogo'

function localDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function ManualWorkoutPage() {
  const [params] = useSearchParams()
  const [date, setDate] = useState(params.get('date') ?? localDate())
  const [choosing, setChoosing] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const programsQuery = useQuery({ queryKey: ['programs'], queryFn: getPrograms })
  const draftQuery = useQuery({ queryKey: ['sessions', 'manual-draft'], queryFn: getManualDraft })
  const programs = useMemo(() => programsQuery.data ?? [], [programsQuery.data])
  const daysQuery = useQuery({
    queryKey: ['manual-program-days', programs.map((program) => program.id)],
    queryFn: () => Promise.all(programs.map((program) => getProgram(program.id))),
    enabled: programs.length > 0,
  })
  const createMutation = useMutation({
    mutationFn: (dayId?: string) => createManualSession({ dayId, workoutDate: date }),
    onSuccess: async (session) => {
      queryClient.setQueryData(sessionQueryKey(session.id), session)
      await queryClient.invalidateQueries({ queryKey: ['sessions', 'manual-draft'] })
      navigate(`/workout/${session.id}?from=manual`)
    },
  })
  const fullPrograms = (daysQuery.data ?? []).filter((program): program is NonNullable<typeof program> => Boolean(program))
  const orderedPrograms = [...fullPrograms].sort((a, b) => Number(b.isActive) - Number(a.isActive))

  return (
    <main className="min-h-dvh w-full min-w-0 overflow-x-hidden bg-slate-100 px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-8">
      <div className="mx-auto w-full min-w-0 max-w-3xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <Link to="/history" aria-label="Back to History" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-xl font-bold text-slate-700 shadow-sm">‹</Link>
          <BrandLogo className="h-6 w-auto" />
          <TopNav />
        </header>
        <h1 className="mb-5 text-3xl font-extrabold tracking-[-0.04em] text-slate-900">Log Workout</h1>
        <label className="mb-5 block rounded-[18px] bg-white p-4 shadow-sm">
          <span className="mb-2 block text-sm font-bold text-slate-700">Workout date</span>
          <input aria-label="Workout date" type="date" max={localDate()} value={date} onChange={(event) => setDate(event.target.value)} className="min-h-11 w-full rounded-[12px] border border-slate-200 px-3 font-semibold text-slate-800" />
        </label>
        {draftQuery.data ? <Link to={`/workout/${draftQuery.data.id}?from=manual`} className="mb-3 flex min-h-16 items-center justify-between rounded-[18px] bg-white px-5 font-bold text-slate-900 shadow-sm">Resume draft <span aria-hidden="true">›</span></Link> : null}
        <button type="button" onClick={() => setChoosing((value) => !value)} className="mb-3 flex min-h-16 w-full items-center justify-between rounded-[18px] bg-white px-5 text-left font-bold text-slate-900 shadow-sm">From Program <span aria-hidden="true">›</span></button>
        {choosing ? <section className="mb-3 rounded-[18px] bg-white p-4 shadow-sm" aria-label="Choose Workout">
          <h2 className="mb-3 text-lg font-extrabold text-slate-900">Choose Workout</h2>
          {programsQuery.isPending || daysQuery.isPending ? <p className="py-3 text-sm text-slate-500">Loading programs…</p> : null}
          {orderedPrograms.map((program) => <div key={program.id} className="mb-4 last:mb-0">
            <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-400">{program.name}{program.isActive ? ' · Active' : ''}</h3>
            {program.days.length ? program.days.map((day) => <button key={day.id} type="button" onClick={() => createMutation.mutate(day.id)} disabled={createMutation.isPending} className="flex min-h-11 w-full items-center justify-between border-t border-slate-100 py-2 text-left font-semibold text-slate-800">{day.name}<span aria-hidden="true">›</span></button>) : <p className="py-2 text-sm text-slate-400">No workout days</p>}
          </div>)}
          {!programs.length && !programsQuery.isPending ? <p className="py-3 text-sm text-slate-500">No programs available.</p> : null}
        </section> : null}
        <button type="button" onClick={() => createMutation.mutate(undefined)} disabled={createMutation.isPending} className="flex min-h-16 w-full items-center justify-between rounded-[18px] bg-white px-5 text-left font-bold text-slate-900 shadow-sm">Blank Workout <span aria-hidden="true">›</span></button>
        {createMutation.isError ? <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">Unable to start a manual workout. Resume or discard the existing draft, then try again.</p> : null}
      </div>
      <BottomTabBar />
    </main>
  )
}
