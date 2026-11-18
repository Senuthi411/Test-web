import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
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
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  usePageBreadcrumbs,
  useToast,
  type ActionMenuItem,
} from '@/shared/components'
import { useDebouncedValue, useTableSort } from '@/shared/hooks'
import { formatDateTime } from '@/shared/utilities/format'
import { paginate } from '@/shared/utilities/pagination'
import type { DeviceSession, DeviceSessionStatus } from '../../../domain/models'
import { PersonCell, SessionStatusBadge } from '../../components/common'
import { errorMessage, useRelativeTime, userPath } from '../../components/helpers'
import { useIdentityServices } from '../../services/identityServices'
import { useDeviceSessions, useDivisions, useRequestSessionRecovery, useRevokeDeviceSession } from '../../services/queries'
import styles from '../../components/identity.module.css'

const PAGE_SIZE = 15
const DAY_MS = 24 * 60 * 60 * 1000
const DETAILS_ID = 'device-session-details'

type StatusFilter = 'all' | DeviceSessionStatus
type WindowFilter = '7' | '30' | '90'

const actionsLabel = (session: DeviceSession) => `Actions for ${session.id}`

/** Focuses a row's actions button, or the search box when the row is no longer listed. */
function focusRowActions(sessionId: string) {
  const trigger = document.querySelector<HTMLElement>(`button[aria-label="Actions for ${CSS.escape(sessionId)}"]`)
  ;(trigger ?? document.querySelector<HTMLElement>('input[aria-label="Search sessions"]'))?.focus()
}

/**
 * ID-13 Device Sessions (Figma 17:613): a full-width session table. Details open on demand
 * in a right-side drawer (row menu → View details, or a `?session=` link from the dashboard).
 */
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
  const [confirming, setConfirming] = useState<{ session: DeviceSession; from: 'table' | 'details' } | null>(null)
  const [revokeError, setRevokeError] = useState<unknown>(null)
  const term = useDebouncedValue(search.trim().toLowerCase(), 200)

  const userFilter = params.get('user') ?? 'all'
  const detailsId = params.get('session')
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
  // One drawer, driven by the address: it always shows the session named there.
  const details = detailsId ? (sessions.find((session) => session.id === detailsId) ?? null) : null
  const filtersActive = search !== '' || userFilter !== 'all' || status !== 'all' || lastSeen !== '30'
  const table = useTableSort(filtered, { session: (row) => row.id, user: (row) => row.user.fullName, device: (row) => row.device, seen: (row) => row.lastSeenAt, status: (row) => row.status })

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
    setParams(detailsId ? { session: detailsId } : {}, { replace: true })
  }

  function askRevoke(session: DeviceSession, from: 'table' | 'details') {
    setRevokeError(null)
    setConfirming({ session, from })
  }

  function confirmRevoke() {
    if (!confirming) return
    setRevokeError(null)
    revoke.mutate(confirming.session.id, {
      onSuccess: (session) => {
        setConfirming(null)
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

  /** Row actions follow the session's status; a revoked session is never reactivated. */
  function rowActions(session: DeviceSession): ActionMenuItem[] {
    const view: ActionMenuItem = { id: 'view', label: 'View details', icon: 'eye', onSelect: () => updateParam('session', session.id) }
    if (session.status === 'active') return [view, { id: 'revoke', label: 'Revoke session', icon: 'lock', danger: true, onSelect: () => askRevoke(session, 'table') }]
    if (session.status === 'revoked') return [view, { id: 'recover', label: 'Start recovery', icon: 'refresh', onSelect: () => startRecovery(session) }]
    return [view]
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
      <Card>
        <div className={styles.filterBar}>
          <SearchInput
            label="Search sessions"
            placeholder="Search by session, user or device"
            width={320}
            style={{ maxWidth: '100%' }}
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
              onSort={(id) => {
                table.onSort(id)
                setPage(1)
              }}
              loading={query.isPending}
              rows={paginate(table.rows, page, PAGE_SIZE)}
              rowKey={(session) => session.id}
              empty={<EmptyState title="No device sessions match these filters" message="Change the search or filters, or widen the Last seen window." />}
              columns={[
                { id: 'session', header: 'Session', sortable: true, cell: (session) => <span className={styles.idStrong}>{session.id}</span> },
                {
                  id: 'user',
                  header: 'User',
                  sortable: true,
                  cell: (session) => (
                    <span className={styles.stackTight}>
                      <PersonCell name={session.user.fullName} to={userPath(session.user.id)} />
                      <span className={styles.muted}>{session.user.id}</span>
                    </span>
                  ),
                },
                { id: 'device', header: 'Device', sortable: true, cell: (session) => session.device },
                { id: 'seen', header: 'Last seen', sortable: true, cell: (session) => <span title={formatDateTime(session.lastSeenAt)}>{relative(session.lastSeenAt)}</span> },
                { id: 'status', header: 'Status', sortable: true, cell: (session) => <SessionStatusBadge status={session.status} /> },
                {
                  id: 'actions',
                  header: 'Actions',
                  align: 'end',
                  width: '72px',
                  cell: (session) => <ActionMenu label={actionsLabel(session)} items={rowActions(session)} />,
                },
              ]}
            />
            {!query.isPending && filtered.length > 0 && (
              <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} itemLabel="sessions" />
            )}
          </>
        )}
      </Card>

      {details && (
        <SessionDetailsDrawer
          session={details}
          onClose={() => updateParam('session', null)}
          onRevoke={() => askRevoke(details, 'details')}
          onRecover={() => startRecovery(details)}
          recovering={recovery.isPending}
        />
      )}

      <ConfirmDialog
        open={confirming !== null}
        title={`Revoke session ${confirming?.session.id ?? ''}?`}
        confirmLabel="Revoke session"
        destructive
        pending={revoke.isPending}
        onCancel={() => setConfirming(null)}
        onConfirm={confirmRevoke}
        returnFocus={() => {
          if (!confirming) return
          // Back to the drawer it was opened from, or to the row's actions button.
          if (confirming.from === 'details') document.getElementById(DETAILS_ID)?.focus()
          else focusRowActions(confirming.session.id)
        }}
      >
        <div className={styles.stack}>
          <p className={styles.muted}>
            {confirming?.session.user.fullName} ({confirming?.session.user.id}) · {confirming?.session.device}. A revoked session cannot be reactivated
            and cannot upload. Unsynced evidence stays on the device; recovery needs a new validated session.
          </p>
          {revokeError !== null && <Banner tone="error">{errorMessage(revokeError)}</Banner>}
        </div>
      </ConfirmDialog>
    </div>
  )
}

const notReported = <span className={styles.muted}>Not reported by the session data</span>

/** Session details on demand. Shows only what the session record holds. */
function SessionDetailsDrawer({
  session,
  onClose,
  onRevoke,
  onRecover,
  recovering,
}: {
  session: DeviceSession
  onClose: () => void
  onRevoke: () => void
  onRecover: () => void
  recovering: boolean
}) {
  const divisions = useDivisions()
  const divisionName = new Map((divisions.data ?? []).map((division) => [division.id, division.name]))
  const scope = session.scopeDivisionIds.map((id) => (divisionName.has(id) ? `${divisionName.get(id)} (${id})` : id))

  const footer =
    session.status === 'active' ? (
      <Button variant="destructiveOutline" icon="lock" onClick={onRevoke}>
        Revoke session
      </Button>
    ) : session.status === 'revoked' ? (
      <Button variant="secondary" icon="refresh" onClick={onRecover} loading={recovering} loadingLabel="Requesting…">
        Start recovery
      </Button>
    ) : undefined

  return (
    <Modal
      id={DETAILS_ID}
      open
      placement="end"
      title={`Session ${session.id}`}
      closeLabel="Close session details"
      onClose={onClose}
      returnFocus={() => focusRowActions(session.id)}
      footer={footer}
    >
      <div className={styles.stack}>
        <DescriptionList
          items={[
            { label: 'Session ID', value: <span className={styles.idStrong}>{session.id}</span> },
            {
              label: 'Employee',
              value: (
                <Link to={userPath(session.user.id)} className={styles.link}>
                  {session.user.fullName} ({session.user.id})
                </Link>
              ),
            },
            { label: 'Device and operating system', value: session.device },
            { label: 'Status', value: <SessionStatusBadge status={session.status} /> },
            { label: 'Authorized scope', value: scope.length > 0 ? scope.join(', ') : <span className={styles.muted}>No division scope recorded</span> },
            { label: 'Last seen', value: formatDateTime(session.lastSeenAt) },
            { label: 'Session started', value: notReported },
            ...(session.status === 'revoked'
              ? [
                  { label: 'Revoked', value: session.revokedAt ? formatDateTime(session.revokedAt) : notReported },
                  { label: 'Revocation reason', value: session.revokedReasonCode ?? notReported },
                ]
              : []),
          ]}
        />
        {session.status === 'revoked' && (
          <Banner tone="warning">
            Revoked sessions cannot be reactivated and cannot upload. Recovery needs an Administrator, a verified Field Worker and an audited
            recovery ticket; a new validated device session is created and queued records are revalidated. Unsynced evidence stays on the device.
          </Banner>
        )}
        {session.status === 'active' && <p className={styles.caption}>Revoking stops uploads from this device immediately. A revoked session cannot be reactivated.</p>}
        {session.status === 'signed_out' && <p className={styles.caption}>This session was signed out on the device. It cannot be used again, so no action is available.</p>}
      </div>
    </Modal>
  )
}
