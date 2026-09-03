import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
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
  disabled = false,
}: {
  programName: string
  isOpen: boolean
  onToggle: () => void
  onCopy?: () => void
  onRename?: () => void
  onDelete?: () => void
  deleteDisabled?: boolean
  disabled?: boolean
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
  const menuId = useId()

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

  useLayoutEffect(() => {
    if (!isOpen || !menuPosition) {
      return
    }

    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
  }, [isOpen, menuPosition])

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
        triggerRef.current?.focus()
        onToggle()
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        triggerRef.current?.focus()
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

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const menu = menuRef.current
    if (!menu) return

    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      triggerRef.current?.focus()
      onToggle()
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      event.stopPropagation()
      triggerRef.current?.focus()
      onToggle()
      return
    }

    const items = [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
    if (!items.length) return

    const activeIndex = items.indexOf(document.activeElement as HTMLButtonElement)
    let nextIndex: number | null = null

    if (event.key === 'ArrowDown') {
      nextIndex = (activeIndex + 1 + items.length) % items.length
    } else if (event.key === 'ArrowUp') {
      nextIndex = (activeIndex - 1 + items.length) % items.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = items.length - 1
    }

    if (nextIndex !== null) {
      event.preventDefault()
      items[nextIndex]?.focus()
    }
  }

  function closeAndRun(action?: () => void) {
    triggerRef.current?.focus()
    onToggle()
    action?.()
  }

  const menu = isOpen && menuPosition ? (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-label={`${programName} actions`}
      onKeyDown={handleMenuKeyDown}
      className="fixed z-[70] w-40 rounded-[12px] border border-slate-200 bg-white p-1.5 shadow-[0_10px_24px_rgba(15,23,42,0.14)]"
      style={{
        left: menuPosition.left,
        ...(menuPosition.top !== undefined ? { top: menuPosition.top } : { bottom: menuPosition.bottom }),
      }}
    >
      {onCopy ? <button type="button" role="menuitem" onClick={() => closeAndRun(onCopy)} className="flex min-h-11 w-full items-center rounded-[8px] px-3 text-left text-xs font-bold text-slate-700 hover:bg-slate-50">Copy</button> : null}
      {onRename ? <button type="button" role="menuitem" onClick={() => closeAndRun(onRename)} className="flex min-h-11 w-full items-center rounded-[8px] px-3 text-left text-xs font-bold text-slate-700 hover:bg-slate-50">Rename</button> : null}
      {onDelete ? (
        <button
          type="button"
          role="menuitem"
          aria-disabled={deleteDisabled || undefined}
          onClick={() => {
            if (!deleteDisabled) closeAndRun(onDelete)
          }}
          title={deleteDisabled ? 'Activate another program before deleting this one' : 'Delete program'}
          className={`flex min-h-11 w-full items-center rounded-[8px] px-3 text-left text-xs font-bold ${deleteDisabled ? 'cursor-not-allowed text-slate-400' : 'text-red-600 hover:bg-red-50'}`}
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
        disabled={disabled}
        aria-label={`More actions for ${programName}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => {
          if (!disabled) onToggle()
        }}
        className="grid min-h-11 min-w-11 place-items-center rounded-[10px] border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
      >
        <MoreHorizontal size={18} strokeWidth={2} aria-hidden="true" />
      </button>
      {typeof document !== 'undefined' ? createPortal(menu, document.body) : null}
    </>
  )
}
