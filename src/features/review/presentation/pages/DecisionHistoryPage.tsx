import { AssignmentHistorySection } from '@/features/capture'
import { Button, Card, DataTable, EmptyState, PageHeader, usePageBreadcrumbs } from '@/shared/components'
import type { DivisionQuarantine, ReviewObservation } from '../../domain/models'
import { QueryBoundary } from '../components/badges'
import { formatDateTime, reviewPaths } from '../components/format'
import { IdLink } from '../components/parts'
import { useReviewExport, useReviewWorkspace } from '../services/queries'
import styles from '../components/review.module.css'

/**
 * REV-17 Review and Decision History: three tables, each drawn from the live records.
 * Observation History: observations whose process has ended (End Process).
 * Assignment History: completed fieldwork assignments.
 * Quarantine History: every division quarantine, active or released.
 * The decision log and audit records are unchanged; they are kept in the data and on the record pages.
 */
export function DecisionHistoryPage() {
  usePageBreadcrumbs([{ label: 'Review', to: reviewPaths.dashboard }, { label: 'Decision History' }])
  const query = useReviewWorkspace()
  const exportAction = useReviewExport('history')
  return (
    <QueryBoundary query={query} label="decision history">
      {(workspace) => {
        const ended = workspace.observations
          .filter((item) => item.processEndedAt !== null)
          .sort((a, b) => (b.processEndedAt ?? '').localeCompare(a.processEndedAt ?? ''))
        const quarantines = [...workspace.divisionQuarantines].sort((a, b) => b.initiatedAt.localeCompare(a.initiatedAt))
        return (
          <div className={styles.page}>
            <PageHeader
              title="Review and Decision History"
              actions={
                <Button variant="secondary" icon="download" onClick={exportAction.run} loading={exportAction.pending}>
                  Export
                </Button>
              }
            />
            <Card title="Observation History">
              <p className={styles.note}>Process-ended observations.</p>
              <DataTable<ReviewObservation>
                caption="Observation history"
                rows={ended}
                rowKey={(row) => row.id}
                empty={<EmptyState title="No process-ended observations" message="An observation appears here when its process is ended with End Process." icon="history" />}
                columns={[
                  { id: 'id', header: 'Observation ID', cell: (row) => <IdLink to={reviewPaths.observation(row.id)}>{row.id}</IdLink> },
                  { id: 'division', header: 'Division', cell: (row) => row.division.name },
                  { id: 'worker', header: 'Field Worker', cell: (row) => row.fieldWorker.fullName },
                ]}
              />
            </Card>
            <Card title="Assignment History">
              <p className={styles.note}>Completed assignments.</p>
              <AssignmentHistorySection />
            </Card>
            <Card title="Quarantine History">
              <p className={styles.note}>Quarantined and released divisions.</p>
              <DataTable<DivisionQuarantine>
                caption="Quarantine history"
                rows={quarantines}
                rowKey={(row) => row.id}
                empty={<EmptyState title="No division quarantines" message="A division appears here once it is quarantined, and stays after it is released." icon="archive" />}
                columns={[
                  { id: 'id', header: 'Quarantine ID', cell: (row) => <IdLink to={reviewPaths.divisionQuarantine(row.id)}>{row.id}</IdLink> },
                  { id: 'division', header: 'Division', cell: (row) => row.division.name },
                  { id: 'disease', header: 'Disease', cell: (row) => row.disease?.name ?? 'Not recorded' },
                  { id: 'released', header: 'Released At', cell: (row) => (row.release ? formatDateTime(row.release.at) : 'Not released') },
                ]}
              />
            </Card>
          </div>
        )
      }}
    </QueryBoundary>
  )
}
