import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Badge, Button, Card, DescriptionList, EmptyState, FilterSelect, SearchInput } from '@/shared/components'
import { Icon } from '@/shared/design-system'
import { ROLE_LABELS, type UserRole } from '@/shared/types'
import {
  PERMISSION_GROUPS,
  PERMISSIONS,
  ROLE_CATALOG,
  ROLE_PERMISSIONS_CONFIGURABLE,
  permissionCell,
  permissionGroup,
  permissionScopeRestriction,
  rolesWithPermission,
  type PermissionDefinition,
  type PermissionGroup,
} from '../../../../domain/roles'
import styles from '../../../components/identity.module.css'
import roleStyles from '../RolesPage.module.css'
import { PermissionLegend, PermissionState } from './PermissionState'
import { RoleComparison } from './RoleComparison'

/** Searchable, grouped, read-only permission matrix. Role permissions are fixed in this version. */
export function PermissionMatrixTab() {
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<UserRole | 'all'>('all')
  const [group, setGroup] = useState<PermissionGroup | 'all'>('all')
  const [collapsed, setCollapsed] = useState<ReadonlySet<PermissionGroup>>(new Set())
  const [selected, setSelected] = useState<PermissionDefinition | null>(null)

  const term = search.trim().toLowerCase()
  const rows = useMemo(
    () =>
      PERMISSIONS.filter((permission) => {
        if (group !== 'all' && permissionGroup(permission.code) !== group) return false
        if (role !== 'all' && !rolesWithPermission(permission.code).includes(role)) return false
        if (term && !`${permission.label} ${permission.code} ${permission.description}`.toLowerCase().includes(term)) return false
        return true
      }),
    [group, role, term],
  )
  const groups = PERMISSION_GROUPS.map((name) => ({ name, permissions: rows.filter((permission) => permissionGroup(permission.code) === name) })).filter(
    (item) => item.permissions.length > 0,
  )
  const filtersActive = search !== '' || role !== 'all' || group !== 'all'
  const visibleRoles = role === 'all' ? ROLE_CATALOG : ROLE_CATALOG.filter((definition) => definition.role === role)
  // While searching or filtering every matching group is shown open.
  const isOpen = (name: PermissionGroup) => filtersActive || !collapsed.has(name)

  function toggle(name: PermissionGroup) {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function clearFilters() {
    setSearch('')
    setRole('all')
    setGroup('all')
  }

  return (
    <div className={styles.stack}>
      <div className={roleStyles.matrixLayout}>
        <Card title="Permission matrix" action={<span className={styles.muted}>Read-only</span>}>
          <div className={styles.filterBar}>
            <SearchInput
              label="Search permissions"
              placeholder="Search by name, code or description"
              width={300}
              style={{ maxWidth: '100%' }}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <FilterSelect<UserRole | 'all'>
              label="Role"
              value={role}
              onChange={setRole}
              options={[{ value: 'all', label: 'All' }, ...ROLE_CATALOG.map((definition) => ({ value: definition.role, label: ROLE_LABELS[definition.role] }))]}
            />
            <FilterSelect<PermissionGroup | 'all'>
              label="Module"
              value={group}
              onChange={setGroup}
              options={[{ value: 'all', label: 'All' }, ...PERMISSION_GROUPS.map((item) => ({ value: item, label: item }))]}
            />
            <Button variant="ghost" onClick={clearFilters} disabled={!filtersActive}>
              Clear filters
            </Button>
          </div>
          <div className={roleStyles.matrixBar}>
            <p className={styles.caption} aria-live="polite">
              {rows.length === 1 ? '1 permission matches' : `${rows.length} permissions match`}
            </p>
            {!filtersActive && (
              <span className={roleStyles.chips}>
                <button type="button" className={styles.textButton} onClick={() => setCollapsed(new Set())} disabled={collapsed.size === 0}>
                  Expand all
                </button>
                <button type="button" className={styles.textButton} onClick={() => setCollapsed(new Set(PERMISSION_GROUPS))} disabled={collapsed.size === PERMISSION_GROUPS.length}>
                  Collapse all
                </button>
              </span>
            )}
          </div>
          <PermissionLegend />
          <p className={styles.caption}>
            The five roles are predefined and their permissions cannot be edited here. Roles are assigned in User Management. The backend enforces
            every permission and scope on each request; this matrix only describes them.
          </p>
          {rows.length === 0 ? (
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
          ) : (
            <div className={roleStyles.matrixScroll} role="region" aria-label="Permission matrix scroll area" tabIndex={0}>
              <table className={roleStyles.matrix}>
                <caption className="tl-visually-hidden">Permission matrix</caption>
                <thead>
                  <tr>
                    <th scope="col">Permission</th>
                    {visibleRoles.map((definition) => (
                      <th key={definition.role} scope="col">
                        <Link
                          to={`/admin/roles/${definition.slug}`}
                          className={roleStyles.inlineLink}
                          aria-label={`View details of the ${ROLE_LABELS[definition.role]} role`}
                        >
                          {ROLE_LABELS[definition.role]}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                {groups.map((item) => {
                  const open = isOpen(item.name)
                  const panelId = `matrix-group-${PERMISSION_GROUPS.indexOf(item.name)}`
                  return (
                    <tbody key={item.name} id={panelId}>
                      <tr className={roleStyles.groupRow}>
                        <th scope="colgroup" colSpan={visibleRoles.length + 1}>
                          <button
                            type="button"
                            className={roleStyles.groupToggle}
                            aria-expanded={open}
                            aria-controls={panelId}
                            disabled={filtersActive}
                            onClick={() => toggle(item.name)}
                          >
                            <Icon name={open ? 'down' : 'right'} size={14} />
                            {item.name}
                            <span className={roleStyles.groupCount}>({item.permissions.length})</span>
                          </button>
                        </th>
                      </tr>
                      {open &&
                        item.permissions.map((permission) => (
                          <tr key={permission.code} data-selected={selected?.code === permission.code || undefined}>
                            <th scope="row">
                              <button type="button" className={roleStyles.permissionButton} onClick={() => setSelected(permission)}>
                                <span className={roleStyles.permissionName}>{permission.label}</span>
                                <span className={roleStyles.code}>{permission.code}</span>
                              </button>
                            </th>
                            {visibleRoles.map((definition) => (
                              <td key={definition.role}>
                                <PermissionState state={permissionCell(definition, permission.code)} role={ROLE_LABELS[definition.role]} compact />
                              </td>
                            ))}
                          </tr>
                        ))}
                    </tbody>
                  )
                })}
              </table>
            </div>
          )}
        </Card>
        <Card title="Permission details" aria-label="Permission details">
          {selected ? (
            <PermissionDetails permission={selected} />
          ) : (
            <p className={styles.muted}>Select a permission to see what it allows, which roles hold it and how it is limited.</p>
          )}
        </Card>
      </div>
      <RoleComparison />
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
        { label: 'Module', value: permissionGroup(permission.code) },
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
