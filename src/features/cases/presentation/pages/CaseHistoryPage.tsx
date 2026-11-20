import { useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  DataTable,
  EmptyState,
  FilterSelect,
  Modal,
  PageHeader,
  SearchInput,
  Tabs,
  Timeline,
  usePageBreadcrumbs,
} from '@/shared/components'
import type { CaseHistoryEntry, CasesWorkspace } from '../../domain/models'
import { DISEASE_CATEGORIES } from '../../domain/models'
import { CasesQueryBoundary, SeverityBadge } from '../components/badges'
import { casesPaths, formatCaseDate, formatCaseDateTime } from '../components/format'
import { CaseFields, CaseIdLink, CasePerson } from '../components/parts'
import { useCasesServices } from '../services/casesServices'
import { useCasesExport, useCasesWorkspace } from '../services/queries'
import styles from '../components/cases.module.css'

type HistoryViewMode = 'table' | 'timeline'

/**
 * CASE-09 Case History & Disease Timeline (Member 4).
 * Uses clean single-line rows with hover tooltips and a click-to-open
 * History Summary Drawer so full clinical notes only appear when clicked.
 */
export function CaseHistoryPage() {
  usePageBreadcrumbs([{ label: 'Cases', to: casesPaths.dashboard }, { label: 'Case History' }])
  const query = useCasesWorkspace()
  return (
    <CasesQueryBoundary query={query} label="case history">
      {(workspace) => <CaseHistoryView workspace={workspace} />}
    </CasesQueryBoundary>
  )
}

function CaseHistoryView({ workspace }: { workspace: CasesWorkspace }) {
  const { demo } = useCasesServices()
  const exportHistory = useCasesExport('history')
  const [params, setParams] = useSearchParams()
  const rawView = (params.get('view') ?? 'table') as HistoryViewMode
  const viewMode: HistoryViewMode = rawView === 'timeline' ? 'timeline' : 'table'

  const [search, setSearch] = useState('')
  const [divisionFilter, setDivisionFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selectedHistory, setSelectedHistory] = useState<CaseHistoryEntry | null>(null)

  const setView = (next: HistoryViewMode) => {
    const nextParams = new URLSearchParams(params)
    if (next === 'table') nextParams.delete('view')
    else nextParams.set('view', next)
    setParams(nextParams, { replace: true })
  }

  const q = search.trim().toLowerCase()
  const filtered = workspace.history.filter((item) => {
    if (divisionFilter !== 'all' && item.division.id !== divisionFilter) return false
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false
    if (!q) return true
    return (
      item.caseId.toLowerCase().includes(q) ||
      item.observationId.toLowerCase().includes(q) ||
      item.referralId.toLowerCase().includes(q) ||
      item.confirmedDisease.name.toLowerCase().includes(q) ||
      item.division.name.toLowerCase().includes(q) ||
      item.clinicalSummary.toLowerCase().includes(q)
    )
  })

  const filtersActive = search !== '' || divisionFilter !== 'all' || categoryFilter !== 'all'

  return (
    <div className={styles.page}>
      <PageHeader
        title="Case History"
        subtitle={`${workspace.history.length} confirmed diagnoses in ${workspace.estates.map((e) => e.id).join(', ')}${demo ? ' · demo data' : ''}`}
        actions={
          <Button
            variant="secondary"
            icon="download"
            loading={exportHistory.pending}
            onClick={exportHistory.run}
          >
            Export
          </Button>
        }
      />

      <Tabs<HistoryViewMode>
        label="Case history presentation mode"
        value={viewMode}
        onChange={setView}
        items={[
          { id: 'table', label: 'Diagnosed Cases', count: filtered.length },
          { id: 'timeline', label: 'Disease Timeline', count: filtered.length },
        ]}
      />

      <Card>
        <div className={styles.filterBar}>
          <SearchInput
            label="Search history"
            placeholder="Search by Case ID, observation, disease or division"
            width={360}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <FilterSelect
            label="Division"
            value={divisionFilter}
            onChange={(val) => setDivisionFilter(val)}
            options={[
              { value: 'all', label: 'All' },
              ...workspace.divisions.map((d) => ({ value: d.id, label: d.name })),
            ]}
          />
          <FilterSelect
            label="Category"
            value={categoryFilter}
            onChange={(val) => setCategoryFilter(val)}
            options={[
              { value: 'all', label: 'All' },
              ...DISEASE_CATEGORIES.map((c) => ({ value: c, label: c })),
            ]}
          />
          <Button
            variant="ghost"
            icon="refresh"
            disabled={!filtersActive}
            onClick={() => {
              setSearch('')
              setDivisionFilter('all')
              setCategoryFilter('all')
            }}
          >
            Reset
          </Button>
        </div>

        {viewMode === 'table' ? (
          <DataTable<CaseHistoryEntry>
            caption="Historical diagnosed cases"
            rows={filtered}
            rowKey={(row) => row.id}
            onRowActivate={(row) => setSelectedHistory(row)}
            rowLabel={(row) => `Inspect diagnosis summary for ${row.caseId}`}
            empty={
              <EmptyState
                title="No historical diagnoses match your filter"
                message="Clear your division or category filter to inspect all past diagnoses."
              />
            }
            columns={[
              {
                id: 'caseId',
                header: 'Case',
                cell: (row) => (
                  <span title={`Diagnosis ${row.id} · Observation ${row.observationId} · Referral ${row.referralId}`}>
                    <CaseIdLink to={casesPaths.caseDetail(row.caseId)}>{row.caseId}</CaseIdLink>
                  </span>
                ),
              },
              {
                id: 'division',
                header: 'Division',
                cell: (row) => (
                  <span title={`${row.estate.name} (${row.estate.id}) · Division ${row.division.id}`}>
                    {row.division.name}
                  </span>
                ),
              },
              {
                id: 'disease',
                header: 'Confirmed disease',
                cell: (row) => (
                  <span title={`Pinned to Catalog v${row.catalogVersion} · Suspected was ${row.suspectedDisease.name}`}>
                    <CaseIdLink to={casesPaths.catalogDisease(row.confirmedDisease.id)}>
                      {row.confirmedDisease.name} (v{row.catalogVersion})
                    </CaseIdLink>
                  </span>
                ),
              },
              {
                id: 'severity',
                header: 'Severity',
                cell: (row) => <SeverityBadge severity={row.severity} />,
              },
              {
                id: 'expert',
                header: 'Expert',
                cell: (row) => <CasePerson name={row.expert.fullName} />,
              },
              {
                id: 'diagnosedAt',
                header: 'Diagnosed',
                cell: (row) => (
                  <span title={`Turnaround time: ${row.turnaroundHours} hours from supervisor referral`}>
                    {formatCaseDate(row.diagnosedAt)}
                  </span>
                ),
              },
              {
                id: 'status',
                header: 'Status',
                cell: (row) => (
                  <Badge tone={row.status === 'Closed' ? 'neutral' : 'success'}>{row.status}</Badge>
                ),
              },
            ]}
          />
        ) : (
          <Timeline
            label="Chronological disease timeline"
            items={filtered.map((item) => ({
              id: item.id,
              title: `${item.caseId} · ${item.confirmedDisease.name} (${item.division.name}) · ${formatCaseDate(item.diagnosedAt)}`,
              detail: `${item.expert.fullName} · Catalog v${item.catalogVersion} · Severity: ${item.severity}`,
              state: 'done' as const,
            }))}
          />
        )}
      </Card>

      {/* Right-hand Diagnosis Summary Drawer on row click */}
      <Modal
        open={selectedHistory !== null}
        placement="end"
        title={selectedHistory ? `${selectedHistory.caseId} · Diagnosis Summary` : 'Diagnosis Summary'}
        description={
          selectedHistory
            ? `${selectedHistory.confirmedDisease.name} (${selectedHistory.confirmedDisease.id}) · Pinned Catalog v${selectedHistory.catalogVersion}`
            : undefined
        }
        onClose={() => setSelectedHistory(null)}
        footer={
          selectedHistory ? (
            <>
              <Button variant="secondary" onClick={() => setSelectedHistory(null)}>
                Close
              </Button>
              <ButtonLink
                to={casesPaths.caseDetail(selectedHistory.caseId)}
                onClick={() => setSelectedHistory(null)}
              >
                Open Case Record
              </ButtonLink>
            </>
          ) : undefined
        }
      >
        {selectedHistory && (
          <div className={styles.stack}>
            <CaseFields
              items={[
                { label: 'Diagnosis ID', value: selectedHistory.id },
                { label: 'Observation', value: selectedHistory.observationId },
                { label: 'Location', value: `${selectedHistory.division.name} (${selectedHistory.estate.name})` },
                { label: 'Suspected (Mobile)', value: selectedHistory.suspectedDisease.name },
                { label: 'Confirmed (Expert)', value: `${selectedHistory.confirmedDisease.name} (v${selectedHistory.catalogVersion})` },
                { label: 'Severity', value: <SeverityBadge severity={selectedHistory.severity} /> },
                { label: 'Diagnosed At', value: formatCaseDateTime(selectedHistory.diagnosedAt) },
                { label: 'Turnaround', value: `${selectedHistory.turnaroundHours} hours` },
              ]}
            />
            <div>
              <p className={styles.subheading}>Clinical Findings</p>
              <p className={styles.note}>{selectedHistory.clinicalSummary}</p>
            </div>
            <div>
              <p className={styles.subheading}>Recommended Action</p>
              <p className={styles.note}>{selectedHistory.recommendedAction}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
