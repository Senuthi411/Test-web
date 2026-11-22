import { useLocation, useNavigate } from 'react-router'
import { BarList, Banner, Button, Card, DataTable, FilterSelect, SearchInput, type DataTableColumn } from '@/shared/components'
import { useTableSort } from '@/shared/hooks'
import { ANALYTICS_PATHS, type Estate, type Filters, type Observation } from '../../domain/models'
import { formatSnapshot, isDefaultFilters, selectConfirmed, summarize, topDisease, writeFilters } from '../../domain/selectors'
import { bucketRangeLabel, granularityNoun, trendSeries } from '../../domain/timeBuckets'
import type { ReportProps } from '../components/AnalyticsPage'
import { Chart, DiseaseDonut, NavigableCard } from '../components/Charts'
import { PERIOD_OPTIONS } from '../components/chartTheme'
import { Metrics } from '../components/Metrics'
import { TimeGrouping, TrendNotice } from '../components/TimeGrouping'
import { useCompactLayout } from '../services/useCompactLayout'
import styles from '../components/analytics.module.css'

/** AN-01 Analytics Dashboard. */
export function DashboardView({ snapshot, observations, filters, setFilters }: ReportProps) {
  const { search } = useLocation()
  const compact = useCompactLayout()
  const grouping = <TimeGrouping snapshot={snapshot} filters={filters} setFilters={setFilters} />
  const summary = summarize(observations)
  const confirmed = selectConfirmed(snapshot, filters)
  const trend = trendSeries(snapshot, filters)
  const chartTitle = `Observations captured per ${granularityNoun[trend.granularity]}`
  const estateCount = new Set(observations.map((item) => snapshot.divisions.find((division) => division.id === item.divisionId)?.estateId)).size
  return (
    <>
      <Banner tone="info">Figures reflect the latest analytics snapshot and can lag behind live review activity. Last refreshed {formatSnapshot(snapshot.asOf)}.</Banner>
      <Metrics
        items={[
          { label: 'Total observations', value: summary.total, detail: `Your estates · ${estateCount}`, icon: 'leaf', tone: 'success', to: { pathname: ANALYTICS_PATHS.observations, search } },
          { label: 'Verified', value: summary.verified, detail: `${summary.verificationRate}% of observations`, icon: 'check', tone: 'info', to: { pathname: ANALYTICS_PATHS.observations, search } },
          {
            label: 'Awaiting review',
            value: summary.open,
            detail: `Submitted ${summary.counts.Submitted} · Resubmitted ${summary.counts.Resubmitted} · In review ${summary.counts['In review']}`,
            icon: 'clock',
            tone: 'warning',
            to: { pathname: ANALYTICS_PATHS.bottlenecks, search },
          },
          {
            label: 'Confirmed diagnoses',
            value: confirmed.length,
            detail: filters.disease ? `Expert-confirmed as ${filters.disease}` : `From ${summary.counts.Referred} expert referrals`,
            icon: 'flask',
            tone: 'purple',
            to: { pathname: ANALYTICS_PATHS.trends, search },
          },
        ]}
      />
      <div className={`${styles.grid} ${styles.dashboardGrid}`}>
        <NavigableCard
          title={chartTitle}
          to={{ pathname: ANALYTICS_PATHS.observations, search }}
          label="View Observation Statistics"
          action={compact ? undefined : grouping}
        >
          {compact && <div className={styles.groupingRow}>{grouping}</div>}
          <TrendNotice plan={trend.plan} />
          {trend.plan.chartable && (
            <Chart
              title={chartTitle}
              labels={trend.buckets.map((bucket) => bucket.label)}
              dataLabels={trend.buckets.map(bucketRangeLabel)}
              thinLabels
              series={[{ name: 'Observations', color: '#2e7d32', values: trend.buckets.map((bucket) => bucket.suspected) }]}
              line
              area
            />
          )}
        </NavigableCard>
        <DiseaseDonut to={{ pathname: ANALYTICS_PATHS.diseases, search }} observations={observations} />
      </div>
    </>
  )
}

/** AN-02 Estate Overview. */
export function EstatesView({ snapshot, observations, filters }: ReportProps) {
  const navigate = useNavigate()
  const { search } = useLocation()
  const estates = snapshot.estates.filter((estate) => !filters.estate || estate.id === filters.estate)
  const confirmedRows = selectConfirmed(snapshot, filters)
  const inEstate = (observation: Observation, estate: Estate) => snapshot.divisions.find((division) => division.id === observation.divisionId)?.estateId === estate.id
  const rows = estates.map((estate) => ({
    ...estate,
    ...summarize(observations.filter((item) => inEstate(item, estate))),
    confirmed: confirmedRows.filter((item) => inEstate(item, estate)).length,
    isTotal: false,
  }))
  type Row = (typeof rows)[number]
  const sorted = useTableSort<Row>(rows, { estate: (row) => row.name, total: (row) => row.total, verified: (row) => row.verified, open: (row) => row.open })
  const total = summarize(observations)
  const totalRow: Row = { id: 'total', name: 'Total', ...total, confirmed: confirmedRows.length, isTotal: true }
  const openDivisions = (row: Row) =>
    navigate({ pathname: ANALYTICS_PATHS.divisions, search: writeFilters(new URLSearchParams(search), { ...filters, estate: row.id, division: '' }).toString() })
  const columns: DataTableColumn<Row>[] = [
    {
      id: 'estate',
      header: 'Estate',
      sortable: true,
      cell: (row) =>
        row.isTotal ? (
          <strong>Total</strong>
        ) : (
          <button type="button" className={styles.tableLink} onClick={() => openDivisions(row)}>
            <span className={styles.nowrap}>{row.name}</span> <span className={styles.nowrap}>({row.id})</span>
          </button>
        ),
    },
    { id: 'total', header: 'Observations', sortable: true, align: 'end', cell: (row) => row.total },
    { id: 'verified', header: 'Verified', sortable: true, align: 'end', cell: (row) => row.verified },
    { id: 'open', header: 'Open', sortable: true, align: 'end', cell: (row) => row.open },
    { id: 'resubmitted', header: 'Resubmitted', align: 'end', cell: (row) => row.counts.Resubmitted },
    { id: 'flagged', header: 'Flagged', align: 'end', cell: (row) => row.counts.Flagged },
    { id: 'correction', header: 'Correction req.', align: 'end', cell: (row) => row.counts['Correction requested'] },
    { id: 'referred', header: 'Referred', align: 'end', cell: (row) => row.counts.Referred },
    { id: 'confirmed', header: 'Confirmed', align: 'end', cell: (row) => row.confirmed },
    { id: 'rate', header: 'Verified %', align: 'end', cell: (row) => `${row.verificationRate}%` },
  ]
  return (
    <>
      <Card>
        <DataTable caption="Estate overview" columns={columns} rows={[...sorted.rows, totalRow]} rowKey={(row) => row.id} sort={sorted.sort} onSort={sorted.onSort} />
      </Card>
      <div className={`${styles.grid} ${styles.equalGrid}`}>
        <NavigableCard title="Review outcomes by estate" to={{ pathname: ANALYTICS_PATHS.divisions, search }} label="View Division Overview">
          <Chart
            title="Review outcomes by estate"
            labels={rows.map((row) => row.name)}
            max={10}
            series={[
              { name: 'Verified', color: '#2e7d32', values: rows.map((row) => row.verified) },
              { name: 'Open', color: '#4a86d1', values: rows.map((row) => row.open) },
              { name: 'Flagged', color: '#e04f4f', values: rows.map((row) => row.counts.Flagged) },
            ]}
          />
        </NavigableCard>
        <Card title="Verification rate" className={styles.wideBars}>
          <BarList label="Verification rate by estate (percent)" max={50} items={rows.map((row) => ({ id: row.id, label: row.name, value: row.verificationRate, color: '#2e7d32' }))} />
          <p className={styles.caption}>Rate (%) = verified ÷ all observations in the estate. Open items are not yet decided.</p>
        </Card>
      </div>
    </>
  )
}

/** AN-03 Division Overview. */
export function DivisionsView({ snapshot, observations, filters, setFilters, resetFilters }: ReportProps) {
  const navigate = useNavigate()
  const compact = useCompactLayout()
  const { search } = useLocation()
  const query = filters.query
  const divisions = snapshot.divisions.filter(
    (division) =>
      (!filters.estate || division.estateId === filters.estate) &&
      (!filters.division || division.id === filters.division) &&
      `${division.name} ${division.id}`.toLowerCase().includes(query.toLowerCase()),
  )
  const rows = divisions.map((division) => {
    const own = observations.filter((item) => item.divisionId === division.id)
    return { ...division, ...summarize(own), top: topDisease(own, division.topPriority) }
  })
  type Row = (typeof rows)[number]
  const sorted = useTableSort<Row>(rows, { division: (row) => row.name, total: (row) => row.total, open: (row) => row.open })
  const openFilters = (row: Row) =>
    navigate({ pathname: ANALYTICS_PATHS.filters, search: writeFilters(new URLSearchParams(search), { ...filters, estate: row.estateId, division: row.id }).toString() })
  const columns: DataTableColumn<Row>[] = [
    {
      id: 'division',
      header: 'Division',
      sortable: true,
      cell: (row) => (
        <button
          type="button"
          className={styles.tableLink}
          onClick={(event) => {
            event.stopPropagation()
            openFilters(row)
          }}
        >
          <span className={styles.nowrap}>{row.name}</span> <span className={styles.nowrap}>({row.id})</span>
        </button>
      ),
    },
    { id: 'estate', header: 'Estate', cell: (row) => <span className={styles.nowrap}>{snapshot.estates.find((estate) => estate.id === row.estateId)?.name}</span> },
    { id: 'total', header: 'Observations', sortable: true, align: 'end', cell: (row) => row.total },
    { id: 'open', header: 'Open', sortable: true, align: 'end', cell: (row) => row.open },
    { id: 'verified', header: 'Verified', align: 'end', cell: (row) => row.verified },
    { id: 'flagged', header: 'Flagged', align: 'end', cell: (row) => row.counts.Flagged },
    { id: 'top', header: 'Top suspected disease', cell: (row) => row.top },
  ]
  return (
    <>
      {/* Same toolbar as the Review queue: shared SearchInput, FilterSelect and ghost reset button. */}
      <div className={styles.filterBar}>
        <SearchInput
          label="Search divisions"
          placeholder="Search by division name or ID"
          width={360}
          value={query}
          onChange={(event) => setFilters({ ...filters, query: event.target.value }, { replace: !!filters.query })}
        />
        <FilterSelect
          label="Estate"
          value={filters.estate}
          onChange={(estate) => setFilters({ ...filters, estate, division: '' })}
          options={[{ value: '', label: 'All' }, ...snapshot.estates.map((estate) => ({ value: estate.id, label: estate.name }))]}
        />
        <FilterSelect<Filters['period']>
          label="Period"
          value={filters.period}
          onChange={(period) => setFilters({ ...filters, period })}
          options={PERIOD_OPTIONS.filter((option) => option.value !== 'custom' || filters.period === 'custom').map((option) => ({ value: option.value as Filters['period'], label: option.label }))}
        />
        <Button variant="ghost" icon="refresh" onClick={resetFilters} disabled={isDefaultFilters(filters)}>
          Reset filters
        </Button>
      </div>
      <NavigableCard title="Observations by division" to={{ pathname: ANALYTICS_PATHS.observations, search }} label="View Observation Statistics">
        {compact ? (
          <BarList label="Observations by division" items={rows.map((row) => ({ id: row.id, label: row.name, value: row.total, color: '#2e7d32' }))} />
        ) : (
          <Chart title="Observations by division" labels={rows.map((row) => row.name)} max={12} wide series={[{ name: 'Observations', color: '#2e7d32', values: rows.map((row) => row.total) }]} />
        )}
      </NavigableCard>
      <Card>
        <DataTable
          caption="Division observation summaries"
          columns={columns}
          rows={sorted.rows}
          rowKey={(row) => row.id}
          sort={sorted.sort}
          onSort={sorted.onSort}
          onRowActivate={openFilters}
          rowLabel={(row) => `Open ${row.name} in Reporting Filters`}
          empty={`No divisions match “${query}”.`}
        />
      </Card>
    </>
  )
}
