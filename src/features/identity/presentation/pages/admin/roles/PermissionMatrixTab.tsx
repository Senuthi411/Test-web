import { useMemo, useState, type ReactNode } from 'react'
import { Badge, Banner, Button, Card, DataTable, DescriptionList, EmptyState, FilterSelect, SearchInput } from '@/shared/components'
import { Icon } from '@/shared/design-system'
import { ROLE_LABELS, type UserRole } from '@/shared/types'
import {
  PERMISSION_MODULES,
  PERMISSIONS,
  ROLE_CATALOG,
  ROLE_PERMISSIONS_CONFIGURABLE,
  permissionModule,
  permissionScopeRestriction,
  rolesWithPermission,
  type PermissionDefinition,
  type PermissionModule,
} from '../../../../domain/roles'
import styles from '../../../components/identity.module.css'
import roleStyles from '../RolesPage.module.css'

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

/** Searchable, read-only permission matrix. Role permissions are fixed in this version. */
export function PermissionMatrixTab({ aside }: { aside?: ReactNode }) {
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<UserRole | 'all'>('all')
  const [module, setModule] = useState<PermissionModule | 'all'>('all')
  const [selected, setSelected] = useState<PermissionDefinition | null>(null)

  const term = search.trim().toLowerCase()
  const rows = useMemo(
    () =>
      PERMISSIONS.filter((permission) => {
        if (module !== 'all' && permissionModule(permission.code) !== module) return false
        if (role !== 'all' && !rolesWithPermission(permission.code).includes(role)) return false
        if (term && !`${permission.label} ${permission.code}`.toLowerCase().includes(term)) return false
        return true
      }),
    [module, role, term],
  )
  const filtersActive = search !== '' || role !== 'all' || module !== 'all'
  const visibleRoles = role === 'all' ? ROLE_CATALOG : ROLE_CATALOG.filter((definition) => definition.role === role)

  function clearFilters() {
    setSearch('')
    setRole('all')
    setModule('all')
  }

  return (
    <div className={styles.stack}>
      <Banner tone="info" title="Core role permissions are read-only">
        The five system roles and their permissions are fixed in this version and are enforced by the backend. Change what a person can
        reach by changing their role or scope, or with temporary access.
      </Banner>
      <div className={styles.withSide}>
        <Card title="Permission matrix" action={<span className={styles.muted}>{`${rows.length} of ${PERMISSIONS.length} permissions`}</span>}>
          <div className={styles.filterBar}>
            <SearchInput
              label="Search permissions"
              placeholder="Search by name or code"
              width={300}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <FilterSelect<UserRole | 'all'>
              label="Role"
              value={role}
              onChange={setRole}
              options={[{ value: 'all', label: 'All' }, ...ROLE_CATALOG.map((definition) => ({ value: definition.role, label: ROLE_LABELS[definition.role] }))]}
            />
            <FilterSelect<PermissionModule | 'all'>
              label="Module"
              value={module}
              onChange={setModule}
              options={[{ value: 'all', label: 'All' }, ...PERMISSION_MODULES.map((item) => ({ value: item, label: item }))]}
            />
            <Button variant="ghost" onClick={clearFilters} disabled={!filtersActive}>
              Clear filters
            </Button>
          </div>
          <p className={styles.caption} aria-live="polite">
            {rows.length === 1 ? '1 permission matches' : `${rows.length} permissions match`}
          </p>
          <DataTable<PermissionDefinition>
            caption="Permission matrix"
            rows={rows}
            rowKey={(permission) => permission.code}
            onRowActivate={setSelected}
            empty={
              <EmptyState
                title="No permissions match"
                message="Change the search, role or module to see more permissions."
                icon="search"
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            }
            columns={[
              {
                id: 'capability',
                header: 'Capability',
                cell: (permission) => (
                  <span>
                    {permission.label}
                    <br />
                    <span className={roleStyles.code}>{permission.code}</span>
                  </span>
                ),
              },
              ...visibleRoles.map((definition) => ({
                id: definition.role,
                header: ROLE_LABELS[definition.role],
                cell: (permission: PermissionDefinition) => (
                  <GrantCell granted={definition.permissions.includes(permission.code)} role={ROLE_LABELS[definition.role]} />
                ),
              })),
            ]}
          />
        </Card>
        <div className={styles.stack}>
          <Card title="Permission details">
            {selected ? (
              <PermissionDetails permission={selected} />
            ) : (
              <p className={styles.muted}>Select a permission to see what it allows, which roles hold it and how it is limited.</p>
            )}
          </Card>
          {aside}
        </div>
      </div>
    </div>
  )
}

function PermissionDetails({ permission }: { permission: PermissionDefinition }) {
  const roles = rolesWithPermission(permission.code)
  return (
    <DescriptionList
      items={[
        { label: 'Name', value: permission.label },
        { label: 'Code', value: <span className={roleStyles.code}>{permission.code}</span> },
        { label: 'Module', value: permissionModule(permission.code) },
        { label: 'Description', value: permission.description },
        {
          label: 'Roles',
          value:
            roles.length === 0 ? (
              'No role'
            ) : (
              <span className={roleStyles.chips}>
                {roles.map((item) => (
                  <Badge key={item} tone="neutral" dot={false}>
                    {ROLE_LABELS[item]}
                  </Badge>
                ))}
              </span>
            ),
        },
        { label: 'Scope restrictions', value: permissionScopeRestriction(permission.code) },
        { label: 'Configurable', value: ROLE_PERMISSIONS_CONFIGURABLE ? 'Yes' : 'No · core role permission, read-only' },
      ]}
    />
  )
}
