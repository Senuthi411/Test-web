import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Banner, Button, ButtonLink, Card, DataTable, EmptyState, KpiCard, PageHeader, Timeline, usePageBreadcrumbs, type KpiTone } from '@/shared/components'
import { QUARANTINE_STATE_LABEL, type QuarantineItem, type QuarantineState } from '../../domain/models'
import { QueryBoundary, QuarantineBadge } from '../components/badges'
import { formatDate, formatDateTime, reviewPaths } from '../components/format'
import { Fields, IdLink } from '../components/parts'
import { useReviewWorkspace } from '../services/queries'
import { useReviewServices } from '../services/reviewServices'
import styles from '../components/review.module.css'

const STATES: Array<{ state: QuarantineState; tone: KpiTone }> = [
  { state: 'pending_decision', tone: 'warning' },
  { state: 'released_pending_ingest', tone: 'info' },
  { state: 'ingest_retry_required', tone: 'purple' },
  { state: 'rejected', tone: 'success' },
]

const actionLabel = (state: QuarantineState) => (state === 'pending_decision' ? 'Decide →' : state === 'rejected' ? 'View →' : 'Track →')

/** REV-14 Quarantine Queue. */
export function QuarantineQueuePage() {
  usePageBreadcrumbs([{ label: 'Review', to: reviewPaths.dashboard }, { label: 'Quarantine Queue' }])
  const query = useReviewWorkspace()
  const { demo } = useReviewServices()
  const navigate = useNavigate()
  return (
    <QueryBoundary query={query} label="quarantine queue">
      {(workspace) => (
        <div className={styles.page}>
          <PageHeader
            title="Quarantine Queue"
            subtitle="Offline items held for supervisor decision"
            actions={
              <Button variant="secondary" icon="refresh" onClick={() => void query.refetch()} loading={query.isFetching}>
                Refresh
              </Button>
            }
          />
          {demo && <Banner tone="info">Demonstration data. The list is scoped to your estates ({workspace.estates.map((estate) => estate.id).join(', ')}), as production requires.</Banner>}
          <div className={styles.kpiRow4}>
            {STATES.map(({ state, tone }) => {
              const items = workspace.quarantine.filter((item) => item.state === state)
              return <KpiCard key={state} label={QUARANTINE_STATE_LABEL[state]} value={items.length} icon="archive" tone={tone} caption={items.map((item) => item.id).join(', ') || 'None'} />
            })}
          </div>
          <Card>
            <DataTable<QuarantineItem>
              caption="Quarantined offline items"
              rows={workspace.quarantine}
              rowKey={(row) => row.id}
              onRowActivate={(row) => navigate(reviewPaths.quarantineItem(row.id))}
              rowLabel={(row) => `Open quarantine record ${row.id}`}
              empty={<EmptyState title="No quarantined items in your scope" message="Offline items held for a decision appear here." icon="archive" />}
              columns={[
                { id: 'record', header: 'Record', cell: (row) => <IdLink to={reviewPaths.quarantineItem(row.id)}>{row.id}</IdLink> },
                { id: 'device', header: 'Device observation', cell: (row) => row.deviceObservationId },
                { id: 'estate', header: 'Estate', cell: (row) => `${row.estate.name.replace(' Tea Estate', '')} (${row.estate.id})` },
                { id: 'division', header: 'Division', cell: (row) => row.division.name },
                { id: 'captured', header: 'Captured', cell: (row) => formatDate(row.capturedAt) },
                { id: 'reason', header: 'Reason', cell: (row) => row.reason },
                { id: 'state', header: 'State', cell: (row) => <QuarantineBadge state={row.state} /> },
                { id: 'action', header: 'Action', align: 'end', cell: (row) => <IdLink to={reviewPaths.quarantineItem(row.id)}>{actionLabel(row.state)}</IdLink> },
              ]}
            />
          </Card>
        </div>
      )}
    </QueryBoundary>
  )
}

function QuarantineBoundary({ title, children }: { title: string; children: (item: QuarantineItem, refetch: () => void, refreshing: boolean) => ReactNode }) {
  const { quarantineId = '' } = useParams()
  usePageBreadcrumbs([{ label: 'Review', to: reviewPaths.dashboard }, { label: 'Quarantine Queue', to: reviewPaths.quarantine }, { label: quarantineId, to: reviewPaths.quarantineItem(quarantineId) }, { label: title }])
  const query = useReviewWorkspace()
  return (
    <QueryBoundary query={query} label={title}>
      {(workspace) => {
        const item = workspace.quarantine.find((row) => row.id === quarantineId)
        if (!item) {
          return (
            <EmptyState
              title="Quarantine record unavailable"
              message={`${quarantineId} does not exist or is outside your estate scope.`}
              icon="info"
              action={
                <ButtonLink variant="secondary" to={reviewPaths.quarantine}>
                  Back to quarantine queue
                </ButtonLink>
              }
            />
          )
        }
        return children(item, () => void query.refetch(), query.isFetching)
      }}
    </QueryBoundary>
  )
}

const STATE_PHRASE: Record<QuarantineState, string> = {
  pending_decision: 'pending supervisor decision',
  released_pending_ingest: 'released, waiting for ingest',
  ingest_retry_required: 'ingest retry required',
  rejected: 'rejected',
}

/** REV-15 Quarantine Record. */
export function QuarantineRecordPage() {
  return (
    <QuarantineBoundary title="Quarantine Record">
      {(item, refetch, refreshing) => (
        <div className={styles.page}>
          <PageHeader
            back={{ to: reviewPaths.quarantine, label: 'Back to quarantine queue' }}
            title={`Quarantine Record ${item.id}`}
            subtitle={`${item.estate.name} · ${item.division.name} (${item.division.id}) · ${STATE_PHRASE[item.state]}`}
            actions={
              <>
                {item.state === 'pending_decision' && (
                  <ButtonLink to={`${reviewPaths.quarantineItem(item.id)}/decide`}>Decide</ButtonLink>
                )}
                <Button variant="secondary" icon="refresh" onClick={refetch} loading={refreshing}>
                  Refresh status
                </Button>
              </>
            }
          />
          <div className={styles.split}>
            <Card title="Record">
              <Fields
                items={[
                  { label: 'Quarantine ID', value: item.id },
                  { label: 'Device observation', value: item.deviceObservationId },
                  { label: 'Estate', value: `${item.estate.name.replace(' Tea Estate', '')} (${item.estate.id})` },
                  { label: 'Division', value: `${item.division.name} (${item.division.id})` },
                  { label: 'Captured', value: formatDateTime(item.capturedAt) },
                  { label: 'State', value: <QuarantineBadge state={item.state} /> },
                  { label: 'Reason', value: item.reason },
                  { label: 'Ingest receipt', value: item.ingestReceipt ?? 'None yet' },
                ]}
              />
              {item.state === 'released_pending_ingest' && (
                <div className={styles.evidenceMeta}>
                  <Banner tone="info">Release does not publish the observation immediately. It becomes visible in the review queue only after the ingest receipt arrives.</Banner>
                </div>
              )}
            </Card>
            <div className={styles.stack}>
              <Card title="Recovery tracking">
                <Timeline
                  label="Recovery tracking"
                  items={[
                    { id: 'quarantined', title: 'Quarantined', detail: `${formatDate(item.quarantinedAt)} · ${item.reason.toLowerCase().replace('demo ', '')}`, state: 'done' },
                    ...(item.decision
                      ? [{ id: 'released', title: 'Supervisor released', detail: `${formatDateTime(item.decision.at)} · ${item.decision.id}`, state: 'done' as const }]
                      : [{ id: 'decision', title: item.state === 'rejected' ? 'Rejected' : 'Supervisor decision', detail: item.state === 'rejected' ? 'Decision details are not included in the approved designs' : 'Waiting for a supervisor decision', state: item.state === 'rejected' ? ('done' as const) : ('open' as const) }]),
                    ...(item.state === 'released_pending_ingest' || item.state === 'ingest_retry_required'
                      ? [
                          { id: 'ingest', title: item.state === 'ingest_retry_required' ? 'Ingest retry required' : 'Pending ingest', detail: 'Waiting for the server ingest receipt', state: 'open' as const },
                          { id: 'receipt', title: 'Ingest receipt received', detail: 'Observation created in review queue', state: 'open' as const },
                        ]
                      : []),
                  ]}
                />
              </Card>
              <Card title="Decision">
                {item.decision ? (
                  <Fields
                    items={[
                      { label: 'Decision ID', value: item.decision.id },
                      { label: 'Decision', value: 'Release' },
                      { label: 'Decided by', value: `${item.decision.by.fullName} (${item.decision.by.id})` },
                      { label: 'Decided', value: formatDateTime(item.decision.at) },
                      { label: 'Reason', value: item.decision.reason },
                    ]}
                  />
                ) : (
                  <p className={styles.note}>{item.state === 'pending_decision' ? 'No decision has been recorded yet.' : 'Decision details are not included in the approved designs for this record.'}</p>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}
    </QuarantineBoundary>
  )
}

/**
 * REV-16 Quarantine Decision. The decision frame is not in the approved export, so no
 * release/reject form or rule is invented: the route explains the block and records nothing.
 */
export function QuarantineDecisionPage() {
  return (
    <QuarantineBoundary title="Quarantine Decision">
      {(item) => (
        <div className={styles.page}>
          <PageHeader back={{ to: reviewPaths.quarantineItem(item.id), label: 'Back to quarantine record' }} title="Quarantine Decision" subtitle={`${item.id} · ${item.deviceObservationId}`} />
          <EmptyState
            title="Quarantine decisions are not available yet"
            message="The approved REV-16 decision screen and its release or reject rules were not included in the design export. No decision can be recorded from this build."
            icon="info"
            action={
              <ButtonLink variant="secondary" to={reviewPaths.quarantineItem(item.id)}>
                Back to quarantine record
              </ButtonLink>
            }
          />
        </div>
      )}
    </QuarantineBoundary>
  )
}
