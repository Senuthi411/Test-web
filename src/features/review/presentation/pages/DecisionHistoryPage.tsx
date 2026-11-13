import { useState } from 'react'
import { Button, Card, DataTable, EmptyState, FilterSelect, PageHeader, Pagination, SearchInput, Tabs, usePageBreadcrumbs } from '@/shared/components'
import { useDebouncedValue } from '@/shared/hooks'
import { paginate } from '@/shared/utilities/pagination'
import { DECISION_OUTCOME_LABEL, DECISION_TYPE_LABEL, type DecisionOutcome, type DecisionType, type ReviewDecision } from '../../domain/models'
import { OutcomeBadge, QueryBoundary } from '../components/badges'
import { formatDate, reviewPaths } from '../components/format'
import { IdLink, Person } from '../components/parts'
import { useReviewExport, useReviewWorkspace } from '../services/queries'
import { useReviewClock } from '../services/useReviewClock'
import styles from '../components/review.module.css'

const PAGE_SIZE = 15
const TYPES: DecisionType[] = ['verification', 'flag', 'correction', 'referral', 'quarantine']
type Tab = 'all' | DecisionType
type DateFilter = '30' | '7' | 'all'
const DAY = 86_400_000

function recordPath(decision: ReviewDecision): string {
  if (decision.type === 'correction') return reviewPaths.correction(decision.recordId)
  if (decision.type === 'referral') return reviewPaths.referrals
  if (decision.type === 'quarantine') return reviewPaths.quarantineItem(decision.targetId)
  return reviewPaths.observation(decision.targetId)
}

const instant = (iso: string) => new Date(iso.includes('T') ? iso : `${iso}T12:00:00+05:30`).getTime()

/** REV-17 Review and Decision History. */
export function DecisionHistoryPage() {
  usePageBreadcrumbs([{ label: 'Review', to: reviewPaths.dashboard }, { label: 'Decision History' }])
  const query = useReviewWorkspace()
  const now = useReviewClock()
  const exportAction = useReviewExport('history')
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [outcome, setOutcome] = useState<'all' | DecisionOutcome>('all')
  const [date, setDate] = useState<DateFilter>('30')
  const [page, setPage] = useState(1)
  const term = useDebouncedValue(search.trim().toLowerCase(), 200)
  const reset = () => {
    setSearch('')
    setOutcome('all')
    setDate('30')
    setPage(1)
  }
  const withReset =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value)
      setPage(1)
    }

  return (
    <QueryBoundary query={query} label="decision history">
      {(workspace) => {
        const decisions = workspace.decisions
        const filtered = decisions.filter(
          (item) =>
            (tab === 'all' || item.type === tab) &&
            (outcome === 'all' || item.outcome === outcome) &&
            (date === 'all' || now.getTime() - instant(item.decidedAt) <= Number(date) * DAY) &&
            (!term || `${item.recordId} ${item.targetId}`.toLowerCase().includes(term)),
        )
        const outcomes = [...new Set(decisions.map((item) => item.outcome))]
        const filtersActive = search !== '' || outcome !== 'all' || date !== '30'
        const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)))
        return (
          <div className={styles.page}>
            <PageHeader
              title="Review and Decision History"
              subtitle="Audit trail of your review, correction, referral and quarantine decisions"
              actions={
                <Button variant="secondary" icon="download" onClick={exportAction.run} loading={exportAction.pending}>
                  Export
                </Button>
              }
            />
            <Tabs<Tab>
              label="Decision type"
              value={tab}
              onChange={withReset(setTab)}
              items={[
                { id: 'all', label: 'All', count: decisions.length },
                ...TYPES.map((type) => ({ id: type, label: DECISION_TYPE_LABEL[type], count: decisions.filter((item) => item.type === type).length })),
              ]}
            />
            <Card>
              <div className={styles.filterBar}>
                <SearchInput label="Search decisions" placeholder="Search by observation or record ID" width={420} value={search} onChange={(event) => withReset(setSearch)(event.target.value)} />
                <FilterSelect<'all' | DecisionOutcome>
                  label="Decision type"
                  value={outcome}
                  onChange={withReset(setOutcome)}
                  options={[{ value: 'all', label: 'All' }, ...outcomes.map((value) => ({ value, label: DECISION_OUTCOME_LABEL[value] }))]}
                />
                <FilterSelect<DateFilter>
                  label="Date"
                  value={date}
                  onChange={withReset(setDate)}
                  options={[
                    { value: '30', label: 'Last 30 days' },
                    { value: '7', label: 'Last 7 days' },
                    { value: 'all', label: 'All dates' },
                  ]}
                />
                <Button variant="ghost" icon="refresh" onClick={reset} disabled={!filtersActive}>
                  Reset filters
                </Button>
              </div>
              <DataTable<ReviewDecision>
                caption="Decision history"
                rows={paginate(filtered, currentPage, PAGE_SIZE)}
                rowKey={(row) => row.id}
                empty={<EmptyState title="No decisions match these filters" message="Change the type tab, search or filters." icon="history" />}
                columns={[
                  { id: 'date', header: 'Date', cell: (row) => formatDate(row.decidedAt) },
                  { id: 'type', header: 'Type', cell: (row) => DECISION_TYPE_LABEL[row.type] },
                  { id: 'record', header: 'Record', cell: (row) => <IdLink to={recordPath(row)}>{row.recordId}</IdLink> },
                  { id: 'target', header: 'Target', cell: (row) => row.targetId },
                  { id: 'decision', header: 'Decision', cell: (row) => <OutcomeBadge outcome={row.outcome} /> },
                  { id: 'by', header: 'Decided by', cell: (row) => <Person name={row.decidedBy.fullName} /> },
                  { id: 'note', header: 'Note', cell: (row) => row.note ?? '—' },
                ]}
              />
              {filtered.length > 0 && <Pagination page={currentPage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} itemLabel="decisions" />}
            </Card>
          </div>
        )
      }}
    </QueryBoundary>
  )
}
