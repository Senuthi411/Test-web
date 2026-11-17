import { Link, useNavigate } from 'react-router'
import { BarList, Button, ButtonLink, Card, DataTable, KpiCard, PageHeader, Skeleton, usePageBreadcrumbs } from '@/shared/components'
import { ROLE_LABELS, type UserRole } from '@/shared/types'
import { RULE_TEMPLATES, enabledRuleCount } from '../../../domain/configuration'
import type { AdminDashboard, EstateSummary } from '../../../domain/models'
import { shortEstateName } from '../../../domain/scope'
import { StatusBadge } from '../../components/common'
import { estatePath, useExportAction } from '../../components/helpers'
import { useAdminDashboard, useConfiguration, useSecurityAlerts } from '../../services/queries'
import { useIdentityServices } from '../../services/identityServices'
import { ActivationSummaryCard } from './dashboard/ActivationSummaryCard'
import { AdministrativeActivityCard } from './dashboard/AdministrativeActivityCard'
import { AttentionCard } from './dashboard/AttentionCard'
import { ConfigurationSummaryCard } from './dashboard/ConfigurationSummaryCard'
import { QuickActionsCard } from './dashboard/QuickActionsCard'
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

/** Estate bar colours, in estate order (as on ID-09). */
const ESTATE_COLORS = ['#2e7d32', '#7cb342', '#4f9d69']

const headerDate = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Colombo',
})

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/** A KPI whose source has no contract yet: shown as not reported, never as zero. */
const NOT_REPORTED = '—'

function KpiRow({ data }: { data: AdminDashboard }) {
  const alerts = useSecurityAlerts()
  const configuration = useConfiguration()
  const inactiveUsers = data.totalUsers - data.activeUsers
  const activeEstates = data.estates.filter((estate) => estate.status === 'active').length
  const inactiveDivisions = data.divisionCount - data.activeDivisionCount
  const alertCount = alerts.data ? alerts.data.alerts.length : null
  const enabledRules = configuration.data ? enabledRuleCount(configuration.data.current.document) : null
  return (
    <div className={styles.kpiRow}>
      <Link to="/admin/users?status=all" className={styles.kpiLink}>
        <KpiCard label="Total users" value={data.totalUsers} caption={`${plural(data.usersByRole.filter((row) => row.count > 0).length, 'role')} in use`} icon="users" tone="info" />
      </Link>
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
          label="Active estates"
          value={activeEstates}
          caption={`of ${plural(data.estates.length, 'estate')} · ${data.estates.map((estate) => shortEstateName(estate.name)).join(' · ')}`}
          icon="map"
          tone="info"
        />
      </Link>
      <Link to="/admin/divisions" className={styles.kpiLink}>
        <KpiCard
          label="Total divisions"
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
      <a href="#attention" className={styles.kpiLink}>
        <KpiCard
          label="Accounts requiring attention"
          value={data.attention.length}
          caption={data.attention.length === 0 ? 'Nothing waiting' : 'See the list below'}
          icon="alert"
          tone="warning"
        />
      </a>
      <Link to="/admin/security" className={styles.kpiLink}>
        <KpiCard
          label="Security alerts"
          value={alertCount ?? NOT_REPORTED}
          caption={alerts.isPending ? 'Loading…' : alertCount === null ? 'Not reported by the source' : `${plural(alertCount, 'alert')} recorded`}
          icon="shield"
          tone="purple"
        />
      </Link>
      <Link to="/admin/settings?tab=rules" className={styles.kpiLink}>
        <KpiCard
          label="Enabled business rules"
          value={enabledRules ?? NOT_REPORTED}
          caption={configuration.isPending ? 'Loading…' : enabledRules === null ? 'Configuration not available' : `of ${RULE_TEMPLATES.length} templates · not evaluated yet`}
          icon="filter"
          tone="success"
        />
      </Link>
    </div>
  )
}

function KpiSkeleton() {
  return (
    <div className={styles.kpiRow} aria-busy="true" aria-label="Loading">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
        <Card key={index}>
          <Skeleton width="50%" height={14} />
          <Skeleton width="30%" height={28} />
          <Skeleton width="70%" height={12} />
        </Card>
      ))}
    </div>
  )
}

/**
 * ID-02 Administrator Dashboard (Figma 14:8). Every figure is derived from a recorded
 * source; a source without a contract is shown as not reported, never as zero.
 */
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

      <QuickActionsCard />

      <div className={dashboardStyles.row2}>
        <SecurityAlertsCard securityLink />
        <PendingActionsCard />
      </div>

      <div className={dashboardStyles.row3}>
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
        <ActivationSummaryCard />
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
              <>
                <BarList
                  label="Divisions per estate"
                  items={query.data!.estates.map((estate, index) => ({
                    id: estate.id,
                    label: `${shortEstateName(estate.name)} · ${estate.region}`,
                    value: estate.divisionCount,
                    color: ESTATE_COLORS[index % ESTATE_COLORS.length],
                  }))}
                />
                <DataTable<EstateSummary>
                  caption="Estate coverage"
                  rows={query.data!.estates}
                  rowKey={(estate) => estate.id}
                  onRowActivate={(estate) => navigate(estatePath(estate.id))}
                  columns={[
                    { id: 'estate', header: 'Estate', cell: (estate) => <span className={styles.idStrong}>{shortEstateName(estate.name)}</span> },
                    { id: 'divisions', header: 'Divisions', cell: (estate) => estate.divisionCount },
                    { id: 'status', header: 'Status', cell: (estate) => <StatusBadge status={estate.status} /> },
                  ]}
                />
              </>
            )}
          </SectionBoundary>
        </Card>
      </div>

      <div className={dashboardStyles.mainSide}>
        <AdministrativeActivityCard />
        <ConfigurationSummaryCard />
      </div>

      <div id="attention">
        <AttentionCard />
      </div>
    </div>
  )
}
