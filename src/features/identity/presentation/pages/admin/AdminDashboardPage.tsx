import { Link, useNavigate } from 'react-router'
import { BarList, Button, ButtonLink, Card, DataTable, KpiCard, PageHeader, Skeleton, usePageBreadcrumbs } from '@/shared/components'
import { ROLE_LABELS, type UserRole } from '@/shared/types'
import type { AdminDashboard, EstateSummary } from '../../../domain/models'
import { shortEstateName } from '../../../domain/scope'
import { StatusBadge } from '../../components/common'
import { estatePath, useExportAction } from '../../components/helpers'
import { useAdminDashboard } from '../../services/queries'
import { useIdentityServices } from '../../services/identityServices'
import { ActivationSummaryCard } from './dashboard/ActivationSummaryCard'
import { AdministrativeActivityCard } from './dashboard/AdministrativeActivityCard'
import { AttentionCard } from './dashboard/AttentionCard'
import { PendingActionsCard } from './dashboard/PendingActionsCard'
import { SectionBoundary } from './dashboard/SectionBoundary'
import { SecurityAlertsCard } from './dashboard/SecurityAlertsCard'
import styles from '../../components/identity.module.css'
import dashboardStyles from './dashboard/AdminDashboard.module.css'

/** ID-02 "Users by role" bar colours. */
const ROLE_COLOR: Record<UserRole, string> = {
  FIELD_WORKER: '#2e7d32',
  SUPERVISOR: '#7cb342',
  DISEASE_EXPERT: '#4f9d69',
  ADMINISTRATOR: '#1f5a2e',
  REPORTING_USER: '#8bc34a',
}

const headerDate = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Colombo',
})

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

function KpiRow({ data }: { data: AdminDashboard }) {
  const inactiveUsers = data.totalUsers - data.activeUsers
  const inactiveDivisions = data.divisionCount - data.activeDivisionCount
  return (
    <div className={styles.kpiRow}>
      <Link to="/admin/users" className={styles.kpiLink}>
        <KpiCard
          label="Active users"
          value={data.activeUsers}
          caption={inactiveUsers === 0 ? 'All accounts active' : `${inactiveUsers} inactive`}
          icon="users"
          tone="success"
        />
      </Link>
      <Link to="/admin/estates" className={styles.kpiLink}>
        <KpiCard
          label="Estates"
          value={data.estates.length}
          caption={data.estates.map((estate) => shortEstateName(estate.name)).join(' · ')}
          icon="map"
          tone="info"
        />
      </Link>
      <Link to="/admin/divisions" className={styles.kpiLink}>
        <KpiCard
          label="Divisions"
          value={data.divisionCount}
          caption={inactiveDivisions === 0 ? 'All divisions active' : `${inactiveDivisions} inactive`}
          icon="layers"
          tone="purple"
        />
      </Link>
      <Link to="/admin/device-sessions" className={styles.kpiLink}>
        <KpiCard
          label="Active device sessions"
          value={data.activeDeviceSessions}
          caption={`${plural(data.revokedSessionsThisWeek, 'session')} revoked this week`}
          icon="phone"
          tone="warning"
        />
      </Link>
    </div>
  )
}

function KpiSkeleton() {
  return (
    <div className={styles.kpiRow} aria-busy="true" aria-label="Loading">
      {[0, 1, 2, 3].map((index) => (
        <Card key={index}>
          <Skeleton width="50%" height={14} />
          <Skeleton width="30%" height={28} />
          <Skeleton width="70%" height={12} />
        </Card>
      ))}
    </div>
  )
}

/** ID-02 Administrator Dashboard (Figma 14:8). */
export function AdminDashboardPage() {
  usePageBreadcrumbs([{ label: 'Administration', to: '/admin' }, { label: 'Dashboard' }])
  const query = useAdminDashboard()
  const { clock, demo } = useIdentityServices()
  const exportAction = useExportAction('dashboard')
  const navigate = useNavigate()
  const date = headerDate.format(clock.now()).replace(',', '')

  return (
    <div className={styles.page}>
      <PageHeader
        title="Administrator Dashboard"
        subtitle={`Identity, security, access and estate administration overview · ${demo ? `Demonstration reference date ${date}` : date}`}
        actions={
          <>
            <Button variant="secondary" icon="download" onClick={exportAction.run} loading={exportAction.pending}>
              Export
            </Button>
            <ButtonLink to="/admin/users/new" icon="plus">
              Create user
            </ButtonLink>
          </>
        }
      />

      {query.isPending ? (
        <KpiSkeleton />
      ) : (
        <SectionBoundary queries={[query]} unavailable="The Identity service does not provide dashboard counts yet, so no figures are shown.">
          {() => <KpiRow data={query.data!} />}
        </SectionBoundary>
      )}

      <div className={dashboardStyles.row2}>
        <SecurityAlertsCard securityLink />
        <PendingActionsCard />
      </div>

      <div className={dashboardStyles.row2}>
        <Card title="Users by role" aria-label="Users by role" className={dashboardStyles.section}>
          <SectionBoundary queries={[query]} unavailable="The Identity service does not report users by role yet.">
            {() => (
              <BarList
                label="Users by role"
                items={query.data!.usersByRole.map(({ role, count }) => ({ id: role, label: ROLE_LABELS[role], value: count, color: ROLE_COLOR[role] }))}
              />
            )}
          </SectionBoundary>
        </Card>
        <Card
          title="Estate coverage"
          aria-label="Estate coverage"
          className={dashboardStyles.section}
          action={
            <Link to="/admin/estates" className={styles.link}>
              View estates
            </Link>
          }
        >
          <SectionBoundary queries={[query]} unavailable="The Identity service does not provide estates yet.">
            {() => (
              <DataTable<EstateSummary>
                caption="Estate coverage"
                rows={query.data!.estates}
                rowKey={(estate) => estate.id}
                onRowActivate={(estate) => navigate(estatePath(estate.id))}
                columns={[
                  { id: 'estate', header: 'Estate', cell: (estate) => <span className={styles.idStrong}>{shortEstateName(estate.name)}</span> },
                  { id: 'region', header: 'Region', cell: (estate) => estate.region },
                  { id: 'divisions', header: 'Divisions', cell: (estate) => estate.divisionCount },
                  { id: 'status', header: 'Status', cell: (estate) => <StatusBadge status={estate.status} /> },
                ]}
              />
            )}
          </SectionBoundary>
        </Card>
      </div>

      <div className={dashboardStyles.mainSide}>
        <AdministrativeActivityCard />
        <ActivationSummaryCard />
      </div>

      <AttentionCard />
    </div>
  )
}
