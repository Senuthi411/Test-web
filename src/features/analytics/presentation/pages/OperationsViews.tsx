import { useState } from 'react'
import { BarList, Badge, Banner, Button, Card, DataTable, DescriptionList, Modal, type DataTableColumn } from '@/shared/components'
import { Icon } from '@/shared/design-system'
import { useTableSort } from '@/shared/hooks'
import { type AnalyticsSnapshot, type Observation } from '../../domain/models'
import { ageDays, isOpenReviewStatus, selectConfirmed, summarize, topDisease } from '../../domain/selectors'
import { NOT_PROVIDED, freshnessSummary } from '../../domain/freshness'
import { REPORT_FILTER_FORM_ID, type ReportProps } from '../components/AnalyticsPage'
import { Chart } from '../components/Charts'
import { statusColors } from '../components/chartTheme'
import { FilterForm } from '../components/FilterForm'
import { Metrics } from '../components/Metrics'
import { formatDate, formatTime } from '../components/format'
import { useCompactLayout } from '../services/useCompactLayout'
import styles from '../components/analytics.module.css'

function ObservationDetail({ observation, snapshot, onClose }: { observation: Observation | null; snapshot: AnalyticsSnapshot; onClose(): void }) {
  return (
    <Modal open={observation !== null} title={observation?.id ?? ''} onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {observation && (
        <>
          <DescriptionList
            columns={2}
            items={[
              { label: 'Division', value: snapshot.divisions.find((division) => division.id === observation.divisionId)?.name },
              { label: 'Captured', value: formatDate(observation.capturedAt) },
              { label: 'Current review status', value: observation.status },
              { label: 'Suspected disease (field)', value: observation.suspectedDisease },
              ...(observation.diagnosis
                ? [
                    { label: 'Confirmed disease (expert)', value: observation.diagnosis.disease },
                    { label: 'Diagnosis / case', value: `${observation.diagnosis.id} · ${observation.diagnosis.caseId}` },
                  ]
                : []),
            ]}
          />
          <p className={styles.caption}>Read-only analytics snapshot. Evidence and review actions remain in their owning workspaces.</p>
        </>
      )}
    </Modal>
  )
}

/** AN-07 Review Bottlenecks. */
export function BottlenecksView({ snapshot, observations }: ReportProps) {
  const [detail, setDetail] = useState<Observation | null>(null)
  const open = observations.filter((item) => isOpenReviewStatus(item.status))
  const ages = open.map((item) => ageDays(item, snapshot.asOf))
  const average = ages.length ? ages.reduce((sum, age) => sum + age, 0) / ages.length : 0
  const longest = [...open].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)).slice(0, 5)
  const sorted = useTableSort(longest, { captured: (row) => row.capturedAt, waiting: (row) => ageDays(row, snapshot.asOf) })
  const columns: DataTableColumn<Observation>[] = [
    {
      id: 'observation',
      header: 'Observation',
      cell: (row) => (
        <button type="button" className={styles.tableLink} onClick={() => setDetail(row)}>
          {row.id}
        </button>
      ),
    },
    { id: 'division', header: 'Division', cell: (row) => snapshot.divisions.find((division) => division.id === row.divisionId)?.name },
    { id: 'stage', header: 'Stage', cell: (row) => <Badge tone={row.status === 'Submitted' ? 'info' : 'purple'} className={row.status === 'Resubmitted' ? styles.resubmittedStage : undefined}>{row.status}</Badge> },
    { id: 'captured', header: 'Captured', sortable: true, cell: (row) => formatDate(row.capturedAt) },
    { id: 'waiting', header: 'Waiting', sortable: true, align: 'end', cell: (row) => `${ageDays(row, snapshot.asOf)} d` },
  ]
  const statusAge = (['Submitted', 'Resubmitted', 'In review', 'Correction requested', 'Referred', 'Flagged'] as const).map((label) => {
    const rows = observations.filter((item) => item.status === label)
    const value = rows.length ? rows.reduce((sum, item) => sum + ageDays(item, snapshot.asOf), 0) / rows.length : 0
    return { id: label, label, value: Number(value.toFixed(1)), color: statusColors[label] }
  })
  return (
    <>
      <Metrics
        className={styles.bottleneckKpis}
        items={[
          { label: 'Open items', value: open.length, detail: 'Awaiting a decision or next step', icon: 'inbox', tone: 'warning' },
          { label: 'Waiting over 7 days', value: ages.filter((age) => age > 7).length, detail: 'Needs attention', icon: 'clock', tone: 'warning' },
          { label: 'Average age of open items', value: average.toFixed(1), detail: 'Days since capture · submitted + resubmitted + in review', icon: 'chart', tone: 'info' },
          {
            label: 'Pending correction approvals',
            value: observations.filter((item) => item.correctionApprovalPending).length,
            detail: 'Resubmitted, awaiting approval',
            icon: 'alert',
            tone: 'purple',
          },
        ]}
      />
      <div className={`${styles.grid} ${styles.bottleneckGrid}`}>
        <Card title="Average age by current status" className={styles.wideBars}>
          <BarList label="Average age in days by current status" max={20} items={statusAge} />
          <p className={styles.caption}>Average days since capture.</p>
          <div className={styles.detailsBelow}>
            <Banner tone="warning">Age is counted from capture date to {formatDate(snapshot.asOf)} (not time in stage).</Banner>
          </div>
        </Card>
        <Card title="Longest-waiting items">
          <DataTable caption="Longest-waiting observations" rows={sorted.rows} columns={columns} rowKey={(row) => row.id} sort={sorted.sort} onSort={sorted.onSort} empty="No open items." />
        </Card>
      </div>
      <ObservationDetail observation={detail} snapshot={snapshot} onClose={() => setDetail(null)} />
    </>
  )
}

/** AN-08 Reporting Filters. */
export function ReportingFiltersView({ snapshot, observations, filters, setFilters, resetFilters }: ReportProps) {
  const compact = useCompactLayout()
  const divisions = snapshot.divisions.filter((division) => (!filters.estate || division.estateId === filters.estate) && (!filters.division || division.id === filters.division))
  const confirmed = selectConfirmed(snapshot, filters)
  const rows = divisions.map((division) => {
    const own = observations.filter((item) => item.divisionId === division.id)
    return { ...division, ...summarize(own), confirmed: confirmed.filter((item) => item.divisionId === division.id).length, top: topDisease(own, division.topPriority) }
  })
  type Row = (typeof rows)[number]
  const columns: DataTableColumn<Row>[] = [
    {
      id: 'division',
      header: 'Division',
      cell: (row) => (
        <>
          <strong className={styles.nowrap}>{row.name}</strong>
          <small className={styles.muted}>{row.id}</small>
        </>
      ),
    },
    { id: 'estate', header: 'Estate', cell: (row) => <span className={styles.nowrap}>{snapshot.estates.find((estate) => estate.id === row.estateId)?.name}</span> },
    { id: 'total', header: 'Total', align: 'end', cell: (row) => row.total },
    ...filters.statuses.map((status): DataTableColumn<Row> => ({ id: status, header: status === 'Correction requested' ? 'Correction' : status, align: 'end', cell: (row) => row.counts[status] })),
    ...(filters.measure !== 'confirmed' ? [{ id: 'suspected', header: 'Suspected disease', cell: (row: Row) => row.top }] : []),
    ...(filters.measure !== 'suspected' ? [{ id: 'confirmed', header: 'Expert-confirmed', align: 'end' as const, cell: (row: Row) => row.confirmed }] : []),
  ]
  const series =
    filters.measure === 'confirmed'
      ? [{ name: 'Expert-confirmed', color: '#12351f', values: rows.map((row) => row.confirmed) }]
      : [
          { name: 'Observations', color: '#2e7d32', values: rows.map((row) => row.total) },
          ...(filters.measure === 'both' ? [{ name: 'Expert-confirmed', color: '#12351f', values: rows.map((row) => row.confirmed) }] : []),
        ]
  return (
    <div className={`${styles.grid} ${styles.filtersGrid}`}>
      <Card title="Filters">
        <FilterForm formId={REPORT_FILTER_FORM_ID} key={JSON.stringify(filters)} full snapshot={snapshot} initial={filters} onApply={setFilters} onReset={resetFilters} />
      </Card>
      <div className={styles.stack}>
        <div className={styles.chips}>
          <span>Active:</span>
          <div className={styles.chipList} role="region" aria-label="Active reporting filters" tabIndex={0}>
            <span className={styles.chip}>{snapshot.estates.find((estate) => estate.id === filters.estate)?.name || `All my estates (${snapshot.estates.length})`}</span>
            <span className={styles.chip}>{snapshot.divisions.find((division) => division.id === filters.division)?.name || 'All divisions'}</span>
            <span className={styles.chip}>{filters.period === 'custom' ? `${filters.from} – ${filters.to}` : `Last ${filters.period} days`}</span>
            {filters.disease && <span className={styles.chip}>{filters.disease}</span>}
            {filters.statuses.map((status) => (
              <button
                type="button"
                key={status}
                className={styles.chip}
                aria-label={`Hide ${status} column`}
                onClick={() => setFilters({ ...filters, statuses: filters.statuses.filter((item) => item !== status) })}
              >
                {status}
                <Icon name="x" size={12} />
              </button>
            ))}
            <span className={styles.chip}>{filters.measure === 'both' ? 'Both measures' : filters.measure === 'confirmed' ? 'Confirmed (expert)' : 'Suspected (field)'}</span>
          </div>
        </div>
        <Card title="Report preview" className={styles.grow}>
          <p className={styles.help}>{filters.measure === 'confirmed' ? 'Expert diagnoses by confirmation date, by division' : filters.measure === 'both' ? 'Observations by capture date and expert diagnoses by confirmation date, by division' : 'Observations captured, by division'} · selected period · {compact ? 'bar length' : 'y-axis'} = {filters.measure === 'confirmed' ? 'number of diagnoses' : filters.measure === 'both' ? 'count' : 'number of observations'}</p>
          <div className={styles.previewChart}>
            {compact ? (
              <div className={styles.stack}>
                {series.map((item) => (
                  <BarList key={item.name} label={`Report preview by division: ${item.name}`} items={rows.map((row, index) => ({ id: `${item.name}-${row.id}`, label: series.length > 1 ? `${row.name} · ${item.name}` : row.name, value: item.values[index], color: item.color }))} />
                ))}
              </div>
            ) : (
              <Chart title="Report preview by division" labels={rows.map((row) => row.name)} max={10} series={series} />
            )}
          </div>
          <DataTable caption="Report preview by division and current status" columns={columns} rows={rows} rowKey={(row) => row.id} />
          <p className={styles.help}>
            Counts are observations captured in the selected period, grouped by their current review status. Status checkboxes show or hide columns; TOTAL is the sum of all review
            statuses. “Top suspected disease” is field-reported; ties are marked.
            {filters.measure !== 'suspected' && ' Expert-confirmed counts use the confirmation date.'}
          </p>
        </Card>
      </div>
    </div>
  )
}

/** AN-09 Data Freshness Information. */
export function FreshnessView({ snapshot }: ReportProps) {
  // Everything here is derived from the snapshot's dataset metadata, refresh schedule and check time.
  const summary = freshnessSummary(snapshot)
  const demoNote = summary.demo ? ' (simulated demo scenario)' : ''
  const rows = summary.rows
  type Row = (typeof rows)[number]
  const columns: DataTableColumn<Row>[] = [
    { id: 'dataset', header: 'Dataset', cell: (row) => <strong>{row.name}</strong> },
    { id: 'updated', header: 'Last refreshed (UTC+05:30)', cell: (row) => (row.updatedAt ? `${formatDate(row.updatedAt)} · ${formatTime(row.updatedAt)}` : NOT_PROVIDED) },
    { id: 'expected', header: 'Expected', cell: (row) => row.frequency || NOT_PROVIDED },
    { id: 'age', header: `Age (${summary.demo ? 'demo clock' : 'checked'} ${formatTime(summary.reference)})`, cell: (row) => row.ageLabel },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <Badge tone={row.delayed ? 'warning' : 'success'}>{row.delayed ? (summary.demo ? 'Delayed (simulated)' : 'Delayed') : 'Fresh'}</Badge>,
    },
  ]
  return (
    <>
      {summary.warning && (
        <Banner tone="warning">
          {summary.warning}
          {demoNote}
        </Banner>
      )}
      {!summary.hasMetadata && <Banner tone="warning">This snapshot has no dataset freshness metadata, so dataset ages and delays can&apos;t be shown.</Banner>}
      <Metrics
        items={[
          { label: 'Last full refresh', value: formatTime(snapshot.asOf), detail: `${formatDate(snapshot.asOf)} · UTC+05:30`, icon: 'refresh', tone: 'success' },
          {
            label: 'Refresh schedule',
            value: summary.schedule?.frequency || NOT_PROVIDED,
            detail: summary.schedule ? `${summary.schedule.localTime} (${summary.schedule.timezone})` : 'No refresh schedule in this snapshot',
            icon: 'clock',
            tone: 'info',
          },
          {
            label: 'Fresh datasets',
            value: summary.hasMetadata ? `${summary.fresh} of ${summary.total}` : '—',
            detail: summary.hasMetadata ? `${summary.delayed} delayed` : 'No dataset metadata',
            icon: 'check',
            tone: 'warning',
          },
        ]}
      />
      {summary.hasMetadata && (
        <Card>
          <DataTable caption="Dataset freshness information" rows={rows} columns={columns} rowKey={(row) => row.name} />
        </Card>
      )}
      <Card title="How to read this">
        <ul className={styles.explanations}>
          {[
            'Analytics are a snapshot and can lag behind live review and diagnosis activity.',
            'A delayed dataset still shows its last good values with a freshness warning.',
            'Original evidence and review records are unaffected by analytics delays.',
          ].map((text) => (
            <li key={text}>
              <Icon name="info" size={16} />
              {text}
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}
