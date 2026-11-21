import type { AnalyticsSnapshot, Filters, Granularity } from '../../domain/models'
import { dateRange } from '../../domain/selectors'
import { MAX_CHART_BUCKETS, MAX_DAILY_DAYS, allowedGranularities, autoGranularity, type TrendPlan } from '../../domain/timeBuckets'
import { FilterSelect } from '@/shared/components'
import styles from './analytics.module.css'

const names: Record<Granularity, string> = { day: 'Daily', week: 'Weekly', month: 'Monthly' }
const plural: Record<Granularity, string> = { day: 'days', week: 'weeks', month: 'months' }

/** Daily / Weekly / Monthly selector for trend charts. The choice is kept in the URL (?granularity=). */
export function TimeGrouping({ snapshot, filters, setFilters }: { snapshot: AnalyticsSnapshot; filters: Filters; setFilters(filters: Filters): void }) {
  const [from, to] = dateRange(filters, snapshot.asOf)
  const allowed = allowedGranularities(from, to)
  const auto = autoGranularity(from, to)
  const value = filters.granularity !== 'auto' && allowed.includes(filters.granularity) ? filters.granularity : 'auto'
  // Shared toolbar dropdown (Figma Filter/Dropdown), as used by the Review queue filters.
  return (
    <div className={styles.timeControl}>
      <FilterSelect<Filters['granularity']>
        label="Group by"
        value={value}
        onChange={(granularity) => setFilters({ ...filters, granularity })}
        options={[{ value: 'auto', label: `Auto (${names[auto].toLowerCase()})` }, ...allowed.map((granularity) => ({ value: granularity, label: names[granularity] }))]}
      />
    </div>
  )
}

/**
 * Explains a grouping fallback (daily limit or bucket limit). When even monthly needs more than MAX_CHART_BUCKETS
 * points it replaces the chart with a message; KPIs, tables and the CSV still cover the full period.
 */
export function TrendNotice({ plan }: { plan: TrendPlan }) {
  if (!plan.chartable) {
    return (
      <p className={styles.tooLong} role="note">
        This range is too long to chart: {plan.count.toLocaleString('en-GB')} months is over the {MAX_CHART_BUCKETS}-point chart limit. The totals and the CSV export
        still cover the full period. Choose a range of {Math.floor(MAX_CHART_BUCKETS / 12)} years or less to see the chart.
      </p>
    )
  }
  if (plan.reason === 'daily-limit') {
    return (
      <p className={styles.notice} role="note">
        Daily view is available for ranges up to {MAX_DAILY_DAYS} days, so this range is shown {names[plan.granularity].toLowerCase()}.
      </p>
    )
  }
  if (plan.reason === 'bucket-limit') {
    return (
      <p className={styles.notice} role="note">
        {names[plan.requested]} view would need {plan.requestedCount.toLocaleString('en-GB')} points (chart limit {MAX_CHART_BUCKETS}), so this range is shown{' '}
        {names[plan.granularity].toLowerCase()} ({plan.count} {plural[plan.granularity]}).
      </p>
    )
  }
  return null
}
