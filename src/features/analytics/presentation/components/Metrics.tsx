import { Link, type To } from 'react-router'
import { KpiCard, type KpiTone } from '@/shared/components'
import type { IconName } from '@/shared/design-system'
import { cx } from '@/shared/utilities/classNames'
import styles from './analytics.module.css'

export interface Metric {
  label: string
  value: string | number
  detail: string
  icon: IconName
  tone: KpiTone
  /** Makes the KPI card a link to the related report. */
  to?: To
}

/** KPI row built from the shared KpiCard (Figma Card/KPI). */
export function Metrics({ items, className }: { items: Metric[]; className?: string }) {
  return (
    <section className={cx(styles.kpiRow, items.length === 3 && styles.kpiRow3, className)} aria-label="Key performance indicators">
      {items.map(({ label, value, detail, icon, tone, to }) => {
        const card = <KpiCard label={label} value={value} caption={detail} icon={icon} tone={tone} />
        return to ? (
          <Link key={label} to={to} className={styles.kpiLink}>
            {card}
          </Link>
        ) : (
          <div key={label}>{card}</div>
        )
      })}
    </section>
  )
}
