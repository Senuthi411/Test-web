import type { ReactNode } from 'react'
import { cx } from '@/shared/utilities/classNames'
import styles from './Badge.module.css'

/**
 * Tones from Badge/Status. Design rule (368:2128): Verified/Active/Assigned use success;
 * Flagged/Pending/Awaiting use warning; Suspected disease is warning, Confirmed is success.
 */
export type BadgeTone = 'success' | 'warning' | 'info' | 'purple' | 'neutral' | 'danger' | 'lime'

export interface BadgeProps {
  tone: BadgeTone
  children: ReactNode
  /** The designs show a leading dot on status badges. */
  dot?: boolean
  className?: string
}

export function Badge({ tone, children, dot = true, className }: BadgeProps) {
  return (
    <span className={cx(styles.badge, styles[tone], className)}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  )
}
