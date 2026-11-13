import { useNavigate, useSearchParams } from 'react-router'
import { Banner, Button, Card, DataTable, EmptyState, PageHeader, Tabs, usePageBreadcrumbs } from '@/shared/components'
import { CORRECTION_STATUSES, CORRECTION_STATUS_LABEL, type Correction, type CorrectionStatus } from '../../domain/models'
import { countBy, isOpenCorrection } from '../../domain/rules'
import { CorrectionStatusBadge, QueryBoundary } from '../components/badges'
import { formatDate, reviewPaths } from '../components/format'
import { IdLink, Person } from '../components/parts'
import { useTableSort } from '../components/useTableSort'
import { useReviewExport, useReviewWorkspace } from '../services/queries'
import { useReviewServices } from '../services/reviewServices'
import styles from '../components/review.module.css'

type Tab = 'open' | CorrectionStatus
const isTab = (value: string | null): value is Tab => value === 'open' || CORRECTION_STATUSES.includes(value as CorrectionStatus)

const LIFECYCLE: Array<{ status: CorrectionStatus; detail: string }> = [
  { status: 'requested', detail: 'Supervisor asks for a correction' },
  { status: 'resubmitted', detail: 'Field worker sends a new revision' },
  { status: 'approved', detail: 'Supervisor accepts the revision' },
  { status: 'applied', detail: 'RevisionApplied · review returns to in_review' },
]

const revisionLabel = (correction: Correction) =>
  correction.status === 'applied'
    ? `${correction.requestedRevision} (applied)`
    : correction.status === 'resubmitted' || correction.status === 'approved'
      ? `${correction.requestedRevision} (pending)`
      : correction.status === 'rejected'
        ? `${correction.requestedRevision} (rejected)`
        : `${correction.requestedRevision} (requested)`

/** REV-07 Correction Queue. */
export function CorrectionQueuePage() {
  usePageBreadcrumbs([{ label: 'Review', to: reviewPaths.dashboard }, { label: 'Correction Queue' }])
  const query = useReviewWorkspace()
  const { demo } = useReviewServices()
  const navigate = useNavigate()
  const exportAction = useReviewExport('corrections')
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('status')
  const tab: Tab = isTab(tabParam) ? tabParam : 'open'

  return (
    <QueryBoundary query={query} label="correction queue">
      {(workspace) => {
        const all = workspace.corrections
        const counts = countBy(all, (item) => item.status, CORRECTION_STATUSES)
        const rows = all.filter((item) => (tab === 'open' ? isOpenCorrection(item.status) : item.status === tab))
        return (
          <div className={styles.page}>
            <PageHeader
              title="Correction Queue"
              subtitle={`Correction requests in your scope (${workspace.estates.map((estate) => estate.id).join(', ')})`}
              actions={
                <Button variant="secondary" icon="download" onClick={exportAction.run} loading={exportAction.pending}>
                  Export
                </Button>
              }
            />
            <Tabs<Tab>
              label="Correction status"
              value={tab}
              onChange={(value) => setParams(value === 'open' ? {} : { status: value }, { replace: true })}
              items={[
                { id: 'open', label: 'Open', count: all.filter((item) => isOpenCorrection(item.status)).length },
                ...CORRECTION_STATUSES.map((status) => ({ id: status, label: CORRECTION_STATUS_LABEL[status], count: counts[status] })),
              ]}
            />
            <div className={styles.withSide}>
              <Card>
                <CorrectionTable rows={rows} onOpen={(row) => navigate(reviewPaths.correction(row.id))} empty={demo ? 'No items in this state (sample data)' : 'No items in this state'} />
              </Card>
              <Card title="Correction lifecycle">
                <p className={styles.caption}>{demo ? 'Demo counts in your scope' : 'Counts in your scope'}</p>
                <ol className={styles.lifecycle}>
                  {LIFECYCLE.map((step, index) => (
                    <li key={step.status}>
                      <span className={styles.stepNumber} aria-hidden="true">
                        {index + 1}
                      </span>
                      <span>
                        <span className={styles.stepTitle}>{CORRECTION_STATUS_LABEL[step.status]}</span>
                        <span className={styles.stepDetail}>{step.detail}</span>
                      </span>
                      <span className={styles.count}>{counts[step.status]}</span>
                    </li>
                  ))}
                </ol>
                <div className={styles.evidenceMeta}>
                  <Banner tone="warning">Approved is not Applied. Only the RevisionApplied event returns the review to in_review.</Banner>
                </div>
              </Card>
            </div>
          </div>
        )
      }}
    </QueryBoundary>
  )
}

function CorrectionTable({ rows, onOpen, empty }: { rows: Correction[]; onOpen: (row: Correction) => void; empty: string }) {
  const table = useTableSort(rows, {
    correction: (row) => row.id,
    observation: (row) => row.observation.id,
    division: (row) => row.observation.division.name,
    requested: (row) => row.requestedAt,
    status: (row) => row.status,
  })
  return (
    <DataTable<Correction>
      caption="Correction requests"
      rows={table.rows}
      rowKey={(row) => row.id}
      sort={table.sort}
      onSort={table.onSort}
      onRowActivate={onOpen}
      rowLabel={(row) => `Open correction ${row.id}`}
      empty={<EmptyState title={empty} message="Choose another correction status." />}
      columns={[
        { id: 'correction', header: 'Correction', sortable: true, cell: (row) => <IdLink to={reviewPaths.correction(row.id)}>{row.id}</IdLink> },
        { id: 'observation', header: 'Observation', sortable: true, cell: (row) => row.observation.id },
        { id: 'division', header: 'Division', sortable: true, cell: (row) => row.observation.division.name },
        { id: 'requestedBy', header: 'Requested by', cell: (row) => <Person name={row.requestedBy.fullName} /> },
        { id: 'requested', header: 'Requested', sortable: true, cell: (row) => formatDate(row.requestedAt) },
        { id: 'status', header: 'Correction status', sortable: true, cell: (row) => <CorrectionStatusBadge status={row.status} /> },
        { id: 'revision', header: 'Revision', cell: revisionLabel },
        {
          id: 'action',
          header: 'Action',
          align: 'end',
          cell: (row) => (
            <IdLink to={reviewPaths.correction(row.id)}>
              <span aria-label={`${row.status === 'resubmitted' ? 'Decide' : 'View'} ${row.id}`}>{row.status === 'resubmitted' ? 'Decide →' : 'View →'}</span>
            </IdLink>
          ),
        },
      ]}
    />
  )
}
