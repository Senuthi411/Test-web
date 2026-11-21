import { useLocation, useNavigate } from 'react-router'
import { BarList, Banner, Card, DataTable, DescriptionList, type DataTableColumn } from '@/shared/components'
import { ANALYTICS_PATHS, DISEASE_IDS, DISEASES, STATUSES, type Observation } from '../../domain/models'
import { selectConfirmed, summarize } from '../../domain/selectors'
import { bucketRangeLabel, granularityNoun, trendSeries } from '../../domain/timeBuckets'
import type { ReportProps } from '../components/AnalyticsPage'
import { Chart, DiseaseDonut, NavigableCard } from '../components/Charts'
import { diseaseColors, statusColors } from '../components/chartTheme'
import { Metrics } from '../components/Metrics'
import { TimeGrouping, TrendNotice } from '../components/TimeGrouping'
import { useCompactLayout } from '../services/useCompactLayout'
import { formatDate } from '../components/format'
import styles from '../components/analytics.module.css'

const percent = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0)

/** "CASE-011 · CASE-023 · CASE-047", wrapping only between IDs. */
function IdList({ ids }: { ids: readonly string[] }) {
  return (
    <>
      {ids.map((id, index) => (
        <span key={id}>
          {index > 0 && ' · '}
          <span className={styles.nowrap}>{id}</span>
        </span>
      ))}
    </>
  )
}

/** AN-04 Observation Statistics. */
export function ObservationsView({ snapshot, observations, filters, setFilters }: ReportProps) {
  const { search } = useLocation()
  const compact = useCompactLayout()
  const grouping = <TimeGrouping snapshot={snapshot} filters={filters} setFilters={setFilters} />
  const summary = summarize(observations)
  const trend = trendSeries(snapshot, filters)
  const chartTitle = `Observations captured per ${granularityNoun[trend.granularity]}`
  return (
    <>
      <Metrics
        items={[
          { label: 'Total observations', value: summary.total, detail: 'Captured in the selected period', icon: 'leaf', tone: 'success' },
          { label: 'Reviewed', value: summary.reviewed, detail: `${percent(summary.reviewed, summary.total)}% have a review decision`, icon: 'check', tone: 'info' },
          { label: 'Open items', value: summary.open, detail: `${percent(summary.open, summary.total)}% submitted, resubmitted or in review`, icon: 'clock', tone: 'purple' },
          { label: 'Flag rate', value: `${summary.flagRate}%`, detail: `${summary.counts.Flagged} of ${summary.total} flagged`, icon: 'flag', tone: 'warning' },
        ]}
      />
      <div className={`${styles.grid} ${styles.equalGrid}`}>
        <Card title={chartTitle} action={compact ? undefined : grouping}>
          {compact && <div className={styles.groupingRow}>{grouping}</div>}
          <TrendNotice plan={trend.plan} />
          {trend.plan.chartable && (
            <Chart
              title={chartTitle}
              labels={trend.buckets.map((bucket) => bucket.label)}
              dataLabels={trend.buckets.map(bucketRangeLabel)}
              thinLabels
              series={[{ name: 'Observations', color: '#2e7d32', values: trend.buckets.map((bucket) => bucket.suspected) }]}
            />
          )}
        </Card>
        <NavigableCard title="Observations by review status" to={{ pathname: ANALYTICS_PATHS.bottlenecks, search }} label="View Review Bottlenecks" className={styles.wideBars}>
          <BarList label="Observations by review status" items={STATUSES.map((label) => ({ id: label, label, value: summary.counts[label], color: statusColors[label] }))} />
        </NavigableCard>
      </div>
    </>
  )
}

/** AN-05 Disease Distribution. */
export function DiseasesView({ snapshot, observations, filters, setFilters }: ReportProps) {
  const { search } = useLocation()
  const estates = snapshot.estates.filter((estate) => !filters.estate || estate.id === filters.estate)
  const confirmed = selectConfirmed(snapshot, filters)
  const estateOf = (observation: Observation) => snapshot.divisions.find((division) => division.id === observation.divisionId)?.estateId
  const rows = DISEASES.map((name) => ({
    id: DISEASE_IDS[name],
    name,
    suspected: observations.filter((item) => item.suspectedDisease === name).length,
    confirmed: confirmed.filter((item) => item.diagnosis?.disease === name).length,
    byEstate: estates.map((estate) => observations.filter((item) => item.suspectedDisease === name && estateOf(item) === estate.id).length),
  }))
  type Row = (typeof rows)[number]
  const columns: DataTableColumn<Row>[] = [
    {
      id: 'name',
      header: 'Disease',
      cell: (row) => (
        <button
          type="button"
          className={styles.tableLink}
          aria-pressed={filters.disease === row.name}
          onClick={() => setFilters({ ...filters, disease: filters.disease === row.name ? '' : row.name })}
        >
          <span className={styles.nowrap}>{row.name}</span> <span className={styles.nowrap}>({row.id})</span>
        </button>
      ),
    },
    { id: 'suspected', header: 'Suspected', align: 'end', cell: (row) => row.suspected },
    ...estates.map((estate, index): DataTableColumn<Row> => ({ id: estate.id, header: estate.name, align: 'end', cell: (row) => row.byEstate[index] })),
    { id: 'confirmed', header: 'Confirmed', align: 'end', cell: (row) => row.confirmed },
  ]
  return (
    <div className={`${styles.grid} ${styles.diseaseGrid}`}>
      <DiseaseDonut title="Share of suspected disease" to={{ pathname: ANALYTICS_PATHS.trends, search }} navigationLabel="View Suspected vs Confirmed" observations={observations} />
      <div className={styles.stack}>
        <Card>
          <DataTable caption="Suspected and confirmed disease distribution" columns={columns} rows={rows} rowKey={(row) => row.id} />
        </Card>
        <Banner tone="info">Suspected counts come from field reports. Confirmed counts include only expert diagnoses.</Banner>
        <NavigableCard title="Suspected by estate" to={{ pathname: ANALYTICS_PATHS.estates, search }} label="View Estate Overview" className={styles.grow}>
          <Chart
            title="Suspected disease by estate"
            labels={estates.map((estate) => estate.name)}
            max={8}
            series={DISEASES.map((name, index) => ({ name, color: diseaseColors[index], values: rows[index].byEstate }))}
          />
        </NavigableCard>
      </div>
    </div>
  )
}

/** AN-06 Suspected vs Confirmed Disease Trends (route /analytics/suspected-vs-confirmed). */
export function TrendsView({ snapshot, observations, filters, setFilters }: ReportProps) {
  const navigate = useNavigate()
  const { search } = useLocation()
  const compact = useCompactLayout()
  const grouping = <TimeGrouping snapshot={snapshot} filters={filters} setFilters={setFilters} />
  const diseaseReport = { pathname: ANALYTICS_PATHS.diseases, search }
  const trend = trendSeries(snapshot, filters)
  const unit = { day: 'Daily', week: 'Weekly', month: 'Monthly' }[trend.granularity]
  const diagnosed = selectConfirmed(snapshot, filters).sort((a, b) => (a.diagnosis?.confirmedAt ?? '').localeCompare(b.diagnosis?.confirmedAt ?? ''))
  const awaiting = observations.flatMap((item) => (item.awaitingCaseId ? [item.awaitingCaseId] : []))
  const columns: DataTableColumn<Observation>[] = [
    {
      id: 'diagnosis',
      header: 'Diagnosis',
      cell: (row) => (
        <button
          type="button"
          className={styles.tableLink}
          onClick={(event) => {
            event.stopPropagation()
            void navigate(diseaseReport)
          }}
        >
          <span className={styles.nowrap}>{row.diagnosis?.id}</span>
        </button>
      ),
    },
    { id: 'case', header: 'Case', cell: (row) => <span className={styles.nowrap}>{row.diagnosis?.caseId}</span> },
    { id: 'disease', header: 'Disease', cell: (row) => row.diagnosis?.disease },
    { id: 'date', header: 'Date', cell: (row) => <span className={styles.nowrap}>{row.diagnosis ? formatDate(row.diagnosis.confirmedAt) : ''}</span> },
  ]
  return (
    <>
      <Banner tone="warning">Confirmed diagnoses are few because only referred observations receive an expert diagnosis. The two measures are not comparable as rates.</Banner>
      <div className={`${styles.grid} ${styles.trendsGrid}`}>
        <Card title={`${unit} counts`} action={compact ? undefined : grouping}>
          {compact && <div className={styles.groupingRow}>{grouping}</div>}
          <TrendNotice plan={trend.plan} />
          {trend.plan.chartable && (
            <Chart
              title={`Suspected (by capture date) and confirmed (by diagnosis date) ${unit.toLowerCase()} counts`}
              labels={trend.buckets.map((bucket) => bucket.label)}
              dataLabels={trend.buckets.map(bucketRangeLabel)}
              thinLabels
              series={[
                { name: 'Suspected (field)', color: '#9bc79a', values: trend.buckets.map((bucket) => bucket.suspected) },
                { name: 'Confirmed (expert)', color: '#12351f', values: trend.buckets.map((bucket) => bucket.confirmed) },
              ]}
            />
          )}
        </Card>
        <Card title="Confirmed diagnoses">
          <DataTable
            caption="Confirmed expert diagnoses"
            columns={columns}
            rows={diagnosed}
            rowKey={(row) => row.diagnosis?.id ?? row.id}
            onRowActivate={() => void navigate(diseaseReport)}
            rowLabel={(row) => `${row.diagnosis?.id}: open Disease Distribution`}
            empty="No expert diagnoses in this selection."
          />
          <div className={styles.detailsBelow}>
            <DescriptionList
              columns={2}
              items={[
                {
                  label: 'Awaiting diagnosis',
                  value: (
                    <>
                      {awaiting.length}
                      <span className={styles.muted}>{awaiting.length ? <IdList ids={awaiting} /> : 'No linked cases in this selection'}</span>
                    </>
                  ),
                },
                {
                  label: 'Referral not yet linked to a case',
                  value: (
                    <>
                      {snapshot.unlinkedReferrals.length}
                      <span className={styles.muted}>{snapshot.unlinkedReferrals.length ? <IdList ids={snapshot.unlinkedReferrals} /> : 'None in this scope'}</span>
                    </>
                  ),
                },
              ]}
            />
          </div>
        </Card>
      </div>
    </>
  )
}
