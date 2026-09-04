import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { useBodyScrollLock } from '../../lib/useBodyScrollLock'

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusableElements(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>(focusableSelector)].filter((element) => (
    !element.hidden && element.getAttribute('aria-hidden') !== 'true'
  ))
}

type DialogProps = {
  children: ReactNode
  labelledBy: string
  describedBy?: string
  role?: 'dialog' | 'alertdialog'
  className?: string
  overlayClassName?: string
  onClose?: () => void
  closeOnEscape?: boolean
  restoreFocusRef?: RefObject<HTMLElement | null>
  fallbackFocusRef?: RefObject<HTMLElement | null>
  initialFocusRef?: RefObject<HTMLElement | null>
  focusKey?: string | number | boolean
}

export function Dialog({
  children,
  labelledBy,
  describedBy,
  role = 'dialog',
  className = '',
  overlayClassName = 'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6',
  onClose,
  closeOnEscape = true,
  restoreFocusRef,
  fallbackFocusRef,
  initialFocusRef,
  focusKey,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [restoreTarget] = useState<HTMLElement | null>(() => (
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  ))

  useBodyScrollLock(true)

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const target = initialFocusRef?.current
      ?? dialog.querySelector<HTMLElement>('[autofocus]')
      ?? getFocusableElements(dialog)[0]
      ?? dialog

    target.focus()
  }, [focusKey, initialFocusRef])

  useLayoutEffect(() => () => {
    const explicitTarget = restoreFocusRef?.current
    if (explicitTarget && document.contains(explicitTarget)) {
      explicitTarget.focus()
      return
    }

    if (restoreTarget && document.contains(restoreTarget)) {
      restoreTarget.focus()
      return
    }

    const fallbackTarget = fallbackFocusRef?.current
    if (fallbackTarget && document.contains(fallbackTarget)) {
      fallbackTarget.focus()
    }
  }, [fallbackFocusRef, restoreFocusRef, restoreTarget])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      if (closeOnEscape) {
        onClose?.()
      }
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const dialog = dialogRef.current
    if (!dialog) return

    const focusableElements = getFocusableElements(dialog)
    if (!focusableElements.length) {
      dialog.focus()
      return
    }

    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const activeIndex = activeElement ? focusableElements.indexOf(activeElement) : -1
    const nextIndex = activeIndex < 0
      ? event.shiftKey ? focusableElements.length - 1 : 0
      : (activeIndex + (event.shiftKey ? -1 : 1) + focusableElements.length) % focusableElements.length

    focusableElements[nextIndex]?.focus()
  }

  return (
    <div className={overlayClassName} data-dialog-overlay onKeyDown={handleKeyDown}>
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={className}
      >
        {children}
      </div>
    </div>
  )
}
