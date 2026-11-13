import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  ActionMenu,
  Banner,
  Button,
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
import { paginate } from '@/shared/utilities/pagination'
import type { DivisionSummary } from '../../../domain/models'
import { shortEstateName } from '../../../domain/scope'
import { PersonCell, StatusBadge } from '../../components/common'
import { divisionPath, estatePath, useDemoWording, useExportAction, userPath } from '../../components/helpers'
import { DivisionFormModal } from '../../components/OrganisationModals'
import { useDivisions, useEstates } from '../../services/queries'
import styles from '../../components/identity.module.css'
import { useIdentityTableSort } from '../../components/useIdentityTableSort'

const PAGE_SIZE = 15

type StatusFilter = 'all' | 'active' | 'inactive'

/** ID-11 Division Management (Figma 17:2). */
export function DivisionsPage() {
  usePageBreadcrumbs([{ label: 'Administration', to: '/admin' }, { label: 'Divisions' }])
  const query = useDivisions()
  const estates = useEstates()
  const { demoWord } = useDemoWording()
  const exportAction = useExportAction('divisions')
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [estate, setEstate] = useState('all')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [page, setPage] = useState(1)
  const [noticeOpen, setNoticeOpen] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<DivisionSummary | null>(null)
  const term = useDebouncedValue(search.trim().toLowerCase(), 200)

  const divisions = query.data ?? []
  const filtered = divisions.filter(
    (division) =>
      (estate === 'all' || division.estateId === estate) &&
      (status === 'all' || division.status === status) &&
      (!term || `${division.name} ${division.id}`.toLowerCase().includes(term)),
  )
  const filtersActive = search !== '' || estate !== 'all' || status !== 'active'
  const estateCount = new Set(divisions.map((division) => division.estateId)).size
  const table = useIdentityTableSort(filtered, { division: (row) => row.name, id: (row) => row.id, estate: (row) => row.estateName, observations: (row) => row.observationCount, pending: (row) => row.pendingReviewCount, status: (row) => row.status })

  function reset() {
    setSearch('')
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
        title="Division Management"
        subtitle={
          query.data
            ? `${divisions.length} ${demoWord}divisions across ${estateCount} estates · division is the finest scope unit`
            : 'Division is the finest scope unit'
        }
        actions={
          <>
            <Button variant="secondary" icon="download" onClick={exportAction.run} loading={exportAction.pending}>
              Export
            </Button>
            <Button icon="plus" onClick={() => setAdding(true)} disabled={!estates.data}>
              Add division
            </Button>
          </>
        }
      />
      {noticeOpen && (
        <Banner tone="info" onDismiss={() => setNoticeOpen(false)}>
          Observations are attributed to a division ID only. The web UI never shows bush-level identifiers.
        </Banner>
      )}
      <Card>
        <div className={styles.filterBar}>
          <SearchInput
            label="Search divisions"
            placeholder="Search by division name or ID"
            width={360}
            value={search}
            onChange={(event) => withReset(setSearch)(event.target.value)}
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
              { value: 'inactive', label: 'Disabled' },
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
            <DataTable<DivisionSummary>
              caption="Divisions"
              sort={table.sort}
              onSort={(id) => { table.onSort(id); setPage(1) }}
              loading={query.isPending}
              rows={paginate(table.rows, page, PAGE_SIZE)}
              rowKey={(division) => division.id}
              onRowActivate={(division) => navigate(divisionPath(division.id))}
              empty={<EmptyState title="No divisions match these filters" message="Change the search or filters to see more divisions." />}
              columns={[
                { id: 'division', header: 'Division', sortable: true, cell: (division) => <span className={styles.idStrong}>{division.name}</span> },
                { id: 'id', header: 'ID', sortable: true, cell: (division) => <span className={styles.muted}>{division.id}</span> },
                { id: 'estate', header: 'Estate', sortable: true, cell: (division) => division.estateName },
                {
                  id: 'worker',
                  header: 'Field worker',
                  cell: (division) =>
                    division.fieldWorkers.length === 0 ? (
                      '—'
                    ) : (
                      <span className={styles.stack}>
                        {division.fieldWorkers.map((worker) => (
                          <PersonCell key={worker.id} name={worker.fullName} to={userPath(worker.id)} />
                        ))}
                      </span>
                    ),
                },
                { id: 'observations', header: 'Observations', sortable: true, cell: (division) => division.observationCount },
                { id: 'pending', header: 'Pending review', sortable: true, cell: (division) => division.pendingReviewCount },
                { id: 'status', header: 'Status', sortable: true, cell: (division) => <StatusBadge status={division.status} inactiveLabel="Disabled" /> },
                {
                  id: 'actions',
                  header: 'Actions',
                  align: 'end',
                  width: '56px',
                  cell: (division) => (
                    <ActionMenu
                      label={`Actions for ${division.name}`}
                      items={[
                        { id: 'view', label: 'View details', icon: 'layers', to: divisionPath(division.id) },
                        { id: 'edit', label: 'Edit division', icon: 'edit', onSelect: () => setEditing(division) },
                        { id: 'estate', label: 'Open estate', icon: 'map', to: estatePath(division.estateId) },
                      ]}
                    />
                  ),
                },
              ]}
            />
            {!query.isPending && filtered.length > 0 && (
              <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} itemLabel={`${demoWord}divisions`} />
            )}
          </>
        )}
      </Card>
      <DivisionFormModal open={adding} estates={estates.data ?? []} onClose={() => setAdding(false)} onSaved={(division) => navigate(divisionPath(division.id))} />
      <DivisionFormModal open={editing !== null} estates={estates.data ?? []} division={editing ?? undefined} onClose={() => setEditing(null)} />
    </div>
  )
}
