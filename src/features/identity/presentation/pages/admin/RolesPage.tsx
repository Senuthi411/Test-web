import { Link, useNavigate, useParams } from 'react-router'
import {
  Badge,
  Banner,
  Button,
  Card,
  DataTable,
  DescriptionList,
  EmptyState,
  ErrorState,
  PageHeader,
  usePageBreadcrumbs,
} from '@/shared/components'
import { Icon } from '@/shared/design-system'
import { ROLE_LABELS, type UserRole } from '@/shared/types'
import type { IdentityUser } from '../../../domain/models'
import { PERMISSIONS, ROLE_CATALOG, roleBySlug, type PermissionDefinition, type RoleDefinition } from '../../../domain/roles'
import { useExportAction, userPath } from '../../components/helpers'
import { useUsers } from '../../services/queries'
import styles from '../../components/identity.module.css'
import roleStyles from './RolesPage.module.css'

const countLabel = (count: number | undefined) => (count === undefined ? '…' : `${count} ${count === 1 ? 'user' : 'users'}`)

function useRoleCounts(): Partial<Record<UserRole, number>> {
  const users = useUsers()
  if (!users.data) return {}
  const counts: Partial<Record<UserRole, number>> = {}
  for (const user of users.data) counts[user.role] = (counts[user.role] ?? 0) + 1
  return counts
}

function GrantCell({ granted, role }: { granted: boolean; role: string }) {
  return granted ? (
    <span className={roleStyles.granted}>
      <Icon name="check" size={16} label={`Granted to ${role}`} />
    </span>
  ) : (
    <span className={styles.muted} aria-label={`Not granted to ${role}`}>
      —
    </span>
  )
}

/** ID-07 Roles and Permissions (Figma 16:2). */
export function RolesPage() {
  usePageBreadcrumbs([{ label: 'Administration', to: '/admin' }, { label: 'Roles & Permissions' }])
  const counts = useRoleCounts()
  const users = useUsers()
  const exportAction = useExportAction('permission-matrix')

  return (
    <div className={styles.page}>
      <PageHeader
        title="Roles and Permissions"
        subtitle="Permission codes are illustrative fixture values; enforcement happens in the backend"
        actions={
          <Button variant="secondary" icon="download" onClick={exportAction.run} loading={exportAction.pending}>
            Export matrix
          </Button>
        }
      />
      {users.isError && <ErrorState error={users.error} onRetry={() => void users.refetch()} />}
      <div className={styles.sideFirst}>
        <Card title="Roles">
          <ul className={roleStyles.roleList}>
            {ROLE_CATALOG.map((definition) => (
              <li key={definition.role}>
                <Link to={`/admin/roles/${definition.slug}`} className={roleStyles.roleItem}>
                  <span className={roleStyles.roleTop}>
                    <span className={roleStyles.roleName}>{ROLE_LABELS[definition.role]}</span>
                    <Badge tone="neutral" dot={false}>
                      {countLabel(counts[definition.role] ?? (users.data ? 0 : undefined))}
                    </Badge>
                  </span>
                  <span className={styles.muted}>{definition.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Permission matrix" action={<span className={styles.muted}>All roles · select a role to open it</span>}>
          <DataTable<PermissionDefinition>
            caption="Permission matrix"
            rows={PERMISSIONS}
            rowKey={(permission) => permission.code}
            columns={[
              {
                id: 'capability',
                header: 'Capability',
                cell: (permission) => (
                  <span>
                    {permission.label} <span className={styles.muted}>({permission.code})</span>
                  </span>
                ),
              },
              ...ROLE_CATALOG.map((definition) => ({
                id: definition.role,
                header: ROLE_LABELS[definition.role],
                cell: (permission: PermissionDefinition) => (
                  <GrantCell granted={definition.permissions.includes(permission.code)} role={ROLE_LABELS[definition.role]} />
                ),
              })),
            ]}
          />
        </Card>
      </div>
    </div>
  )
}

/** Assigned-user subtitle on the role detail (161:74 …). */
function assignedSubtitle(user: IdentityUser): string {
  switch (user.role) {
    case 'ADMINISTRATOR':
      return 'Identity administration'
    case 'SUPERVISOR':
      return user.estateIds.join(', ')
    case 'DISEASE_EXPERT':
      return 'Referred cases'
    case 'FIELD_WORKER':
      return user.divisionIds.join(', ')
    case 'REPORTING_USER':
      return 'Scoped division analytics'
  }
}

/** ID-07 role detail (Figma 161:74 … 161:1426). Viewing a role never assigns it. */
export function RoleDetailPage() {
  const { role: slug } = useParams()
  const definition = roleBySlug(slug)
  usePageBreadcrumbs(
    definition
      ? [{ label: 'Administration', to: '/admin' }, { label: `${ROLE_LABELS[definition.role]} role` }]
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

  return (
    <div className={styles.page}>
      <PageHeader back={{ to: '/admin/roles', label: 'Back to roles' }} title={label} subtitle={`${definition.description} · permissions view only`} />
      <nav className={roleStyles.roleTabs} aria-label="Roles">
        {ROLE_CATALOG.map((item) => (
          <Link
            key={item.role}
            to={`/admin/roles/${item.slug}`}
            className={roleStyles.roleTab}
            aria-current={item.role === definition.role ? 'page' : undefined}
          >
            {ROLE_LABELS[item.role]}
          </Link>
        ))}
      </nav>
      <Banner tone="info">
        Viewing a role&apos;s permissions does not assign it. Assign roles to users from Users → Edit User or Scope Assignment.
      </Banner>
      <div className={styles.sideFirst}>
        <div className={styles.stack}>
          <Card title="Role summary">
            <DescriptionList
              items={[
                { label: 'Role', value: label },
                { label: 'Description', value: definition.description },
                { label: 'Assigned users', value: users.data ? countLabel(assigned.length) : '…' },
                { label: 'Allowed module', value: definition.allowedModule },
                { label: 'Capabilities', value: `${definition.permissions.length} of ${PERMISSIONS.length} granted` },
              ]}
            />
          </Card>
          <Card title="Estate / division scope rules">
            <p className={styles.muted}>{definition.scopeRules}</p>
          </Card>
          <Card title="Assigned users">
            {users.isError ? <ErrorState error={users.error} onRetry={() => void users.refetch()} /> : <DataTable<IdentityUser>
              caption={`Users with the ${label} role`}
              loading={users.isPending}
              rows={assigned}
              rowKey={(user) => user.id}
              onRowActivate={(user) => navigate(userPath(user.id))}
              empty={<p className={styles.caption}>No users hold this role.</p>}
              columns={[
                { id: 'id', header: 'ID', cell: (user) => <span className={styles.idStrong}>{user.id}</span> },
                {
                  id: 'name',
                  header: 'Name',
                  cell: (user) => (
                    <span>
                      {user.fullName}
                      <br />
                      <span className={styles.muted}>{assignedSubtitle(user)}</span>
                    </span>
                  ),
                },
              ]}
            />}
          </Card>
        </div>
        <Card title={`Permission matrix · ${label}`}>
          <DataTable<PermissionDefinition>
            caption={`Permissions of the ${label} role`}
            rows={PERMISSIONS}
            rowKey={(permission) => permission.code}
            columns={[
              {
                id: 'code',
                header: 'Permission code',
                cell: (permission) => (
                  <span>
                    {permission.label}
                    <br />
                    <span className={roleStyles.code}>{permission.code}</span>
                  </span>
                ),
              },
              {
                id: 'access',
                header: 'Access',
                cell: (permission) =>
                  definition.permissions.includes(permission.code) ? (
                    <Badge tone="success" dot={false}>
                      ✓ Granted
                    </Badge>
                  ) : (
                    <span className={styles.muted}>Not granted</span>
                  ),
              },
            ]}
          />
        </Card>
      </div>
    </div>
  )
}
