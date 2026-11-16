import { Link } from 'react-router'
import { Badge, Card } from '@/shared/components'
import { useAdminDashboard } from '../../../services/queries'
import { SectionBoundary } from './SectionBoundary'
import styles from './AdminDashboard.module.css'

/**
 * Account lifecycle. The Identity model has Active and Inactive only; invitation and
 * activation states are shown as not reported rather than estimated.
 */
export function ActivationSummaryCard() {
  const query = useAdminDashboard()

  return (
    <Card
      title="Account activation summary"
      aria-label="Account activation summary"
      className={styles.section}
    >
      <SectionBoundary queries={[query]} unavailable="The Identity service does not report account statuses yet.">
        {() => {
          const { activeUsers, totalUsers } = query.data!
          const rows = [
            { status: 'active', label: 'Active', count: activeUsers, tone: 'success' as const },
            { status: 'inactive', label: 'Inactive', count: totalUsers - activeUsers, tone: 'neutral' as const },
          ]
          return (
            <>
              <ul className={styles.lifecycle} aria-label="Accounts by status">
                {rows.map((row) => (
                  <li key={row.status} className={styles.lifecycleRow}>
                    <Badge tone={row.tone}>{row.label}</Badge>
                    <span className={styles.lifecycleTrack} aria-hidden="true">
                      <span className={styles.lifecycleFill} data-tone={row.tone} style={{ width: `${totalUsers ? (row.count / totalUsers) * 100 : 0}%` }} />
                    </span>
                    <span className={styles.lifecycleCount}>{row.count}</span>
                    <Link to={`/admin/users?status=${row.status}`} className={styles.link} aria-label={`View ${row.label.toLowerCase()} users`}>
                      View
                    </Link>
                  </li>
                ))}
                <li className={styles.lifecycleRow}>
                  <Badge tone="neutral" dot={false}>
                    Invited · Pending activation
                  </Badge>
                  <span className={styles.itemMeta}>Not reported</span>
                </li>
              </ul>
              <p className={styles.note}>
                {totalUsers} account{totalUsers === 1 ? '' : 's'} in total. Invitation and activation statuses need the Identity contract; until then they are not counted.
              </p>
            </>
          )
        }}
      </SectionBoundary>
    </Card>
  )
}
