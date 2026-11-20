import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import {
  ActionMenu,
  Badge,
  Button,
  ButtonLink,
  Card,
  DataTable,
  EmptyState,
  FilterSelect,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  Tabs,
  usePageBreadcrumbs,
} from '@/shared/components'
import type { CaseRecord, CaseStatus, CasesWorkspace } from '../../domain/models'
import { CaseStatusBadge, CasesQueryBoundary, SeverityBadge } from '../components/badges'
import { casesPaths, formatCaseDate, formatCaseDateTime } from '../components/format'
import { CaseFields, CaseIdLink, CasePerson } from '../components/parts'
import { useCasesServices } from '../services/casesServices'
import { useCasesExport, useCasesWorkspace } from '../services/queries'
import styles from '../components/cases.module.css'

type AssignedTab = 'all' | CaseStatus

const PAGE_SIZE = 10

/**
 * CASE-02 Assigned Cases (Member 4).
 * Clean, minimal table (6 core columns + hover tooltip + Quick Preview drawer on demand)
 * so extra details are only shown when clicked or hovered.
 */
export function AssignedCasesPage() {
  usePageBreadcrumbs([{ label: 'Cases', to: casesPaths.dashboard }, { label: 'Assigned Cases' }])
  const query = useCasesWorkspace()
  return (
    <CasesQueryBoundary query={query} label="assigned cases">
      {(workspace) => <AssignedCasesView workspace={workspace} />}
    </CasesQueryBoundary>
  )
}

function AssignedCasesView({ workspace }: { workspace: CasesWorkspace }) {
  const { demo } = useCasesServices()
  const navigate = useNavigate()
  const exportAssigned = useCasesExport('assigned')
  const [params, setParams] = useSearchParams()
  const rawTab = (params.get('tab') ?? 'all') as AssignedTab
  const activeTab: AssignedTab = ['all', 'awaiting_diagnosis', 'diagnosed', 'pending_link', 'closed'].includes(rawTab)
    ? rawTab
    : 'all'

  const [search, setSearch] = useState('')
  const [estateFilter, setEstateFilter] = useState('all')
  const [diseaseFilter, setDiseaseFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [previewCase, setPreviewCase] = useState<CaseRecord | null>(null)

  const counts = {
    all: workspace.cases.length,
    awaiting_diagnosis: workspace.cases.filter((c) => c.status === 'awaiting_diagnosis').length,
    diagnosed: workspace.cases.filter((c) => c.status === 'diagnosed').length,
    pending_link: workspace.cases.filter((c) => c.status === 'pending_link').length,
    closed: workspace.cases.filter((c) => c.status === 'closed').length,
  }

  const q = search.trim().toLowerCase()
  const filtered = workspace.cases.filter((item) => {
    if (activeTab !== 'all' && item.status !== activeTab) return false
    if (estateFilter !== 'all' && item.estate.id !== estateFilter) return false
    if (
      diseaseFilter !== 'all' &&
      item.suspectedDisease.id !== diseaseFilter &&
      item.confirmedDisease?.id !== diseaseFilter
    ) {
      return false
    }
    if (!q) return true
    return (
      item.id.toLowerCase().includes(q) ||
      item.observationId.toLowerCase().includes(q) ||
      item.referralId.toLowerCase().includes(q) ||
      item.division.name.toLowerCase().includes(q) ||
      item.estate.name.toLowerCase().includes(q) ||
      item.suspectedDisease.name.toLowerCase().includes(q) ||
      (item.confirmedDisease?.name.toLowerCase().includes(q) ?? false) ||
      item.referredBy.fullName.toLowerCase().includes(q)
    )
  })

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const filtersActive = search !== '' || estateFilter !== 'all' || diseaseFilter !== 'all'

  const setTab = (next: AssignedTab) => {
    setPage(1)
    const nextParams = new URLSearchParams(params)
    if (next === 'all') nextParams.delete('tab')
    else nextParams.set('tab', next)
    setParams(nextParams, { replace: true })
  }

  const resetFilters = () => {
    setSearch('')
    setEstateFilter('all')
    setDiseaseFilter('all')
    setPage(1)
  }

  const targetPath = (row: CaseRecord) =>
    row.status === 'pending_link' ? casesPaths.pendingReferral(row.referralId) : casesPaths.caseDetail(row.id)

  return (
    <div className={styles.page}>
      <PageHeader
        title="Assigned Cases"
        subtitle={`${workspace.cases.length} cases in ${workspace.estates.map((e) => e.id).join(', ')}${demo ? ' · demo data' : ''}`}
        actions={
          <Button
            variant="secondary"
            icon="download"
            loading={exportAssigned.pending}
            onClick={exportAssigned.run}
          >
            Export
          </Button>
        }
      />

      <Tabs<AssignedTab>
        label="Case status"
        value={activeTab}
        onChange={setTab}
        items={[
          { id: 'all', label: 'All', count: counts.all },
          { id: 'awaiting_diagnosis', label: 'Awaiting diagnosis', count: counts.awaiting_diagnosis },
          { id: 'diagnosed', label: 'Diagnosed', count: counts.diagnosed },
          { id: 'pending_link', label: 'Pending link', count: counts.pending_link },
          { id: 'closed', label: 'Closed', count: counts.closed },
        ]}
      />

      <Card>
        <div className={styles.filterBar}>
          <SearchInput
            label="Search cases"
            placeholder="Search by Case ID, observation, division or disease"
            width={360}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
          <FilterSelect
            label="Estate"
            value={estateFilter}
            onChange={(val) => {
              setEstateFilter(val)
              setPage(1)
            }}
            options={[
              { value: 'all', label: 'All' },
              ...workspace.estates.map((e) => ({ value: e.id, label: e.name })),
            ]}
          />
          <FilterSelect
            label="Disease"
            value={diseaseFilter}
            onChange={(val) => {
              setDiseaseFilter(val)
              setPage(1)
            }}
            options={[
              { value: 'all', label: 'All' },
              ...workspace.diseases.map((d) => ({ value: d.id, label: d.name })),
            ]}
          />
          <Button variant="ghost" icon="refresh" onClick={resetFilters} disabled={!filtersActive}>
            Reset
          </Button>
        </div>

        <DataTable<CaseRecord>
          caption="Assigned cases and referrals"
          rows={pageRows}
          rowKey={(row) => row.id}
          onRowActivate={(row) => setPreviewCase(row)}
          rowLabel={(row) => `Preview ${row.id}`}
          empty={
            <EmptyState
              title="No cases match these filters"
              message="Change the status tab, search or filters to see more cases."
            />
          }
          columns={[
            {
              id: 'caseId',
              header: 'Case',
              cell: (row) => (
                <span title={`Referral ${row.referralId} · Observation ${row.observationId}`}>
                  <CaseIdLink to={targetPath(row)}>{row.caseId ?? row.referralId}</CaseIdLink>
                </span>
              ),
            },
            {
              id: 'observation',
              header: 'Observation',
              cell: (row) => (
                <span title={`Captured ${formatCaseDateTime(row.capturedAt)} · GPS ±${row.gpsAccuracyM} m`}>
                  {row.observationId}
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
              header: 'Disease',
              cell: (row) =>
                row.confirmedDisease ? (
                  <span title={`Confirmed ${row.confirmedDisease.name} (${row.confirmedDisease.id}) · Pinned to Catalog v${row.catalogVersion} · Suspected was ${row.suspectedDisease.name}`}>
                    <Badge tone="success">{row.confirmedDisease.name}</Badge>
                  </span>
                ) : (
                  <span title={`Suspected by field worker (${row.suspectedDisease.id}) · Awaiting expert confirmation`}>
                    {row.suspectedDisease.name}
                  </span>
                ),
            },
            {
              id: 'referredAt',
              header: 'Referred',
              cell: (row) => (
                <span title={`Referred by ${row.referredBy.fullName} on ${formatCaseDateTime(row.referredAt)}`}>
                  {formatCaseDate(row.referredAt)}
                </span>
              ),
            },
            {
              id: 'status',
              header: 'Status',
              cell: (row) => <CaseStatusBadge status={row.status} />,
            },
            {
              id: 'actions',
              header: '',
              align: 'end',
              cell: (row) => (
                <span className={styles.rowActions}>
                  <Link
                    className={styles.idLink}
                    to={targetPath(row)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {row.status === 'pending_link'
                      ? 'Link →'
                      : row.status === 'awaiting_diagnosis'
                        ? 'Diagnose →'
                        : 'Open →'}
                  </Link>
                  <ActionMenu
                    label={`Actions for ${row.id}`}
                    items={[
                      {
                        id: 'preview',
                        label: 'Quick preview',
                        icon: 'eye',
                        onSelect: () => setPreviewCase(row),
                      },
                      {
                        id: 'open',
                        label: 'Open full case',
                        icon: 'right',
                        onSelect: () => void navigate(targetPath(row)),
                      },
                      ...(row.status === 'awaiting_diagnosis'
                        ? [
                            {
                              id: 'diagnose',
                              label: 'Record diagnosis',
                              icon: 'check' as const,
                              onSelect: () => void navigate(casesPaths.caseDiagnose(row.id)),
                            },
                          ]
                        : []),
                    ]}
                  />
                </span>
              ),
            },
          ]}
        />

        {filtered.length > 0 && (
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            onPageChange={setPage}
            itemLabel="cases"
          />
        )}
      </Card>

      {/* Right-hand Quick Preview Drawer when a row is clicked */}
      <Modal
        open={previewCase !== null}
        placement="end"
        title={previewCase ? `${previewCase.id} · Quick Preview` : 'Case Preview'}
        description={
          previewCase
            ? `${previewCase.division.name} (${previewCase.estate.name}) · Observation ${previewCase.observationId}`
            : undefined
        }
        onClose={() => setPreviewCase(null)}
        footer={
          previewCase ? (
            <>
              <Button variant="secondary" onClick={() => setPreviewCase(null)}>
                Close
              </Button>
              <ButtonLink to={targetPath(previewCase)} onClick={() => setPreviewCase(null)}>
                {previewCase.status === 'pending_link' ? 'Link Referral' : 'Open Full Workbench'}
              </ButtonLink>
            </>
          ) : undefined
        }
      >
        {previewCase && (
          <div className={styles.stack}>
            <CaseFields
              items={[
                { label: 'Status', value: <CaseStatusBadge status={previewCase.status} /> },
                { label: 'Referral ID', value: previewCase.referralId },
                { label: 'Observation ID', value: previewCase.observationId },
                { label: 'Suspected (Mobile)', value: `${previewCase.suspectedDisease.name} (${previewCase.suspectedDisease.id})` },
                {
                  label: 'Confirmed (Expert)',
                  value: previewCase.confirmedDisease
                    ? `${previewCase.confirmedDisease.name} (Catalog v${previewCase.catalogVersion})`
                    : 'Awaiting expert decision',
                },
                {
                  label: 'Severity',
                  value: previewCase.diagnosis ? <SeverityBadge severity={previewCase.diagnosis.severity} /> : '—',
                },
                { label: 'Referred By', value: <CasePerson name={previewCase.referredBy.fullName} /> },
                { label: 'Referred At', value: formatCaseDateTime(previewCase.referredAt) },
              ]}
            />
            <div>
              <p className={styles.subheading}>Observed Symptoms</p>
              <div className={styles.chips}>
                {previewCase.observedSymptoms.map((s) => (
                  <Badge key={s} tone="neutral">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className={styles.subheading}>Supervisor Referral Note</p>
              <p className={styles.note}>{previewCase.referralNote}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
