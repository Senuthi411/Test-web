import { Link } from 'react-router'
import { Card } from '@/shared/components'
import { Icon, type IconName } from '@/shared/design-system'
import styles from './AdminDashboard.module.css'

const QUICK_ACTIONS: ReadonlyArray<{ label: string; to: string; icon: IconName }> = [
  { label: 'Add User', to: '/admin/users/new', icon: 'plus' },
  { label: 'Add Estate', to: '/admin/estates?create=1', icon: 'map' },
  { label: 'Add Division', to: '/admin/divisions?create=1', icon: 'layers' },
  { label: 'Security Center', to: '/admin/security', icon: 'lock' },
  { label: 'System Settings', to: '/admin/settings', icon: 'columns' },
  { label: 'Audit Logs', to: '/admin/audit-logs', icon: 'file' },
]

/** Shortcuts to the screens where the work is done; none of them acts on its own. */
export function QuickActionsCard() {
  return (
    <Card title="Quick actions" aria-label="Quick actions" className={styles.section}>
      <ul className={styles.quickActions}>
        {QUICK_ACTIONS.map((action) => (
          <li key={action.label}>
            <Link to={action.to} className={styles.quickAction}>
              <Icon name={action.icon} size={18} />
              {action.label}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
