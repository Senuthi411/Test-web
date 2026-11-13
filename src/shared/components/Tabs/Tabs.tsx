import { useId, useRef, type KeyboardEvent } from 'react'
import styles from './Tabs.module.css'

export interface TabItem<T extends string> {
  id: T
  label: string
  /** Optional count shown after the label, e.g. "Flagged 3". */
  count?: number
}

export interface TabsProps<T extends string> {
  items: readonly TabItem<T>[]
  value: T
  onChange: (value: T) => void
  /** Accessible name for the tab list. */
  label: string
  /** id prefix used to link each tab to its panel (`${idBase}-panel-${id}`). */
  idBase?: string
}

/**
 * WAI-ARIA tabs with automatic activation and arrow/Home/End keyboard support.
 * Render the panel with {@link tabPanelProps}.
 */
export function Tabs<T extends string>({ items, value, onChange, label, idBase }: TabsProps<T>) {
  const generated = useId()
  const base = idBase ?? generated
  const refs = useRef(new Map<T, HTMLButtonElement>())

  function focusAndSelect(index: number) {
    const item = items[(index + items.length) % items.length]
    if (!item) return
    onChange(item.id)
    refs.current.get(item.id)?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ArrowRight') focusAndSelect(index + 1)
    else if (event.key === 'ArrowLeft') focusAndSelect(index - 1)
    else if (event.key === 'Home') focusAndSelect(0)
    else if (event.key === 'End') focusAndSelect(items.length - 1)
    else return
    event.preventDefault()
  }

  return (
    <div role="tablist" aria-label={label} className={styles.tabList}>
      {items.map((item, index) => {
        const selected = item.id === value
        return (
          <button
            key={item.id}
            ref={(node) => {
              if (node) refs.current.set(item.id, node)
              else refs.current.delete(item.id)
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`${base}-panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            className={styles.tab}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {item.label}
            {item.count !== undefined && <span className={styles.count}>{item.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
