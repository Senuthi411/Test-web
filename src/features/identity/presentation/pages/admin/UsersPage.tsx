import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  ActionMenu,
  Button,
  ButtonLink,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  FilterSelect,
  PageHeader,
  Pagination,
  SearchInput,
  usePageBreadcrumbs,
} from '@/shared/components'
import { useDebouncedValue } from '@/shared/hooks'
import { ROLE_LABELS, USER_ROLES, type UserRole } from '@/shared/types'
import { paginate } from '@/shared/utilities/pagination'
import type { IdentityUser } from '../../../domain/models'
import { shortEstateName } from '../../../domain/scope'
import { PersonCell, RoleBadge, StatusBadge } from '../../components/common'
import { scopeLabel, useDemoWording, useExportAction, userPath } from '../../components/helpers'
import { useDivisions, useEstates, useUsers } from '../../services/queries'
import styles from '../../components/identity.module.css'
import { useIdentityTableSort } from '../../components/useIdentityTableSort'

const PAGE_SIZE = 15

/** ID-03 "Role" filter, in the order of the design. */
const ROLE_FILTER_ORDER: UserRole[] = ['ADMINISTRATOR', 'SUPERVISOR', 'DISEASE_EXPERT', 'FIELD_WORKER', 'REPORTING_USER']

type StatusFilter = 'all' | 'active' | 'inactive'

/** ID-03 User Management (Figma 15:2). */
export function UsersPage() {
  usePageBreadcrumbs([{ label: 'Administration', to: '/admin' }, { label: 'Users' }])
  const users = useUsers()
  const estates = useEstates()
  const divisions = useDivisions()
  const { demoWord } = useDemoWording()
  const exportAction = useExportAction('users')
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [role, setRole] = useState<UserRole | 'all'>('all')
  const [estate, setEstate] = useState('all')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [page, setPage] = useState(1)
  const term = useDebouncedValue(search.trim().toLowerCase(), 200)

  const estateOfDivision = useMemo(
    () => new Map((divisions.data ?? []).map((division) => [division.id, division.estateId])),
    [divisions.data],
  )

  const filtered = useMemo(() => {
    return (users.data ?? []).filter((user) => {
      if (role !== 'all' && user.role !== role) return false
      if (status !== 'all' && user.status !== status) return false
      if (estate !== 'all') {
        const inEstate =
          user.role === 'ADMINISTRATOR' ||
          user.estateIds.includes(estate) ||
          user.divisionIds.some((id) => estateOfDivision.get(id) === estate)
        if (!inEstate) return false
      }
      if (term) {
        const haystack = `${user.fullName} ${user.email} ${user.id}`.toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
  }, [users.data, role, status, estate, term, estateOfDivision])

  const filtersActive = search !== '' || role !== 'all' || estate !== 'all' || status !== 'active'
  const table = useIdentityTableSort(filtered, { user: (user) => user.fullName, id: (user) => user.id, role: (user) => ROLE_LABELS[user.role], email: (user) => user.email, status: (user) => user.status })
  const pageRows = paginate(table.rows, page, PAGE_SIZE)
  const estateCount = estates.data?.length
  const divisionCount = divisions.data?.length

  function resetFilters() {
    setSearch('')
    setRole('all')
    setEstate('all')
    setStatus('active')
    setPage(1)
  }

  const withReset = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value)
    setPage(1)
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="User Management"
        subtitle={
          users.data
            ? `${users.data.length} ${demoWord}accounts across ${estateCount ?? '…'} estates and ${divisionCount ?? '…'} divisions`
            : 'Accounts, roles and scope'
        }
        actions={
          <>
            <Button variant="secondary" icon="download" onClick={exportAction.run} loading={exportAction.pending}>
              Export
            </Button>
            <ButtonLink to="/admin/users/new" icon="plus">
              Create user
            </ButtonLink>
          </>
        }
      />
      <Card>
        <div className={styles.filterBar}>
          <SearchInput
            label="Search users"
            placeholder="Search by name, email or user ID"
            width={360}
            value={search}
            onChange={(event) => withReset(setSearch)(event.target.value)}
          />
          <FilterSelect<UserRole | 'all'>
            label="Role"
            value={role}
            onChange={withReset(setRole)}
            options={[
              { value: 'all', label: 'All' },
              ...ROLE_FILTER_ORDER.filter((item) => USER_ROLES.includes(item)).map((item) => ({ value: item, label: ROLE_LABELS[item] })),
            ]}
          />
          <FilterSelect
            label="Estate"
            value={estate}
            onChange={withReset(setEstate)}
            options={[{ value: 'all', label: 'All' }, ...(estates.data ?? []).map((item) => ({ value: item.id, label: shortEstateName(item.name) }))]}
          />
          <FilterSelect<StatusFilter>
            label="Status"
            value={status}
            onChange={withReset(setStatus)}
            options={[
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
          <Button variant="ghost" onClick={resetFilters} disabled={!filtersActive}>
            Reset filters
          </Button>
        </div>

        {users.isError ? (
          <ErrorState error={users.error} onRetry={() => void users.refetch()} />
        ) : (
          <>
            <DataTable<IdentityUser>
              caption="Users"
              sort={table.sort}
              onSort={(id) => { table.onSort(id); setPage(1) }}
              loading={users.isPending}
              rows={pageRows}
              rowKey={(user) => user.id}
              onRowActivate={(user) => navigate(userPath(user.id))}
              empty={
                <EmptyState
                  title="No users match these filters"
                  message="Change the search or filters to see more users."
                  action={
                    filtersActive ? (
                      <Button variant="secondary" onClick={resetFilters}>
                        Reset filters
                      </Button>
                    ) : undefined
                  }
                />
              }
              columns={[
                { id: 'user', header: 'User', sortable: true, cell: (user) => <PersonCell name={user.fullName} /> },
                { id: 'id', header: 'User ID', sortable: true, cell: (user) => <span className={styles.muted}>{user.id}</span> },
                { id: 'role', header: 'Role', sortable: true, cell: (user) => <RoleBadge role={user.role} /> },
                { id: 'email', header: 'Email', sortable: true, cell: (user) => user.email },
                { id: 'scope', header: 'Scope', cell: (user) => <span className={styles.muted}>{scopeLabel(user)}</span> },
                { id: 'status', header: 'Status', sortable: true, cell: (user) => <StatusBadge status={user.status} /> },
                {
                  id: 'actions',
                  header: 'Actions',
                  align: 'end',
                  width: '56px',
                  cell: (user) => (
                    <ActionMenu
                      label={`Actions for ${user.fullName}`}
                      items={[
                        { id: 'view', label: 'View details', icon: 'user', to: userPath(user.id) },
                        { id: 'edit', label: 'Edit user', icon: 'edit', to: `${userPath(user.id)}/edit` },
                        { id: 'scope', label: 'Manage scope', icon: 'layers', to: `${userPath(user.id)}/scope`, disabled: user.role === 'ADMINISTRATOR' },
                      ]}
                    />
                  ),
                },
              ]}
            />
            {!users.isPending && filtered.length > 0 && (
              <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} itemLabel={`${demoWord}users`} />
            )}
          </>
        )}
      </Card>
    </div>
  )
}
