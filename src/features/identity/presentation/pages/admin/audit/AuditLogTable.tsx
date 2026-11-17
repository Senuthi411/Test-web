import { useMemo, useState, type ReactNode } from 'react'
import { Badge, Button, Card, DataTable, DescriptionList, FilterSelect, Modal, Pagination, SearchInput, TextField } from '@/shared/components'
import { formatDateTime } from '@/shared/utilities/format'
import { paginate } from '@/shared/utilities/pagination'
import type { AuditKind } from '../../../../domain/activity'
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTIONS,
  AUDIT_MODULES,
  AUDIT_OUTCOME_LABELS,
  EMPTY_AUDIT_FILTERS,
  auditActors,
  auditFiltersActive,
  filterAuditLog,
  type AuditLogEntry,
  type AuditLogFilters,
  type AuditModule,
  type AuditOutcome,
} from '../../../../domain/auditLog'
import { useDemoWording } from '../../../components/helpers'
import { useAuditLog } from '../../../services/queries'
import styles from '../../../components/identity.module.css'
import { SectionBoundary } from '../dashboard/SectionBoundary'

const PAGE_SIZE = 10

export interface AuditLogTableProps {
  title: string
  /** Restricts the table to these actions (e.g. security events). Omit for the full log. */
  kinds?: readonly AuditKind[]
  /** Shown under the table: what the source does and does not record. */
  note?: ReactNode
  emptyMessage: string
}

/**
 * Read-only audit records from the shared audit source, with search, filters, pagination
 * and a details panel. There is no edit, delete or export of audit records here.
 */
export function AuditLogTable({ title, kinds, note, emptyMessage }: AuditLogTableProps) {
  const log = useAuditLog()
  return (
    <Card title={title} aria-label={title} action={<span className={styles.muted}>Read-only</span>}>
      <SectionBoundary queries={[log]} unavailable="The audit log is not available yet: the backend audit contract has not been approved, so no records are shown.">
        {() => <AuditLogBody entries={kinds ? log.data!.filter((entry) => kinds.includes(entry.action)) : log.data!} kinds={kinds} title={title} emptyMessage={emptyMessage} />}
      </SectionBoundary>
      {note && <p className={styles.caption}>{note}</p>}
    </Card>
  )
}

function AuditLogBody({ entries, kinds, title, emptyMessage }: { entries: AuditLogEntry[]; kinds?: readonly AuditKind[]; title: string; emptyMessage: string }) {
  const { demo } = useDemoWording()
  const [filters, setFilters] = useState<AuditLogFilters>(EMPTY_AUDIT_FILTERS)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<AuditLogEntry | null>(null)

  const rows = useMemo(() => filterAuditLog(entries, filters), [entries, filters])
  const actors = useMemo(() => auditActors(entries), [entries])
  const actions = kinds ?? AUDIT_ACTIONS
  const modules = AUDIT_MODULES.filter((module) => entries.some((entry) => entry.module === module) || !kinds)
  const active = auditFiltersActive(filters)
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)

  const update = <K extends keyof AuditLogFilters>(key: K, value: AuditLogFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
  }

  return (
    <>
      <div className={styles.filterBar}>
        <SearchInput
          label={`Search ${title.toLowerCase()}`}
          placeholder="Search by person, record or action"
          width={280}
          style={{ maxWidth: '100%' }}
          value={filters.search}
          onChange={(event) => update('search', event.target.value)}
        />
        <TextField label="From" type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => update('from', event.target.value)} />
        <TextField label="To" type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => update('to', event.target.value)} />
        <FilterSelect<string>
          label="Actor"
          value={filters.actorId}
          onChange={(value) => update('actorId', value)}
          options={[{ value: 'all', label: 'All' }, ...actors.map((actor) => ({ value: actor.id, label: actor.fullName }))]}
        />
        {!kinds && (
          <FilterSelect<AuditModule | 'all'>
            label="Module"
            value={filters.module}
            onChange={(value) => update('module', value)}
            options={[{ value: 'all', label: 'All' }, ...modules.map((module) => ({ value: module, label: module }))]}
          />
        )}
        <FilterSelect<AuditKind | 'all'>
          label="Action"
          value={filters.action}
          onChange={(value) => update('action', value)}
          options={[{ value: 'all', label: 'All' }, ...actions.map((action) => ({ value: action, label: AUDIT_ACTION_LABELS[action] }))]}
        />
        <FilterSelect<AuditOutcome | 'all'>
          label="Outcome"
          value={filters.outcome}
          onChange={(value) => update('outcome', value)}
          options={[
            { value: 'all', label: 'All' },
            { value: 'success', label: AUDIT_OUTCOME_LABELS.success },
            { value: 'failure', label: AUDIT_OUTCOME_LABELS.failure },
          ]}
        />
        <Button
          variant="ghost"
          onClick={() => {
            setFilters(EMPTY_AUDIT_FILTERS)
            setPage(1)
          }}
          disabled={!active}
        >
          Clear filters
        </Button>
      </div>
      <p className={styles.caption} aria-live="polite">
        {rows.length === 1 ? '1 record' : `${rows.length} records`}
        {active ? ` match the filters (of ${entries.length})` : ''}
        {demo ? ' · demonstration data' : ''}
      </p>
      <DataTable<AuditLogEntry>
        caption={title}
        rows={paginate(rows, currentPage, PAGE_SIZE)}
        rowKey={(entry) => entry.id}
        onRowActivate={setSelected}
        rowLabel={(entry) => `View details of ${entry.summary}`}
        empty={<p className={styles.caption}>{entries.length === 0 ? emptyMessage : 'No records match the filters.'}</p>}
        columns={[
          { id: 'at', header: 'Time', cell: (entry) => <span className={styles.muted}>{formatDateTime(entry.at)}</span> },
          {
            id: 'actor',
            header: 'Actor',
            cell: (entry) =>
              entry.actor ? (
                <span className={styles.stackTight}>
                  <span>{entry.actor.fullName}</span>
                  <span className={styles.muted}>{entry.actor.id}</span>
                </span>
              ) : (
                <span className={styles.muted}>Not recorded</span>
              ),
          },
          {
            id: 'action',
            header: 'Action',
            cell: (entry) => (
              <span className={styles.stackTight}>
                <span>{AUDIT_ACTION_LABELS[entry.action]}</span>
                <span className={styles.muted}>{entry.module}</span>
              </span>
            ),
          },
          { id: 'target', header: 'Target', cell: (entry) => entry.target?.label ?? <span className={styles.muted}>—</span> },
          { id: 'outcome', header: 'Outcome', cell: (entry) => <OutcomeBadge outcome={entry.outcome} /> },
          {
            id: 'details',
            header: 'Details',
            cell: (entry) => (
              <button
                type="button"
                className={styles.textButton}
                onClick={(event) => {
                  event.stopPropagation()
                  setSelected(entry)
                }}
                aria-label={`View details of record ${entry.id}`}
              >
                View
              </button>
            ),
          },
        ]}
      />
      {rows.length > PAGE_SIZE && <Pagination page={currentPage} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} itemLabel="records" />}
      <Modal open={selected !== null} title="Audit record" description={selected?.summary} onClose={() => setSelected(null)} placement="end" size="medium">
        {selected && <AuditRecordDetails entry={selected} />}
      </Modal>
    </>
  )
}

export function OutcomeBadge({ outcome }: { outcome: AuditOutcome }) {
  return (
    <Badge tone={outcome === 'success' ? 'success' : 'danger'} dot={false}>
      {AUDIT_OUTCOME_LABELS[outcome]}
    </Badge>
  )
}

function AuditRecordDetails({ entry }: { entry: AuditLogEntry }) {
  const notRecorded = <span className={styles.muted}>Not recorded</span>
  return (
    <DescriptionList
      items={[
        { label: 'Record', value: <span className={styles.idStrong}>{entry.id}</span> },
        { label: 'Time', value: formatDateTime(entry.at) },
        { label: 'Actor', value: entry.actor ? `${entry.actor.fullName} (${entry.actor.id})` : notRecorded },
        { label: 'Action', value: AUDIT_ACTION_LABELS[entry.action] },
        { label: 'Module', value: entry.module },
        { label: 'Target', value: entry.target ? `${entry.target.label}` : notRecorded },
        { label: 'Previous value', value: entry.previousValue ?? notRecorded },
        { label: 'New value', value: entry.newValue ?? notRecorded },
        { label: 'Outcome', value: <OutcomeBadge outcome={entry.outcome} /> },
        { label: 'Reason code', value: entry.reasonCode ?? notRecorded },
        { label: 'Details', value: entry.detail || notRecorded },
        { label: 'Estates', value: entry.estateIds.length > 0 ? entry.estateIds.join(', ') : notRecorded },
      ]}
    />
  )
}
