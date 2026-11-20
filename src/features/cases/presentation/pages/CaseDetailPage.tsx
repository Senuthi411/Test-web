import { useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { EvidenceImage } from '@/features/capture'
import { newIdempotencyKey } from '@/shared/api'
import {
  Badge,
  Banner,
  Button,
  Card,
  Checkbox,
  Modal,
  PageHeader,
  SelectField,
  Tabs,
  TextAreaField,
  TextField,
  Timeline,
  Toggle,
  usePageBreadcrumbs,
  useToast,
} from '@/shared/components'
import type {
  CaseFollowUpPriority,
  CaseRecord,
  CaseSeverity,
  CasesWorkspace,
} from '../../domain/models'
import { CASE_SEVERITIES } from '../../domain/models'
import {
  canCloseDiagnosedCase,
  canRecordCaseDiagnosis,
  validateRecordCaseDiagnosis,
  type CasesFieldErrors,
} from '../../domain/rules'
import {
  CaseStatusBadge,
  CasesQueryBoundary,
  DiseaseCategoryBadge,
  SeverityBadge,
} from '../components/badges'
import { casesErrorText, casesPaths, formatCaseDate, formatCaseDateTime } from '../components/format'
import { CaseFields, CaseIdLink, CasePerson } from '../components/parts'
import { useCaseRecord, useCasesActions, useCasesWorkspace } from '../services/queries'
import styles from '../components/cases.module.css'

type CaseWorkbenchTab = 'overview' | 'evidence' | 'compare' | 'diagnose'

/**
 * CASE-03 Case Detail, CASE-04 Linked Evidence, CASE-05 Record Diagnosis,
 * CASE-06 Confirm Diagnosis, and CASE-10 Pending Case Link (Member 4).
 * Uses progressive disclosure (click/hover drawers & modals for technical hashes,
 * optional follow-up fields, and timeline audit logs) so the primary screen stays clean.
 */
export function CaseDetailPage() {
  const { caseId = '', referralId = '' } = useParams()
  const location = useLocation()
  const lookupId = caseId || referralId

  const defaultTabFromPath = (): CaseWorkbenchTab => {
    if (location.pathname.endsWith('/evidence')) return 'evidence'
    if (location.pathname.endsWith('/diagnose') || location.pathname.endsWith('/diagnose/confirm')) return 'diagnose'
    return 'overview'
  }

  usePageBreadcrumbs([
    { label: 'Cases', to: casesPaths.dashboard },
    { label: 'Assigned Cases', to: casesPaths.assigned },
    { label: lookupId },
  ])

  const recordQuery = useCaseRecord(lookupId)
  const workspaceQuery = useCasesWorkspace()

  return (
    <CasesQueryBoundary query={recordQuery} label={`case ${lookupId}`}>
      {(record) => (
        <CasesQueryBoundary query={workspaceQuery} label="cases workspace">
          {(workspace) => (
            <CaseWorkbench
              key={record.id}
              record={record}
              workspace={workspace}
              initialTab={defaultTabFromPath()}
              openConfirmInitially={location.pathname.endsWith('/diagnose/confirm')}
            />
          )}
        </CasesQueryBoundary>
      )}
    </CasesQueryBoundary>
  )
}

function CaseWorkbench({
  record,
  workspace,
  initialTab,
  openConfirmInitially,
}: {
  record: CaseRecord
  workspace: CasesWorkspace
  initialTab: CaseWorkbenchTab
  openConfirmInitially: boolean
}) {
  const navigate = useNavigate()
  const toast = useToast()
  const actions = useCasesActions()
  const [params, setParams] = useSearchParams()

  const tabParam = params.get('tab') as CaseWorkbenchTab | null
  const activeTab: CaseWorkbenchTab =
    tabParam && ['overview', 'evidence', 'compare', 'diagnose'].includes(tabParam)
      ? tabParam
      : initialTab

  const setTab = (next: CaseWorkbenchTab) => {
    const nextParams = new URLSearchParams(params)
    nextParams.set('tab', next)
    setParams(nextParams, { replace: true })
  }

  // On-demand Drawers / Modals (Progressive disclosure)
  const [techDetailsOpen, setTechDetailsOpen] = useState(false)
  const [timelineDrawerOpen, setTimelineDrawerOpen] = useState(false)
  const [showFollowUpFields, setShowFollowUpFields] = useState(false)

  // Evidence revision & zoom state
  const [selectedRevisionIndex, setSelectedRevisionIndex] = useState(record.revisions.length - 1)
  const [evidenceZoom, setEvidenceZoom] = useState(100)
  const [evidenceRotation, setEvidenceRotation] = useState(0)

  // Side-by-side image comparison state
  const [compareDiseaseId, setCompareDiseaseId] = useState(
    record.confirmedDisease?.id ?? record.suspectedDisease.id,
  )
  const [syncZoom, setSyncZoom] = useState(true)
  const [leftZoom, setLeftZoom] = useState(100)
  const [rightZoom, setRightZoom] = useState(100)

  // Record Diagnosis form state (CASE-05 / CASE-06)
  const activeCatalogDiseases = workspace.diseases.filter((d) => d.status === 'active')
  const [diseaseId, setDiseaseId] = useState(
    record.diagnosis?.confirmedDisease.id ?? record.suspectedDisease.id,
  )
  const [severity, setSeverity] = useState<CaseSeverity>(record.diagnosis?.severity ?? 'High')
  const [symptomsConfirmed, setSymptomsConfirmed] = useState<string[]>(
    record.diagnosis?.symptomsConfirmed ?? [...record.observedSymptoms],
  )
  const [clinicalFindings, setClinicalFindings] = useState(
    record.diagnosis?.clinicalFindings ??
      `Official final leaf evidence (${record.revisions[record.revisions.length - 1]?.imageId ?? 'IMG'}) confirms ${record.suspectedDisease.name} lesions in ${record.division.name}.`,
  )
  const [reasoning, setReasoning] = useState(
    record.diagnosis?.reasoning ??
      `Morphological match with Active Catalog v${workspace.kpis.activeCatalogVersion} diagnostic criteria and observed symptoms (${record.observedSymptoms.join(', ')}).`,
  )
  const [recommendedAction, setRecommendedAction] = useState(
    record.diagnosis?.recommendedAction ??
      'Apply targeted foliar fungicide/sanitation across affected division rows and inspect adjacent terrace perimeter within 7 days.',
  )
  const [followUpPriority, setFollowUpPriority] = useState<CaseFollowUpPriority>(
    record.diagnosis?.followUpPlan?.priority ?? 'P1',
  )
  const [followUpDescription, setFollowUpDescription] = useState(
    record.diagnosis?.followUpPlan?.description ??
      `Conduct post-treatment follow-up inspection across ${record.division.name} (${record.division.id}) and capture 3 verification photographs.`,
  )
  const [monitoringWindow, setMonitoringWindow] = useState(
    record.diagnosis?.followUpPlan?.monitoringWindow ?? '7 days post-treatment',
  )
  const [inspectionFocus, setInspectionFocus] = useState(
    record.diagnosis?.followUpPlan?.inspectionFocus ?? 'Upper and lower flush canopy along shaded boundary rows',
  )
  const [closeOnSubmit, setCloseOnSubmit] = useState(false)
  const [formErrors, setFormErrors] = useState<CasesFieldErrors>({})
  const [submitFailure, setSubmitFailure] = useState<string | null>(null)
  const [confirmModalOpen, setConfirmModalOpen] = useState(openConfirmInitially)
  const [idempotencyKey] = useState(() => newIdempotencyKey())

  const selectedRevision = record.revisions[selectedRevisionIndex] ?? record.revisions[record.revisions.length - 1]
  const comparedCatalogDisease =
    workspace.diseases.find((d) => d.id === compareDiseaseId) ?? workspace.diseases[0]
  const selectedFormDisease =
    activeCatalogDiseases.find((d) => d.id === diseaseId) ?? activeCatalogDiseases[0]

  // CASE-10 Pending Case Link handler
  const handleLinkPendingReferral = () => {
    actions.linkReferral.mutate(
      {
        referralId: record.referralId,
        meta: { expectedVersion: record.version, idempotencyKey },
      },
      {
        onSuccess: (linked) => {
          toast.show({
            tone: 'success',
            title: `Referral ${record.referralId} linked to ${linked.id}`,
            message: `${linked.id} is now Awaiting Diagnosis in your queue.`,
          })
          void navigate(casesPaths.caseDetail(linked.id))
        },
        onError: (err) => {
          toast.show({ tone: 'error', title: 'Could not link referral', message: casesErrorText(err) })
        },
      },
    )
  }

  const toggleSymptom = (symptomLabel: string) => {
    setSymptomsConfirmed((prev) =>
      prev.includes(symptomLabel) ? prev.filter((item) => item !== symptomLabel) : [...prev, symptomLabel],
    )
    setFormErrors((prev) => ({ ...prev, symptomsConfirmed: '' }))
  }

  const handleOpenConfirmDiagnosis = () => {
    const errors = validateRecordCaseDiagnosis({
      diseaseId,
      severity,
      symptomsConfirmed,
      clinicalFindings,
      reasoning,
      recommendedAction,
      followUpPriority,
      followUpDescription,
      monitoringWindow,
      inspectionFocus,
      closeCase: closeOnSubmit,
    })
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return
    setSubmitFailure(null)
    setConfirmModalOpen(true)
  }

  const handleConfirmRecordDiagnosis = () => {
    if (!record.caseId) return
    actions.recordDiagnosis.mutate(
      {
        caseId: record.caseId,
        input: {
          diseaseId,
          severity,
          symptomsConfirmed,
          clinicalFindings,
          reasoning,
          recommendedAction,
          followUpPriority,
          followUpDescription,
          monitoringWindow,
          inspectionFocus,
          closeCase: closeOnSubmit,
        },
        meta: { expectedVersion: record.version, idempotencyKey },
      },
      {
        onSuccess: (updated) => {
          setConfirmModalOpen(false)
          toast.show({
            tone: 'success',
            title: `Diagnosis recorded for ${updated.id}`,
            message: `Confirmed ${updated.confirmedDisease?.name} (${updated.confirmedDisease?.id}) · Pinned to Catalog v${updated.catalogVersion}.`,
          })
          setTab('overview')
        },
        onError: (err) => {
          setSubmitFailure(casesErrorText(err))
        },
      },
    )
  }

  const handleCloseDiagnosedCase = () => {
    if (!record.caseId) return
    actions.closeCase.mutate(
      {
        caseId: record.caseId,
        meta: { expectedVersion: record.version, idempotencyKey: newIdempotencyKey() },
      },
      {
        onSuccess: (updated) => {
          toast.show({
            tone: 'success',
            title: `${updated.id} closed`,
            message: 'Case lifecycle transitioned from Diagnosed to Closed.',
          })
        },
        onError: (err) => {
          toast.show({ tone: 'error', title: 'Could not close case', message: casesErrorText(err) })
        },
      },
    )
  }

  // CASE-10 Pending Case Link dedicated view when status === 'pending_link'
  if (record.status === 'pending_link') {
    return (
      <div className={styles.page}>
        <PageHeader
          back={{ to: casesPaths.assigned, label: 'Back to Assigned Cases' }}
          title={`Pending Case Link · ${record.referralId}`}
          subtitle={`${record.division.name} (${record.estate.name}) · Observation ${record.observationId}`}
          actions={
            <>
              <CaseStatusBadge status="pending_link" />
              <Button
                icon="link"
                loading={actions.linkReferral.isPending}
                onClick={handleLinkPendingReferral}
              >
                Link & Create Case
              </Button>
            </>
          }
        />

        <div className={styles.split}>
          <Card title="Referral Summary">
            <CaseFields
              items={[
                { label: 'Referral', value: record.referralId },
                { label: 'Observation', value: record.observationId },
                { label: 'Location', value: `${record.division.name} (${record.estate.name})` },
                { label: 'Referred by', value: <CasePerson name={record.referredBy.fullName} /> },
                { label: 'Referred date', value: formatCaseDate(record.referredAt) },
                { label: 'Suspected disease', value: record.suspectedDisease.name },
              ]}
            />
            <p className={styles.subheading}>Referral note</p>
            <p className={styles.note}>{record.referralNote}</p>
          </Card>

          <Card title="Observation Evidence">
            <EvidenceImage
              label={`${selectedRevision.imageId} · ${selectedRevision.statusBadge}`}
              altText={`Synthetic tea leaf evidence for ${record.observationId}`}
            />
            <div className={styles.chips} style={{ marginTop: 12 }}>
              {record.observedSymptoms.map((s) => (
                <Badge key={s} tone="neutral">
                  {s}
                </Badge>
              ))}
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <PageHeader
        back={{ to: casesPaths.assigned, label: 'Back to Assigned Cases' }}
        title={`Case Detail · ${record.id}`}
        subtitle={`${record.division.name} (${record.estate.name}) · ${record.observationId} · referred ${formatCaseDate(record.referredAt)}`}
        actions={
          <>
            <CaseStatusBadge status={record.status} />
            <Button variant="secondary" icon="history" onClick={() => setTimelineDrawerOpen(true)}>
              Timeline ({record.timeline.length})
            </Button>
            {canRecordCaseDiagnosis(record.status) && activeTab !== 'diagnose' && (
              <Button icon="check" onClick={() => setTab('diagnose')}>
                Record Diagnosis
              </Button>
            )}
            {canCloseDiagnosedCase(record.status) && (
              <Button
                variant="secondary"
                icon="check"
                loading={actions.closeCase.isPending}
                onClick={handleCloseDiagnosedCase}
              >
                Close Case
              </Button>
            )}
          </>
        }
      />

      <Tabs<CaseWorkbenchTab>
        label="Case detail workbench tabs"
        value={activeTab}
        onChange={setTab}
        items={[
          { id: 'overview', label: 'Overview' },
          { id: 'evidence', label: `Evidence (${record.revisions.length})` },
          { id: 'compare', label: 'Compare' },
          { id: 'diagnose', label: record.diagnosis ? 'Diagnosis' : 'Record Diagnosis' },
        ]}
      />

      {activeTab === 'overview' && (
        <div className={styles.caseGrid}>
          {/* Column 1: Evidence Preview */}
          <Card
            title="Observation evidence"
            action={
              <Button variant="ghost" onClick={() => setTechDetailsOpen(true)}>
                Technical provenance
              </Button>
            }
          >
            <EvidenceImage
              label={`${selectedRevision.imageId} · ${selectedRevision.statusBadge}`}
              altText={`Synthetic tea leaf evidence for ${record.observationId}`}
            />
            <div className={styles.actionsInline} style={{ marginTop: 12, justifyContent: 'space-between' }}>
              <span title={`SHA-256: ${selectedRevision.sha256}`}>
                <Badge tone="success">{selectedRevision.statusBadge}</Badge>
              </span>
              <div className={styles.actionsInline}>
                <Button variant="secondary" onClick={() => setTab('evidence')}>
                  Inspect evidence
                </Button>
                <Button variant="secondary" icon="columns" onClick={() => setTab('compare')}>
                  Compare
                </Button>
              </div>
            </div>
          </Card>

          {/* Column 2: Clean Case Details */}
          <Card title="Case details">
            <CaseFields
              items={[
                { label: 'Case ID', value: record.id },
                { label: 'Observation', value: `${record.observationId} (${record.referralId})` },
                { label: 'Division', value: `${record.division.name} (${record.estate.name})` },
                { label: 'Field worker', value: <CasePerson name={record.fieldWorker.fullName} /> },
                { label: 'Referred by', value: <CasePerson name={record.referredBy.fullName} /> },
                { label: 'Catalog version', value: `v${record.catalogVersion}` },
              ]}
            />
            <p className={styles.subheading}>Observed symptoms</p>
            <div className={styles.chips}>
              {record.observedSymptoms.map((sym) => (
                <Badge key={sym} tone="neutral">
                  {sym}
                </Badge>
              ))}
            </div>
            <p className={styles.subheading}>Supervisor referral note</p>
            <p className={styles.note}>{record.referralNote}</p>
          </Card>

          {/* Column 3: Suspected vs Confirmed & Next Action */}
          <Card title="Clinical decision">
            <div className={styles.stack}>
              <div className={styles.diseaseBox}>
                <span className={styles.sectionEyebrow}>Suspected (Mobile field capture)</span>
                <p className={styles.diseaseTitle}>
                  {record.suspectedDisease.name} ({record.suspectedDisease.id})
                </p>
                <span className={styles.caption}>
                  <em>{record.suspectedDisease.pathogen}</em>
                </span>
              </div>

              <div className={`${styles.diseaseBox} ${record.diagnosis ? styles.diseaseBoxConfirmed : ''}`}>
                <span className={styles.sectionEyebrow}>Confirmed (Disease expert)</span>
                {record.diagnosis ? (
                  <>
                    <p className={styles.diseaseTitle}>
                      <CaseIdLink to={casesPaths.catalogDisease(record.diagnosis.confirmedDisease.id)}>
                        {record.diagnosis.confirmedDisease.name} ({record.diagnosis.confirmedDisease.id})
                      </CaseIdLink>
                    </p>
                    <div className={styles.actionsInline}>
                      <SeverityBadge severity={record.diagnosis.severity} />
                      <Badge tone="teal">Catalog v{record.diagnosis.catalogVersionPinned}</Badge>
                    </div>
                    <p className={styles.caption}>{record.diagnosis.clinicalFindings}</p>
                    <Button variant="secondary" fullWidth onClick={() => setTab('diagnose')}>
                      View full diagnosis
                    </Button>
                  </>
                ) : (
                  <>
                    <p className={styles.caption}>Not yet confirmed by expert.</p>
                    <Button icon="check" fullWidth onClick={() => setTab('diagnose')}>
                      Record Diagnosis
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'evidence' && (
        <div className={styles.splitWideLeft}>
          <Card
            title={`Evidence Viewer · ${record.observationId}`}
            action={
              <Button variant="ghost" onClick={() => setTechDetailsOpen(true)}>
                View SHA-256 & GPS details
              </Button>
            }
          >
            <div className={styles.evidenceToolbar} style={{ marginBottom: 16 }}>
              <SelectField
                label="Revision"
                value={String(selectedRevisionIndex)}
                onChange={(e) => setSelectedRevisionIndex(Number(e.target.value))}
                options={record.revisions.map((rev, idx) => ({
                  value: String(idx),
                  label: `V${rev.revisionNumber} · ${rev.statusBadge}`,
                }))}
              />
              <div className={styles.evidenceControls}>
                <Button variant="secondary" onClick={() => setEvidenceZoom((z) => Math.max(75, z - 25))}>
                  −
                </Button>
                <span className={styles.zoomPill}>{evidenceZoom}%</span>
                <Button variant="secondary" onClick={() => setEvidenceZoom((z) => Math.min(200, z + 25))}>
                  +
                </Button>
                <Button variant="secondary" onClick={() => setEvidenceRotation((r) => (r + 90) % 360)}>
                  Rotate
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEvidenceZoom(100)
                    setEvidenceRotation(0)
                  }}
                >
                  Reset
                </Button>
              </div>
            </div>

            <EvidenceImage
              label={`${selectedRevision.imageId} · ${selectedRevision.statusBadge}`}
              altText={`Tea leaf evidence revision ${selectedRevision.revisionNumber} for ${record.observationId}`}
              zoom={evidenceZoom}
              rotation={evidenceRotation}
            />
          </Card>

          <Card title="Revision Summary">
            <CaseFields
              items={[
                { label: 'Revision', value: `V${selectedRevision.revisionNumber} (${selectedRevision.revisionId})` },
                { label: 'Status', value: <Badge tone={selectedRevision.isOfficialFinal ? 'success' : 'neutral'}>{selectedRevision.statusBadge}</Badge> },
                { label: 'Submitted by', value: selectedRevision.submittedBy.fullName },
                { label: 'Received', value: formatCaseDateTime(selectedRevision.receivedAt) },
              ]}
            />
            <p className={styles.subheading}>Symptoms on this revision</p>
            <div className={styles.chips}>
              {selectedRevision.symptoms.map((sym) => (
                <Badge key={sym} tone="teal">
                  {sym}
                </Badge>
              ))}
            </div>
            <p className={styles.subheading}>Field note</p>
            <p className={styles.note}>{selectedRevision.fieldNote}</p>
            <div style={{ marginTop: 14 }}>
              <Button variant="secondary" icon="columns" fullWidth onClick={() => setTab('compare')}>
                Compare with Catalog Plate
              </Button>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'compare' && (
        <Card title={`Side-by-Side Comparison · ${record.observationId} vs Catalog Plate`}>
          <div className={styles.evidenceToolbar} style={{ marginBottom: 16 }}>
            <div className={styles.actionsInline}>
              <SelectField
                label="Catalog Reference"
                value={compareDiseaseId}
                onChange={(e) => setCompareDiseaseId(e.target.value)}
                options={workspace.diseases.map((d) => ({
                  value: d.id,
                  label: `${d.name} (${d.id} · v${d.catalogVersion})`,
                }))}
              />
              <Toggle
                label="Sync zoom"
                checked={syncZoom}
                onChange={(e) => {
                  setSyncZoom(e.target.checked)
                  if (e.target.checked) setRightZoom(leftZoom)
                }}
              />
            </div>

            <div className={styles.evidenceControls}>
              <Button
                variant="secondary"
                onClick={() => {
                  const next = Math.max(75, leftZoom - 25)
                  setLeftZoom(next)
                  if (syncZoom) setRightZoom(next)
                }}
              >
                −
              </Button>
              <span className={styles.zoomPill}>{leftZoom}%</span>
              <Button
                variant="secondary"
                onClick={() => {
                  const next = Math.min(200, leftZoom + 25)
                  setLeftZoom(next)
                  if (syncZoom) setRightZoom(next)
                }}
              >
                +
              </Button>
            </div>
          </div>

          <div className={styles.compareGrid}>
            <Card title={`Field Observation · ${record.observationId}`}>
              <EvidenceImage
                label={`${selectedRevision.imageId} · Field Evidence`}
                altText={`Field observation ${record.observationId}`}
                zoom={leftZoom}
              />
              <p className={styles.note} style={{ marginTop: 12 }}>
                {selectedRevision.fieldNote}
              </p>
            </Card>

            <Card
              title={`Catalog Plate · ${comparedCatalogDisease.name} (${comparedCatalogDisease.id})`}
              action={
                <CaseIdLink to={casesPaths.catalogDisease(comparedCatalogDisease.id)}>
                  Full catalog entry →
                </CaseIdLink>
              }
            >
              <EvidenceImage
                label={`CAT-${comparedCatalogDisease.id} · v${comparedCatalogDisease.catalogVersion}`}
                altText={`Catalog reference plate for ${comparedCatalogDisease.name}`}
                zoom={syncZoom ? leftZoom : rightZoom}
              />
              <p className={styles.note} style={{ marginTop: 12 }}>
                {comparedCatalogDisease.diagnosticCriteria}
              </p>
            </Card>
          </div>
        </Card>
      )}

      {activeTab === 'diagnose' && (
        <div className={styles.splitWideLeft}>
          <Card
            title={
              record.diagnosis
                ? `Confirmed Diagnosis · ${record.diagnosis.id}`
                : `Record Diagnosis · ${record.id}`
            }
          >
            {record.diagnosis ? (
              <div className={styles.stack}>
                <CaseFields
                  items={[
                    {
                      label: 'Confirmed disease',
                      value: `${record.diagnosis.confirmedDisease.name} (${record.diagnosis.confirmedDisease.id})`,
                    },
                    { label: 'Severity', value: <SeverityBadge severity={record.diagnosis.severity} /> },
                    { label: 'Pinned catalog', value: `Catalog v${record.diagnosis.catalogVersionPinned}` },
                    { label: 'Recorded by', value: record.diagnosis.recordedBy.fullName },
                    { label: 'Diagnosed at', value: formatCaseDateTime(record.diagnosis.diagnosedAt) },
                    { label: 'Case status', value: record.diagnosis.caseStatus },
                  ]}
                />

                <div>
                  <p className={styles.subheading}>Confirmed symptoms</p>
                  <div className={styles.chips}>
                    {record.diagnosis.symptomsConfirmed.map((s) => (
                      <Badge key={s} tone="success">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <p className={styles.subheading}>Clinical findings</p>
                  <p className={styles.note}>{record.diagnosis.clinicalFindings}</p>
                </div>

                <div>
                  <p className={styles.subheading}>Recommended action</p>
                  <p className={styles.note}>{record.diagnosis.recommendedAction}</p>
                </div>

                {record.diagnosis.followUpPlan && (
                  <div>
                    <p className={styles.subheading}>
                      Follow-up plan ({record.diagnosis.followUpPlan.priority} · {record.diagnosis.followUpPlan.monitoringWindow})
                    </p>
                    <p className={styles.note}>{record.diagnosis.followUpPlan.description}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.form}>
                <div className={styles.split}>
                  <SelectField
                    label="Confirmed disease (Active Catalog v2)"
                    required
                    value={diseaseId}
                    error={formErrors.diseaseId}
                    onChange={(e) => {
                      setDiseaseId(e.target.value)
                      setFormErrors((prev) => ({ ...prev, diseaseId: '' }))
                    }}
                    options={activeCatalogDiseases.map((d) => ({
                      value: d.id,
                      label: `${d.name} (${d.id})`,
                    }))}
                  />

                  <SelectField
                    label="Severity level"
                    required
                    value={severity}
                    error={formErrors.severity}
                    onChange={(e) => setSeverity(e.target.value as CaseSeverity)}
                    options={CASE_SEVERITIES.map((s) => ({ value: s, label: s }))}
                  />
                </div>

                <div>
                  <p className={styles.subheading}>Confirmed symptoms *</p>
                  <div className={styles.symptomGrid}>
                    {workspace.symptoms
                      .filter((s) => s.status === 'active')
                      .map((sym) => (
                        <div key={sym.id} className={styles.symptomItem} title={sym.description}>
                          <Checkbox
                            label={`${sym.name} (${sym.id})`}
                            checked={symptomsConfirmed.includes(sym.name)}
                            onChange={() => toggleSymptom(sym.name)}
                          />
                        </div>
                      ))}
                  </div>
                  {formErrors.symptomsConfirmed && (
                    <p role="alert" style={{ color: '#b42318', fontSize: 13 }}>
                      {formErrors.symptomsConfirmed}
                    </p>
                  )}
                </div>

                <TextAreaField
                  label="Clinical findings"
                  required
                  rows={2}
                  value={clinicalFindings}
                  error={formErrors.clinicalFindings}
                  onChange={(e) => {
                    setClinicalFindings(e.target.value)
                    setFormErrors((prev) => ({ ...prev, clinicalFindings: '' }))
                  }}
                />

                <TextAreaField
                  label="Diagnostic reasoning"
                  required
                  rows={2}
                  value={reasoning}
                  error={formErrors.reasoning}
                  onChange={(e) => {
                    setReasoning(e.target.value)
                    setFormErrors((prev) => ({ ...prev, reasoning: '' }))
                  }}
                />

                <TextAreaField
                  label="Recommended action"
                  required
                  rows={2}
                  value={recommendedAction}
                  error={formErrors.recommendedAction}
                  onChange={(e) => {
                    setRecommendedAction(e.target.value)
                    setFormErrors((prev) => ({ ...prev, recommendedAction: '' }))
                  }}
                />

                <Toggle
                  label="Add optional follow-up inspection plan for Supervisor"
                  checked={showFollowUpFields}
                  onChange={(e) => setShowFollowUpFields(e.target.checked)}
                />

                {showFollowUpFields && (
                  <div className={styles.diseaseBox}>
                    <div className={styles.split}>
                      <SelectField
                        label="Priority"
                        value={followUpPriority}
                        onChange={(e) => setFollowUpPriority(e.target.value as CaseFollowUpPriority)}
                        options={[
                          { value: 'P1', label: 'P1 · Urgent (7 days)' },
                          { value: 'P2', label: 'P2 · Standard (14 days)' },
                          { value: 'P3', label: 'P3 · Routine (21 days)' },
                        ]}
                      />
                      <TextField
                        label="Monitoring window"
                        value={monitoringWindow}
                        onChange={(e) => setMonitoringWindow(e.target.value)}
                      />
                    </div>
                    <TextField
                      label="Inspection focus"
                      value={inspectionFocus}
                      onChange={(e) => setInspectionFocus(e.target.value)}
                    />
                    <TextAreaField
                      label="Follow-up instructions"
                      rows={2}
                      value={followUpDescription}
                      onChange={(e) => setFollowUpDescription(e.target.value)}
                    />
                  </div>
                )}

                <Checkbox
                  label="Close case immediately upon recording diagnosis"
                  checked={closeOnSubmit}
                  onChange={(e) => setCloseOnSubmit(e.target.checked)}
                />

                <div className={styles.actionsInline}>
                  <Button icon="check" onClick={handleOpenConfirmDiagnosis}>
                    Review & Confirm Diagnosis
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <Card title="Selected Catalog Entry">
            {selectedFormDisease && (
              <div className={styles.stack}>
                <CaseFields
                  items={[
                    { label: 'Disease', value: `${selectedFormDisease.name} (${selectedFormDisease.id})` },
                    { label: 'Pathogen', value: <em>{selectedFormDisease.pathogen}</em> },
                    { label: 'Category', value: <DiseaseCategoryBadge category={selectedFormDisease.category} /> },
                    { label: 'Catalog version', value: `v${selectedFormDisease.catalogVersion} (Pinned)` },
                  ]}
                />
                <p className={styles.subheading}>Diagnostic criteria</p>
                <p className={styles.note}>{selectedFormDisease.diagnosticCriteria}</p>
                <p className={styles.subheading}>Treatment guidance</p>
                <p className={styles.note}>{selectedFormDisease.treatmentGuidance}</p>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* On-demand Technical Provenance Drawer (SHA-256, GPS, Asset Key) */}
      <Modal
        open={techDetailsOpen}
        placement="end"
        title={`Technical Provenance · ${selectedRevision.imageId}`}
        description={`Cryptographic integrity and location metadata for ${record.observationId}`}
        onClose={() => setTechDetailsOpen(false)}
        footer={
          <Button variant="secondary" onClick={() => setTechDetailsOpen(false)}>
            Close
          </Button>
        }
      >
        <div className={styles.stack}>
          <CaseFields
            items={[
              { label: 'Revision ID', value: selectedRevision.revisionId },
              { label: 'Status', value: selectedRevision.statusBadge },
              { label: 'Asset Key', value: selectedRevision.assetKey },
              { label: 'MIME Type', value: selectedRevision.mimeType },
              { label: 'Latitude / Longitude', value: `${selectedRevision.latitude}° N, ${selectedRevision.longitude}° E` },
              { label: 'GPS Accuracy', value: `±${selectedRevision.gpsAccuracyM} m` },
              { label: 'Captured At', value: formatCaseDateTime(selectedRevision.capturedAt) },
              { label: 'Received At', value: formatCaseDateTime(selectedRevision.receivedAt) },
            ]}
          />
          <div>
            <p className={styles.subheading}>SHA-256 Checksum</p>
            <div className={styles.codeHash}>{selectedRevision.sha256}</div>
          </div>
        </div>
      </Modal>

      {/* On-demand Lifecycle Timeline Drawer */}
      <Modal
        open={timelineDrawerOpen}
        placement="end"
        title={`Case Timeline · ${record.id}`}
        description="End-to-end audit trail from mobile capture to expert decision"
        onClose={() => setTimelineDrawerOpen(false)}
        footer={
          <Button variant="secondary" onClick={() => setTimelineDrawerOpen(false)}>
            Close
          </Button>
        }
      >
        <Timeline
          label="Case lifecycle events"
          items={record.timeline.map((ev) => ({
            id: ev.id,
            title: `${ev.title} (${formatCaseDateTime(ev.at)})`,
            detail: `${ev.actor} (${ev.actorRole}) · ${ev.detail}`,
            state: 'done' as const,
          }))}
        />
      </Modal>

      {/* CASE-06 Confirm Diagnosis Modal */}
      <Modal
        open={confirmModalOpen}
        title={`Confirm Diagnosis · ${record.id}`}
        description="Once confirmed, the active catalog version is pinned and the decision is sent to the Estate Supervisor."
        onClose={() => setConfirmModalOpen(false)}
        dismissible={!actions.recordDiagnosis.isPending}
        size="medium"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={actions.recordDiagnosis.isPending}
              onClick={() => setConfirmModalOpen(false)}
            >
              Keep editing
            </Button>
            <Button
              icon="check"
              loading={actions.recordDiagnosis.isPending}
              onClick={handleConfirmRecordDiagnosis}
            >
              Confirm & Record Diagnosis
            </Button>
          </>
        }
      >
        <div className={styles.stack}>
          <CaseFields
            items={[
              { label: 'Case', value: `${record.id} (${record.observationId})` },
              { label: 'Confirmed disease', value: `${selectedFormDisease?.name} (${selectedFormDisease?.id})` },
              { label: 'Pinned catalog', value: `Catalog v${workspace.kpis.activeCatalogVersion}` },
              { label: 'Severity', value: <SeverityBadge severity={severity} /> },
              { label: 'Resulting status', value: closeOnSubmit ? 'Closed' : 'Diagnosed' },
            ]}
          />
          <p className={styles.note}>{clinicalFindings}</p>
          {submitFailure && <Banner tone="error">{submitFailure}</Banner>}
        </div>
      </Modal>
    </div>
  )
}
