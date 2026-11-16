import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Badge, Button, Card, DataTable, EmptyState, ErrorState, FilterSelect, Pagination, SearchInput, TextField, type BadgeTone } from '@/shared/components'
import { ROLE_LABELS, type UserRole } from '@/shared/types'
import { formatDateTime } from '@/shared/utilities/format'
import { paginate } from '@/shared/utilities/pagination'
import {
  ACCESS_HISTORY_ACTION_LABELS,
  IDENTITY_HISTORY_ACTIONS,
  isIdentityHistoryAction,
  type AccessHistoryAction,
  type AccessHistoryEntry,
  type AccessHistoryResult,
} from '../../../../domain/accessGrants'
import { ROLE_CATALOG } from '../../../../domain/roles'
import { isServiceUnavailable, userPath } from '../../../components/helpers'
import { useIdentityServices } from '../../../services/identityServices'
import { useAccessHistory } from '../../../services/queries'
import styles from '../../../components/identity.module.css'

const PAGE_SIZE = 15
const RESULT_LABELS: Record<AccessHistoryResult, string> = { success: 'Success', rejected: 'Rejected', failed: 'Failed' }
const RESULT_TONES: Record<AccessHistoryResult, BadgeTone> = { success: 'success', rejected: 'warning', failed: 'danger' }

/** Local calendar day (YYYY-MM-DD) of an instant, for the date-range filter. */
const localDay = (iso: string) => {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const notRecorded = <span className={styles.muted}>Not recorded</span>

/**
 * Read-only identity and authorization history, as recorded by the audit log: role, permanent
 * scope and account-status changes and device-access revocations. Operational assignments are
 * not authorization changes and are not shown. Nothing here can be edited.
 */
export function AccessHistoryTab() {
  const { demo } = useIdentityServices()
  const history = useAccessHistory()
  const [employee, setEmployee] = useState('')
  const [role, setRole] = useState<UserRole | 'all'>('all')
  const [action, setAction] = useState<AccessHistoryAction | 'all'>('all')
  const [actor, setActor] = useState('all')
  const [result, setResult] = useState<AccessHistoryResult | 'all'>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  const term = employee.trim().toLowerCase()
  const all = useMemo(() => (history.data ?? []).filter((entry) => isIdentityHistoryAction(entry.action)), [history.data])
  const actors = useMemo(
    () => [...new Map(all.flatMap((entry) => (entry.performedBy ? [[entry.performedBy.id, entry.performedBy] as const] : []))).values()].sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [all],
  )
  const filtered = useMemo(
    () =>
      all.filter((entry) => {
        if (role !== 'all' && entry.employee.role !== role) return false
        if (action !== 'all' && entry.action !== action) return false
        if (actor !== 'all' && entry.performedBy?.id !== actor) return false
        if (result !== 'all' && entry.result !== result) return false
        const day = localDay(entry.at)
        if (from && day < from) return false
        if (to && day > to) return false
        if (term && !`${entry.employee.fullName} ${entry.employee.id}`.toLowerCase().includes(term)) return false
        return true
      }),
    [all, role, action, actor, result, from, to, term],
  )
  const filtersActive = employee !== '' || role !== 'all' || action !== 'all' || actor !== 'all' || result !== 'all' || from !== '' || to !== ''
  const rangeError = from && to && to < from ? 'The end date is before the start date' : undefined

  const withReset = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value)
    setPage(1)
  }

  function clearFilters() {
    setEmployee('')
    setRole('all')
    setAction('all')
    setActor('all')
    setResult('all')
    setFrom('')
    setTo('')
    setPage(1)
  }

  if (history.isError && isServiceUnavailable(history.error)) {
    return (
      <Card>
        <EmptyState
          icon="info"
          title="Access history is not available yet"
          message="The backend audit log has no access-history service yet. No records are shown, and none are made up."
        />
      </Card>
    )
  }

  return (
    <Card
      title="Access history"
      action={<span className={styles.muted}>{demo ? 'Read-only · demonstration audit records' : 'Read-only · from the audit log'}</span>}
    >
      <div className={styles.filterBar}>
        <SearchInput
          label="Employee"
          placeholder="Search by employee or user ID"
          width={260}
          style={{ maxWidth: '100%' }}
          value={employee}
          onChange={(event) => withReset(setEmployee)(event.target.value)}
        />
        <FilterSelect<AccessHistoryAction | 'all'>
          label="Event type"
          value={action}
          onChange={withReset(setAction)}
          options={[{ value: 'all', label: 'All' }, ...IDENTITY_HISTORY_ACTIONS.map((item) => ({ value: item, label: ACCESS_HISTORY_ACTION_LABELS[item] }))]}
        />
        <FilterSelect<UserRole | 'all'>
          label="Role"
          value={role}
          onChange={withReset(setRole)}
          options={[{ value: 'all', label: 'All' }, ...ROLE_CATALOG.map((item) => ({ value: item.role, label: ROLE_LABELS[item.role] }))]}
        />
        <FilterSelect<string>
          label="Actor"
          value={actor}
          onChange={withReset(setActor)}
          options={[{ value: 'all', label: 'All' }, ...actors.map((item) => ({ value: item.id, label: item.fullName }))]}
        />
        <FilterSelect<AccessHistoryResult | 'all'>
          label="Result"
          value={result}
          onChange={withReset(setResult)}
          options={[{ value: 'all', label: 'All' }, ...(Object.keys(RESULT_LABELS) as AccessHistoryResult[]).map((item) => ({ value: item, label: RESULT_LABELS[item] }))]}
        />
        <TextField label="From" type="date" value={from} onChange={(event) => withReset(setFrom)(event.target.value)} />
        <TextField label="To" type="date" value={to} onChange={(event) => withReset(setTo)(event.target.value)} error={rangeError} />
        <Button variant="ghost" onClick={clearFilters} disabled={!filtersActive}>
          Clear filters
        </Button>
      </div>
      {history.isError ? (
        <ErrorState error={history.error} onRetry={() => void history.refetch()} />
      ) : (
        <>
          <DataTable<AccessHistoryEntry>
            caption="Access history"
            loading={history.isPending}
            rows={paginate(filtered, page, PAGE_SIZE)}
            rowKey={(entry) => entry.id}
            empty={
              all.length === 0 ? (
                <EmptyState title="No access changes recorded" message="Role, permanent scope and account-status changes and device-access revocations appear here once they are recorded." />
              ) : (
                <EmptyState
                  title="No records match these filters"
                  action={
                    <Button variant="secondary" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              )
            }
            columns={[
              { id: 'at', header: 'When', cell: (entry) => <span className={styles.muted}>{formatDateTime(entry.at)}</span> },
              {
                id: 'employee',
                header: 'Employee',
                cell: (entry) => (
                  <span>
                    {entry.employee.fullName}
                    <br />
                    <span className={styles.muted}>
                      {entry.employee.id} · {ROLE_LABELS[entry.employee.role]}
                    </span>
                  </span>
                ),
              },
              { id: 'action', header: 'Event', cell: (entry) => ACCESS_HISTORY_ACTION_LABELS[entry.action] },
              { id: 'previous', header: 'Previous', cell: (entry) => entry.previousAccess ?? notRecorded },
              { id: 'new', header: 'New', cell: (entry) => entry.newAccess ?? notRecorded },
              { id: 'by', header: 'Actor', cell: (entry) => entry.performedBy?.fullName ?? notRecorded },
              { id: 'reason', header: 'Reason', cell: (entry) => entry.reason ?? <span className={styles.muted}>—</span> },
              {
                id: 'result',
                header: 'Outcome',
                cell: (entry) => (
                  <Badge tone={RESULT_TONES[entry.result]} dot={false}>
                    {RESULT_LABELS[entry.result]}
                  </Badge>
                ),
              },
              {
                id: 'details',
                header: 'Details',
                cell: (entry) => (
                  <Link to={userPath(entry.employee.id)} className={styles.link} aria-label={`View ${entry.employee.fullName}`}>
                    View user
                  </Link>
                ),
              },
            ]}
          />
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} itemLabel="records" />
        </>
      )}
    </Card>
  )
}
