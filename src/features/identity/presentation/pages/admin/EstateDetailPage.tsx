import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  Avatar,
  Button,
  Card,
  DataTable,
  KpiCard,
  PageHeader,
  Tabs,
  Timeline,
  tabPanelProps,
  usePageBreadcrumbs,
} from '@/shared/components'
import { ROLE_LABELS } from '@/shared/types'
import { cx } from '@/shared/utilities/classNames'
import type { DivisionSummary, EstateDetail } from '../../../domain/models'
import { QueryBoundary, StatusBadge } from '../../components/common'
import { activityLink, divisionPath, useDemoWording, useRelativeTime, userPath } from '../../components/helpers'
import { DivisionFormModal, EstateFormModal } from '../../components/OrganisationModals'
import { useEstateDetail, useEstates } from '../../services/queries'
import styles from '../../components/identity.module.css'
import detailStyles from './EstateDetailPage.module.css'

type TabId = 'overview' | 'divisions' | 'team' | 'activity'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'divisions', label: 'Divisions' },
  { id: 'team', label: 'Team' },
  { id: 'activity', label: 'Activity' },
] as const

/** ID-10 Estate Detail (Figma 16:865 and the EST-001 / EST-003 variants). */
export function EstateDetailPage() {
  const { estateId = '' } = useParams()
  const query = useEstateDetail(estateId)
  usePageBreadcrumbs(
    query.data
      ? [
          { label: 'Administration', to: '/admin' },
          { label: 'Estates', to: '/admin/estates' },
          { label: query.data.estate.name },
        ]
      : null,
  )
  return (
    <div className={styles.page}>
      <QueryBoundary query={query}>{(detail) => <EstateDetailView detail={detail} />}</QueryBoundary>
    </div>
  )
}

function EstateDetailView({ detail }: { detail: EstateDetail }) {
  const { estate } = detail
  const [tab, setTab] = useState<TabId>('overview')
  const [editing, setEditing] = useState(false)
  const [addingDivision, setAddingDivision] = useState(false)
  const estates = useEstates()
  const navigate = useNavigate()
  const relative = useRelativeTime()
  const { illustrative } = useDemoWording()
  const activeDivisions = detail.divisions.filter((division) => division.status === 'active').length

  const divisionsCard = (
    <Card
      title="Divisions"
      action={
        <Link to="/admin/divisions" className={styles.link}>
          Manage divisions
        </Link>
      }
    >
      <DataTable<DivisionSummary>
        caption={`Divisions of ${estate.name}`}
        rows={detail.divisions}
        rowKey={(division) => division.id}
        onRowActivate={(division) => navigate(divisionPath(division.id))}
        empty={<p className={styles.caption}>This estate has no divisions yet.</p>}
        columns={[
          { id: 'division', header: 'Division', cell: (division) => <span className={styles.idStrong}>{division.name}</span> },
          { id: 'id', header: 'ID', cell: (division) => <span className={styles.muted}>{division.id}</span> },
          { id: 'workers', header: 'Field workers', cell: (division) => division.fieldWorkers.length },
          { id: 'status', header: 'Status', cell: (division) => <StatusBadge status={division.status} inactiveLabel="Disabled" /> },
        ]}
      />
    </Card>
  )

  const teamCard = (
    <Card title="Team">
      {detail.team.length === 0 ? (
        <p className={styles.caption}>No supervisors, experts or field workers are assigned to this estate.</p>
      ) : (
        <ul className={detailStyles.team}>
          {detail.team.map((member) => (
            <li key={member.id} className={detailStyles.member}>
              <Avatar name={member.fullName} size={40} />
              <span>
                <Link to={userPath(member.id)} className={detailStyles.memberName}>
                  {member.fullName}
                </Link>
                <span className={styles.muted}>
                  {ROLE_LABELS[member.role]}
                  {member.role === 'FIELD_WORKER' && member.divisionIds.length > 0 && ` · ${member.divisionIds.join(', ')}`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )

  const activityCard = (
    <Card title={`Recent estate activity${illustrative}`}>
      {detail.activity.length === 0 ? (
        <p className={styles.caption}>No administrative activity is recorded for this estate.</p>
      ) : (
        <Timeline
          label="Recent estate activity"
          items={detail.activity.map((event, index) => {
            const to = activityLink(event)
            return {
              id: event.id,
              state: index === detail.activity.length - 1 ? 'open' : 'done',
              title: to ? (
                <Link to={to} className={styles.link}>
                  {event.title}
                </Link>
              ) : (
                event.title
              ),
              detail: [event.detail, relative(event.at)].filter(Boolean).join(' · '),
            }
          })}
        />
      )}
    </Card>
  )

  return (
    <>
      <PageHeader
        back={{ to: '/admin/estates', label: 'Back to estates' }}
        title={estate.name}
        subtitle={`${estate.id} · ${estate.region} · ${estate.status === 'active' ? 'Active' : 'Inactive'}`}
        actions={
          <>
            <Button variant="secondary" icon="edit" onClick={() => setEditing(true)}>
              Edit estate
            </Button>
            <Button icon="plus" onClick={() => setAddingDivision(true)} disabled={estate.status !== 'active'}>
              Add division
            </Button>
          </>
        }
      />
      <Tabs items={TABS} value={tab} onChange={setTab} label="Estate sections" idBase="estate-detail" />
      <div {...tabPanelProps('estate-detail', tab)} className={styles.stack}>
        {tab === 'overview' && (
          <>
            <div className={cx(styles.kpiRow, detailStyles.kpiRow3)}>
              <KpiCard label="Total divisions" value={detail.divisions.length} caption={`${activeDivisions} active`} icon="layers" tone="success" />
              <KpiCard label="Assigned employees" value={detail.team.length} caption="Active supervisors, experts and field workers" icon="users" tone="info" />
              <KpiCard
                label="Estate status"
                value={estate.status === 'active' ? 'Active' : 'Inactive'}
                caption={estate.status === 'active' ? 'Accepting new divisions' : 'No new divisions can be added'}
                icon="shield"
                tone={estate.status === 'active' ? 'success' : 'warning'}
              />
            </div>
            <div className={detailStyles.split}>
              {divisionsCard}
              {teamCard}
            </div>
          </>
        )}
        {tab === 'divisions' && divisionsCard}
        {tab === 'team' && teamCard}
        {tab === 'activity' && activityCard}
      </div>
      <EstateFormModal open={editing} estate={estate} onClose={() => setEditing(false)} />
      <DivisionFormModal open={addingDivision} estates={estates.data ?? [estate]} defaultEstateId={estate.id} onClose={() => setAddingDivision(false)} />
    </>
  )
}
