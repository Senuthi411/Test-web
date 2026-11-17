import { useSearchParams } from 'react-router'
import { Button, PageHeader, Tabs, tabPanelProps, usePageBreadcrumbs, type TabItem } from '@/shared/components'
import { useDemoWording, useExportAction } from '../../components/helpers'
import styles from '../../components/identity.module.css'
import { AccessHistoryTab } from './roles/AccessHistoryTab'
import { PermissionMatrixTab } from './roles/PermissionMatrixTab'

type RolesTab = 'matrix' | 'history'

const ROLES_TABS: readonly TabItem<RolesTab>[] = [
  { id: 'matrix', label: 'Permission Matrix' },
  { id: 'history', label: 'Access History' },
]

const isRolesTab = (value: string | null): value is RolesTab => ROLES_TABS.some((tab) => tab.id === value)

/**
 * ID-07 Roles and Permissions: what each predefined role can do and within what scope, and
 * which identity and access changes have occurred. Read-only; roles are assigned in User
 * Management. An unknown `?tab=` (e.g. the removed Role Overview or Temporary Access) opens
 * the Permission Matrix, and the removed per-role pages (`/admin/roles/:role`) redirect here.
 */
export function RolesPage() {
  usePageBreadcrumbs([{ label: 'Administration', to: '/admin' }, { label: 'Roles & Permissions' }])
  const exportAction = useExportAction('permission-matrix')
  const { demo } = useDemoWording()
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab: RolesTab = isRolesTab(requested) ? requested : 'matrix'

  return (
    <div className={styles.page}>
      <PageHeader
        title="Roles and Permissions"
        subtitle={`Review the permissions of the predefined system roles and audit access changes.${demo ? ' Demonstration data: the backend enforces the real permissions.' : ''}`}
        actions={
          tab === 'matrix' ? (
            <Button variant="secondary" icon="download" onClick={exportAction.run} loading={exportAction.pending}>
              Export matrix
            </Button>
          ) : undefined
        }
      />
      <Tabs
        items={ROLES_TABS}
        value={tab}
        onChange={(next) => setParams(next === 'matrix' ? {} : { tab: next }, { replace: true })}
        label="Roles and permissions sections"
        idBase="roles"
      />
      <div {...tabPanelProps('roles', tab)} className={styles.stack}>
        {tab === 'matrix' && <PermissionMatrixTab />}
        {tab === 'history' && <AccessHistoryTab />}
      </div>
    </div>
  )
}
