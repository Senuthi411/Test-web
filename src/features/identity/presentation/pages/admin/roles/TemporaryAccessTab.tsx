import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  Badge,
  Banner,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  DataTable,
  DescriptionList,
  EmptyState,
  ErrorState,
  FilterSelect,
  Modal,
  Pagination,
  SearchInput,
  TextAreaField,
  useToast,
} from '@/shared/components'
import { ROLE_LABELS, type UserRole } from '@/shared/types'
import { formatDateTime } from '@/shared/utilities/format'
import { paginate } from '@/shared/utilities/pagination'
import {
  GRANT_STATUS_LABELS,
  displayGrantStatus,
  endActionFor,
  isExpiringSoon,
  type AccessGrant,
  type GrantStatus,
} from '../../../../domain/accessGrants'
import { ROLE_CATALOG } from '../../../../domain/roles'
import { PersonCell, RoleBadge } from '../../../components/common'
import { errorMessage, fieldErrorsOf, userPath } from '../../../components/helpers'
import { useIdentityServices } from '../../../services/identityServices'
import { useAccessGrants, useDivisions, useEndAccessGrant, useEstates, useUsers } from '../../../services/queries'
import styles from '../../../components/identity.module.css'
import roleStyles from '../RolesPage.module.css'
import { GrantRequestModal } from './GrantRequestModal'
import { GrantStatusBadge } from './GrantStatusBadge'
import { grantPeriod, grantScope, isServiceUnavailable } from './grantDisplay'

const PAGE_SIZE = 10
const STATUS_ORDER: GrantStatus[] = ['pending_approval', 'scheduled', 'active', 'rejected', 'expired', 'revoked', 'cancelled']

/** Temporary access list, request form and revoke / cancel. */
export function TemporaryAccessTab() {
  const { clock, demo } = useIdentityServices()
  const grants = useAccessGrants()
  const users = useUsers()
  const estates = useEstates()
  const divisions = useDivisions()
  const nowMs = clock.now().getTime()
  const now = new Date(nowMs)

  const [search, setSearch] = useState('')
  const [role, setRole] = useState<UserRole | 'all'>('all')
  const [status, setStatus] = useState<GrantStatus | 'all'>('all')
  const [expiringSoon, setExpiringSoon] = useState(false)
  const [page, setPage] = useState(1)
  const [requesting, setRequesting] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [ending, setEnding] = useState<AccessGrant | null>(null)

  const term = search.trim().toLowerCase()
  const all = useMemo(() => grants.data ?? [], [grants.data])
  const filtered = useMemo(
    () =>
      all
        .filter((grant) => {
          if (role !== 'all' && grant.employee.role !== role) return false
          if (status !== 'all' && displayGrantStatus(grant, new Date(nowMs)) !== status) return false
          if (expiringSoon && !isExpiringSoon(grant, new Date(nowMs))) return false
          if (term && !`${grant.employee.fullName} ${grant.employee.id} ${grant.id}`.toLowerCase().includes(term)) return false
          return true
        })
        .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)),
    [all, role, status, expiringSoon, term, nowMs],
  )
  const filtersActive = search !== '' || role !== 'all' || status !== 'all' || expiringSoon
  const selected = all.find((grant) => grant.id === selectedId) ?? null
  const unavailable = grants.isError && isServiceUnavailable(grants.error)
  const formReady = Boolean(users.data && estates.data && divisions.data)

  const withReset = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value)
    setPage(1)
  }

  function clearFilters() {
    setSearch('')
    setRole('all')
    setStatus('all')
    setExpiringSoon(false)
    setPage(1)
  }

  if (unavailable) {
    return (
      <Card>
        <EmptyState
          icon="info"
          title="Temporary access is not available yet"
          message="The backend has no temporary-access or approval service yet. No grants are shown and none can be requested. Permanent access is still managed from Users → Manage scope."
        />
      </Card>
    )
  }

  return (
    <div className={styles.stack}>
      <Banner tone="info" title="Approval is decided by the backend">
        Requests are sent for approval; this screen never approves or activates access. No approval authority is defined yet, so new
        requests stay Pending approval.
        {demo ? ' Demonstration data: requests are kept in this browser tab only and grant no real access.' : ''}
      </Banner>
      <Card
        title="Temporary access"
        action={
          <Button icon="plus" onClick={() => setRequesting(true)} disabled={!formReady || grants.isError}>
            Request temporary access
          </Button>
        }
      >
        <div className={styles.filterBar}>
          <SearchInput
            label="Search grants"
            placeholder="Search by employee, user ID or grant ID"
            width={320}
            value={search}
            onChange={(event) => withReset(setSearch)(event.target.value)}
          />
          <FilterSelect<UserRole | 'all'>
            label="Role"
            value={role}
            onChange={withReset(setRole)}
            options={[{ value: 'all', label: 'All' }, ...ROLE_CATALOG.map((item) => ({ value: item.role, label: ROLE_LABELS[item.role] }))]}
          />
          <FilterSelect<GrantStatus | 'all'>
            label="Status"
            value={status}
            onChange={withReset(setStatus)}
            options={[{ value: 'all', label: 'All' }, ...STATUS_ORDER.map((item) => ({ value: item, label: GRANT_STATUS_LABELS[item] }))]}
          />
          <Checkbox label="Expiring within 24 hours" checked={expiringSoon} onChange={(event) => withReset(setExpiringSoon)(event.target.checked)} />
          <Button variant="ghost" onClick={clearFilters} disabled={!filtersActive}>
            Clear filters
          </Button>
        </div>
        {grants.isError ? (
          <ErrorState error={grants.error} onRetry={() => void grants.refetch()} />
        ) : (
          <>
            <DataTable<AccessGrant>
              caption="Temporary access grants"
              loading={grants.isPending}
              rows={paginate(filtered, page, PAGE_SIZE)}
              rowKey={(grant) => grant.id}
              onRowActivate={(grant) => setSelectedId(grant.id)}
              empty={
                all.length === 0 ? (
                  <EmptyState title="No temporary access" message="No grant has been requested. Requests appear here with the status the backend reports." />
                ) : (
                  <EmptyState
                    title="No grants match these filters"
                    message="Change the search or filters to see more grants."
                    action={
                      <Button variant="secondary" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    }
                  />
                )
              }
              columns={[
                {
                  id: 'employee',
                  header: 'Employee',
                  cell: (grant) => (
                    <span>
                      <PersonCell name={grant.employee.fullName} />
                      <span className={styles.muted}>{grant.employee.id}</span>
                    </span>
                  ),
                },
                { id: 'role', header: 'Role', cell: (grant) => <RoleBadge role={grant.employee.role} /> },
                { id: 'access', header: 'Added access', cell: (grant) => grantScope(grant) },
                { id: 'period', header: 'Period', cell: (grant) => <span className={styles.muted}>{grantPeriod(grant)}</span> },
                {
                  id: 'status',
                  header: 'Status',
                  cell: (grant) => (
                    <span className={roleStyles.chips}>
                      <GrantStatusBadge status={displayGrantStatus(grant, now)} />
                      {isExpiringSoon(grant, now) && (
                        <Badge tone="warning" dot={false}>
                          Expiring soon
                        </Badge>
                      )}
                    </span>
                  ),
                },
                {
                  id: 'actions',
                  header: 'Actions',
                  align: 'end',
                  cell: (grant) => {
                    const action = endActionFor(grant, now)
                    return action ? (
                      <Button
                        variant="secondary"
                        aria-label={`${action === 'revoke' ? 'Revoke' : 'Cancel'} ${grant.id} for ${grant.employee.fullName}`}
                        onClick={(event) => {
                          // The row itself opens the details; this button opens only the confirmation.
                          event.stopPropagation()
                          setEnding(grant)
                        }}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        {action === 'revoke' ? 'Revoke' : 'Cancel'}
                      </Button>
                    ) : null
                  },
                },
              ]}
            />
            <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} itemLabel="grants" />
          </>
        )}
      </Card>

      {formReady && (
        <GrantRequestModal
          open={requesting}
          onClose={() => setRequesting(false)}
          users={users.data ?? []}
          estates={estates.data ?? []}
          divisions={divisions.data ?? []}
          existing={all}
        />
      )}
      <GrantDetailsModal
        grant={selected}
        onClose={() => setSelectedId(null)}
        onEnd={(grant) => {
          setSelectedId(null)
          setEnding(grant)
        }}
      />
      <EndGrantDialog grant={ending} onClose={() => setEnding(null)} />
    </div>
  )
}

function GrantDetailsModal({ grant, onClose, onEnd }: { grant: AccessGrant | null; onClose: () => void; onEnd: (grant: AccessGrant) => void }) {
  const { clock } = useIdentityServices()
  const nowMs = clock.now().getTime()
  const now = new Date(nowMs)
  if (!grant) return null
  const action = endActionFor(grant, now)
  const shown = displayGrantStatus(grant, now)
  return (
    <Modal
      open
      onClose={onClose}
      title={`Temporary access ${grant.id}`}
      size="medium"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {action && (
            <Button variant="destructiveOutline" onClick={() => onEnd(grant)}>
              {action === 'revoke' ? 'Revoke access' : 'Cancel request'}
            </Button>
          )}
        </>
      }
    >
      <div className={styles.stack}>
        {shown !== grant.status && (
          <Banner tone="warning">The expiry has passed, so this grant is shown as expired. The backend reported “{GRANT_STATUS_LABELS[grant.status]}”.</Banner>
        )}
        <DescriptionList
          items={[
            { label: 'Employee', value: `${grant.employee.fullName} (${grant.employee.id})` },
            { label: 'Role', value: ROLE_LABELS[grant.employee.role] },
            { label: 'Added access', value: grantScope(grant) },
            { label: 'Period', value: grantPeriod(grant) },
            { label: 'Status', value: <GrantStatusBadge status={shown} /> },
            { label: 'Reason', value: grant.reason },
            { label: 'Requested by', value: `${grant.requestedBy.fullName} · ${formatDateTime(grant.requestedAt)}` },
            {
              label: 'Approval',
              value: grant.decidedBy && grant.decidedAt ? `${grant.decidedBy.fullName} · ${formatDateTime(grant.decidedAt)}` : 'Not decided',
            },
            ...(grant.endedBy && grant.endedAt
              ? [{ label: 'Ended', value: `${grant.endedBy.fullName} · ${formatDateTime(grant.endedAt)} · ${grant.endReason ?? ''}` }]
              : []),
          ]}
        />
        <Link to={`${userPath(grant.employee.id)}/scope`} className={styles.link}>
          Change permanent access for {grant.employee.fullName}
        </Link>
      </div>
    </Modal>
  )
}

function EndGrantDialog({ grant, onClose }: { grant: AccessGrant | null; onClose: () => void }) {
  const { clock } = useIdentityServices()
  const toast = useToast()
  const end = useEndAccessGrant()
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const action = grant ? endActionFor(grant, clock.now()) : null
  const revoke = action === 'revoke'
  const missing = submitted && !reason.trim() ? 'Enter the reason' : undefined
  const serverError = fieldErrorsOf(end.error).reason

  function close() {
    setReason('')
    setSubmitted(false)
    end.reset()
    onClose()
  }

  function confirm() {
    setSubmitted(true)
    if (!grant || !action || !reason.trim()) return
    end.mutate(
      { id: grant.id, action, reason },
      {
        onSuccess: (result) => {
          toast.show({ tone: 'success', title: revoke ? 'Access revoked' : 'Request cancelled', message: `${result.id} · ${GRANT_STATUS_LABELS[result.status]}` })
          close()
        },
      },
    )
  }

  return (
    <ConfirmDialog
      open={Boolean(grant && action)}
      title={revoke ? 'Revoke temporary access?' : 'Cancel temporary access?'}
      description={
        grant
          ? revoke
            ? `${grant.employee.fullName} loses ${grantScope(grant)} immediately. Their permanent access is not changed.`
            : `The grant for ${grant.employee.fullName} (${grantScope(grant)}) will not start.`
          : undefined
      }
      confirmLabel={revoke ? 'Revoke access' : 'Cancel grant'}
      cancelLabel="Keep"
      destructive
      pending={end.isPending}
      onConfirm={confirm}
      onCancel={close}
    >
      <div className={styles.stack}>
        {end.isError && !serverError && (
          <Banner tone="error" title="Nothing was changed">
            {errorMessage(end.error)}
          </Banner>
        )}
        <TextAreaField label="Reason" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} error={missing ?? serverError} />
      </div>
    </ConfirmDialog>
  )
}
