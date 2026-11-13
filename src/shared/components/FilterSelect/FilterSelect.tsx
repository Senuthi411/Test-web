import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
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
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function openMenu(index = selectedIndex) {
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
        <ul id={listId} role="listbox" aria-label={label} className={styles.menu}>
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
