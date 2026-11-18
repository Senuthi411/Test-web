import { Link } from 'react-router'
import { Badge, Card } from '@/shared/components'
import { ROLE_LABELS } from '@/shared/types'
import { pendingAdministrativeActions } from '../../../../domain/adminDashboard'
import { useRelativeTime } from '../../../components/helpers'
import { useAdminDashboard } from '../../../services/queries'
import { PENDING_ACTION_LABELS } from './dashboardLabels'
import { SectionBoundary } from './SectionBoundary'
import styles from './AdminDashboard.module.css'

/** Tasks an Administrator can act on. Account issues stay in "Users requiring attention". */
export function PendingActionsCard() {
  const dashboard = useAdminDashboard()
  const relative = useRelativeTime()

  return (
    <Card
      title="Pending administrative actions"
      aria-label="Pending administrative actions"
      className={styles.section}
    >
      <SectionBoundary queries={[dashboard]} unavailable="Device-session recovery tasks come from an Identity service that is not connected yet.">
        {() => {
          const actions = pendingAdministrativeActions(dashboard.data!.openRecoveries)
          return (
            <>
              {actions.length === 0 ? (
                <div className={styles.empty}>
                  <p className={styles.itemTitle}>No pending administrative actions</p>
                  <p className={styles.itemText}>No device-session recovery is waiting.</p>
                </div>
              ) : (
                <ul className={styles.items} aria-label="Pending administrative actions">
                  {actions.map((action) => {
                    const label = PENDING_ACTION_LABELS[action.kind]
                    return (
                      <li key={`${action.kind}-${action.id}`} className={styles.item}>
                        <div className={styles.itemMain}>
                          <p className={styles.itemTitle}>
                            {label.title}
                            <Badge tone={label.tone}>{label.status}</Badge>
                          </p>
                          <p className={styles.itemText}>Controlled recovery was requested for {action.subject} and is not complete.</p>
                          <p className={styles.itemMeta}>
                            {action.employee.fullName} ({action.employee.id}) · {ROLE_LABELS[action.employee.role]} · {relative(action.at)}
                          </p>
                        </div>
                        <Link
                          to={`/admin/device-sessions/${action.subject}/recovery`}
                          className={styles.itemAction}
                          aria-label={`${label.action} ${action.id} for ${action.employee.fullName}`}
                        >
                          {label.action}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
              <p className={styles.note}>
                Invitations awaiting activation, account reviews and MFA enrollment are not reported yet: the Identity contract does not define them.
              </p>
            </>
          )
        }}
      </SectionBoundary>
    </Card>
  )
}
