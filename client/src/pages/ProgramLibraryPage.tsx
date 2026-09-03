import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  activateProgram,
  activeProgramQueryKey,
  createProgram,
  deleteProgram,
  getProgramTemplates,
  getPrograms,
  programsQueryKey,
  updateProgram,
  type ProgramSummary,
  type ProgramTemplate,
  getCopiedProgramName,
  getProgramMutationError,
 } from '../lib/programs'
import { dashboardQueryKey, getDashboard } from '../lib/dashboard'
import { BottomTabBar } from '../components/nav/BottomTabBar'
import { TopNav } from '../components/nav/TopNav'
import { BrandLogo } from '../components/BrandLogo'
import { FluidSelect } from '../components/forms/FluidSelect'
import { ProgramActionsMenu } from '../components/programs/ProgramActionsMenu'
import { ProgramDeleteDialog, type ProgramDeleteTarget } from '../components/programs/ProgramDeleteDialog'
import { Dialog } from '../components/ui/Dialog'
import { PageLoader } from '../components/ui/PageLoader'

type CreateMode = 'template' | 'blank' | 'copy'

type CreateModalState = {
  mode: CreateMode
  sourceProgramId?: string
} | null

function programStats(program: ProgramSummary) {
  return `${program.dayCount} training ${program.dayCount === 1 ? 'day' : 'days'} · ${program.exerciseCount} exercises`
}

export function ProgramLibraryPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [createModal, setCreateModal] = useState<CreateModalState>(null)
  const [renameTarget, setRenameTarget] = useState<ProgramSummary | null>(null)
  const [openMenuProgramId, setOpenMenuProgramId] = useState<string | null>(null)
  const [activationBlockedProgramId, setActivationBlockedProgramId] = useState<string | null>(null)
  const [activationError, setActivationError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ProgramDeleteTarget | null>(null)
  const [renameName, setRenameName] = useState('')
  const [programName, setProgramName] = useState('')
  const newProgramButtonRef = useRef<HTMLButtonElement>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState('beginner-full-body')
  const [formError, setFormError] = useState('')
  const { data: programs = [], isPending, isError } = useQuery({
    queryKey: programsQueryKey,
    queryFn: getPrograms,
    retry: false,
  })
  const { data: templates = [], isPending: templatesPending, isError: templatesError } = useQuery({
    queryKey: ['programs', 'templates'],
    queryFn: getProgramTemplates,
    retry: false,
    enabled: Boolean(createModal),
  })
  const { data: dashboard } = useQuery({
    queryKey: dashboardQueryKey,
    queryFn: getDashboard,
    retry: false,
  })
  const activeProgram = programs.find((program) => program.isActive) ?? null
  const otherPrograms = programs.filter((program) => !program.isActive)

  async function invalidateProgramData() {
    await queryClient.invalidateQueries({ queryKey: programsQueryKey })
    await queryClient.invalidateQueries({ queryKey: activeProgramQueryKey })
    await queryClient.invalidateQueries({ queryKey: dashboardQueryKey })
  }

  const createMutation = useMutation({
    mutationFn: createProgram,
    onSuccess: async (program) => {
      await invalidateProgramData()
      setCreateModal(null)
      setFormError('')

      if (program) {
        navigate(`/program/${program.id}`)
      }
    },
    onError: (error) => setFormError(getProgramMutationError(error, 'A program with this name already exists. Try another name.', 'Unable to create the program. Please try again.')),
  })
  const activateMutation = useMutation({
    mutationFn: activateProgram,
    onSuccess: async () => {
      setActivationBlockedProgramId(null)
      setActivationError('')
      await invalidateProgramData()
    },
    onError: (error, programId) => {
      setActivationBlockedProgramId(programId)
      setActivationError(getProgramMutationError(error, 'Finish or cancel your active workout before switching programs.', 'Unable to switch programs. Please try again.'))
    },
  })
  const deleteMutation = useMutation({
    mutationFn: deleteProgram,
    onSuccess: async () => {
      await invalidateProgramData()
      setDeleteTarget(null)
    },
  })
  const renameMutation = useMutation({
    mutationFn: ({ programId, name }: { programId: string; name: string }) => updateProgram(programId, name),
    onSuccess: async () => {
      await invalidateProgramData()
      setRenameTarget(null)
    },
  })

  function openCreateModal(mode: CreateMode, sourceProgram?: ProgramSummary) {
    setFormError('')
    setCreateModal({
      mode,
      ...(sourceProgram ? { sourceProgramId: sourceProgram.id } : {}),
    })

    if (mode === 'template') {
      const template = templates.find((item) => item.id === selectedTemplateId) ?? templates[0]
      setSelectedTemplateId(template?.id ?? 'beginner-full-body')
      setProgramName(template?.name ?? 'Beginner Full Body')
      return
    }

    setProgramName(sourceProgram ? getCopiedProgramName(sourceProgram.name) : 'My Program')
  }

  function closeCreateModal() {
    if (createMutation.isPending) {
      return
    }

    setCreateModal(null)
    setFormError('')
  }

  function openRenameModal(program: ProgramSummary) {
    renameMutation.reset()
    setOpenMenuProgramId(null)
    setRenameTarget(program)
    setRenameName(program.name)
  }

  function openDeleteDialog(program: ProgramSummary) {
    deleteMutation.reset()
    setOpenMenuProgramId(null)
    setDeleteTarget(program)
  }

  function toggleProgramMenu(programId: string) {
    setOpenMenuProgramId((currentProgramId) => currentProgramId === programId ? null : programId)
  }

  function handleActivate(programId: string) {
    if (activateMutation.isPending) {
      return
    }

    setOpenMenuProgramId(null)

    if (dashboard?.activeSession) {
      activateMutation.reset()
      setActivationBlockedProgramId(programId)
      setActivationError('Finish or cancel your active workout before switching programs.')
      return
    }

    setActivationBlockedProgramId(null)
    setActivationError('')
    activateMutation.reset()
    activateMutation.mutate(programId)
  }

  function handleTemplateSelect(template: ProgramTemplate) {
    setSelectedTemplateId(template.id)
    setProgramName(template.name)
  }

  function submitCreate() {
    if (!createModal || !programName.trim()) {
      setFormError('Enter a program name.')
      return
    }

    if (createModal.mode === 'template') {
      if (templatesPending) {
        setFormError('Templates are still loading. Please wait.')
        return
      }

      if (templatesError || !templates.some((template) => template.id === selectedTemplateId)) {
        setFormError('Unable to load a valid template. Please try again.')
        return
      }
    }

    createMutation.mutate({
      name: programName.trim(),
      source: createModal.mode,
      ...(createModal.mode === 'template' ? { templateId: selectedTemplateId } : {}),
      ...(createModal.mode === 'copy' && createModal.sourceProgramId
        ? { sourceProgramId: createModal.sourceProgramId }
        : {}),
    })
  }

  return (
    <main className="min-h-dvh bg-slate-100 px-4 pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-10 lg:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <BrandLogo className="h-6 w-auto" />
            <h1 className="mt-1 text-3xl font-bold tracking-[-0.03em] text-slate-900">Programs</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Try different routines without losing the workouts you have already logged.
            </p>
          </div>
          <TopNav />
          <button
            ref={newProgramButtonRef}
            type="button"
            onClick={() => openCreateModal('template')}
            className="min-h-11 w-fit rounded-[13px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.2),0_4px_12px_rgba(15,23,42,0.16)] transition hover:bg-slate-800 sm:ml-auto"
          >
            + New Program
          </button>
        </header>

        {isPending ? (
          <PageLoader statusMessage="Loading your programs..." />
        ) : null}

        {isError ? (
          <section className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
            <p className="rounded-[10px] bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
              Unable to load your programs. Please refresh and try again.
            </p>
          </section>
        ) : null}

        {activeProgram ? (
          <section>
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Active program</p>
            <article className="relative overflow-visible rounded-[20px] border border-slate-300 bg-white p-[18px] pl-[22px] shadow-[0_4px_14px_rgba(15,23,42,0.10)]">
              <span aria-hidden="true" className="absolute bottom-3 left-0 top-3 w-[3px] rounded-full bg-slate-900" />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-lg font-extrabold tracking-[-0.03em] text-slate-900">{activeProgram.name}</h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                    <span>{programStats(activeProgram)}</span>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-600">Active</span>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Link
                  to={`/program/${activeProgram.id}`}
                  className="inline-flex min-h-11 items-center rounded-[10px] bg-slate-900 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800"
                >
                  View and edit
                </Link>
                <ProgramActionsMenu
                  programName={activeProgram.name}
                  isOpen={openMenuProgramId === activeProgram.id}
                  onToggle={() => toggleProgramMenu(activeProgram.id)}
                  onCopy={() => { setOpenMenuProgramId(null); openCreateModal('copy', activeProgram) }}
                  onRename={() => openRenameModal(activeProgram)}
                   onDelete={() => undefined}
                   deleteDisabled
                   disabled={createMutation.isPending || renameMutation.isPending || deleteMutation.isPending || activateMutation.isPending}
                />
              </div>
            </article>
          </section>
        ) : null}

        {otherPrograms.length ? (
          <section className="mt-5">
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Other programs</p>
            <div className="space-y-2.5">
              {otherPrograms.map((program) => (
                <article key={program.id} className="relative overflow-visible rounded-[20px] border border-slate-200 bg-white p-[18px] shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
                  <div className="min-w-0">
                    <h2 className="break-words text-lg font-extrabold tracking-[-0.03em] text-slate-900">{program.name}</h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                      <span>{programStats(program)}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleActivate(program.id)}
                      disabled={activateMutation.isPending && activateMutation.variables === program.id}
                      className="min-h-11 rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                      {activateMutation.isPending && activateMutation.variables === program.id ? 'Switching...' : 'Make active'}
                    </button>
                    <Link
                      to={`/program/${program.id}`}
                      onClick={() => setOpenMenuProgramId(null)}
                      className="inline-flex min-h-11 items-center rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      Edit
                    </Link>
                <ProgramActionsMenu
                      programName={program.name}
                      isOpen={openMenuProgramId === program.id}
                      onToggle={() => toggleProgramMenu(program.id)}
                      onCopy={() => { setOpenMenuProgramId(null); openCreateModal('copy', program) }}
                       onRename={() => openRenameModal(program)}
                       onDelete={() => openDeleteDialog(program)}
                       disabled={createMutation.isPending || renameMutation.isPending || deleteMutation.isPending || activateMutation.isPending}
                    />
                  </div>
                  {(activationBlockedProgramId === program.id || (activateMutation.isError && activateMutation.variables === program.id)) ? (
                    <p role="alert" className="mt-3 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium leading-5 text-slate-600">
                      {activationError || 'Finish or cancel your active workout before switching programs.'}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <button
          type="button"
          onClick={() => openCreateModal('template')}
          className="mt-2 flex min-h-[54px] w-full items-center justify-center rounded-[16px] border border-dashed border-slate-300 bg-slate-50 text-[13px] font-extrabold text-slate-600 transition hover:bg-white"
        >
          + Create another program
        </button>

      </div>
      <BottomTabBar />

      {createModal ? (
        <Dialog
          labelledBy="create-program-dialog-title"
          onClose={closeCreateModal}
          closeOnEscape={!createMutation.isPending}
          overlayClassName="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 px-4 py-6"
          className="max-h-[calc(100dvh-3rem)] w-full max-w-lg overflow-y-auto rounded-[24px] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.35)]"
        >
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">New routine</p>
          <h2 id="create-program-dialog-title" className="mt-1 text-2xl font-extrabold tracking-[-0.03em] text-slate-900">
            Try another program
          </h2>

          <div className="mt-5 grid grid-cols-3 gap-2 rounded-[12px] bg-slate-100 p-1">
            {(['template', 'blank', 'copy'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  if (mode === 'copy') {
                    const firstProgram = programs[0]
                    openCreateModal(mode, firstProgram)
                  } else {
                    openCreateModal(mode)
                  }
                }}
                disabled={createMutation.isPending}
                className={`min-h-11 rounded-[9px] px-2 text-xs font-bold capitalize ${createModal.mode === mode ? 'bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.1)]' : 'text-slate-500'}`}
              >
                {mode === 'template' ? 'Template' : mode === 'copy' ? 'Copy' : 'Blank'}
              </button>
            ))}
          </div>

          {createModal.mode === 'template' ? (
            <div className="mt-4 space-y-2">
              {templatesPending ? <p role="status" aria-live="polite" className="text-sm text-slate-500">Loading templates...</p> : null}
              {templatesError ? <p role="alert" className="rounded-[10px] bg-red-50 px-3 py-2 text-sm font-medium text-red-700">Unable to load templates. Please try again.</p> : null}
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleTemplateSelect(template)}
                  disabled={createMutation.isPending || templatesPending || templatesError}
                  className={`min-h-11 w-full rounded-[14px] border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${selectedTemplateId === template.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <span className="block break-words font-bold text-slate-900 [overflow-wrap:anywhere]">{template.name}</span>
                  <span className="mt-1 block break-words text-sm leading-5 text-slate-500 [overflow-wrap:anywhere]">{template.description}</span>
                  <span className="mt-2 block text-xs font-bold uppercase tracking-[0.08em] text-slate-400">
                    {template.days} days · {template.exerciseCount} exercises
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {createModal.mode === 'copy' ? (
            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Copy from</span>
              <FluidSelect
                value={createModal.sourceProgramId ?? ''}
                ariaLabel="Copy from"
                options={programs.map((program) => ({ value: program.id, label: program.name }))}
                disabled={createMutation.isPending}
                onValueChange={(programId) => {
                  const sourceProgram = programs.find((program) => program.id === programId)
                  setCreateModal({ mode: 'copy', sourceProgramId: programId })
                   setProgramName(sourceProgram ? getCopiedProgramName(sourceProgram.name) : 'Program Copy')
                }}
              />
            </label>
          ) : null}

          <label htmlFor="create-program-name" className="mt-4 block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Program name</span>
            <input
              id="create-program-name"
              value={programName}
              aria-describedby={formError ? 'create-program-error' : undefined}
              maxLength={80}
              onChange={(event) => setProgramName(event.target.value)}
              className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-900"
              placeholder="e.g. Three Month Beginner Plan"
            />
          </label>

          {formError ? <p id="create-program-error" role="alert" className="mt-4 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">{formError}</p> : null}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={closeCreateModal}
              disabled={createMutation.isPending}
              className="min-h-11 flex-1 rounded-[13px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-500 transition hover:bg-slate-50 disabled:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitCreate}
              disabled={createMutation.isPending}
              className="min-h-11 flex-1 rounded-[13px] bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {createMutation.isPending ? 'Creating...' : 'Create program'}
            </button>
          </div>
        </Dialog>
      ) : null}

      {renameTarget ? (
        <Dialog
          labelledBy="rename-program-dialog-title"
          onClose={() => {
            if (!renameMutation.isPending) setRenameTarget(null)
          }}
          closeOnEscape={!renameMutation.isPending}
           overlayClassName="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 px-4 py-6"
           className="max-h-[calc(100dvh-3rem)] w-full max-w-md overflow-y-auto rounded-[24px] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.35)]"
        >
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Program settings</p>
           <h2 id="rename-program-dialog-title" className="mt-1 break-words text-2xl font-extrabold tracking-[-0.03em] text-slate-900 [overflow-wrap:anywhere]">
            Rename program
          </h2>
          <label htmlFor="rename-program-name" className="mt-5 block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Program name</span>
            <input
              id="rename-program-name"
              value={renameName}
              aria-describedby={renameMutation.isError ? 'rename-program-error' : undefined}
              maxLength={80}
              onChange={(event) => setRenameName(event.target.value)}
              className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-900"
            />
          </label>
          {renameMutation.isError ? (
            <p id="rename-program-error" role="alert" className="mt-4 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
               {getProgramMutationError(renameMutation.error, 'A program with this name already exists.', 'Unable to rename the program. Please try again.')}
            </p>
          ) : null}
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setRenameTarget(null)}
              disabled={renameMutation.isPending}
              className="min-h-11 flex-1 rounded-[13px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-500 transition hover:bg-slate-50 disabled:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (renameName.trim()) {
                  renameMutation.mutate({ programId: renameTarget.id, name: renameName.trim() })
                }
              }}
              disabled={renameMutation.isPending || !renameName.trim()}
              className="min-h-11 flex-1 rounded-[13px] bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {renameMutation.isPending ? 'Saving...' : 'Save name'}
            </button>
          </div>
        </Dialog>
      ) : null}

      {deleteTarget ? (
        <ProgramDeleteDialog
          program={deleteTarget}
          isDeleting={deleteMutation.isPending}
          error={deleteMutation.isError ? 'Unable to delete this program. Please try again.' : undefined}
          onCancel={() => {
            if (!deleteMutation.isPending) {
              deleteMutation.reset()
              setDeleteTarget(null)
            }
          }}
           onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
           fallbackFocusRef={newProgramButtonRef}
         />
      ) : null}
    </main>
  )
}
