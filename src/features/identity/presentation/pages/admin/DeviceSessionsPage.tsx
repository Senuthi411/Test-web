import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  ActionMenu,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  DescriptionList,
  EmptyState,
  ErrorState,
  FilterSelect,
  PageHeader,
  Pagination,
  SearchInput,
  usePageBreadcrumbs,
  useToast,
} from '@/shared/components'
import { useDebouncedValue } from '@/shared/hooks'
import { formatDateTime } from '@/shared/utilities/format'
import { paginate } from '@/shared/utilities/pagination'
import type { DeviceSession, DeviceSessionStatus } from '../../../domain/models'
import { PersonCell, SessionStatusBadge } from '../../components/common'
import { errorMessage, useRelativeTime, userPath } from '../../components/helpers'
import { useIdentityServices } from '../../services/identityServices'
import { useDeviceSessions, useRequestSessionRecovery, useRevokeDeviceSession } from '../../services/queries'
import styles from '../../components/identity.module.css'
import { useIdentityTableSort } from '../../components/useIdentityTableSort'

const PAGE_SIZE = 15
const DAY_MS = 24 * 60 * 60 * 1000

type StatusFilter = 'all' | DeviceSessionStatus
type WindowFilter = '7' | '30' | '90'

/** ID-13 Device Sessions (Figma 17:613). */
export function DeviceSessionsPage() {
  usePageBreadcrumbs([{ label: 'Administration', to: '/admin' }, { label: 'Device Sessions' }])
  const query = useDeviceSessions()
  const { clock, demo } = useIdentityServices()
  const relative = useRelativeTime()
  const toast = useToast()
  const navigate = useNavigate()
  const revoke = useRevokeDeviceSession()
  const recovery = useRequestSessionRecovery()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [lastSeen, setLastSeen] = useState<WindowFilter>('30')
  const [page, setPage] = useState(1)
  const [confirming, setConfirming] = useState<DeviceSession | null>(null)
  const [revokeError, setRevokeError] = useState<unknown>(null)
  const term = useDebouncedValue(search.trim().toLowerCase(), 200)

  const userFilter = params.get('user') ?? 'all'
  const selectedId = params.get('session')
  const sessions = query.data ?? []
  const users = [...new Map(sessions.map((session) => [session.user.id, session.user])).values()].sort((a, b) =>
    a.fullName.localeCompare(b.fullName),
  )
  const now = clock.now().getTime()
  const filtered = sessions.filter(
    (session) =>
      (userFilter === 'all' || session.user.id === userFilter) &&
      (status === 'all' || session.status === status) &&
      now - new Date(session.lastSeenAt).getTime() <= Number(lastSeen) * DAY_MS &&
      (!term || `${session.id} ${session.user.fullName} ${session.user.id} ${session.device}`.toLowerCase().includes(term)),
  )
  const selected =
    sessions.find((session) => session.id === selectedId) ??
    filtered.find((session) => session.status === 'revoked') ??
    filtered[0] ??
    null
  const filtersActive = search !== '' || userFilter !== 'all' || status !== 'all' || lastSeen !== '30'
  const table = useIdentityTableSort(filtered, { session: (row) => row.id, device: (row) => row.device, seen: (row) => row.lastSeenAt, status: (row) => row.status })

  function updateParam(key: 'user' | 'session', value: string | null) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (value === null || value === 'all') next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )
  }

  function reset() {
    setSearch('')
    setStatus('all')
    setLastSeen('30')
    setPage(1)
    setParams({}, { replace: true })
  }

  function confirmRevoke() {
    if (!confirming) return
    setRevokeError(null)
    revoke.mutate(confirming.id, {
      onSuccess: (session) => {
        setConfirming(null)
        updateParam('session', session.id)
        toast.show({ tone: 'success', title: `Session ${session.id} revoked`, message: 'The device can no longer upload with this session.' })
      },
      onError: (error) => setRevokeError(error),
    })
  }

  function startRecovery(session: DeviceSession) {
    recovery.mutate(session.id, {
      onSuccess: () => {
        toast.show({
          tone: 'info',
          title: 'Recovery ticket requested',
          message: demo ? 'Demonstration only: no session is restored.' : 'No session is restored until every step is complete.',
        })
        navigate(`/admin/device-sessions/${session.id}/recovery`)
      },
      onError: (error) => toast.show({ tone: 'error', title: 'Recovery was not requested', message: errorMessage(error) }),
    })
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Device Sessions"
        subtitle={`Mobile app sessions for field workers${demo ? ' · illustrative session data' : ''}`}
        actions={
          <Button variant="secondary" icon="refresh" onClick={() => void query.refetch()} loading={query.isFetching && !query.isPending} loadingLabel="Refreshing…">
            Refresh
          </Button>
        }
      />
      <div className={styles.withSide}>
        <Card>
          <div className={styles.filterBar}>
            <SearchInput
              label="Search sessions"
              placeholder="Search by session, user or device"
              width={320}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
            <FilterSelect
              label="User"
              value={userFilter}
              onChange={(value) => {
                updateParam('user', value)
                setPage(1)
              }}
              options={[{ value: 'all', label: 'All' }, ...users.map((user) => ({ value: user.id, label: user.fullName }))]}
            />
            <FilterSelect<StatusFilter>
              label="Status"
              value={status}
              onChange={(value) => {
                setStatus(value)
                setPage(1)
              }}
              options={[
                { value: 'all', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'revoked', label: 'Revoked' },
                { value: 'signed_out', label: 'Signed out' },
              ]}
            />
            <FilterSelect<WindowFilter>
              label="Last seen"
              value={lastSeen}
              onChange={(value) => {
                setLastSeen(value)
                setPage(1)
              }}
              options={[
                { value: '7', label: '7 days' },
                { value: '30', label: '30 days' },
                { value: '90', label: '90 days' },
              ]}
            />
            <Button variant="ghost" onClick={reset} disabled={!filtersActive}>
              Reset filters
            </Button>
          </div>
          {query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : (
            <>
              <DataTable<DeviceSession>
                caption="Device sessions"
              sort={table.sort}
              onSort={(id) => { table.onSort(id); setPage(1) }}
                loading={query.isPending}
                rows={paginate(table.rows, page, PAGE_SIZE)}
                rowKey={(session) => session.id}
                onRowActivate={(session) => updateParam('session', session.id)}
                rowLabel={(session) => `Show session ${session.id}`}
                empty={<EmptyState title="No device sessions match these filters" message="Change the search or filters, or widen the Last seen window." />}
                columns={[
                  { id: 'session', header: 'Session', sortable: true, cell: (session) => <span className={styles.idStrong}>{session.id}</span> },
                  { id: 'user', header: 'User', cell: (session) => <PersonCell name={session.user.fullName} to={userPath(session.user.id)} /> },
                  { id: 'device', header: 'Device', sortable: true, cell: (session) => session.device },
                  { id: 'seen', header: 'Last seen', sortable: true, cell: (session) => relative(session.lastSeenAt) },
                  { id: 'status', header: 'Status', sortable: true, cell: (session) => <SessionStatusBadge status={session.status} /> },
                  {
                    id: 'actions',
                    header: 'Actions',
                    align: 'end',
                    width: '56px',
                    cell: (session) => (
                      <ActionMenu
                        label={`Actions for ${session.id}`}
                        items={[
                          { id: 'view', label: 'View details', icon: 'eye', onSelect: () => updateParam('session', session.id) },
                          {
                            id: 'revoke',
                            label: 'Revoke session',
                            icon: 'lock',
                            danger: true,
                            disabled: session.status !== 'active',
                            onSelect: () => {
                              setRevokeError(null)
                              setConfirming(session)
                            },
                          },
                        ]}
                      />
                    ),
                  },
                ]}
              />
              {!query.isPending && filtered.length > 0 && (
                <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} itemLabel="sessions" />
              )}
            </>
          )}
        </Card>

        {selected && <SessionPanel session={selected} onRevoke={() => setConfirming(selected)} onRecover={() => startRecovery(selected)} recovering={recovery.isPending} />}
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title={`Revoke session ${confirming?.id ?? ''}?`}
        confirmLabel="Revoke session"
        destructive
        pending={revoke.isPending}
        onCancel={() => setConfirming(null)}
        onConfirm={confirmRevoke}
      >
        <div className={styles.stack}>
          <p className={styles.muted}>
            {confirming?.user.fullName} ({confirming?.user.id}) · {confirming?.device}. A revoked session cannot be reactivated and cannot upload.
            Unsynced evidence stays on the device; recovery needs a new validated session.
          </p>
          {revokeError !== null && <Banner tone="error">{errorMessage(revokeError)}</Banner>}
        </div>
      </ConfirmDialog>
    </div>
  )
}

function SessionPanel({
  session,
  onRevoke,
  onRecover,
  recovering,
}: {
  session: DeviceSession
  onRevoke: () => void
  onRecover: () => void
  recovering: boolean
}) {
  const relative = useRelativeTime()
  return (
    <Card title={`Session ${session.id}`} action={<SessionStatusBadge status={session.status} />}>
      <DescriptionList
        items={[
          { label: 'User', value: `${session.user.fullName} (${session.user.id})` },
          { label: 'Device', value: session.device },
          { label: 'Scope', value: session.scopeDivisionIds.join(', ') || '—' },
          { label: 'Last seen', value: relative(session.lastSeenAt) },
          ...(session.status === 'revoked'
            ? [
                { label: 'Revoked', value: session.revokedAt ? formatDateTime(session.revokedAt) : '—' },
                { label: 'Reason code', value: session.revokedReasonCode ?? '—' },
              ]
            : []),
        ]}
      />
      {session.status === 'revoked' ? (
        <>
          <Banner tone="warning">
            Revoked sessions cannot be reactivated and cannot upload. Recovery needs an Administrator, a verified Field Worker and an audited
            recovery ticket; a new validated device session is created and queued records are revalidated. Unsynced evidence stays on the device.
          </Banner>
          <div>
            <Button variant="secondary" icon="refresh" onClick={onRecover} loading={recovering} loadingLabel="Requesting…">
              Start recovery
            </Button>
          </div>
        </>
      ) : session.status === 'active' ? (
        <div>
          <Button variant="destructiveOutline" icon="lock" onClick={onRevoke}>
            Revoke session
          </Button>
        </div>
      ) : (
        <p className={styles.caption}>This session was signed out on the device. It cannot be used again.</p>
      )}
    </Card>
  )
}
