import { Link, useNavigate } from 'react-router'
import { Badge, Card, DataTable } from '@/shared/components'
import { pendingAdministrativeActions, withoutPendingDuplicates } from '../../../../domain/adminDashboard'
import type { AttentionRow } from '../../../../domain/models'
import { PersonCell, RoleBadge, StatusBadge } from '../../../components/common'
import { useDemoWording, useRelativeTime, userPath } from '../../../components/helpers'
import { useAdminDashboard } from '../../../services/queries'
import { ATTENTION_REASON_LABELS } from './dashboardLabels'
import { SectionBoundary } from './SectionBoundary'
import styles from './AdminDashboard.module.css'

function actionFor(row: AttentionRow): { to: string; label: string } {
  return row.reasons.includes('sessions_revoked')
    ? { to: `/admin/device-sessions?user=${row.user.id}`, label: 'Review sessions' }
    : { to: userPath(row.user.id), label: 'Review user' }
}

/** Accounts with issues or incomplete setup. Tasks already pending are left out. */
export function AttentionCard() {
  const query = useAdminDashboard()
  const relative = useRelativeTime()
  const navigate = useNavigate()
  const { demo } = useDemoWording()

  return (
    <Card
      title="Users requiring attention"
      aria-label="Users requiring attention"
      className={styles.section}
      action={
        <Link to="/admin/users" className={styles.link}>
          View all users
        </Link>
      }
    >
      <SectionBoundary queries={[query]} unavailable="The Identity service does not report account issues yet.">
        {() => {
          const data = query.data!
          const rows = withoutPendingDuplicates(data.attention, pendingAdministrativeActions(data.openRecoveries))
          return (
            <DataTable<AttentionRow>
              caption="Users requiring attention"
              rows={rows}
              rowKey={(row) => row.user.id}
              onRowActivate={(row) => navigate(actionFor(row).to)}
              empty={<p className={styles.itemText}>No users need attention.</p>}
              columns={[
                { id: 'user', header: 'User', cell: (row) => <PersonCell name={row.user.fullName} /> },
                { id: 'id', header: 'User ID', cell: (row) => <span className={styles.idCell}>{row.user.id}</span> },
                { id: 'role', header: 'Role', cell: (row) => <RoleBadge role={row.user.role} /> },
                {
                  id: 'reason',
                  header: 'Reason',
                  cell: (row) =>
                    row.reasons.length > 0 ? (
                      <span className={`${styles.itemText} ${styles.reasonCell}`}>{row.reasons.map((reason) => ATTENTION_REASON_LABELS[reason]).join('; ')}</span>
                    ) : (
                      <span className={`${styles.itemMeta} ${styles.reasonCell}`}>{demo ? 'Listed by the demonstration design; no issue recorded' : 'No reason reported'}</span>
                    ),
                },
                {
                  id: 'status',
                  header: 'Status',
                  cell: (row) =>
                    row.status === 'session_revoked' ? <Badge tone="warning">Session revoked</Badge> : <StatusBadge status={row.status} />,
                },
                { id: 'last', header: 'Last device session', cell: (row) => <span className={styles.itemMeta}>{relative(row.lastDeviceSessionAt)}</span> },
                {
                  id: 'action',
                  header: 'Action',
                  cell: (row) => {
                    const action = actionFor(row)
                    return (
                      <Link to={action.to} className={styles.link} onClick={(event) => event.stopPropagation()} aria-label={`${action.label}: ${row.user.fullName}`}>
                        {action.label}
                      </Link>
                    )
                  },
                },
              ]}
            />
          )
        }}
      </SectionBoundary>
    </Card>
  )
}
