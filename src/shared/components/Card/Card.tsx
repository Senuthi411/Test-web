import type { HTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from '@/shared/design-system'
import { cx } from '@/shared/utilities/classNames'
import styles from './Card.module.css'

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Card title (Heading/Card title). Rendered as an h2 unless `titleLevel` says otherwise. */
  title?: ReactNode
  titleLevel?: 2 | 3
  /** Right-aligned header content, e.g. a "View all" link. */
  action?: ReactNode
  children?: ReactNode
}

export function Card({ title, titleLevel = 2, action, children, className, ...rest }: CardProps) {
  const Heading = titleLevel === 2 ? 'h2' : 'h3'
  return (
    <section {...rest} className={cx(styles.card, className)}>
      {(title || action) && (
        <div className={styles.header}>
          {title && <Heading className={styles.title}>{title}</Heading>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export type KpiTone = 'success' | 'info' | 'warning' | 'purple'

const TONE_CLASS: Record<KpiTone, string | undefined> = {
  success: styles.toneSuccess,
  info: styles.toneInfo,
  warning: styles.toneWarning,
  purple: styles.tonePurple,
}

export interface KpiCardProps {
  label: string
  value: ReactNode
  caption?: ReactNode
  icon: IconName
  tone: KpiTone
}

/** Figma: Card/KPI — label, icon chip, large value and caption. */
export function KpiCard({ label, value, caption, icon, tone }: KpiCardProps) {
  return (
    <section className={cx(styles.card, styles.kpi)} aria-label={label}>
      <div className={styles.kpiTop}>
        <h2 className={styles.kpiLabel}>{label}</h2>
        <span className={cx(styles.kpiChip, TONE_CLASS[tone])}>
          <Icon name={icon} size={20} />
        </span>
      </div>
      <p className={styles.kpiValue}>{value}</p>
      {caption && <p className={styles.kpiCaption}>{caption}</p>}
    </section>
  )
}
