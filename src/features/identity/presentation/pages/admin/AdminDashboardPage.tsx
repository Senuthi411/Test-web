import { Link, useNavigate } from 'react-router'
import { Badge, BarList, Button, ButtonLink, Card, DataTable, KpiCard, PageHeader, Timeline, usePageBreadcrumbs } from '@/shared/components'
import { ROLE_LABELS, type UserRole } from '@/shared/types'
import type { AttentionRow, EstateSummary } from '../../../domain/models'
import { shortEstateName } from '../../../domain/scope'
import { PersonCell, QueryBoundary, RoleBadge, StatusBadge } from '../../components/common'
import { activityLink, estatePath, useExportAction, useRelativeTime, userPath } from '../../components/helpers'
import { useAdminDashboard } from '../../services/queries'
import { useIdentityServices } from '../../services/identityServices'
import styles from '../../components/identity.module.css'

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

/** ID-02 Administrator Dashboard (Figma 14:8). */
export function AdminDashboardPage() {
  usePageBreadcrumbs([{ label: 'Administration', to: '/admin' }, { label: 'Dashboard' }])
  const query = useAdminDashboard()
  const { clock } = useIdentityServices()
  const exportAction = useExportAction('dashboard')
  const relative = useRelativeTime()
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <PageHeader
        title="Administrator Dashboard"
        subtitle={`Identity, estates and device access overview · ${headerDate.format(clock.now()).replace(',', '')}`}
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
      <QueryBoundary query={query}>
        {(data) => (
          <>
            <div className={styles.kpiRow}>
              <Link to="/admin/users" className={styles.kpiLink}>
                <KpiCard
                  label="Active users"
                  value={data.activeUsers}
                  caption={data.activeUsers === data.totalUsers ? 'All accounts active' : `${data.totalUsers - data.activeUsers} inactive`}
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
                <KpiCard label="Divisions" value={data.divisionCount} caption="Division-level scopes only" icon="layers" tone="purple" />
              </Link>
              <Link to="/admin/device-sessions" className={styles.kpiLink}>
                <KpiCard
                  label="Active device sessions"
                  value={data.activeDeviceSessions}
                  caption={`${data.revokedSessionsThisWeek} session${data.revokedSessionsThisWeek === 1 ? '' : 's'} revoked this week`}
                  icon="phone"
                  tone="warning"
                />
              </Link>
            </div>

            <div className={styles.row3}>
              <Card title="Users by role">
                <BarList
                  label="Users by role"
                  items={data.usersByRole.map(({ role, count }) => ({ id: role, label: ROLE_LABELS[role], value: count, color: ROLE_COLOR[role] }))}
                />
              </Card>
              <Card
                title="Estate coverage"
                action={
                  <Link to="/admin/estates" className={styles.link}>
                    View estates
                  </Link>
                }
              >
                <DataTable<EstateSummary>
                  caption="Estate coverage"
                  rows={data.estates}
                  rowKey={(estate) => estate.id}
                  onRowActivate={(estate) => navigate(estatePath(estate.id))}
                  columns={[
                    { id: 'estate', header: 'Estate', cell: (estate) => <span className={styles.idStrong}>{shortEstateName(estate.name)}</span> },
                    { id: 'region', header: 'Region', cell: (estate) => estate.region },
                    { id: 'divisions', header: 'Divisions', cell: (estate) => estate.divisionCount },
                    { id: 'status', header: 'Status', cell: (estate) => <StatusBadge status={estate.status} /> },
                  ]}
                />
              </Card>
              <Card title="Recent administrative activity">
                {data.recentActivity.length === 0 ? (
                  <p className={styles.caption}>No administrative activity yet.</p>
                ) : (
                  <Timeline
                    label="Recent administrative activity"
                    items={data.recentActivity.map((event, index) => {
                      const to = activityLink(event)
                      return {
                        id: event.id,
                        state: index === data.recentActivity.length - 1 ? 'open' : 'done',
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
            </div>

            <Card
              title="Users requiring attention"
              action={
                <Link to="/admin/users" className={styles.link}>
                  View all users
                </Link>
              }
            >
              <DataTable<AttentionRow>
                caption="Users requiring attention"
                rows={data.attention}
                rowKey={(row) => row.user.id}
                onRowActivate={(row) =>
                  navigate(row.status === 'session_revoked' ? `/admin/device-sessions?user=${row.user.id}` : userPath(row.user.id))
                }
                empty={<p className={styles.caption}>No users need attention.</p>}
                columns={[
                  { id: 'user', header: 'User', cell: (row) => <PersonCell name={row.user.fullName} /> },
                  { id: 'role', header: 'Role', cell: (row) => <RoleBadge role={row.user.role} /> },
                  { id: 'scope', header: 'Scope', cell: (row) => <span className={styles.muted}>{row.user.scopeIds.join(', ') || '—'}</span> },
                  {
                    id: 'status',
                    header: 'Status',
                    cell: (row) =>
                      row.status === 'session_revoked' ? <Badge tone="warning">Session revoked</Badge> : <StatusBadge status={row.status} />,
                  },
                  { id: 'last', header: 'Last device session', cell: (row) => <span className={styles.muted}>{relative(row.lastDeviceSessionAt)}</span> },
                ]}
              />
            </Card>
          </>
        )}
      </QueryBoundary>
    </div>
  )
}
