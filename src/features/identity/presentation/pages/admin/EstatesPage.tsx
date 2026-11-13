import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  ActionMenu,
  Badge,
  BarList,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  FilterSelect,
  PageHeader,
  SearchInput,
  usePageBreadcrumbs,
} from '@/shared/components'
import { useDebouncedValue } from '@/shared/hooks'
import type { EstateSummary } from '../../../domain/models'
import { shortEstateName } from '../../../domain/scope'
import { PersonCell, StatusBadge } from '../../components/common'
import { estatePath, useDemoWording, userPath } from '../../components/helpers'
import { DivisionFormModal, EstateFormModal } from '../../components/OrganisationModals'
import { useEstates } from '../../services/queries'
import styles from '../../components/identity.module.css'
import { useIdentityTableSort } from '../../components/useIdentityTableSort'

/** ID-09 "Observations by estate" bar colours, in estate order. */
const ESTATE_COLORS = ['#2e7d32', '#7cb342', '#4f9d69']

type StatusFilter = 'all' | 'active' | 'inactive'

/** ID-09 Estate Management (Figma 16:596). */
export function EstatesPage() {
  usePageBreadcrumbs([{ label: 'Administration', to: '/admin' }, { label: 'Estates' }])
  const query = useEstates()
  const { demo, demoWord } = useDemoWording()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState('all')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<EstateSummary | null>(null)
  const [addingDivisionTo, setAddingDivisionTo] = useState<string | null>(null)
  const term = useDebouncedValue(search.trim().toLowerCase(), 200)

  const estates = useMemo(() => query.data ?? [], [query.data])
  const regions = [...new Set(estates.map((estate) => estate.region))].sort()
  const filtered = estates.filter(
    (estate) =>
      (region === 'all' || estate.region === region) &&
      (status === 'all' || estate.status === status) &&
      (!term || `${estate.name} ${estate.id} ${estate.region}`.toLowerCase().includes(term)),
  )
  const filtersActive = search !== '' || region !== 'all' || status !== 'active'
  const divisionTotal = estates.reduce((sum, estate) => sum + estate.divisionCount, 0)
  const observationTotal = estates.reduce((sum, estate) => sum + estate.observationCount, 0)
  const activeCount = estates.filter((estate) => estate.status === 'active').length
  const table = useIdentityTableSort(filtered, { estate: (row) => row.name, id: (row) => row.id, region: (row) => row.region, divisions: (row) => row.divisionCount, observations: (row) => row.observationCount, status: (row) => row.status })

  function reset() {
    setSearch('')
    setRegion('all')
    setStatus('active')
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Estate Management"
        subtitle={query.data ? `${estates.length} ${demoWord}estates · ${divisionTotal} divisions` : 'Estates, regions and divisions'}
        actions={
          <Button icon="plus" onClick={() => setAdding(true)}>
            Add estate
          </Button>
        }
      />
      <Card>
        <div className={styles.filterBar}>
          <SearchInput label="Search estates" placeholder="Search estates" width={360} value={search} onChange={(event) => setSearch(event.target.value)} />
          <FilterSelect label="Region" value={region} onChange={setRegion} options={[{ value: 'all', label: 'All' }, ...regions.map((item) => ({ value: item, label: item }))]} />
          <FilterSelect<StatusFilter>
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
          <Button variant="ghost" onClick={reset} disabled={!filtersActive}>
            Reset filters
          </Button>
        </div>
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <DataTable<EstateSummary>
            caption="Estates"
              sort={table.sort}
              onSort={(id) => { table.onSort(id) }}
            loading={query.isPending}
            rows={table.rows}
            rowKey={(estate) => estate.id}
            onRowActivate={(estate) => navigate(estatePath(estate.id))}
            empty={<EmptyState title="No estates match these filters" message="Change the search or filters to see more estates." />}
            columns={[
              { id: 'estate', header: 'Estate', sortable: true, cell: (estate) => <span className={styles.idStrong}>{estate.name}</span> },
              { id: 'id', header: 'ID', sortable: true, cell: (estate) => <span className={styles.muted}>{estate.id}</span> },
              { id: 'region', header: 'Region', sortable: true, cell: (estate) => estate.region },
              { id: 'divisions', header: 'Divisions', sortable: true, cell: (estate) => estate.divisionCount },
              {
                id: 'supervisor',
                header: 'Supervisor',
                cell: (estate) => (estate.supervisor ? <PersonCell name={estate.supervisor.fullName} to={userPath(estate.supervisor.id)} /> : '—'),
              },
              {
                id: 'expert',
                header: 'Expert',
                cell: (estate) => (estate.expert ? <PersonCell name={estate.expert.fullName} to={userPath(estate.expert.id)} /> : '—'),
              },
              { id: 'observations', header: 'Observations', sortable: true, cell: (estate) => estate.observationCount },
              { id: 'status', header: 'Status', sortable: true, cell: (estate) => <StatusBadge status={estate.status} /> },
              {
                id: 'actions',
                header: 'Actions',
                align: 'end',
                width: '56px',
                cell: (estate) => (
                  <ActionMenu
                    label={`Actions for ${estate.name}`}
                    items={[
                      { id: 'view', label: 'View details', icon: 'map', to: estatePath(estate.id) },
                      { id: 'edit', label: 'Edit estate', icon: 'edit', onSelect: () => setEditing(estate) },
                      { id: 'division', label: 'Add division', icon: 'plus', onSelect: () => setAddingDivisionTo(estate.id), disabled: estate.status !== 'active' },
                    ]}
                  />
                ),
              },
            ]}
          />
        )}
      </Card>

      {query.data && (
        <div className={styles.row3}>
          <Card title="Observations by estate">
            <BarList
              label="Observations by estate"
              items={estates.map((estate, index) => ({
                id: estate.id,
                label: shortEstateName(estate.name),
                value: estate.observationCount,
                color: ESTATE_COLORS[index % ESTATE_COLORS.length],
              }))}
            />
            <p className={styles.caption}>
              {demo ? `Demonstration counts from the fixture (${observationTotal} observations).` : `${observationTotal} observations.`}
            </p>
          </Card>
          <Card title="Divisions per estate">
            <BarList
              label="Divisions per estate"
              items={estates.map((estate) => ({ id: estate.id, label: shortEstateName(estate.name), value: estate.divisionCount, color: '#1f5a2e' }))}
            />
            <p className={styles.caption}>Division IDs only; no bush-level records.</p>
          </Card>
          <Card title="Estate status">
            <div className={styles.filterBar}>
              <Badge tone="success">{activeCount} active</Badge>
              <Badge tone="neutral">{estates.length - activeCount} inactive</Badge>
            </div>
            <p className={styles.caption}>Status changes require administrator confirmation.</p>
          </Card>
        </div>
      )}

      <EstateFormModal open={adding} onClose={() => setAdding(false)} onSaved={(estate) => navigate(estatePath(estate.id))} />
      <EstateFormModal open={editing !== null} estate={editing ?? undefined} onClose={() => setEditing(null)} />
      <DivisionFormModal open={addingDivisionTo !== null} estates={estates} defaultEstateId={addingDivisionTo ?? undefined} onClose={() => setAddingDivisionTo(null)} />
    </div>
  )
}
