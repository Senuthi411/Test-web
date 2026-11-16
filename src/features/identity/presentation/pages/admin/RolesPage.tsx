import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import {
  Badge,
  Button,
  Card,
  DataTable,
  DescriptionList,
  EmptyState,
  ErrorState,
  PageHeader,
  Tabs,
  tabPanelProps,
  usePageBreadcrumbs,
  type TabItem,
} from '@/shared/components'
import { ROLE_LABELS } from '@/shared/types'
import type { IdentityUser } from '../../../domain/models'
import {
  APPLICATION_ACCESS_LABELS,
  PERMISSIONS,
  ROLE_CATALOG,
  ROLE_PROFILES,
  applicationAccess,
  permissionCell,
  permissionGroup,
  permissionScopeRestriction,
  roleBySlug,
  roleGroups,
  scopeSummary,
  type RoleDefinition,
} from '../../../domain/roles'
import { isServiceUnavailable, scopeLabel, useDemoWording, useExportAction, userPath } from '../../components/helpers'
import { StatusBadge } from '../../components/common'
import { useUsers } from '../../services/queries'
import styles from '../../components/identity.module.css'
import roleStyles from './RolesPage.module.css'
import { AccessHistoryTab } from './roles/AccessHistoryTab'
import { PermissionMatrixTab } from './roles/PermissionMatrixTab'
import { PermissionLegend, PermissionState } from './roles/PermissionState'
import { RoleOverviewTab } from './roles/RoleOverviewTab'
import { userCountLabel, usersWithRolePath } from './roles/roleUsers'

type RolesTab = 'overview' | 'matrix' | 'history'

const ROLES_TABS: readonly TabItem<RolesTab>[] = [
  { id: 'overview', label: 'Role Overview' },
  { id: 'matrix', label: 'Permission Matrix' },
  { id: 'history', label: 'Access History' },
]

const isRolesTab = (value: string | null): value is RolesTab => ROLES_TABS.some((tab) => tab.id === value)

/**
 * ID-07 Roles and Permissions: who the system roles are, what each can do and within what
 * scope, and which identity and access changes have occurred. Read-only; roles are assigned
 * in User Management. An unknown `?tab=` (e.g. the removed Temporary Access) opens the overview.
 */
export function RolesPage() {
  usePageBreadcrumbs([{ label: 'Administration', to: '/admin' }, { label: 'Roles & Permissions' }])
  const exportAction = useExportAction('permission-matrix')
  const { demo } = useDemoWording()
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab: RolesTab = isRolesTab(requested) ? requested : 'overview'

  return (
    <div className={styles.page}>
      <PageHeader
        title="Roles and Permissions"
        subtitle={`Review system roles, understand permissions, and audit access changes.${demo ? ' Demonstration data: the backend enforces the real permissions.' : ''}`}
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
        onChange={(next) => setParams(next === 'overview' ? {} : { tab: next }, { replace: true })}
        label="Roles and permissions sections"
        idBase="roles"
      />
      <div {...tabPanelProps('roles', tab)} className={styles.stack}>
        {tab === 'overview' && <RoleOverviewTab />}
        {tab === 'matrix' && <PermissionMatrixTab />}
        {tab === 'history' && <AccessHistoryTab />}
      </div>
    </div>
  )
}

/** ID-07 role detail. Viewing a role never assigns it. */
export function RoleDetailPage() {
  const { role: slug } = useParams()
  const definition = roleBySlug(slug)
  usePageBreadcrumbs(
    definition
      ? [{ label: 'Administration', to: '/admin' }, { label: 'Roles & Permissions', to: '/admin/roles' }, { label: `${ROLE_LABELS[definition.role]} role` }]
      : [{ label: 'Administration', to: '/admin' }, { label: 'Role not found' }],
  )
  if (!definition) {
    return (
      <div className={styles.page}>
        <Card>
          <EmptyState title="Role not found" message="This address does not match a web or mobile role." icon="search" />
        </Card>
      </div>
    )
  }
  return <RoleDetail definition={definition} />
}

function RoleDetail({ definition }: { definition: RoleDefinition }) {
  const users = useUsers()
  const navigate = useNavigate()
  const assigned = (users.data ?? []).filter((user) => user.role === definition.role)
  const label = ROLE_LABELS[definition.role]
  const profile = ROLE_PROFILES[definition.role]
  const allowed = PERMISSIONS.filter((permission) => definition.permissions.includes(permission.code))

  return (
    <div className={styles.page}>
      <PageHeader back={{ to: '/admin/roles', label: 'Back to roles' }} title={label} subtitle={profile.responsibility} />
      <nav className={roleStyles.roleTabs} aria-label="Roles">
        {ROLE_CATALOG.map((item) => (
          <Link key={item.role} to={`/admin/roles/${item.slug}`} className={roleStyles.roleTab} aria-current={item.role === definition.role ? 'page' : undefined}>
            {ROLE_LABELS[item.role]}
          </Link>
        ))}
      </nav>
      <div className={styles.sideFirst}>
        <div className={styles.stack}>
          <Card title="Role summary">
            <DescriptionList
              items={[
                { label: 'Role', value: label },
                { label: 'Application access', value: APPLICATION_ACCESS_LABELS[applicationAccess(definition.role)] },
                { label: 'Permanent scope', value: scopeSummary(definition.role) },
                {
                  label: 'Modules',
                  value: (
                    <span className={roleStyles.chips}>
                      {roleGroups(definition).map((group) => (
                        <Badge key={group} tone="neutral" dot={false}>
                          {group}
                        </Badge>
                      ))}
                    </span>
                  ),
                },
                { label: 'Assigned users', value: users.data ? userCountLabel(assigned.length) : users.isError ? 'Not available' : '…' },
                { label: 'Capabilities', value: `${allowed.length} of ${PERMISSIONS.length} permissions` },
              ]}
            />
          </Card>
          <Card title="Estate / division scope rules">
            <p className={styles.muted}>{definition.scopeRules}</p>
          </Card>
          <Card title="Security limitations">
            <ul className={styles.noteList}>
              {profile.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>
        </div>
        <div className={styles.stack}>
          <Card title="Allowed actions" aria-label={`Allowed actions of the ${label} role`}>
            <PermissionLegend />
            <ul className={roleStyles.actionList}>
              {allowed.map((permission) => (
                <li key={permission.code} className={roleStyles.actionItem}>
                  <PermissionState state={permissionCell(definition, permission.code)} compact />
                  <div>
                    <p className={roleStyles.permissionName}>
                      {permission.label} <span className={roleStyles.code}>{permission.code}</span>
                    </p>
                    <p className={roleStyles.muted}>
                      {permission.description} {permissionScopeRestriction(permission.code)}
                    </p>
                    <p className={roleStyles.code}>{permissionGroup(permission.code)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card
            title="Assigned users"
            action={
              <Link to={usersWithRolePath(definition.role)} className={styles.link}>
                View in User Management
              </Link>
            }
          >
            {users.isError ? (
              isServiceUnavailable(users.error) ? (
                <p className={styles.muted}>User accounts are not available yet: the Identity service is not connected.</p>
              ) : (
                <ErrorState error={users.error} onRetry={() => void users.refetch()} />
              )
            ) : (
              <DataTable<IdentityUser>
                caption={`Users with the ${label} role`}
                loading={users.isPending}
                rows={assigned}
                rowKey={(user) => user.id}
                onRowActivate={(user) => navigate(userPath(user.id))}
                empty={<p className={styles.caption}>No users hold this role.</p>}
                columns={[
                  { id: 'id', header: 'ID', cell: (user) => <span className={styles.idStrong}>{user.id}</span> },
                  { id: 'name', header: 'Name', cell: (user) => user.fullName },
                  { id: 'scope', header: 'Scope', cell: (user) => <span className={styles.muted}>{scopeLabel(user)}</span> },
                  { id: 'status', header: 'Status', cell: (user) => <StatusBadge status={user.status} /> },
                  {
                    id: 'manage',
                    header: 'Manage',
                    cell: (user) => (
                      <span className={roleStyles.chips}>
                        <Link to={`${userPath(user.id)}/edit`} className={styles.link} onClick={(event) => event.stopPropagation()} aria-label={`Manage role of ${user.fullName}`}>
                          Role
                        </Link>
                        <Link to={`${userPath(user.id)}/scope`} className={styles.link} onClick={(event) => event.stopPropagation()} aria-label={`View access scope of ${user.fullName}`}>
                          Scope
                        </Link>
                      </span>
                    ),
                  },
                ]}
              />
            )}
          </Card>
          <p className={styles.caption}>Viewing a role does not assign it. Change a person’s role in Edit User and their permanent scope in Scope Assignment.</p>
        </div>
      </div>
    </div>
  )
}
