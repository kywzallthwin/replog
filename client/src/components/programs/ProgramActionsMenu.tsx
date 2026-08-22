import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'

type MenuPosition = {
  left: number
  top?: number
  bottom?: number
}

export function ProgramActionsMenu({
  programName,
  isOpen,
  onToggle,
  onCopy,
  onRename,
  onDelete,
  deleteDisabled = false,
}: {
  programName: string
  isOpen: boolean
  onToggle: () => void
  onCopy?: () => void
  onRename?: () => void
  onDelete?: () => void
  deleteDisabled?: boolean
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current
    const menu = menuRef.current

    if (!trigger) {
      return
    }

    const rect = trigger.getBoundingClientRect()
    const menuRect = menu?.getBoundingClientRect()
    const menuWidth = menuRect?.width ?? 160
    const menuHeight = menuRect?.height ?? 132
    const viewportPadding = 12
    const gap = 6
    const mobileBottomReserve = window.innerWidth < 1024 ? 84 : viewportPadding
    const spaceBelow = window.innerHeight - rect.bottom - mobileBottomReserve - gap
    const spaceAbove = rect.top - viewportPadding - gap
    const opensAbove = spaceBelow < menuHeight && spaceAbove > spaceBelow
    const unclampedLeft = rect.right - menuWidth
    const left = Math.max(viewportPadding, Math.min(unclampedLeft, window.innerWidth - menuWidth - viewportPadding))

    if (opensAbove) {
      setMenuPosition({
        left,
        bottom: window.innerHeight - rect.top + gap,
      })
      return
    }

    setMenuPosition({
      left,
      top: Math.max(viewportPadding, Math.min(rect.bottom + gap, window.innerHeight - menuHeight - viewportPadding)),
    })
  }, [])

  useLayoutEffect(() => {
    if (!isOpen) {
      return
    }

    updateMenuPosition()
  }, [isOpen, updateMenuPosition])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handleViewportChange() {
      updateMenuPosition()
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node

      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        onToggle()
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onToggle()
      }
    }

    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onToggle, updateMenuPosition])

  function closeAndRun(action?: () => void) {
    onToggle()
    action?.()
  }

  const menu = isOpen && menuPosition ? (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`${programName} actions`}
      className="fixed z-[70] w-40 rounded-[12px] border border-slate-200 bg-white p-1.5 shadow-[0_10px_24px_rgba(15,23,42,0.14)]"
      style={{
        left: menuPosition.left,
        ...(menuPosition.top !== undefined ? { top: menuPosition.top } : { bottom: menuPosition.bottom }),
      }}
    >
      {onCopy ? <button type="button" role="menuitem" onClick={() => closeAndRun(onCopy)} className="flex min-h-10 w-full items-center rounded-[8px] px-3 text-left text-xs font-bold text-slate-700 hover:bg-slate-50">Copy</button> : null}
      {onRename ? <button type="button" role="menuitem" onClick={() => closeAndRun(onRename)} className="flex min-h-10 w-full items-center rounded-[8px] px-3 text-left text-xs font-bold text-slate-700 hover:bg-slate-50">Rename</button> : null}
      {onDelete ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => closeAndRun(onDelete)}
          disabled={deleteDisabled}
          title={deleteDisabled ? 'Activate another program before deleting this one' : 'Delete program'}
          className={`flex min-h-10 w-full items-center rounded-[8px] px-3 text-left text-xs font-bold ${deleteDisabled ? 'cursor-not-allowed text-slate-400' : 'text-red-600 hover:bg-red-50'}`}
        >
          Delete
        </button>
      ) : null}
    </div>
  ) : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`More actions for ${programName}`}
        aria-expanded={isOpen}
        onClick={onToggle}
        className="grid min-h-11 min-w-11 place-items-center rounded-[10px] border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
      >
        <MoreHorizontal size={18} strokeWidth={2} aria-hidden="true" />
      </button>
      {typeof document !== 'undefined' ? createPortal(menu, document.body) : null}
    </>
  )
}
