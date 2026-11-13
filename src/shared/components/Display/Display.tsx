import type { ReactNode } from 'react'
import { Icon } from '@/shared/design-system'
import { cx } from '@/shared/utilities/classNames'
import styles from './Display.module.css'

export interface DescriptionItem {
  /** Stable key; defaults to the label. */
  id?: string
  label: string
  value: ReactNode
}

export interface DescriptionListProps {
  items: readonly DescriptionItem[]
  /** Figma "Details grid": one column in side cards, up to three in wide cards. */
  columns?: 1 | 2 | 3
}

/** Figma "Details grid" (kv rows): caption label above a semibold value. */
export function DescriptionList({ items, columns = 1 }: DescriptionListProps) {
  return (
    <dl className={cx(styles.details, columns === 2 && styles.columns2, columns === 3 && styles.columns3)}>
      {items.map((item) => (
        <div key={item.id ?? item.label} className={styles.detail}>
          <dt className={styles.detailLabel}>{item.label}</dt>
          <dd className={styles.detailValue}>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export interface BarListItem {
  id: string
  label: string
  value: number
  /** Bar colour; defaults to the primary green. */
  color?: string
}

export interface BarListProps {
  /** Accessible name of the list, e.g. "Users by role". */
  label: string
  items: readonly BarListItem[]
  /** Value that fills the whole track. Defaults to the largest value. */
  max?: number
}

/** Figma "Bar list": label, proportional track and value (ID-02, ID-09). */
export function BarList({ label, items, max }: BarListProps) {
  const scale = max ?? Math.max(1, ...items.map((item) => item.value))
  return (
    <ul className={styles.bars} aria-label={label}>
      {items.map((item) => (
        <li key={item.id} className={styles.bar}>
          <span className={styles.barLabel}>{item.label}</span>
          <span className={styles.barTrack} aria-hidden="true">
            <span
              className={styles.barFill}
              style={{ width: `${Math.min(100, (item.value / scale) * 100)}%`, background: item.color }}
            />
          </span>
          <span className={styles.barValue}>{item.value}</span>
        </li>
      ))}
    </ul>
  )
}

export interface TimelineItem {
  id: string
  title: ReactNode
  detail?: ReactNode
  /** Completed events show a filled check; the latest open event a ring (ID-02). */
  state?: 'done' | 'open'
}

/** Figma "Timeline": rail with dots, title and caption per event. */
export function Timeline({ items, label }: { items: readonly TimelineItem[]; label: string }) {
  return (
    <ol className={styles.timeline} aria-label={label}>
      {items.map((item, index) => (
        <li key={item.id} className={styles.timelineItem}>
          <span className={styles.rail} aria-hidden="true">
            <span className={cx(styles.dot, item.state === 'open' && styles.dotOpen)}>
              {item.state !== 'open' && <Icon name="check" size={12} />}
            </span>
            {index < items.length - 1 && <span className={styles.line} />}
          </span>
          <span className={styles.timelineText}>
            <span className={styles.timelineTitle}>{item.title}</span>
            {item.detail && <span className={styles.timelineDetail}>{item.detail}</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}
