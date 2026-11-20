import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { EvidenceImage } from '@/features/capture'
import { newIdempotencyKey } from '@/shared/api'
import {
  ActionMenu,
  Badge,
  Banner,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  DataTable,
  EmptyState,
  FilterSelect,
  Modal,
  PageHeader,
  SearchInput,
  SelectField,
  Tabs,
  TextAreaField,
  TextField,
  usePageBreadcrumbs,
  useToast,
} from '@/shared/components'
import type {
  CasesWorkspace,
  CatalogDiseaseDetail,
  CatalogSymptom,
  CatalogVersionRecord,
  DiseaseCategory,
} from '../../domain/models'
import { DISEASE_CATEGORIES } from '../../domain/models'
import {
  validateDeactivateDisease,
  validatePublishCatalogVersion,
  validateSaveCatalogDraft,
  type CasesFieldErrors,
} from '../../domain/rules'
import {
  CasesQueryBoundary,
  CatalogStatusBadge,
  DiseaseCategoryBadge,
  SeverityBadge,
} from '../components/badges'
import { casesErrorText, casesPaths, formatCaseDateTime } from '../components/format'
import { CaseFields, CaseIdLink } from '../components/parts'
import { useCasesServices } from '../services/casesServices'
import {
  useCasesActions,
  useCasesExport,
  useCasesWorkspace,
  useCatalogDisease,
} from '../services/queries'
import styles from '../components/cases.module.css'

type CatalogMainTab = 'diseases' | 'symptoms' | 'versions'

/**
 * CASE-07 Disease Catalog (Member 4).
 * Uses clean single-line tables with hover tooltips and a click-to-open
 * Diff Comparison Modal (`CURRENT v2` vs `NEW DRAFT v3`) so details are shown on demand.
 */
export function DiseaseCatalogPage() {
  usePageBreadcrumbs([{ label: 'Cases', to: casesPaths.dashboard }, { label: 'Disease Catalog' }])
  const query = useCasesWorkspace()
  return (
    <CasesQueryBoundary query={query} label="disease catalog">
      {(workspace) => <CatalogListView workspace={workspace} />}
    </CasesQueryBoundary>
  )
}

function CatalogListView({ workspace }: { workspace: CasesWorkspace }) {
  const { demo } = useCasesServices()
  const navigate = useNavigate()
  const toast = useToast()
  const actions = useCasesActions()
  const exportCatalog = useCasesExport('catalog')
  const [params, setParams] = useSearchParams()

  const rawTab = (params.get('tab') ?? 'diseases') as CatalogMainTab
  const activeTab: CatalogMainTab = ['diseases', 'symptoms', 'versions'].includes(rawTab)
    ? rawTab
    : 'diseases'

  const setTab = (next: CatalogMainTab) => {
    const nextParams = new URLSearchParams(params)
    if (next === 'diseases') nextParams.delete('tab')
    else nextParams.set('tab', next)
    setParams(nextParams, { replace: true })
  }

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Add / Edit Disease Draft modal state
  const [draftModalOpen, setDraftModalOpen] = useState(false)
  const [editingDiseaseId, setEditingDiseaseId] = useState<string | undefined>(undefined)
  const [draftName, setDraftName] = useState('')
  const [draftPathogen, setDraftPathogen] = useState('')
  const [draftCategory, setDraftCategory] = useState<DiseaseCategory>('Fungal')
  const [draftSummary, setDraftSummary] = useState('')
  const [draftCriteria, setDraftCriteria] = useState('')
  const [draftDifferential, setDraftDifferential] = useState('')
  const [draftTreatment, setDraftTreatment] = useState('')
  const [draftSymptomIds, setDraftSymptomIds] = useState<string[]>(['SYM-001', 'SYM-005'])
  const [draftNote, setDraftNote] = useState('')
  const [draftErrors, setDraftErrors] = useState<CasesFieldErrors>({})

  // Publish Catalog Version modal state
  const [publishModalOpen, setPublishModalOpen] = useState(false)
  const [releaseNotes, setReleaseNotes] = useState(
    'Publish Catalog v3: Promotes DIS-005 (Red rust stem & foliar blight), symptom SYM-007, and updated DIS-002 Grey blight diagnostic criteria.',
  )
  const [confirmPinnedUnchanged, setConfirmPinnedUnchanged] = useState(false)
  const [publishErrors, setPublishErrors] = useState<CasesFieldErrors>({})

  const openNewDraftModal = (existing?: CatalogDiseaseDetail) => {
    if (existing) {
      const src = existing.draftChanges?.proposed ?? existing
      setEditingDiseaseId(existing.id)
      setDraftName(src.name)
      setDraftPathogen(src.pathogen)
      setDraftCategory(src.category)
      setDraftSummary(src.summary)
      setDraftCriteria(src.diagnosticCriteria)
      setDraftDifferential(src.differentialDiagnosis)
      setDraftTreatment(src.treatmentGuidance)
      setDraftSymptomIds([...src.symptomIds])
      setDraftNote(existing.draftChanges?.note ?? `Staged v${workspace.kpis.activeCatalogVersion + 1} update for ${existing.id}`)
    } else {
      setEditingDiseaseId(undefined)
      setDraftName('')
      setDraftPathogen('')
      setDraftCategory('Fungal')
      setDraftSummary('')
      setDraftCriteria('')
      setDraftDifferential('')
      setDraftTreatment('')
      setDraftSymptomIds(['SYM-001'])
      setDraftNote(`New disease entry for Catalog v${workspace.kpis.activeCatalogVersion + 1}`)
    }
    setDraftErrors({})
    setDraftModalOpen(true)
  }

  const toggleDraftSymptom = (id: string) => {
    setDraftSymptomIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
    setDraftErrors((prev) => ({ ...prev, symptomIds: '' }))
  }

  const handleSaveDraft = () => {
    const input = {
      diseaseId: editingDiseaseId,
      name: draftName,
      pathogen: draftPathogen,
      category: draftCategory,
      summary: draftSummary,
      diagnosticCriteria: draftCriteria,
      differentialDiagnosis: draftDifferential,
      treatmentGuidance: draftTreatment,
      symptomIds: draftSymptomIds,
      note: draftNote,
    }
    const errors = validateSaveCatalogDraft(input)
    setDraftErrors(errors)
    if (Object.keys(errors).length > 0) return

    actions.saveCatalogDraft.mutate(
      { input, meta: { expectedVersion: 1, idempotencyKey: newIdempotencyKey() } },
      {
        onSuccess: (saved) => {
          setDraftModalOpen(false)
          toast.show({
            tone: 'success',
            title: `Catalog draft saved (${saved.id})`,
            message: `${saved.name} staged for Catalog v${workspace.kpis.activeCatalogVersion + 1}.`,
          })
        },
        onError: (err) => {
          toast.show({ tone: 'error', title: 'Could not save draft', message: casesErrorText(err) })
        },
      },
    )
  }

  const handlePublishCatalogVersion = () => {
    const errors = validatePublishCatalogVersion({ releaseNotes, confirmPinnedUnchanged })
    setPublishErrors(errors)
    if (Object.keys(errors).length > 0) return

    actions.publishCatalogVersion.mutate(
      {
        input: { releaseNotes, confirmPinnedUnchanged },
        meta: { expectedVersion: workspace.kpis.activeCatalogVersion, idempotencyKey: newIdempotencyKey() },
      },
      {
        onSuccess: (updated) => {
          setPublishModalOpen(false)
          toast.show({
            tone: 'success',
            title: `Catalog v${updated.kpis.activeCatalogVersion} published`,
            message: 'New catalog version is now Active. All historical diagnoses remain pinned to their original version.',
          })
        },
        onError: (err) => {
          toast.show({ tone: 'error', title: 'Publish failed', message: casesErrorText(err) })
        },
      },
    )
  }

  const q = search.trim().toLowerCase()
  const filteredDiseases = workspace.diseases.filter((d) => {
    if (categoryFilter !== 'all' && d.category !== categoryFilter) return false
    if (statusFilter !== 'all' && d.status !== statusFilter) return false
    if (!q) return true
    return (
      d.id.toLowerCase().includes(q) ||
      d.name.toLowerCase().includes(q) ||
      d.pathogen.toLowerCase().includes(q) ||
      d.summary.toLowerCase().includes(q)
    )
  })

  const filteredSymptoms = workspace.symptoms.filter((s) => {
    if (!q) return true
    return (
      s.id.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.plantPart.toLowerCase().includes(q)
    )
  })

  const hasDraftsToPublish =
    workspace.diseases.some((d) => d.status === 'draft' || d.draftChanges !== null) ||
    workspace.kpis.draftCatalogVersion !== null

  const filtersActive = search !== '' || categoryFilter !== 'all' || statusFilter !== 'all'

  return (
    <div className={styles.page}>
      <PageHeader
        title="Disease Catalog"
        subtitle={`Active Catalog v${workspace.kpis.activeCatalogVersion} · ${workspace.diseases.length} diseases · ${workspace.symptoms.length} symptoms${demo ? ' · demo data' : ''}`}
        actions={
          <>
            <Button
              variant="secondary"
              icon="download"
              loading={exportCatalog.pending}
              onClick={exportCatalog.run}
            >
              Export
            </Button>
            <Button variant="secondary" icon="plus" onClick={() => openNewDraftModal()}>
              New Draft (v{workspace.kpis.activeCatalogVersion + 1})
            </Button>
            {hasDraftsToPublish && (
              <Button icon="check" onClick={() => setPublishModalOpen(true)}>
                Publish v{workspace.kpis.activeCatalogVersion + 1}
              </Button>
            )}
          </>
        }
      />

      <Tabs<CatalogMainTab>
        label="Disease catalog sections"
        value={activeTab}
        onChange={setTab}
        items={[
          { id: 'diseases', label: 'Diseases', count: workspace.diseases.length },
          { id: 'symptoms', label: 'Symptoms', count: workspace.symptoms.length },
          { id: 'versions', label: 'Version History', count: workspace.catalogVersions.length },
        ]}
      />

      <Card>
        {activeTab === 'diseases' && (
          <>
            <div className={styles.filterBar}>
              <SearchInput
                label="Search diseases"
                placeholder="Search by disease ID, name or pathogen"
                width={360}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
              <FilterSelect
                label="Status"
                value={statusFilter}
                onChange={(val) => setStatusFilter(val)}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'active', label: 'Active' },
                  { value: 'draft', label: 'Draft' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
              />
              <Button
                variant="ghost"
                icon="refresh"
                disabled={!filtersActive}
                onClick={() => {
                  setSearch('')
                  setCategoryFilter('all')
                  setStatusFilter('all')
                }}
              >
                Reset
              </Button>
            </div>

            <DataTable<CatalogDiseaseDetail>
              caption="Disease catalog entries"
              rows={filteredDiseases}
              rowKey={(row) => row.id}
              onRowActivate={(row) => void navigate(casesPaths.catalogDisease(row.id))}
              rowLabel={(row) => `Open ${row.name}`}
              empty={
                <EmptyState
                  title="No matching catalog diseases"
                  message="Try clearing your search or category filter."
                />
              }
              columns={[
                {
                  id: 'disease',
                  header: 'Disease',
                  cell: (row) => (
                    <span title={row.summary}>
                      <CaseIdLink to={casesPaths.catalogDisease(row.id)}>
                        {row.name} ({row.id})
                      </CaseIdLink>
                    </span>
                  ),
                },
                {
                  id: 'pathogen',
                  header: 'Pathogen',
                  cell: (row) => <em>{row.pathogen}</em>,
                },
                {
                  id: 'category',
                  header: 'Category',
                  cell: (row) => <DiseaseCategoryBadge category={row.category} />,
                },
                {
                  id: 'symptoms',
                  header: 'Symptoms',
                  cell: (row) => (
                    <span title={row.symptoms.map((s) => `${s.id}: ${s.name}`).join(' · ')}>
                      {row.symptomIds.length} linked ({row.symptomIds.join(', ')})
                    </span>
                  ),
                },
                {
                  id: 'version',
                  header: 'Version',
                  cell: (row) =>
                    row.draftChanges ? (
                      <span title={`Staged draft changes for v${row.draftChanges.targetVersion}: ${row.draftChanges.note}`}>
                        v{row.catalogVersion} · <Badge tone="warning">v{row.draftChanges.targetVersion} diff</Badge>
                      </span>
                    ) : (
                      `v${row.catalogVersion}`
                    ),
                },
                {
                  id: 'status',
                  header: 'Status',
                  cell: (row) => <CatalogStatusBadge status={row.status} />,
                },
                {
                  id: 'actions',
                  header: '',
                  align: 'end',
                  cell: (row) => (
                    <span className={styles.rowActions}>
                      <Link
                        className={styles.idLink}
                        to={casesPaths.catalogDisease(row.id)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        View →
                      </Link>
                      <ActionMenu
                        label={`Actions for ${row.name}`}
                        items={[
                          {
                            id: 'view',
                            label: 'View details',
                            icon: 'eye',
                            onSelect: () => void navigate(casesPaths.catalogDisease(row.id)),
                          },
                          {
                            id: 'edit',
                            label: 'Edit draft',
                            icon: 'edit',
                            onSelect: () => openNewDraftModal(row),
                          },
                        ]}
                      />
                    </span>
                  ),
                },
              ]}
            />
          </>
        )}

        {activeTab === 'symptoms' && (
          <DataTable<CatalogSymptom>
            caption="Standardized disease symptoms taxonomy"
            rows={filteredSymptoms}
            rowKey={(row) => row.id}
            columns={[
              {
                id: 'id',
                header: 'Symptom',
                cell: (row) => (
                  <span title={row.description}>
                    <strong>{row.name}</strong> ({row.id})
                  </span>
                ),
              },
              { id: 'part', header: 'Plant part', cell: (row) => row.plantPart },
              {
                id: 'stage',
                header: 'Stage',
                cell: (row) => <Badge tone="teal">{row.progressionStage}</Badge>,
              },
              {
                id: 'diseases',
                header: 'Linked diseases',
                cell: (row) => (
                  <div className={styles.chips}>
                    {row.linkedDiseaseIds.map((dId) => (
                      <CaseIdLink key={dId} to={casesPaths.catalogDisease(dId)}>
                        {dId}
                      </CaseIdLink>
                    ))}
                  </div>
                ),
              },
              {
                id: 'status',
                header: 'Status',
                cell: (row) => <CatalogStatusBadge status={row.status} />,
              },
            ]}
          />
        )}

        {activeTab === 'versions' && (
          <DataTable<CatalogVersionRecord>
            caption="Disease catalog version release history"
            rows={workspace.catalogVersions}
            rowKey={(row) => String(row.version)}
            columns={[
              {
                id: 'version',
                header: 'Version',
                cell: (row) => <strong>Catalog v{row.version}</strong>,
              },
              {
                id: 'status',
                header: 'Status',
                cell: (row) => (
                  <Badge
                    tone={
                      row.status === 'Active'
                        ? 'success'
                        : row.status === 'Draft'
                          ? 'warning'
                          : 'neutral'
                    }
                  >
                    {row.status}
                  </Badge>
                ),
              },
              {
                id: 'counts',
                header: 'Coverage',
                cell: (row) => `${row.diseaseCount} diseases · ${row.symptomCount} symptoms`,
              },
              {
                id: 'publishedAt',
                header: 'Published',
                cell: (row) =>
                  row.publishedAt
                    ? `${formatCaseDateTime(row.publishedAt)} · ${row.publishedBy}`
                    : `Staged by ${row.publishedBy}`,
              },
              {
                id: 'notes',
                header: 'Release notes',
                cell: (row) => row.releaseNotes,
              },
            ]}
          />
        )}
      </Card>

      {/* Add / Edit Disease Draft Modal */}
      <Modal
        open={draftModalOpen}
        title={
          editingDiseaseId
            ? `Edit Draft · ${editingDiseaseId} (v${workspace.kpis.activeCatalogVersion + 1})`
            : `New Disease Draft (v${workspace.kpis.activeCatalogVersion + 1})`
        }
        description="Draft changes are staged for the upcoming catalog version and can be compared field-by-field before publishing."
        onClose={() => setDraftModalOpen(false)}
        size="large"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraftModalOpen(false)}>
              Cancel
            </Button>
            <Button
              icon="check"
              loading={actions.saveCatalogDraft.isPending}
              onClick={handleSaveDraft}
            >
              Save Draft v{workspace.kpis.activeCatalogVersion + 1}
            </Button>
          </>
        }
      >
        <div className={styles.form}>
          <div className={styles.split}>
            <TextField
              label="Disease name"
              required
              value={draftName}
              error={draftErrors.name}
              onChange={(e) => setDraftName(e.target.value)}
            />
            <TextField
              label="Pathogen (scientific name)"
              required
              value={draftPathogen}
              error={draftErrors.pathogen}
              onChange={(e) => setDraftPathogen(e.target.value)}
            />
          </div>

          <SelectField
            label="Category"
            required
            value={draftCategory}
            error={draftErrors.category}
            onChange={(e) => setDraftCategory(e.target.value as DiseaseCategory)}
            options={DISEASE_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />

          <TextAreaField
            label="Clinical summary"
            required
            rows={2}
            value={draftSummary}
            error={draftErrors.summary}
            onChange={(e) => setDraftSummary(e.target.value)}
          />

          <TextAreaField
            label="Diagnostic criteria"
            required
            rows={2}
            value={draftCriteria}
            error={draftErrors.diagnosticCriteria}
            onChange={(e) => setDraftCriteria(e.target.value)}
          />

          <TextAreaField
            label="Differential diagnosis"
            rows={2}
            value={draftDifferential}
            onChange={(e) => setDraftDifferential(e.target.value)}
          />

          <TextAreaField
            label="Treatment guidance"
            required
            rows={2}
            value={draftTreatment}
            error={draftErrors.treatmentGuidance}
            onChange={(e) => setDraftTreatment(e.target.value)}
          />

          <div>
            <p className={styles.subheading}>Linked symptoms *</p>
            <div className={styles.symptomGrid}>
              {workspace.symptoms.map((sym) => (
                <div key={sym.id} className={styles.symptomItem} title={sym.description}>
                  <Checkbox
                    label={`${sym.id} · ${sym.name}`}
                    checked={draftSymptomIds.includes(sym.id)}
                    onChange={() => toggleDraftSymptom(sym.id)}
                  />
                </div>
              ))}
            </div>
            {draftErrors.symptomIds && (
              <p role="alert" style={{ color: '#b42318', fontSize: 13 }}>
                {draftErrors.symptomIds}
              </p>
            )}
          </div>

          <TextField
            label="Draft note"
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
          />
        </div>
      </Modal>

      {/* Publish Catalog Version Modal */}
      <Modal
        open={publishModalOpen}
        title={`Publish Catalog v${workspace.kpis.activeCatalogVersion + 1}`}
        description="Promotes all staged v3 drafts and modifications to Active status for future diagnoses."
        onClose={() => setPublishModalOpen(false)}
        size="medium"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPublishModalOpen(false)}>
              Cancel
            </Button>
            <Button
              icon="check"
              loading={actions.publishCatalogVersion.isPending}
              onClick={handlePublishCatalogVersion}
            >
              Confirm & Publish v{workspace.kpis.activeCatalogVersion + 1}
            </Button>
          </>
        }
      >
        <div className={styles.stack}>
          <Banner tone="info" title="Immutable Version Pinning">
            Existing confirmed diagnoses (e.g., `CASE-006`, `CASE-042` pinned to Catalog `v2`) remain permanently bound to `v2`.
          </Banner>

          <TextAreaField
            label="Release notes"
            required
            rows={3}
            value={releaseNotes}
            error={publishErrors.releaseNotes}
            onChange={(e) => setReleaseNotes(e.target.value)}
          />

          <Checkbox
            label={`I confirm that historical diagnoses remain pinned to Catalog v${workspace.kpis.activeCatalogVersion}`}
            checked={confirmPinnedUnchanged}
            onChange={(e) => {
              setConfirmPinnedUnchanged(e.target.checked)
              setPublishErrors((prev) => ({ ...prev, confirmPinnedUnchanged: '' }))
            }}
          />
          {publishErrors.confirmPinnedUnchanged && (
            <p role="alert" style={{ color: '#b42318', fontSize: 13 }}>
              {publishErrors.confirmPinnedUnchanged}
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}

/**
 * CASE-08 Disease Detail & On-Demand Diff Modal (`CURRENT v2` vs `NEW DRAFT v3`).
 */
export function DiseaseDetailPage() {
  const { diseaseId = '' } = useParams()
  usePageBreadcrumbs([
    { label: 'Cases', to: casesPaths.dashboard },
    { label: 'Disease Catalog', to: casesPaths.catalog },
    { label: diseaseId },
  ])
  const diseaseQuery = useCatalogDisease(diseaseId)
  return (
    <CasesQueryBoundary query={diseaseQuery} label={`disease ${diseaseId}`}>
      {(disease) => <DiseaseDetailView disease={disease} />}
    </CasesQueryBoundary>
  )
}

function DiseaseDetailView({ disease }: { disease: CatalogDiseaseDetail }) {
  const toast = useToast()
  const actions = useCasesActions()
  const [diffModalOpen, setDiffModalOpen] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [deactivateReason, setDeactivateReason] = useState('')
  const [deactivateError, setDeactivateError] = useState<string | null>(null)

  const handleDeactivate = () => {
    const errors = validateDeactivateDisease({ diseaseId: disease.id, reason: deactivateReason })
    if (errors.reason) {
      setDeactivateError(errors.reason)
      return
    }
    actions.deactivateDisease.mutate(
      {
        input: { diseaseId: disease.id, reason: deactivateReason },
        meta: { expectedVersion: disease.catalogVersion, idempotencyKey: newIdempotencyKey() },
      },
      {
        onSuccess: (updated) => {
          setDeactivateOpen(false)
          toast.show({
            tone: 'info',
            title: `${updated.name} (${updated.id}) deactivated`,
            message: 'Entry removed from active diagnosis selections; historical cases remain intact.',
          })
        },
        onError: (err) => setDeactivateError(casesErrorText(err)),
      },
    )
  }

  return (
    <div className={styles.page}>
      <PageHeader
        back={{ to: casesPaths.catalog, label: 'Back to Disease Catalog' }}
        title={`${disease.name} · ${disease.id}`}
        subtitle={`${disease.pathogen} · Catalog v${disease.catalogVersion} · updated ${formatCaseDateTime(disease.updatedAt)}`}
        actions={
          <>
            <CatalogStatusBadge status={disease.status} />
            {disease.draftChanges && (
              <Button variant="secondary" icon="columns" onClick={() => setDiffModalOpen(true)}>
                Compare v{disease.catalogVersion} vs v{disease.draftChanges.targetVersion} Diff
              </Button>
            )}
            {disease.status === 'active' && (
              <Button variant="destructiveOutline" onClick={() => setDeactivateOpen(true)}>
                Deactivate
              </Button>
            )}
          </>
        }
      />

      {disease.draftChanges && (
        <Banner
          tone="info"
          title={`Draft v${disease.draftChanges.targetVersion} changes staged (${disease.draftChanges.diffs.filter((d) => d.changed).length} modified fields)`}
          action={
            <Button variant="secondary" onClick={() => setDiffModalOpen(true)}>
              View Diff Comparison
            </Button>
          }
        >
          {disease.draftChanges.note}
        </Banner>
      )}

      <div className={styles.splitWideLeft}>
        <div className={styles.stack}>
          <Card title="Clinical Profile">
            <CaseFields
              items={[
                { label: 'Disease ID', value: disease.id },
                { label: 'Pathogen', value: <em>{disease.pathogen}</em> },
                { label: 'Category', value: <DiseaseCategoryBadge category={disease.category} /> },
                { label: 'Typical severity', value: <SeverityBadge severity={disease.typicalSeverity} /> },
                { label: 'Catalog version', value: `v${disease.catalogVersion}` },
                { label: 'Updated by', value: disease.updatedBy },
              ]}
            />
            <p className={styles.subheading}>Summary</p>
            <p className={styles.note}>{disease.summary}</p>
            <p className={styles.subheading}>Diagnostic criteria</p>
            <p className={styles.note}>{disease.diagnosticCriteria}</p>
            <p className={styles.subheading}>Differential diagnosis</p>
            <p className={styles.note}>{disease.differentialDiagnosis}</p>
            <p className={styles.subheading}>Treatment guidance</p>
            <p className={styles.note}>{disease.treatmentGuidance}</p>
          </Card>

          <Card title={`Linked Symptoms (${disease.symptoms.length})`}>
            <DataTable
              caption="Symptoms associated with this disease"
              rows={disease.symptoms}
              rowKey={(row) => row.id}
              columns={[
                {
                  id: 'id',
                  header: 'Symptom',
                  cell: (row) => (
                    <span title={row.description}>
                      <strong>{row.name}</strong> ({row.id})
                    </span>
                  ),
                },
                { id: 'part', header: 'Plant part', cell: (row) => row.plantPart },
                { id: 'stage', header: 'Stage', cell: (row) => <Badge tone="teal">{row.progressionStage}</Badge> },
              ]}
            />
          </Card>
        </div>

        <div className={styles.stack}>
          <Card title="Reference Plate">
            {disease.referenceImages[0] && (
              <div>
                <EvidenceImage
                  label={disease.referenceImages[0].assetLabel}
                  altText={disease.referenceImages[0].caption}
                  thumbnail
                />
                <p className={styles.subheading}>{disease.referenceImages[0].caption}</p>
                <p className={styles.caption}>{disease.referenceImages[0].sourceAttribution}</p>
              </div>
            )}
          </Card>

          <Card title={`Linked Scoped Cases (${disease.linkedCaseIds.length})`}>
            {disease.linkedCaseIds.length > 0 ? (
              <div className={styles.chips}>
                {disease.linkedCaseIds.map((cId) => (
                  <ButtonLink key={cId} variant="secondary" to={casesPaths.caseDetail(cId)}>
                    {cId}
                  </ButtonLink>
                ))}
              </div>
            ) : (
              <p className={styles.caption}>No cases currently linked to this catalog entry.</p>
            )}
          </Card>
        </div>
      </div>

      {/* On-demand Field-by-Field Diff Modal */}
      {disease.draftChanges && (
        <Modal
          open={diffModalOpen}
          title={`Catalog Diff · CURRENT v${disease.catalogVersion} vs NEW DRAFT v${disease.draftChanges.targetVersion}`}
          description={`Staged by ${disease.draftChanges.updatedBy} on ${formatCaseDateTime(disease.draftChanges.updatedAt)}`}
          onClose={() => setDiffModalOpen(false)}
          size="large"
          footer={
            <Button variant="secondary" onClick={() => setDiffModalOpen(false)}>
              Close
            </Button>
          }
        >
          <div className={styles.tableScroll}>
            <table className={styles.diffTable} aria-label="Catalog field-by-field diff comparison">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Current Active (v{disease.catalogVersion})</th>
                  <th>New Draft (v{disease.draftChanges.targetVersion})</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {disease.draftChanges.diffs.map((row) => (
                  <tr key={row.field}>
                    <td>
                      <strong>{row.label}</strong>
                    </td>
                    <td className={row.changed ? styles.diffChangedBefore : undefined}>{row.before}</td>
                    <td className={row.changed ? styles.diffChangedAfter : undefined}>{row.after}</td>
                    <td>
                      <Badge tone={row.changed ? 'warning' : 'neutral'}>
                        {row.changed ? 'Modified' : 'Unchanged'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      <Modal
        open={deactivateOpen}
        title={`Deactivate ${disease.name} (${disease.id})?`}
        description="Deactivating removes this disease from future diagnosis selection lists while preserving all past cases pinned to this catalog entry."
        onClose={() => setDeactivateOpen(false)}
        size="medium"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeactivateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={actions.deactivateDisease.isPending}
              onClick={handleDeactivate}
            >
              Confirm Deactivation
            </Button>
          </>
        }
      >
        <TextAreaField
          label="Deactivation reason"
          required
          rows={3}
          value={deactivateReason}
          error={deactivateError ?? undefined}
          onChange={(e) => {
            setDeactivateReason(e.target.value)
            setDeactivateError(null)
          }}
        />
      </Modal>
    </div>
  )
}
