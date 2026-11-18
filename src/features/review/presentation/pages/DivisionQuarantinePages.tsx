import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { newIdempotencyKey } from '@/shared/api'
import { ASSIGNMENT_STATUS } from '@/features/capture'
import { Badge, Banner, Button, ButtonLink, Card, DataTable, EmptyState, Modal, PageHeader, SelectField, TextAreaField, Timeline, usePageBreadcrumbs, useToast } from '@/shared/components'
import { OPERATIONAL_STATUS_LABEL, type DivisionOperationalStatus, type DivisionQuarantine, type ReviewWorkspace } from '../../domain/models'
import { QueryBoundary } from '../components/badges'
import { formatDateTime, reviewPaths } from '../components/format'
import { Fields, IdLink } from '../components/parts'
import { isPending } from '../../domain/rules'
import { useReviewActions, useReviewWorkspace } from '../services/queries'
import styles from '../components/review.module.css'

const SEVERITY_TONE = { Low: 'neutral', Moderate: 'warning', High: 'danger', Critical: 'danger' } as const
const text = (value: string | null | undefined) => value || 'Not recorded'
const assignmentStatus = (status: string) => ASSIGNMENT_STATUS[status as keyof typeof ASSIGNMENT_STATUS] ?? status

export function SeverityBadge({ severity }: { severity: string | null }) {
  if (!severity) return <>Not recorded</>
  return <Badge tone={SEVERITY_TONE[severity as keyof typeof SEVERITY_TONE] ?? 'neutral'}>{severity}</Badge>
}

/** Every division in the Supervisor's estates with its actual operational status, from the division records and quarantine records. */
export function DivisionStatusOverview({ workspace }: { workspace: ReviewWorkspace }) {
  const navigate = useNavigate()
  const [viewing, setViewing] = useState<ReviewWorkspace['divisions'][number] | null>(null)
  const quarantineOf = (divisionId: string) => workspace.divisionQuarantines.find((item) => item.division.id === divisionId && item.status === 'Active')
  // View opens the division's quarantine record when it has one, otherwise a short summary of the division.
  const view = (row: ReviewWorkspace['divisions'][number]) => {
    const q = quarantineOf(row.id)
    if (q) navigate(reviewPaths.divisionQuarantine(q.id))
    else setViewing(row)
  }
  const pending = viewing ? workspace.observations.filter((item) => item.division.id === viewing.id && isPending(item.reviewStatus)).length : 0
  return (
    <Card title="Division operational status">
      <DataTable<ReviewWorkspace['divisions'][number]>
        caption="Division operational status"
        rows={workspace.divisions}
        rowKey={(row) => row.id}
        columns={[
          { id: 'division', header: 'Division', cell: (row) => `${row.name} (${row.id})` },
          { id: 'status', header: 'Operational status', cell: (row) => <DivisionStatusBadge status={row.operationalStatus} /> },
          { id: 'actions', header: 'Actions', align: 'end', cell: (row) => <Button variant="ghost" onClick={() => view(row)} aria-label={`View ${row.name} (${row.id})`}>View</Button> },
        ]}
      />
      <Modal
        open={viewing !== null}
        title={viewing ? `${viewing.name} (${viewing.id})` : 'Division'}
        onClose={() => setViewing(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setViewing(null)}>
              Close
            </Button>
            {viewing && (
              <ButtonLink variant="destructiveOutline" icon="flag" to={`${reviewPaths.divisionQuarantineNew}?division=${viewing.id}`}>
                Quarantine this division
              </ButtonLink>
            )}
          </>
        }
      >
        {viewing && (
          <Fields
            items={[
              { label: 'Estate', value: workspace.estates.find((item) => item.id === viewing.estateId)?.name ?? viewing.estateId },
              { label: 'Operational status', value: <DivisionStatusBadge status={viewing.operationalStatus} /> },
              { label: 'Quarantine', value: 'None active: the division is operating normally' },
              ...workspace.divisionQuarantines
                .filter((item) => item.division.id === viewing.id && item.status === 'Released')
                .map((item) => ({ label: 'Released quarantine', value: <IdLink to={reviewPaths.divisionQuarantine(item.id)}>{item.id} · View record →</IdLink> })),
              { label: 'Observations awaiting review', value: pending },
            ]}
          />
        )}
      </Modal>
    </Card>
  )
}

/** Normal Operations / Restricted Operations, from the division's actual status. */
export function DivisionStatusBadge({ status }: { status: DivisionOperationalStatus }) {
  return <Badge tone={status === 'restricted' ? 'danger' : 'success'}>{OPERATIONAL_STATUS_LABEL[status]}</Badge>
}

/** Division quarantine record: division status, linked diagnosis, assignments and history. */
export function DivisionQuarantineDetailPage() {
  const { divisionQuarantineId = '' } = useParams()
  usePageBreadcrumbs([{ label: 'Review', to: reviewPaths.dashboard }, { label: 'Division Quarantine', to: reviewPaths.quarantine }, { label: divisionQuarantineId }])
  const query = useReviewWorkspace()
  return (
    <QueryBoundary query={query} label="division quarantine">
      {(workspace) => {
        const item = workspace.divisionQuarantines.find((row) => row.id === divisionQuarantineId)
        if (!item) {
          return (
            <EmptyState
              title="Division quarantine unavailable"
              message={`${divisionQuarantineId} does not exist or is outside your estate scope.`}
              icon="info"
              action={
                <ButtonLink variant="secondary" to={reviewPaths.quarantine}>
                  Back to Division Quarantine
                </ButtonLink>
              }
            />
          )
        }
        return <DetailView item={item} />
      }}
    </QueryBoundary>
  )
}

function DetailView({ item }: { item: DivisionQuarantine }) {
  const d = item.diagnosis
  const active = item.status === 'Active'
  const toast = useToast()
  const actions = useReviewActions()
  const [releasing, setReleasing] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [idempotencyKey] = useState(newIdempotencyKey)

  async function release() {
    if (!reason.trim()) {
      setReasonError('Enter the reason for release')
      return
    }
    setFailure(null)
    try {
      await actions.release.mutateAsync({ id: item.id, input: { reason }, meta: { expectedVersion: 0, idempotencyKey } })
      setReleasing(false)
      setReason('')
      toast.show({ tone: 'success', title: `${item.division.name} released`, message: `Quarantine ${item.id} is released. The division is back to Normal Operations.` })
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'The division was not released.')
    }
  }
  return (
    <div className={styles.page}>
      <PageHeader
        back={{ to: reviewPaths.quarantine, label: 'Back to Division Quarantine' }}
        title={`Division Quarantine ${item.id}`}
        subtitle={`${item.estate.name} · ${item.division.name} (${item.division.id})`}
        actions={
          <>
            <ButtonLink variant="secondary" icon="eye" to={`${reviewPaths.observation(item.observationId)}/diagnosis`}>
              View Expert Diagnosis
            </ButtonLink>
            {active && (
              <>
                <ButtonLink icon="plus" to={reviewPaths.quarantineAssignment(item.id)}>
                  Create Quarantine Assignment
                </ButtonLink>
                <Button variant="destructive" icon="check" onClick={() => { setReason(''); setReasonError(null); setFailure(null); setReleasing(true) }}>
                  Release Division
                </Button>
              </>
            )}
          </>
        }
      />
      {active ? (
        <Banner tone="warning" title={`${item.division.name} (${item.division.id}) · ${OPERATIONAL_STATUS_LABEL[item.operationalStatus]}`}>
          Normal field activities are restricted; only Supervisor-authorised assignments are allowed. Normal assignments for this division are blocked; use Create Quarantine Assignment.
        </Banner>
      ) : (
        <Banner tone="success" title={`${item.division.name} (${item.division.id}) · ${OPERATIONAL_STATUS_LABEL[item.operationalStatus]}`}>
          This quarantine was released{item.release ? ` on ${formatDateTime(item.release.at)} by ${item.release.by}` : ''}. The record, its diagnosis and its history are kept.
        </Banner>
      )}
      <div className={styles.split}>
        <Card title="Division">
          <Fields
            items={[
              { label: 'Estate', value: `${item.estate.name} (${item.estate.id})` },
              { label: 'Division', value: `${item.division.name} (${item.division.id})` },
              { label: 'Operational status', value: <DivisionStatusBadge status={item.operationalStatus} /> },
            ]}
          />
        </Card>
        <Card title="Quarantine">
          <Fields
            items={[
              { label: 'Quarantine ID', value: item.id },
              { label: 'Quarantine status', value: <Badge tone={active ? 'danger' : 'success'}>{item.status}</Badge> },
              { label: 'Confirmed disease', value: item.disease ? `${item.disease.name} (${item.disease.id})` : 'Not recorded' },
              { label: 'Severity', value: <SeverityBadge severity={item.severity} /> },
              { label: 'Linked observation', value: <IdLink to={reviewPaths.observation(item.observationId)}>{item.observationId}</IdLink> },
              { label: 'Linked case', value: item.caseId ?? 'Not linked' },
              { label: 'Policy', value: item.policy },
              { label: 'Initiated by', value: item.initiatedBy },
              { label: 'Initiated', value: formatDateTime(item.initiatedAt) },
              { label: 'Reason', value: item.reason },
            ]}
          />
        </Card>
      </div>
      {item.release && (
        <Card title="Release">
          <Fields
            items={[
              { label: 'Release status', value: <Badge tone="success">Released</Badge> },
              { label: 'Released', value: formatDateTime(item.release.at) },
              { label: 'Released by', value: item.release.by },
              { label: 'Reason for release', value: item.release.reason },
            ]}
          />
        </Card>
      )}
      <Card title={`Related Quarantine Assignments (${item.assignments.length})`}>
        <DataTable<DivisionQuarantine['assignments'][number]>
          caption="Quarantine assignments"
          rows={item.assignments}
          rowKey={(row) => row.id}
          empty={<EmptyState title="No Quarantine Assignments yet" message="Use Create Quarantine Assignment above; nothing is assigned automatically." icon="clip" />}
          columns={[
            { id: 'id', header: 'Assignment', cell: (row) => <IdLink to={`/assignments/${row.id}`}>{row.id}</IdLink> },
            { id: 'title', header: 'Title', cell: (row) => row.title },
            { id: 'worker', header: 'Field Worker', cell: (row) => row.fieldWorker ?? 'Not assigned' },
            { id: 'status', header: 'Status', cell: (row) => <Badge tone="info">{assignmentStatus(row.status)}</Badge> },
          ]}
        />
      </Card>
      <Card title="Quarantine history">
        <Timeline
          label="Quarantine history"
          items={item.history.map((entry) => ({ id: entry.id, title: entry.event, state: 'done' as const, detail: [entry.by, formatDateTime(entry.at), entry.note].filter(Boolean).join(' · ') }))}
        />
      </Card>
      <Card title="Linked records">
        <Fields
          items={[
            { label: 'Observation', value: <IdLink to={reviewPaths.observation(item.observationId)}>{item.observationId}</IdLink> },
            { label: 'Case', value: item.caseId ?? 'Not linked' },
            { label: 'Referral', value: item.referralId ?? 'Not linked' },
          ]}
        />
      </Card>
      <Card title="Expert diagnosis">
        {d ? (
          <Fields
            items={[
              { label: 'Confirmed disease', value: `${d.disease.name} (${d.disease.id})` },
              { label: 'Severity', value: <SeverityBadge severity={d.severity} /> },
              { label: 'Catalog version used', value: d.catalogVersion ?? 'Not recorded' },
              { label: 'Expert', value: d.expert },
              { label: 'Diagnosed', value: formatDateTime(d.diagnosedAt) },
              { label: 'Case status', value: d.caseStatus },
              { label: 'Symptoms confirmed', value: text(d.symptomsConfirmed) },
              { label: 'Clinical findings', value: text(d.clinicalFindings) },
              { label: 'Reasoning', value: text(d.reasoning) },
              { label: 'Recommended action', value: text(d.recommendedAction) },
              { label: 'Follow-up description', value: text(d.followUpDescription) },
              { label: 'Monitoring window', value: text(d.monitoringWindow) },
              { label: 'Inspection focus', value: text(d.inspectionFocus) },
            ]}
          />
        ) : (
          <p className={styles.note}>The linked diagnosis is unavailable.</p>
        )}
      </Card>
      <Modal
        open={releasing}
        title="Release this division?"
        onClose={() => setReleasing(false)}
        dismissible={!actions.release.isPending}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReleasing(false)} disabled={actions.release.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" loading={actions.release.isPending} onClick={() => void release()}>
              Confirm Release
            </Button>
          </>
        }
      >
        <Fields
          items={[
            { label: 'Division', value: `${item.division.name} (${item.division.id})` },
            { label: 'Quarantine ID', value: item.id },
          ]}
        />
        <p>The division returns to Normal Operations. The quarantine record, its history and any assignments are kept; nothing is assigned automatically.</p>
        {failure && <Banner tone="error">{failure}</Banner>}
        <TextAreaField label="Reason for Release" required rows={3} value={reason} error={reasonError ?? undefined} onChange={(event) => { setReason(event.target.value); setReasonError(null) }} />
      </Modal>
    </div>
  )
}

const POLICY_TEXT = 'Normal field activities are restricted. Only Supervisor-authorised assignments are allowed.'

/** Quarantine a Division: the Supervisor acts on a recorded expert diagnosis. Nothing is assigned or released from here. */
export function DivisionQuarantineFormPage() {
  usePageBreadcrumbs([{ label: 'Review', to: reviewPaths.dashboard }, { label: 'Division Quarantine', to: reviewPaths.quarantine }, { label: 'Quarantine a Division' }])
  const query = useReviewWorkspace()
  return (
    <QueryBoundary query={query} label="quarantine form">
      {(workspace) => <QuarantineForm workspace={workspace} />}
    </QueryBoundary>
  )
}

function QuarantineForm({ workspace }: { workspace: ReviewWorkspace }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const actions = useReviewActions()
  const [idempotencyKey] = useState(newIdempotencyKey)
  const preset = workspace.divisions.find((item) => item.id === params.get('division'))
  const [estateId, setEstateId] = useState(preset?.estateId ?? (workspace.estates.length === 1 ? workspace.estates[0].id : ''))
  const [divisionId, setDivisionId] = useState(preset?.id ?? '')
  const [observationId, setObservationId] = useState('')
  const [reason, setReason] = useState('')
  const [reasonEdited, setReasonEdited] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState<string | null>(null)

  const estate = workspace.estates.find((item) => item.id === estateId)
  const divisions = workspace.divisions.filter((item) => item.estateId === estateId)
  const division = divisions.find((item) => item.id === divisionId)
  // Only an observation with a recorded expert diagnosis can be acted on: a disease is never entered or assumed here.
  const referrals = workspace.referrals.filter((item) => item.observation.division.id === divisionId && item.diagnosis)
  const referral = referrals.find((item) => item.observation.id === observationId)
  const existing = workspace.divisionQuarantines.find((item) => item.division.id === divisionId && item.status === 'Active')
  const disease = referral?.diagnosis ? `${referral.diagnosis.disease.name} (${referral.diagnosis.disease.id})` : null

  // A message goes away as soon as the field it belongs to is changed.
  const clear = (...keys: string[]) => setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !keys.includes(key))))

  function chooseObservation(id: string) {
    setObservationId(id)
    clear('observation', 'reason')
    const found = referrals.find((item) => item.observation.id === id)
    if (found?.diagnosis && !reasonEdited) setReason(`Confirmed ${found.diagnosis.disease.name}${found.diagnosis.severity ? `, ${found.diagnosis.severity} severity` : ''} (${found.caseId ?? found.id})`)
  }

  async function confirm() {
    setFailure(null)
    const found: Record<string, string> = {}
    if (!estateId) found.estate = 'Select an estate'
    if (!divisionId) found.division = 'Select a division'
    if (divisionId && !referral) found.observation = 'Select the linked observation that has a recorded expert diagnosis'
    if (!reason.trim()) found.reason = 'Enter the quarantine reason'
    setErrors(found)
    if (Object.keys(found).length || !referral || existing) return
    try {
      const result = await actions.quarantine.mutateAsync({ id: referral.observation.id, input: { reason }, meta: { expectedVersion: 0, idempotencyKey } })
      toast.show({ tone: 'success', title: `${division?.name ?? 'Division'} quarantined`, message: `Restricted Operations applies. Quarantine ${result.divisionQuarantine?.id ?? ''} was created.` })
      navigate(result.divisionQuarantine ? reviewPaths.divisionQuarantine(result.divisionQuarantine.id) : reviewPaths.quarantine)
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'The quarantine was not created.')
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader back={{ to: reviewPaths.quarantine, label: 'Back to Division Quarantine' }} title="Quarantine a Division" subtitle="Restricted Operations applies once you confirm. Nothing is assigned or released from this page." />
      {failure && (
        <Banner tone="error" title="The quarantine was not created">
          {failure} Your entries are kept; you can try again.
        </Banner>
      )}
      {existing && (
        <Banner tone="warning" title={`${existing.division.name} (${existing.division.id}) is already under Restricted Operations`}>
          It has an active quarantine, <IdLink to={reviewPaths.divisionQuarantine(existing.id)}>{existing.id}</IdLink>, so a second one cannot be created. Open it to see its details and assignments, or choose another division.
        </Banner>
      )}
      <Card title="A. Division details">
        <div className={styles.form}>
          <SelectField
            label="Estate"
            required
            placeholder="Select an estate"
            options={workspace.estates.map((item) => ({ value: item.id, label: `${item.name} (${item.id})` }))}
            value={estateId}
            error={errors.estate}
            onChange={(event) => { setEstateId(event.target.value); setDivisionId(''); setObservationId(''); clear('estate', 'division', 'observation') }}
          />
          <SelectField
            label="Division"
            required
            placeholder={estateId ? 'Select a division' : 'Select an estate first'}
            disabled={!estateId}
            options={divisions.map((item) => ({ value: item.id, label: `${item.name} (${item.id}) · ${OPERATIONAL_STATUS_LABEL[item.operationalStatus]}` }))}
            value={divisionId}
            error={errors.division}
            onChange={(event) => { setDivisionId(event.target.value); setObservationId(''); clear('division', 'observation') }}
          />
        </div>
      </Card>
      <Card title="B. Quarantine information">
        <div className={styles.form}>
          <SelectField
            label="Linked observation"
            required
            placeholder={divisionId ? (referrals.length ? 'Select an observation with an expert diagnosis' : 'No observation with an expert diagnosis') : 'Select a division first'}
            disabled={!divisionId || referrals.length === 0}
            options={referrals.map((item) => ({ value: item.observation.id, label: `${item.observation.id} · ${item.diagnosis?.disease.name ?? ''} · ${item.caseId ?? item.id}` }))}
            value={observationId}
            error={errors.observation}
            hint={divisionId && referrals.length === 0 ? 'The disease must be confirmed by an expert first. Record the expert diagnosis on the observation, then quarantine the division.' : undefined}
            onChange={(event) => chooseObservation(event.target.value)}
          />
          <Fields
            items={[
              { label: 'Confirmed disease', value: disease ?? 'Taken from the linked expert diagnosis' },
              { label: 'Severity', value: referral ? (referral.diagnosis?.severity ?? 'Not recorded') : 'Taken from the linked expert diagnosis' },
              { label: 'Linked case', value: referral ? (referral.caseId ?? 'Not linked') : 'Taken from the linked observation' },
            ]}
          />
          <TextAreaField label="Quarantine reason" required rows={3} value={reason} error={errors.reason} onChange={(event) => { setReason(event.target.value); setReasonEdited(true); clear('reason') }} />
        </div>
      </Card>
      <Card title="C. Policy">
        <p>
          <Badge tone="danger">Restricted Operations</Badge>
        </p>
        <p className={styles.note}>{POLICY_TEXT}</p>
      </Card>
      <Card title="D. Confirmation">
        <Fields
          items={[
            { label: 'Estate', value: estate ? `${estate.name} (${estate.id})` : 'Not selected' },
            { label: 'Division', value: division ? `${division.name} (${division.id})` : 'Not selected' },
            { label: 'Confirmed disease', value: disease ?? 'Not selected' },
            { label: 'Severity', value: referral ? (referral.diagnosis?.severity ?? 'Not recorded') : 'Not selected' },
            { label: 'Linked observation / case', value: referral ? `${referral.observation.id} / ${referral.caseId ?? 'Not linked'}` : 'Not selected' },
            { label: 'Reason', value: reason.trim() || 'Not entered' },
            { label: 'Policy', value: `Restricted Operations. ${POLICY_TEXT}` },
          ]}
        />
        <div className={styles.decisionButtons}>
          <Button variant="destructive" icon="flag" loading={actions.quarantine.isPending} disabled={Boolean(existing)} onClick={() => void confirm()}>
            Confirm Quarantine
          </Button>
          <ButtonLink variant="secondary" to={reviewPaths.quarantine}>
            Cancel
          </ButtonLink>
        </div>
      </Card>
    </div>
  )
}
