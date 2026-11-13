import { useEffect, useId, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react'
import { useNavigate } from 'react-router'
import { Icon, type IconName } from '@/shared/design-system'
import { cx } from '@/shared/utilities/classNames'
import styles from './ActionMenu.module.css'

export interface ActionMenuItem {
  id: string
  label: string
  icon?: IconName
  /** Navigates to this path when chosen. */
  to?: string
  onSelect?: () => void
  danger?: boolean
  disabled?: boolean
}

export interface ActionMenuProps {
  /** Accessible name of the trigger, e.g. "Actions for Hiruni Nadeesha". */
  label: string
  items: readonly ActionMenuItem[]
}

const stop = (event: SyntheticEvent) => event.stopPropagation()

/**
 * The "more" (⋯) control at the end of a table row. A WAI-ARIA menu button: Enter,
 * Space or ArrowDown open it, arrows move between items, Escape closes and returns
 * focus. Clicks never reach the row, so opening the menu does not open the record.
 */
export function ActionMenu({ label, items }: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const menuId = useId()
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    itemRefs.current.find((item) => item && !item.disabled)?.focus()
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function close(returnFocus: boolean) {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }

  function choose(item: ActionMenuItem) {
    close(false)
    if (item.to) navigate(item.to)
    item.onSelect?.()
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    event.stopPropagation()
    const enabled = itemRefs.current.filter((item): item is HTMLButtonElement => Boolean(item && !item.disabled))
    const index = enabled.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'Escape') {
      event.preventDefault()
      close(true)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      enabled[(index + 1) % enabled.length]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      enabled[(index - 1 + enabled.length) % enabled.length]?.focus()
    } else if (event.key === 'Tab') {
      close(false)
    }
  }

  return (
    <div ref={rootRef} className={styles.root} onClick={stop} onKeyDown={stop}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <Icon name="more" size={18} />
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label={label} className={styles.menu} onKeyDown={onMenuKeyDown}>
          {items.map((item, index) => (
            <button
              key={item.id}
              ref={(node) => {
                itemRefs.current[index] = node
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={item.disabled}
              className={cx(styles.item, item.danger && styles.danger)}
              onClick={() => choose(item)}
            >
              {item.icon && <Icon name={item.icon} size={16} />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
