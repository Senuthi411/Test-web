import { useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  Button,
  Card,
  DataTable,
  DescriptionList,
  KpiCard,
  PageHeader,
  usePageBreadcrumbs,
  useToast,
} from '@/shared/components'
import { formatDate } from '@/shared/utilities/format'
import type { DivisionDetail, DivisionObservation } from '../../../domain/models'
import { QueryBoundary, ReviewStatusBadge, StatusBadge } from '../../components/common'
import { estatePath, useDemoWording, userPath } from '../../components/helpers'
import { DivisionFormModal } from '../../components/OrganisationModals'
import { useDivisionDetail, useEstates } from '../../services/queries'
import styles from '../../components/identity.module.css'
import detailStyles from './EstateDetailPage.module.css'

/** ID-12 Division Detail (Figma 17:364 and the per-division variants). */
export function DivisionDetailPage() {
  const { divisionId = '' } = useParams()
  const query = useDivisionDetail(divisionId)
  usePageBreadcrumbs(
    query.data
      ? [
          { label: 'Administration', to: '/admin' },
          { label: 'Divisions', to: '/admin/divisions' },
          { label: query.data.division.name },
        ]
      : null,
  )
  return (
    <div className={styles.page}>
      <QueryBoundary query={query}>{(detail) => <DivisionDetailView detail={detail} />}</QueryBoundary>
    </div>
  )
}

function DivisionDetailView({ detail }: { detail: DivisionDetail }) {
  const { division } = detail
  const [editing, setEditing] = useState(false)
  const estates = useEstates()
  const toast = useToast()
  const { demo } = useDemoWording()
  const statusText = division.status === 'active' ? 'Active' : 'Disabled'

  return (
    <>
      <PageHeader
        back={{ to: '/admin/divisions', label: 'Back to divisions' }}
        title={division.name}
        subtitle={`${division.id} · ${division.estateName} (${division.estateId}) · ${statusText}`}
        actions={
          <Button icon="edit" onClick={() => setEditing(true)}>
            Edit division
          </Button>
        }
      />
      <div className={styles.kpiRow}>
        <KpiCard label="Observations" value={division.observationCount} caption={demo ? 'Demo fixture total' : 'Total'} icon="clip" tone="success" />
        <KpiCard label="Verified" value={division.verifiedCount} caption="Supervisor verified" icon="check" tone="success" />
        <KpiCard label="Pending review" value={division.pendingReviewCount} caption="In review" icon="clock" tone="warning" />
        <KpiCard
          label="Expert-confirmed cases"
          value={detail.expertConfirmedCaseIds.length}
          caption={detail.expertConfirmedCaseIds.length ? detail.expertConfirmedCaseIds.join(', ') : 'No confirmed cases'}
          icon="flask"
          tone="purple"
        />
      </div>
      <div className={detailStyles.split}>
        <Card
          title="Recent observations"
          action={
            <button
              type="button"
              className={styles.textButton}
              onClick={() =>
                toast.show({
                  tone: 'info',
                  title: 'Review queue is a Supervisor workflow',
                  message: 'Administrators do not review observations. Supervisors open the queue from the Review area.',
                })
              }
            >
              Open review queue
            </button>
          }
        >
          <DataTable<DivisionObservation>
            caption={`Recent observations in ${division.name}`}
            rows={detail.recentObservations}
            rowKey={(observation) => observation.id}
            empty={<p className={styles.caption}>No observations have been captured in this division.</p>}
            columns={[
              { id: 'id', header: 'Observation', cell: (observation) => <span className={styles.idStrong}>{observation.id}</span> },
              { id: 'captured', header: 'Captured', cell: (observation) => formatDate(observation.capturedAt) },
              { id: 'disease', header: 'Suspected disease', cell: (observation) => observation.suspectedDisease },
              { id: 'status', header: 'Review status', cell: (observation) => <ReviewStatusBadge status={observation.reviewStatus} /> },
              { id: 'gps', header: 'GPS accuracy', cell: (observation) => `${observation.gpsAccuracyM} m` },
            ]}
          />
        </Card>
        <Card title="Division profile">
          <DescriptionList
            items={[
              { label: 'Division ID', value: division.id },
              {
                label: 'Estate',
                value: (
                  <Link to={estatePath(division.estateId)} className={styles.link}>
                    {division.estateName}
                  </Link>
                ),
              },
              { label: 'Region', value: detail.region || '—' },
              { label: 'Status', value: <StatusBadge status={division.status} inactiveLabel="Disabled" /> },
              {
                label: 'Field worker',
                value:
                  division.fieldWorkers.length === 0
                    ? '—'
                    : division.fieldWorkers.map((worker, index) => (
                        <span key={worker.id}>
                          {index > 0 && ', '}
                          <Link to={userPath(worker.id)} className={styles.link}>
                            {worker.fullName} ({worker.id})
                          </Link>
                        </span>
                      )),
              },
              {
                label: 'Supervisor',
                value: detail.supervisor ? (
                  <Link to={userPath(detail.supervisor.id)} className={styles.link}>
                    {detail.supervisor.fullName} ({detail.supervisor.id})
                  </Link>
                ) : (
                  '—'
                ),
              },
            ]}
          />
        </Card>
      </div>
      <DivisionFormModal open={editing} estates={estates.data ?? []} division={division} onClose={() => setEditing(false)} />
    </>
  )
}
