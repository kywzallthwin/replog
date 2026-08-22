export type ProgramDeleteTarget = {
  id: string
  name: string
  isActive: boolean
  dayCount: number
  exerciseCount: number
}

export function ProgramDeleteDialog({
  program,
  isDeleting,
  error,
  onCancel,
  onConfirm,
}: {
  program: ProgramDeleteTarget
  isDeleting: boolean
  error?: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !isDeleting) onCancel()
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-program-dialog-title"
        aria-describedby="delete-program-dialog-description"
        className="w-full max-w-md rounded-[24px] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.35)]"
      >
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Program settings</p>
        <h2 id="delete-program-dialog-title" className="mt-1 text-2xl font-extrabold tracking-[-0.03em] text-slate-900">
          Delete {program.name}?
        </h2>
        <p id="delete-program-dialog-description" className="mt-3 text-sm leading-6 text-slate-500">
          This removes the program and its {program.dayCount} {program.dayCount === 1 ? 'day' : 'days'} with {program.exerciseCount} {program.exerciseCount === 1 ? 'exercise' : 'exercises'}.
          Completed workout history will remain preserved.
        </p>
        <p className="mt-3 rounded-[12px] bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-600">
          This action cannot be undone.
        </p>
        {error ? (
          <p role="alert" className="mt-3 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="min-h-11 flex-1 rounded-[13px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            Keep program
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="min-h-11 flex-1 rounded-[13px] border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-red-100 disabled:text-red-300"
          >
            {isDeleting ? 'Deleting...' : 'Delete program'}
          </button>
        </div>
      </div>
    </div>
  )
}
