import { Link } from 'react-router'
import { PageHeader, usePageBreadcrumbs } from '@/shared/components'
import { useDemoWording } from '../../components/helpers'
import styles from '../../components/identity.module.css'
import { AuditLogTable } from './audit/AuditLogTable'

/**
 * ID-18 Audit Logs: the centralized, read-only administrative audit trail. Records come from
 * the shared audit source that every administrative action writes to; nothing here creates,
 * edits or deletes a record.
 */
export function AuditLogsPage() {
  usePageBreadcrumbs([{ label: 'Administration', to: '/admin' }, { label: 'Audit Logs' }])
  const { demo } = useDemoWording()
  return (
    <div className={styles.page}>
      <PageHeader
        title="Audit Logs"
        subtitle={`Every recorded administrative action: users, access, estates, divisions, device sessions and configuration.${demo ? ' Demonstration data: records made in this tab are kept in memory only.' : ''}`}
      />
      <AuditLogTable
        title="Administrative audit log"
        emptyMessage="No administrative actions have been recorded yet."
        note={
          <>
            Audit records cannot be edited or deleted. Sign-in attempts, MFA administration and password recovery are not recorded by this source yet.
            Security-related records are also shown in{' '}
            <Link to="/admin/security?tab=events" className={styles.link}>
              Security Center › Security Events
            </Link>
            .
          </>
        }
      />
    </div>
  )
}
