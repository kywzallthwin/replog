import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

export type FluidSelectOption = {
  value: string
  label: string
  disabled?: boolean
}

type FluidSelectProps = {
  value: string
  options: FluidSelectOption[]
  onValueChange: (value: string) => void
  ariaLabel?: string
  placeholder?: string
  disabled?: boolean
}

type MenuPosition = {
  left: number
  top?: number
  bottom?: number
  width: number
  maxHeight: number
  placement: 'above' | 'below'
}

function getFirstEnabledIndex(options: FluidSelectOption[]) {
  return options.findIndex((option) => !option.disabled)
}

function getNextEnabledIndex(options: FluidSelectOption[], startIndex: number, direction: 1 | -1) {
  if (!options.length) return -1

  let index = startIndex
  for (let step = 0; step < options.length; step += 1) {
    index = (index + direction + options.length) % options.length
    if (!options[index].disabled) return index
  }

  return -1
}

export function FluidSelect({
  value,
  options,
  onValueChange,
  ariaLabel,
  placeholder = 'Select an option',
  disabled = false,
}: FluidSelectProps) {
  const selectId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
  const selectedIndex = options.findIndex((option) => option.value === value)
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const gap = 6
    const viewportPadding = 12
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding - gap
    const spaceAbove = rect.top - viewportPadding - gap
    const placement = spaceBelow >= 180 || spaceBelow >= spaceAbove ? 'below' : 'above'
    const availableHeight = placement === 'below' ? spaceBelow : spaceAbove

    setMenuPosition({
      left: rect.left,
      ...(placement === 'below' ? { top: rect.bottom + gap } : { bottom: window.innerHeight - rect.top + gap }),
      width: rect.width,
      maxHeight: Math.max(96, Math.min(320, availableHeight)),
      placement,
    })
  }, [])

  useLayoutEffect(() => {
    if (!isOpen) return

    updateMenuPosition()
  }, [isOpen, updateMenuPosition])

  useEffect(() => {
    if (!isOpen) return

    function handleViewportChange() {
      updateMenuPosition()
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false)
      }
    }

    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isOpen, updateMenuPosition])

  function openMenu() {
    if (disabled || !options.length) return
    updateMenuPosition()
    setActiveIndex(selectedIndex >= 0 && !options[selectedIndex].disabled ? selectedIndex : getFirstEnabledIndex(options))
    setIsOpen(true)
  }

  function commitOption(index: number) {
    const option = options[index]
    if (!option || option.disabled) return

    onValueChange(option.value)
    setIsOpen(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape') {
      if (isOpen) {
        event.preventDefault()
        event.stopPropagation()
        setIsOpen(false)
      }
      return
    }

    if (event.key === 'Tab') {
      setIsOpen(false)
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!isOpen) {
        openMenu()
      } else if (activeIndex >= 0) {
        commitOption(activeIndex)
      }
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!isOpen) {
        openMenu()
        return
      }

      const direction = event.key === 'ArrowDown' ? 1 : -1
      const nextIndex = getNextEnabledIndex(options, activeIndex >= 0 ? activeIndex : selectedIndex, direction)
      if (nextIndex >= 0) setActiveIndex(nextIndex)
      return
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      if (!isOpen) openMenu()
      const enabledIndexes = options.flatMap((option, index) => (option.disabled ? [] : [index]))
      if (enabledIndexes.length) setActiveIndex(event.key === 'Home' ? enabledIndexes[0] : enabledIndexes.at(-1) ?? enabledIndexes[0])
    }
  }

  useEffect(() => {
    if (!isOpen || activeIndex < 0) return

    document.getElementById(`${selectId}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, isOpen, selectId])

  const menu = isOpen && menuPosition ? (
    <div
      ref={menuRef}
      id={`${selectId}-listbox`}
      role="listbox"
      aria-label={ariaLabel}
      className="fluid-select-menu fixed z-[70] overflow-y-auto rounded-[16px] border border-slate-200 bg-white p-1.5 shadow-[0_12px_30px_rgba(15,23,42,0.16)]"
      data-placement={menuPosition.placement}
      style={{
        left: menuPosition.left,
        ...(menuPosition.top !== undefined ? { top: menuPosition.top } : { bottom: menuPosition.bottom }),
        width: menuPosition.width,
        maxHeight: menuPosition.maxHeight,
      }}
    >
      {options.map((option, index) => {
        const isSelected = option.value === value
        const isActive = index === activeIndex

        return (
          <div
            key={option.value}
            id={`${selectId}-option-${index}`}
            role="option"
            aria-selected={isSelected}
            aria-disabled={option.disabled || undefined}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => commitOption(index)}
            className={`flex min-h-11 w-full items-center justify-between rounded-[11px] px-3 py-2 text-left text-sm font-semibold transition-colors duration-150 ${
              option.disabled
                ? 'cursor-not-allowed text-slate-300'
                : isSelected
                  ? 'cursor-pointer bg-slate-900 text-white'
                  : isActive
                    ? 'cursor-pointer bg-slate-100 text-slate-900'
                    : 'cursor-pointer text-slate-700 hover:bg-slate-100'
            }`}
          >
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">{option.label}</span>
            {isSelected ? (
              <svg className="ml-3 h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="m5 10 3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : null}
          </div>
        )
      })}
    </div>
  ) : null

  return (
    <>
      <div className="relative w-full">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled || !options.length}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={`${selectId}-listbox`}
          aria-label={ariaLabel ? `${ariaLabel}: ${selectedOption?.label ?? placeholder}` : undefined}
          aria-activedescendant={isOpen && activeIndex >= 0 ? `${selectId}-option-${activeIndex}` : undefined}
          onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
          onKeyDown={handleKeyDown}
           className="flex min-h-12 h-auto w-full items-center justify-between gap-3 rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 shadow-[0_1px_3px_rgba(15,23,42,0.08)] outline-none transition-[border-color,box-shadow] duration-200 hover:border-slate-300 focus-visible:border-slate-900 disabled:cursor-not-allowed disabled:text-slate-400"
        >
           <span className="min-w-0 break-words [overflow-wrap:anywhere]">{selectedOption?.label ?? placeholder}</span>
          <svg
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {typeof document !== 'undefined' ? createPortal(menu, document.body) : null}
    </>
  )
}
