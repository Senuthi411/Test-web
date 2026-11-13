import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  ActionMenu,
  Button,
  Card,
  DataTable,
  EmptyState,
  FilterSelect,
  PageHeader,
  Pagination,
  SearchInput,
  Tabs,
  usePageBreadcrumbs,
} from '@/shared/components'
import { useDebouncedValue } from '@/shared/hooks'
import { paginate } from '@/shared/utilities/pagination'
import { REVIEW_STATUSES, REVIEW_STATUS_LABEL, type ReviewObservation, type ReviewStatus } from '../../domain/models'
import { countBy } from '../../domain/rules'
import { QueryBoundary, ReviewStatusBadge } from '../components/badges'
import { formatDate, reviewPaths } from '../components/format'
import { IdLink, Person } from '../components/parts'
import { useTableSort } from '../components/useTableSort'
import { useReviewExport, useReviewWorkspace } from '../services/queries'
import { useReviewServices } from '../services/reviewServices'
import { useReviewClock } from '../services/useReviewClock'
import styles from '../components/review.module.css'

const PAGE_SIZE = 15
type Tab = 'all' | ReviewStatus
type CapturedFilter = '30' | '7' | 'all'
const DAY = 86_400_000

const isTab = (value: string | null): value is Tab => value === 'all' || REVIEW_STATUSES.includes(value as ReviewStatus)

/** REV-02 Observation Review Queue. */
export function ReviewQueuePage() {
  usePageBreadcrumbs([{ label: 'Review', to: reviewPaths.dashboard }, { label: 'Review Queue' }])
  const query = useReviewWorkspace()
  return (
    <QueryBoundary query={query} label="review queue">
      {(workspace) => <Queue observations={workspace.observations} estateIds={workspace.estates.map((estate) => estate.id)} divisions={workspace.divisions} />}
    </QueryBoundary>
  )
}

function Queue({ observations, estateIds, divisions }: { observations: ReviewObservation[]; estateIds: string[]; divisions: Array<{ id: string; name: string }> }) {
  const { demo } = useReviewServices()
  const now = useReviewClock()
  const navigate = useNavigate()
  const exportAction = useReviewExport('queue')
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('status')
  const tab: Tab = isTab(statusParam) ? statusParam : 'all'
  const [search, setSearch] = useState('')
  const [division, setDivision] = useState('all')
  const [disease, setDisease] = useState('all')
  const [captured, setCaptured] = useState<CapturedFilter>('30')
  const [page, setPage] = useState(1)
  const term = useDebouncedValue(search.trim().toLowerCase(), 200)

  const counts = countBy(observations, (item) => item.reviewStatus, REVIEW_STATUSES)
  const diseases = [...new Map(observations.map((item) => [item.suspectedDisease.id, item.suspectedDisease.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]))
  const filtered = observations.filter(
    (item) =>
      (tab === 'all' || item.reviewStatus === tab) &&
      (division === 'all' || item.division.id === division) &&
      (disease === 'all' || item.suspectedDisease.id === disease) &&
      (captured === 'all' || now.getTime() - new Date(item.capturedAt).getTime() <= Number(captured) * DAY) &&
      (!term || `${item.id} ${item.fieldWorker.fullName}`.toLowerCase().includes(term)),
  )
  const table = useTableSort(filtered, {
    observation: (row) => row.id,
    division: (row) => row.division.name,
    disease: (row) => row.suspectedDisease.name,
    captured: (row) => row.capturedAt,
    worker: (row) => row.fieldWorker.fullName,
    status: (row) => REVIEW_STATUS_LABEL[row.reviewStatus],
  })
  const filtersActive = search !== '' || division !== 'all' || disease !== 'all' || captured !== '30'
  const pageCountMax = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCountMax)

  const changeTab = (value: Tab) => {
    setPage(1)
    setParams(value === 'all' ? {} : { status: value }, { replace: true })
  }
  const withReset =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value)
      setPage(1)
    }
  function reset() {
    setSearch('')
    setDivision('all')
    setDisease('all')
    setCaptured('30')
    setPage(1)
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Observation Review Queue"
        subtitle={`${observations.length} observations in ${estateIds.join(', ')}${demo ? ' · demo data' : ''}`}
        actions={
          <Button variant="secondary" icon="download" onClick={exportAction.run} loading={exportAction.pending}>
            Export
          </Button>
        }
      />
      <Tabs<Tab>
        label="Review status"
        value={tab}
        onChange={changeTab}
        items={[{ id: 'all', label: 'All', count: observations.length }, ...REVIEW_STATUSES.map((status) => ({ id: status, label: REVIEW_STATUS_LABEL[status], count: counts[status] }))]}
      />
      <Card>
        <div className={styles.filterBar}>
          <SearchInput label="Search observations" placeholder="Search by observation ID or field worker" width={420} value={search} onChange={(event) => withReset(setSearch)(event.target.value)} />
          <FilterSelect label="Division" value={division} onChange={withReset(setDivision)} options={[{ value: 'all', label: 'All' }, ...divisions.map((item) => ({ value: item.id, label: item.name }))]} />
          <FilterSelect label="Disease" value={disease} onChange={withReset(setDisease)} options={[{ value: 'all', label: 'All' }, ...diseases.map(([id, name]) => ({ value: id, label: name }))]} />
          <FilterSelect<CapturedFilter>
            label="Captured"
            value={captured}
            onChange={withReset(setCaptured)}
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
        <DataTable<ReviewObservation>
          caption="Observations awaiting or completed review"
          rows={paginate(table.rows, currentPage, PAGE_SIZE)}
          rowKey={(row) => row.id}
          sort={table.sort}
          onSort={(id) => {
            table.onSort(id)
            setPage(1)
          }}
          onRowActivate={(row) => navigate(reviewPaths.observation(row.id))}
          rowLabel={(row) => `Open review for ${row.id}`}
          empty={<EmptyState title="No observations match these filters" message="Change the status tab, search or filters to see more observations." />}
          columns={[
            { id: 'observation', header: 'Observation', sortable: true, cell: (row) => <IdLink to={reviewPaths.observation(row.id)}>{row.id}</IdLink> },
            { id: 'division', header: 'Division', sortable: true, cell: (row) => row.division.name },
            { id: 'disease', header: 'Suspected disease', sortable: true, cell: (row) => row.suspectedDisease.name },
            { id: 'captured', header: 'Captured', sortable: true, cell: (row) => formatDate(row.capturedAt) },
            { id: 'worker', header: 'Field worker', sortable: true, cell: (row) => <Person name={row.fieldWorker.fullName} /> },
            { id: 'status', header: 'Review status', sortable: true, cell: (row) => <ReviewStatusBadge status={row.reviewStatus} /> },
            {
              id: 'actions',
              header: 'Actions',
              align: 'end',
              width: '56px',
              cell: (row) => (
                <ActionMenu
                  label={`Actions for ${row.id}`}
                  items={[
                    { id: 'review', label: 'Open review', icon: 'eye', to: reviewPaths.observation(row.id) },
                    { id: 'evidence', label: 'Open evidence viewer', icon: 'image', to: reviewPaths.evidence(row.id) },
                  ]}
                />
              ),
            },
          ]}
        />
        {filtered.length > 0 && <Pagination page={currentPage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} itemLabel="observations" />}
      </Card>
    </div>
  )
}
