import { useMemo, useState } from 'react'
import { Badge, Button, Card, DataTable, EmptyState, ErrorState, FilterSelect, Pagination, SearchInput, TextField, type BadgeTone } from '@/shared/components'
import { ROLE_LABELS, type UserRole } from '@/shared/types'
import { formatDateTime } from '@/shared/utilities/format'
import { paginate } from '@/shared/utilities/pagination'
import {
  ACCESS_HISTORY_ACTION_LABELS,
  type AccessHistoryAction,
  type AccessHistoryEntry,
  type AccessHistoryResult,
} from '../../../../domain/accessGrants'
import { ROLE_CATALOG } from '../../../../domain/roles'
import { useIdentityServices } from '../../../services/identityServices'
import { useAccessHistory } from '../../../services/queries'
import styles from '../../../components/identity.module.css'
import { isServiceUnavailable } from './grantDisplay'

const PAGE_SIZE = 15
const RESULT_LABELS: Record<AccessHistoryResult, string> = { success: 'Success', rejected: 'Rejected', failed: 'Failed' }
const RESULT_TONES: Record<AccessHistoryResult, BadgeTone> = { success: 'success', rejected: 'warning', failed: 'danger' }

/** Local calendar day (YYYY-MM-DD) of an instant, for the date-range filter. */
const localDay = (iso: string) => {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Read-only access history, as recorded by the audit log. Nothing here can be edited. */
export function AccessHistoryTab() {
  const { demo } = useIdentityServices()
  const history = useAccessHistory()
  const [employee, setEmployee] = useState('')
  const [role, setRole] = useState<UserRole | 'all'>('all')
  const [action, setAction] = useState<AccessHistoryAction | 'all'>('all')
  const [result, setResult] = useState<AccessHistoryResult | 'all'>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  const term = employee.trim().toLowerCase()
  const all = useMemo(() => history.data ?? [], [history.data])
  const filtered = useMemo(
    () =>
      all.filter((entry) => {
        if (role !== 'all' && entry.employee.role !== role) return false
        if (action !== 'all' && entry.action !== action) return false
        if (result !== 'all' && entry.result !== result) return false
        const day = localDay(entry.at)
        if (from && day < from) return false
        if (to && day > to) return false
        if (term && !`${entry.employee.fullName} ${entry.employee.id}`.toLowerCase().includes(term)) return false
        return true
      }),
    [all, role, action, result, from, to, term],
  )
  const filtersActive = employee !== '' || role !== 'all' || action !== 'all' || result !== 'all' || from !== '' || to !== ''
  const rangeError = from && to && to < from ? 'The end date is before the start date' : undefined

  const withReset = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value)
    setPage(1)
  }

  function clearFilters() {
    setEmployee('')
    setRole('all')
    setAction('all')
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
      action={<span className={styles.muted}>{demo ? 'Read-only · demonstration records from this session' : 'Read-only · from the audit log'}</span>}
    >
      <div className={styles.filterBar}>
        <SearchInput
          label="Employee"
          placeholder="Search by employee or user ID"
          width={280}
          value={employee}
          onChange={(event) => withReset(setEmployee)(event.target.value)}
        />
        <FilterSelect<UserRole | 'all'>
          label="Role"
          value={role}
          onChange={withReset(setRole)}
          options={[{ value: 'all', label: 'All' }, ...ROLE_CATALOG.map((item) => ({ value: item.role, label: ROLE_LABELS[item.role] }))]}
        />
        <FilterSelect<AccessHistoryAction | 'all'>
          label="Action"
          value={action}
          onChange={withReset(setAction)}
          options={[
            { value: 'all', label: 'All' },
            ...(Object.keys(ACCESS_HISTORY_ACTION_LABELS) as AccessHistoryAction[]).map((item) => ({ value: item, label: ACCESS_HISTORY_ACTION_LABELS[item] })),
          ]}
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
                <EmptyState title="No access changes recorded" message="Temporary access requests and permanent scope changes appear here once they are recorded." />
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
              { id: 'action', header: 'Action', cell: (entry) => ACCESS_HISTORY_ACTION_LABELS[entry.action] },
              { id: 'previous', header: 'Previous access', cell: (entry) => entry.previousAccess ?? <span className={styles.muted}>Not recorded</span> },
              { id: 'new', header: 'New access', cell: (entry) => entry.newAccess ?? <span className={styles.muted}>Not recorded</span> },
              { id: 'by', header: 'Performed by', cell: (entry) => entry.performedBy?.fullName ?? <span className={styles.muted}>Not recorded</span> },
              { id: 'reason', header: 'Reason', cell: (entry) => entry.reason ?? <span className={styles.muted}>—</span> },
              {
                id: 'result',
                header: 'Result',
                cell: (entry) => (
                  <Badge tone={RESULT_TONES[entry.result]} dot={false}>
                    {RESULT_LABELS[entry.result]}
                  </Badge>
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
