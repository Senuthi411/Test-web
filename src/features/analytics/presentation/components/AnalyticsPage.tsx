import { useState, type ComponentType } from 'react'
import { Banner, Button, Card, EmptyState, ErrorState, Modal, PageHeader, Skeleton, useToast } from '@/shared/components'
import { ANALYTICS_TITLES, type AnalyticsScreen, type AnalyticsSnapshot, type Filters, type Observation } from '../../domain/models'
import { filterError, formatSnapshot, isDefaultFilters, selectConfirmed, selectObservations } from '../../domain/selectors'
import { exportFilename } from '../../application/csv'
import { REPORT_TYPES, buildPageExport } from '../../application/pageExports'
import { downloadCsv } from '../services/download'
import { useAnalyticsSnapshot } from '../services/useAnalyticsSnapshot'
import { useFilters } from '../services/useFilters'
import { FilterForm } from './FilterForm'
import styles from './analytics.module.css'

export interface ReportProps {
  snapshot: AnalyticsSnapshot
  observations: Observation[]
  filters: Filters
  setFilters(filters: Filters, options?: { replace?: boolean }): void
  resetFilters(): void
}

export const REPORT_FILTER_FORM_ID = 'analytics-report-filter-form'

const SUBTITLE_PREFIX: Partial<Record<AnalyticsScreen, string>> = {
  trends: 'Suspected (field) and confirmed (expert) are shown separately · ',
  diseases: 'Suspected disease reported from the field · ',
  filters: 'Choose scope, period and measures · ',
}

/** Screens that render even when the selection has no observations. */
const ALWAYS_RENDERS: ReadonlySet<AnalyticsScreen> = new Set(['filters', 'freshness', 'divisions'])

/**
 * Shared frame of the nine Analytics screens: heading, Filters / Export actions, loading,
 * error, scope and validation states, the active-filter summary and the dialogs. The app
 * shell (sidebar, top bar, role guard) comes from the Test-web layout.
 */
export function AnalyticsPage({ screen, view: View }: { screen: AnalyticsScreen; view: ComponentType<ReportProps> }) {
  const query = useAnalyticsSnapshot()
  const { filters, setFilters, resetFilters } = useFilters()
  const toast = useToast()
  const [dialog, setDialog] = useState<'filters' | 'export' | null>(null)
  const { title, label } = ANALYTICS_TITLES[screen]

  const snapshot = query.data ?? null
  const pending = query.isPending
  const error = query.isError && !snapshot ? query.error : null
  const stale = query.isError && !!snapshot
  const observations = snapshot ? selectObservations(snapshot, filters) : []
  const scopeInvalid =
    !!snapshot &&
    ((!!filters.estate && !snapshot.estates.some((estate) => estate.id === filters.estate)) ||
      (!!filters.division && !snapshot.divisions.some((division) => division.id === filters.division && (!filters.estate || division.estateId === filters.estate))))
  const validation = filterError(filters)
  const showsDiagnoses = screen === 'dashboard' || screen === 'estates' || screen === 'diseases' || screen === 'trends'
  const rendersReport = observations.length > 0 || ALWAYS_RENDERS.has(screen)
    || (showsDiagnoses && !!snapshot && selectConfirmed(snapshot, filters).length > 0)
  const canExport = !!snapshot && !pending && !error && !scopeInvalid && !validation && rendersReport

  function exportCsv() {
    if (!snapshot || !canExport) return
    const file = buildPageExport(screen, snapshot, filters)
    downloadCsv(file.csv, file.filename)
    setDialog(null)
    toast.show({ tone: 'success', title: 'Report downloaded as CSV.' })
  }

  const subtitle = pending
    ? 'Loading report…'
    : error
      ? 'Report unavailable'
      : screen === 'freshness'
        ? 'How current each reporting dataset is'
        : `${SUBTITLE_PREFIX[screen] ?? ''}Data as of ${snapshot ? formatSnapshot(snapshot.asOf) : '—'} (UTC+05:30)${snapshot?.demo ? ' · demo snapshot' : ''}`

  const exportButton = (
    <Button variant="secondary" icon="download" disabled={!canExport} onClick={() => setDialog('export')}>
      Export
    </Button>
  )
  const actions =
    screen === 'filters' ? (
      <>
        <Button variant="secondary" type="reset" form={REPORT_FILTER_FORM_ID} disabled={pending || !!error}>
          Reset
        </Button>
        <Button type="submit" form={REPORT_FILTER_FORM_ID} disabled={pending || !!error}>
          Apply filters
        </Button>
        {exportButton}
      </>
    ) : screen === 'freshness' ? (
      <>
        <Button
          variant="secondary"
          icon="refresh"
          disabled={pending}
          onClick={() => {
            void query.refetch()
            toast.show({ tone: 'info', title: snapshot?.demo ? 'Checking the latest demo snapshot.' : 'Checking the latest snapshot.' })
          }}
        >
          Check again
        </Button>
        {exportButton}
      </>
    ) : (
      <>
        <Button variant="secondary" icon="filter" disabled={pending || !!error} onClick={() => setDialog('filters')} aria-label={isDefaultFilters(filters) ? 'Filters' : 'Filters (active)'}>
          Filters{isDefaultFilters(filters) ? '' : ' •'}
        </Button>
        {exportButton}
      </>
    )

  let body
  if (pending) {
    body = (
      <Card aria-busy="true" aria-label={`Loading ${label}`}>
        <Skeleton height={320} />
      </Card>
    )
  } else if (error) {
    body = (
      <>
        <Banner tone="error">We couldn&apos;t load this report. Your review and evidence records are not affected.</Banner>
        <ErrorState error={error} onRetry={() => void query.refetch()} />
      </>
    )
  } else if (snapshot) {
    body = (
      <>
        {stale && <Banner tone="warning">Showing the last good snapshot. This report may not include recent activity.</Banner>}
        {scopeInvalid || validation ? (
          <>
            <Banner tone="warning">{scopeInvalid ? 'The selected estate or division is outside your reporting scope. Reset the filters to continue.' : validation}</Banner>
            <div>
              <Button variant="secondary" onClick={resetFilters}>
                Reset filters
              </Button>
            </div>
          </>
        ) : (
          <>
            {!isDefaultFilters(filters) && screen !== 'filters' && screen !== 'freshness' && (
              <div className={styles.activeSummary}>
                <span>
                  Filtered report · {snapshot.estates.find((estate) => estate.id === filters.estate)?.name || 'All my estates'} ·{' '}
                  {snapshot.divisions.find((division) => division.id === filters.division)?.name || 'All divisions'} ·{' '}
                  {filters.period === 'custom' ? `${filters.from} – ${filters.to}` : `Last ${filters.period} days`}
                  {filters.disease ? ` · ${filters.disease}` : ''}
                  {filters.query ? ` · Division search: ${filters.query}` : ''}
                </span>
                <Button variant="ghost" onClick={resetFilters}>
                  Clear filters
                </Button>
              </div>
            )}
            {rendersReport ? (
              <View snapshot={snapshot} observations={observations} filters={filters} setFilters={setFilters} resetFilters={resetFilters} />
            ) : (
              <EmptyState
                title="No observations match these filters"
                message="Change the filters or reset them to see the full reporting period."
                action={
                  <div className={styles.buttonRow}>
                    <Button variant="secondary" onClick={resetFilters}>
                      Reset filters
                    </Button>
                    <Button onClick={() => setDialog('filters')}>Change filters</Button>
                  </div>
                }
              />
            )}
          </>
        )}
      </>
    )
  }

  return (
    <div className={styles.page} data-screen={screen}>
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
      {body}
      {snapshot && (
        <Modal open={dialog === 'filters'} title="Reporting filters" onClose={() => setDialog(null)}>
          <FilterForm
            snapshot={snapshot}
            initial={filters}
            onApply={(next) => {
              setFilters(next)
              setDialog(null)
              toast.show({ tone: 'success', title: 'Reporting filters applied.' })
            }}
            onReset={() => {
              resetFilters()
              toast.show({ tone: 'info', title: 'Filters reset.' })
            }}
          />
        </Modal>
      )}
      {snapshot && (
        <Modal
          open={dialog === 'export'}
          title="Export report"
          description={`Export this page (${label}) for the current scope and period. Field-suspected and expert-confirmed measures remain separate.`}
          onClose={() => setDialog(null)}
        >
          <div className={styles.exportOptions}>
            <p className={styles.help}>File: {exportFilename(REPORT_TYPES[screen], snapshot.asOf)}</p>
            <Button icon="download" onClick={exportCsv}>
              Download CSV (Excel compatible)
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setDialog(null)
                setTimeout(() => window.print(), 100)
              }}
            >
              Print / save as PDF
            </Button>
            <p className={styles.help}>
              {snapshot.demo
                ? 'This exports the demo snapshot locally. Server-generated exports and export logs require the reporting API.'
                : 'This exports the loaded snapshot locally.'}
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}
