import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { newIdempotencyKey } from '@/shared/api'
import { Badge, Banner, Button, ButtonLink, Card, EmptyState, Modal, PageHeader, SelectField, TextAreaField, TextField, usePageBreadcrumbs, useToast } from '@/shared/components'
import { SEVERITY_LEVELS, type ExpertDiagnosisInput, type ObservationReview } from '../../domain/models'
import { canRecordDiagnosis, expertDiagnosisErrors, type FieldErrors } from '../../domain/rules'
import { QueryBoundary, ReviewStatusBadge } from '../components/badges'
import { errorText, formatDateTime, reviewPaths } from '../components/format'
import { Fields } from '../components/parts'
import { useObservationReview, useReviewActions } from '../services/queries'
import styles from '../components/review.module.css'

const diagnosisPath = (id: string) => `${reviewPaths.observation(id)}/diagnosis`
const recordPath = (id: string) => `${reviewPaths.observation(id)}/diagnosis/new`
const text = (value: string) => value || 'Not recorded'

/** Create New Assignment opens the existing assignment form with this division and the expert's plan prefilled. */
function assignmentPath(review: ObservationReview): string {
  const params = new URLSearchParams({ division: review.observation.division.id, observation: review.observation.id })
  const d = review.expertDiagnosis
  if (d) {
    params.set('title', `Follow up ${review.observation.id} · ${d.disease.name}`)
    const plan = [
      d.recommendedAction,
      d.followUpDescription && `Follow-up plan: ${d.followUpDescription}`,
      d.monitoringWindow && `Monitoring window: ${d.monitoringWindow}`,
      d.inspectionFocus && `Inspection focus: ${d.inspectionFocus}`,
    ].filter(Boolean)
    params.set('instructions', plan.join('\n\n'))
  }
  return `/assignments/new?${params.toString()}`
}

/** Expert Diagnosis details for an observation's case, with the Supervisor's follow-up actions. */
export function ExpertDiagnosisPage() {
  const { observationId = '' } = useParams()
  usePageBreadcrumbs([{ label: 'Review', to: reviewPaths.dashboard }, { label: observationId, to: reviewPaths.observation(observationId) }, { label: 'Expert Diagnosis' }])
  const query = useObservationReview(observationId)
  return <QueryBoundary query={query} label="expert diagnosis">{(review) => <DiagnosisView key={`${review.observation.id}-${review.version}`} review={review} />}</QueryBoundary>
}

function DiagnosisView({ review }: { review: ObservationReview }) {
  const o = review.observation
  const d = review.expertDiagnosis
  const toast = useToast()
  const actions = useReviewActions()
  const [idempotencyKey] = useState(newIdempotencyKey)
  const [confirming, setConfirming] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)
  const meta = { expectedVersion: review.version, idempotencyKey }
  const quarantine = review.divisionQuarantine
  // The reason starts from the expert's findings and stays editable.
  const [reason, setReason] = useState(() => (d ? `Confirmed ${d.disease.name}${d.severity ? `, ${d.severity} severity` : ''} (${d.caseId ?? d.referralId})` : ''))

  async function quarantineDivision() {
    setFailure(null)
    try {
      await actions.quarantine.mutateAsync({ id: o.id, input: { reason }, meta })
      setConfirming(false)
      toast.show({ tone: 'success', title: `${o.division.name} quarantined`, message: 'Restricted Operations applies to this division.' })
    } catch (error) {
      setConfirming(false)
      setFailure(error)
    }
  }

  async function closeCase() {
    setFailure(null)
    try {
      await actions.closeCase.mutateAsync({ id: o.id, meta })
      toast.show({ tone: 'success', title: `${d?.caseId ?? 'Case'} closed` })
    } catch (error) {
      setFailure(error)
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader
        back={{ to: reviewPaths.observation(o.id), label: 'Back to Decision Observation' }}
        title={`Expert Diagnosis · ${o.id}`}
        subtitle={`${o.division.name} (${o.division.id}) · ${o.estate.name}`}
        actions={
          <>
            {quarantine ? (
              <ButtonLink variant="destructiveOutline" icon="flag" to={reviewPaths.divisionQuarantine(quarantine.id)}>
                View quarantine {quarantine.id}
              </ButtonLink>
            ) : (
              <Button variant="destructiveOutline" icon="flag" onClick={() => setConfirming(true)} disabled={d === null} title={d === null ? 'Record the expert diagnosis first' : undefined}>
                Quarantine Division
              </Button>
            )}
            <ButtonLink icon="plus" to={assignmentPath(review)}>
              Create New Assignment
            </ButtonLink>
          </>
        }
      />
      {failure !== null && (
        <Banner tone="error" title="The action was not completed">
          {errorText(failure)}
        </Banner>
      )}
      <Card title="Division operational status">
        <Fields
          items={[
            { label: 'Division', value: `${o.division.name} (${o.division.id}) · ${o.estate.name}` },
            { label: 'Operational status', value: <Badge tone={quarantine ? 'danger' : 'success'}>{quarantine ? 'Restricted Operations' : 'Normal Operations'}</Badge> },
            ...(quarantine
              ? [
                  { label: 'Quarantine ID', value: <Link to={reviewPaths.divisionQuarantine(quarantine.id)}>{quarantine.id}</Link> },
                  { label: 'Initiated', value: `${formatDateTime(quarantine.initiatedAt)} · ${quarantine.initiatedBy}` },
                  { label: 'Quarantine assignments', value: quarantine.assignments.length ? quarantine.assignments.map((item) => `${item.id} (${item.status})`).join(', ') : 'None yet' },
                ]
              : []),
          ]}
        />
        {quarantine ? (
          <>
            <p className={styles.note}>
              Normal field activities are restricted; only Supervisor-authorised assignments are allowed. Quarantine {quarantine.id} was initiated from {quarantine.observationId}
              {quarantine.caseId ? ` (${quarantine.caseId})` : ''}.
            </p>
            <div className={styles.decisionButtons}>
              <ButtonLink icon="eye" to={reviewPaths.divisionQuarantine(quarantine.id)}>
                View Quarantine Details
              </ButtonLink>
              <ButtonLink variant="secondary" icon="plus" to={reviewPaths.quarantineAssignment(quarantine.id)}>
                Create Quarantine Assignment
              </ButtonLink>
            </div>
          </>
        ) : (
          <p className={styles.note}>The division is operating normally. Quarantine Division sets it to Restricted Operations after you confirm.</p>
        )}
      </Card>
      {d === null ? (
        <EmptyState
          title="No expert diagnosis yet"
          message={
            <>
              No diagnosis has been recorded for {o.id}{review.referralId ? ` (referral ${review.referralId})` : ''}. The observation is <ReviewStatusBadge status={o.reviewStatus} />.
              {canRecordDiagnosis(o.reviewStatus) ? '' : ' A diagnosis can be recorded once the observation has been referred to an expert.'}
            </>
          }
          icon="info"
          action={
            canRecordDiagnosis(o.reviewStatus) ? (
              <ButtonLink to={recordPath(o.id)} icon="edit">
                Record expert diagnosis
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <>
          <Card title="Case and reference details">
            <Fields
              items={[
                { label: 'Case ID', value: d.caseId ?? 'Not linked' },
                { label: 'Referral ID', value: d.referralId },
                { label: 'Linked observation', value: d.observationId },
                { label: 'Estate and division', value: `${d.estate.name} (${d.estate.id}) · ${d.division.name} (${d.division.id})` },
                { label: 'Assigned expert', value: d.expert },
                { label: 'Diagnosis date and time', value: formatDateTime(d.diagnosedAt) },
                { label: 'Case status', value: <Badge tone={d.caseStatus === 'Closed' ? 'neutral' : 'success'}>{d.caseStatus}</Badge> },
                ...(d.closedAt ? [{ label: 'Closed date and time', value: formatDateTime(d.closedAt) }] : []),
              ]}
            />
          </Card>
          <div className={styles.split}>
            <Card title="Confirmed disease details">
              <Fields
                items={[
                  { label: 'Confirmed disease', value: `${d.disease.name} (${d.disease.id})` },
                  { label: 'Catalog version used', value: d.catalogVersion ?? 'Not recorded' },
                ]}
              />
            </Card>
            <Card title="Severity">
              <Fields items={[{ label: 'Severity level', value: d.severity ?? 'Not recorded' }]} />
            </Card>
          </div>
          <Card title="Symptoms verification">
            <Fields items={[{ label: 'Symptoms confirmed', value: text(d.symptomsConfirmed) }]} />
          </Card>
          <Card title="Expert notes">
            <Fields
              items={[
                { label: 'Clinical findings', value: text(d.clinicalFindings) },
                { label: 'Reasoning', value: text(d.reasoning) },
              ]}
            />
          </Card>
          <Card title="Recommended action">
            <Fields items={[{ label: 'Recommended action', value: text(d.recommendedAction) }]} />
          </Card>
          <Card title="Follow-up plan">
            <Fields
              items={[
                { label: 'Follow-up description', value: text(d.followUpDescription) },
                { label: 'Monitoring window', value: text(d.monitoringWindow) },
                { label: 'Inspection focus', value: text(d.inspectionFocus) },
              ]}
            />
            <p className={styles.note}>The Supervisor assigns any follow-up inspection; none is created from this plan automatically.</p>
          </Card>
          {d.caseStatus === 'Diagnosed' && d.catalogVersion !== null && (
            <div>
              <Button variant="secondary" icon="check" loading={actions.closeCase.isPending} onClick={() => void closeCase()}>
                Close Case
              </Button>
            </div>
          )}
        </>
      )}
      <Modal
        open={confirming}
        title="Quarantine this division?"
        size="large"
        onClose={() => setConfirming(false)}
        dismissible={!actions.quarantine.isPending}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={actions.quarantine.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" loading={actions.quarantine.isPending} disabled={!reason.trim()} onClick={() => void quarantineDivision()}>
              Confirm quarantine
            </Button>
          </>
        }
      >
        <Fields
          items={[
            { label: 'Estate', value: `${o.estate.name} (${o.estate.id})` },
            { label: 'Division', value: `${o.division.name} (${o.division.id})` },
            { label: 'Confirmed disease', value: d ? `${d.disease.name} (${d.disease.id})` : 'Not recorded' },
            { label: 'Severity', value: d?.severity ?? 'Not recorded' },
            { label: 'Linked observation', value: o.id },
            { label: 'Linked case', value: d?.caseId ?? 'Not linked' },
            { label: 'Quarantine policy', value: 'Restricted Operations' },
          ]}
        />
        <p>
          <strong>Normal field activities in this division will be restricted.</strong> Only Supervisor-authorised assignments are allowed; normal field assignments for {o.division.name} are blocked until a Supervisor authorises a Quarantine Assignment. Existing assignments are not changed and no work is assigned automatically.
        </p>
        <TextAreaField label="Quarantine reason" required rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Modal>
    </div>
  )
}

const EMPTY: Omit<ExpertDiagnosisInput, 'closeCase'> = {
  diseaseId: '', symptomsConfirmed: '', severity: '', clinicalFindings: '', reasoning: '', recommendedAction: '', followUpDescription: '', monitoringWindow: '', inspectionFocus: '',
}

/** Record Expert Diagnosis: sections A–I, filled in by the Supervisor on the expert's behalf. */
export function ExpertDiagnosisFormPage() {
  const { observationId = '' } = useParams()
  usePageBreadcrumbs([{ label: 'Review', to: reviewPaths.dashboard }, { label: observationId, to: reviewPaths.observation(observationId) }, { label: 'Expert Diagnosis', to: diagnosisPath(observationId) }, { label: 'Record diagnosis' }])
  const query = useObservationReview(observationId)
  return <QueryBoundary query={query} label="expert diagnosis form">{(review) => <DiagnosisForm key={`${review.observation.id}-${review.version}`} review={review} />}</QueryBoundary>
}

function DiagnosisForm({ review }: { review: ObservationReview }) {
  const o = review.observation
  const navigate = useNavigate()
  const toast = useToast()
  const actions = useReviewActions()
  const [idempotencyKey] = useState(newIdempotencyKey)
  const [draft, setDraft] = useState(EMPTY)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [confirm, setConfirm] = useState<'submit' | 'close' | null>(null)
  const [failure, setFailure] = useState<unknown>(null)
  const set = (key: keyof typeof EMPTY) => (event: { target: { value: string } }) => setDraft((current) => ({ ...current, [key]: event.target.value }))
  const back = diagnosisPath(o.id)
  const disease = review.catalog.find((item) => item.id === draft.diseaseId)
  const catalogVersion = disease?.catalogVersion ?? review.catalog[0]?.catalogVersion
  const caseId = review.referral?.caseId ?? o.id.replace('OBS-', 'CASE-')

  if (!canRecordDiagnosis(o.reviewStatus)) {
    return (
      <div className={styles.page}>
        <PageHeader back={{ to: back, label: 'Back to Expert Diagnosis' }} title="Record Expert Diagnosis" subtitle={o.id} />
        <EmptyState
          title="A diagnosis cannot be recorded"
          message={
            <>
              {o.id} is <ReviewStatusBadge status={o.reviewStatus} />. A diagnosis can only be recorded for a referred observation that has none yet.
            </>
          }
          icon="info"
          action={<ButtonLink variant="secondary" to={back}>Back to Expert Diagnosis</ButtonLink>}
        />
      </div>
    )
  }

  function validate(): boolean {
    const found = expertDiagnosisErrors({ ...draft, closeCase: false })
    setErrors(found)
    return Object.keys(found).length === 0
  }

  async function submit(closeCase: boolean) {
    setFailure(null)
    try {
      await actions.recordDiagnosis.mutateAsync({ id: o.id, input: { ...draft, closeCase }, meta: { expectedVersion: review.version, idempotencyKey } })
      toast.show({ tone: 'success', title: closeCase ? `Diagnosis recorded and ${caseId} closed` : `Diagnosis recorded · ${caseId} is Diagnosed` })
      navigate(back)
    } catch (error) {
      setConfirm(null)
      setFailure(error)
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (validate()) setConfirm('submit')
  }

  const pending = actions.recordDiagnosis.isPending
  return (
    <form className={styles.page} onSubmit={onSubmit} noValidate aria-label="Record Expert Diagnosis">
      <PageHeader back={{ to: back, label: 'Back to Expert Diagnosis' }} title={`Record Expert Diagnosis · ${o.id}`} subtitle="Recorded by the Supervisor on the expert's behalf" />
      {failure !== null && (
        <Banner tone="error" title="The diagnosis was not recorded">
          {errorText(failure)} Your entries are kept; you can try again.
        </Banner>
      )}
      <Card title="A. Case and reference details (auto-linked)">
        <Fields
          items={[
            { label: 'Case ID', value: caseId },
            { label: 'Referral ID', value: review.referralId ?? 'Not linked' },
            { label: 'Linked observation ID', value: o.id },
            { label: 'Estate and division', value: `${o.estate.name} (${o.estate.id}) · ${o.division.name} (${o.division.id})` },
            { label: 'Assigned expert', value: review.referral?.expert ?? 'Not assigned' },
            { label: 'Diagnosis date and time', value: 'Set when the diagnosis is submitted' },
          ]}
        />
      </Card>
      <Card title="B. Decision status (auto-updated)">
        <Fields
          items={[
            { label: 'Case status', value: 'Not yet diagnosed (Diagnosed or Closed on submission)' },
            { label: 'Closed date and time', value: 'Set only when the case is closed' },
          ]}
        />
      </Card>
      <Card title="C. Confirmed disease details">
        <div className={styles.form}>
          <SelectField
            label="Confirmed disease"
            required
            placeholder="Select from the Active Disease Catalog"
            options={review.catalog.map((item) => ({ value: item.id, label: `${item.name} (${item.id})` }))}
            value={draft.diseaseId}
            onChange={set('diseaseId')}
            error={errors.diseaseId}
          />
          <Fields items={[{ label: 'Catalog version used', value: catalogVersion === undefined ? 'Not available' : `${catalogVersion} (pinned automatically)` }]} />
        </div>
      </Card>
      <Card title="D. Symptoms verification">
        <TextAreaField label="Symptoms confirmed" required rows={3} value={draft.symptomsConfirmed} onChange={set('symptomsConfirmed')} error={errors.symptomsConfirmed} />
      </Card>
      <Card title="E. Severity">
        <SelectField label="Severity level" required placeholder="Select severity" options={SEVERITY_LEVELS.map((value) => ({ value, label: value }))} value={draft.severity} onChange={set('severity')} error={errors.severity} />
      </Card>
      <Card title="F. Expert notes">
        <div className={styles.form}>
          <TextAreaField label="Clinical findings" required rows={4} value={draft.clinicalFindings} onChange={set('clinicalFindings')} error={errors.clinicalFindings} />
          <TextAreaField label="Reasoning" required rows={4} value={draft.reasoning} onChange={set('reasoning')} error={errors.reasoning} />
        </div>
      </Card>
      <Card title="G. Recommended action">
        <TextAreaField label="Recommended action" required hint="Next steps for the Supervisor and Field Team." rows={4} value={draft.recommendedAction} onChange={set('recommendedAction')} error={errors.recommendedAction} />
      </Card>
      <Card title="H. Follow-up plan (Phase 2 / P1)">
        <div className={styles.form}>
          <TextAreaField label="Follow-up description" rows={3} value={draft.followUpDescription} onChange={set('followUpDescription')} />
          <TextField label="Monitoring window" value={draft.monitoringWindow} onChange={set('monitoringWindow')} />
          <TextField label="Inspection focus" value={draft.inspectionFocus} onChange={set('inspectionFocus')} />
          <p className={styles.note}>The Supervisor assigns the inspection. Nothing is created or assigned from this plan automatically.</p>
        </div>
      </Card>
      <Card title="I. Submission">
        <div className={styles.decisionButtons}>
          <Button type="submit" icon="check" loading={pending}>
            Review &amp; Submit Diagnosis
          </Button>
          <Button
            variant="secondary"
            icon="check"
            disabled={pending}
            onClick={() => {
              if (validate()) setConfirm('close')
            }}
          >
            Close Case
          </Button>
        </div>
      </Card>
      <Modal
        open={confirm !== null}
        title={confirm === 'close' ? 'Submit diagnosis and close the case?' : 'Submit this diagnosis?'}
        onClose={() => setConfirm(null)}
        dismissible={!pending}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)} disabled={pending}>
              Keep editing
            </Button>
            <Button loading={pending} onClick={() => void submit(confirm === 'close')}>
              {confirm === 'close' ? 'Submit and close case' : 'Confirm and submit'}
            </Button>
          </>
        }
      >
        <p>
          <strong>{disease ? `${disease.name} (${disease.id})` : ''}</strong> · severity <strong>{draft.severity}</strong> · catalog version {catalogVersion}
        </p>
        <p>{draft.recommendedAction}</p>
        <p>The case becomes {confirm === 'close' ? 'Closed, with its closing time recorded' : 'Diagnosed'}. No inspection is assigned automatically.</p>
      </Modal>
    </form>
  )
}
