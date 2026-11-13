import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Icon } from '@/shared/design-system'
import styles from './FilterSelect.module.css'

export interface FilterOption<Value extends string = string> {
  value: Value
  label: string
}

export interface FilterSelectProps<Value extends string> {
  /** Shown before the value, e.g. "Estate" → "Estate: All estates". */
  label: string
  value: Value
  options: readonly FilterOption<Value>[]
  onChange: (value: Value) => void
  disabled?: boolean
}

/**
 * Toolbar filter dropdown (Figma Filter/Dropdown). Implements the ARIA
 * "select-only combobox" pattern: Enter/Space/Arrow keys open it, arrows move the
 * active option, Enter selects, Escape closes and returns focus to the trigger.
 */
export function FilterSelect<Value extends string>({ label, value, options, onChange, disabled }: FilterSelectProps<Value>) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState<CSSProperties>({})
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listId = useId()
  const optionId = (index: number) => `${listId}-option-${index}`
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )
  const selected = options[selectedIndex]

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    const closeOnMove = (event: Event) => { if (!(event.target instanceof Node) || !rootRef.current?.contains(event.target)) setOpen(false) }
    window.addEventListener('resize', closeOnMove)
    document.addEventListener('scroll', closeOnMove, true)
    return () => { document.removeEventListener('pointerdown', onPointerDown); window.removeEventListener('resize', closeOnMove); document.removeEventListener('scroll', closeOnMove, true) }
  }, [open])

  useEffect(() => {
    if (open) document.getElementById(`${listId}-option-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [open, activeIndex, listId])

  function openMenu(index = selectedIndex) {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) {
      const width = Math.min(Math.max(rect.width, 240), window.innerWidth - 32)
      const below = window.innerHeight - rect.bottom - 16
      const above = rect.top - 16
      const upwards = below < 160 && above > below
      setPosition({ position: 'fixed', width, minWidth: 0, left: Math.max(16, Math.min(rect.left, window.innerWidth - width - 16)), ...(upwards ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }), maxHeight: Math.max(80, Math.min(320, upwards ? above : below)) })
    }
    setActiveIndex(index)
    setOpen(true)
  }

  function choose(index: number) {
    const option = options[index]
    if (option) onChange(option.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault()
        openMenu()
      }
      return
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActiveIndex((index) => Math.min(options.length - 1, index + 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActiveIndex((index) => Math.max(0, index - 1))
        break
      case 'Home':
        event.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        event.preventDefault()
        setActiveIndex(options.length - 1)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        choose(activeIndex)
        break
      case 'Escape':
        event.preventDefault()
        setOpen(false)
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? optionId(activeIndex) : undefined}
        aria-label={`${label}: ${selected?.label ?? ''}`}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className={styles.triggerLabel}>{label}:</span>
        <span>{selected?.label}</span>
        <Icon name="down" size={14} />
      </button>
      {open && (
        <ul id={listId} role="listbox" aria-label={label} className={styles.menu} style={position}>
          {options.map((option, index) => (
            <li
              key={option.value}
              id={optionId(index)}
              role="option"
              aria-selected={option.value === value}
              data-active={index === activeIndex}
              className={styles.option}
              onPointerEnter={() => setActiveIndex(index)}
              onClick={() => choose(index)}
            >
              {option.label}
              {option.value === value && (
                <span className={styles.optionCheck}>
                  <Icon name="check" size={14} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
