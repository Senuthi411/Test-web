/**
 * Review business rules. Each rule cites the approved screen it comes from. Where the
 * designs are silent, the rule is the most conservative reading and is recorded in
 * docs/phase5-review-completion-report.md ("Interpretations").
 */
import type {
  ApproveCorrectionInput,
  ExpertDiagnosisInput,
  Correction,
  CorrectionRequestInput,
  CorrectionStatus,
  FlagInput,
  ReferralInput,
  RejectCorrectionInput,
  ReviewStatus,
  ReviewWorkspace,
  VerifyInput,
} from './models'

export type FieldErrors = Record<string, string>

/** Status after each observation decision (REV-04/05/06/12 "Resulting status"). */
export const RESULTING_STATUS = {
  verify: 'verified',
  flag: 'flagged',
  requestCorrection: 'correction_requested',
  refer: 'referred',
} as const satisfies Record<string, ReviewStatus>

export type ObservationDecision = keyof typeof RESULTING_STATUS

/**
 * Observation review lifecycle. This table is the single source of truth for every status change:
 * the data layer, the screens and the tests all ask it, so no button decides a transition on its own.
 *
 *   Submitted → In Review → Verified | Flagged
 *   Verified  → Referred | History          Flagged → Correction Requested | History
 *   Correction Requested → Resubmitted → (Review) In Review
 *   Referred  → Decision (only once the expert has confirmed)      Decision → History
 *
 * `history` is the existing Observation History (End Process); it is terminal and is not a review status.
 * The review status, the correction status and the referral status are separate state machines; this table
 * is the review one. Applying a correction (RevisionApplied) and the expert's confirmation are events the
 * other modules deliver, and they are the only way to enter In Review again or Decision.
 */
export type WorkflowAction =
  | 'startReview'
  | 'verify'
  | 'flag'
  | 'requestCorrection'
  | 'refer'
  | 'resubmit'
  | 'startResubmittedReview'
  | 'recordExpertDecision'
  | 'endProcess'

export type WorkflowTarget = ReviewStatus | 'history'

export const WORKFLOW_TRANSITIONS: Readonly<Record<ReviewStatus, Readonly<Partial<Record<WorkflowAction, WorkflowTarget>>>>> = {
  submitted: { startReview: 'in_review' },
  in_review: { verify: 'verified', flag: 'flagged' },
  verified: { refer: 'referred', endProcess: 'history' },
  flagged: { requestCorrection: 'correction_requested', endProcess: 'history' },
  correction_requested: { resubmit: 'resubmitted' },
  resubmitted: { startResubmittedReview: 'in_review' },
  referred: { recordExpertDecision: 'decision' },
  decision: { endProcess: 'history' },
}

/** The status (or History) the action leads to from `status`, or null when the action is not allowed there. */
export function transitionTarget(status: ReviewStatus, action: WorkflowAction): WorkflowTarget | null {
  return WORKFLOW_TRANSITIONS[status][action] ?? null
}
export const canTransition = (status: ReviewStatus, action: WorkflowAction): boolean => transitionTarget(status, action) !== null

const DECISIONS: readonly ObservationDecision[] = ['verify', 'flag', 'requestCorrection', 'refer']

/** The Supervisor decisions (those with a decision form) the lifecycle allows in `status`. */
export function allowedDecisions(status: ReviewStatus): readonly ObservationDecision[] {
  return DECISIONS.filter((decision) => canTransition(status, decision))
}

/** Whether `decision` (or, without one, any decision) may be recorded in `status`. */
export function canDecide(status: ReviewStatus, decision?: ObservationDecision): boolean {
  return decision ? canTransition(status, decision) : allowedDecisions(status).length > 0
}

/** Submitted (Review) and Resubmitted (Review) move to In Review only when the Supervisor starts the review, never on opening. */
export function canStartReview(status: ReviewStatus): boolean {
  return canTransition(status, 'startReview') || canTransition(status, 'startResubmittedReview')
}
/** Kept for callers: claiming is the same as starting the review. */
export const canClaim = canStartReview

/** The action that starts the review from `status` (Submitted or Resubmitted), or null. */
export const startReviewAction = (status: ReviewStatus): WorkflowAction | null =>
  canTransition(status, 'startReview') ? 'startReview' : canTransition(status, 'startResubmittedReview') ? 'startResubmittedReview' : null

/** The expert's diagnosis can be received while the observation is Referred and its case has no diagnosis yet. */
export function canRecordDiagnosis(status: ReviewStatus): boolean {
  return canTransition(status, 'recordExpertDecision')
}

/** End Process (to History) is offered from Verified, Flagged and Decision, and only once. */
export function canEndProcess(status: ReviewStatus, processEndedAt: string | null): boolean {
  return processEndedAt === null && canTransition(status, 'endProcess')
}

/** REV-10: only a resubmitted revision can be compared and approved. */
export function canApproveCorrection(status: CorrectionStatus): boolean {
  return status === 'resubmitted'
}

/** REV-11 rejects COR-041 while it is still "Requested"; REV-08 offers Reject on a resubmitted one. */
export function canRejectCorrection(status: CorrectionStatus): boolean {
  return status === 'requested' || status === 'resubmitted'
}

/** REV-06/REV-10: only the RevisionApplied event moves Approved to Applied (and the review back to in_review). */
export function canApplyRevision(status: CorrectionStatus): boolean {
  return status === 'approved'
}

/** REV-07 "Open" tab = corrections not yet finished (Applied and Rejected are final). */
export function isOpenCorrection(status: CorrectionStatus): boolean {
  return status === 'requested' || status === 'resubmitted' || status === 'approved'
}

/** REV-01 "Pending = submitted or in review." A resubmitted revision also waits for a review decision. */
export function isPending(status: ReviewStatus): boolean {
  return status === 'submitted' || status === 'resubmitted' || status === 'in_review'
}

/** A Field Worker can resubmit only while the correction is requested and the observation waits for it. */
export function canResubmit(status: CorrectionStatus, reviewStatus: ReviewStatus): boolean {
  return status === 'requested' && reviewStatus === 'correction_requested'
}

/** Fixture-only stand-in input for the Capture mobile app's corrected resubmission. */
export interface ResubmissionInput {
  note: string
  retakePhoto: boolean
}

export function resubmissionErrors(input: ResubmissionInput): FieldErrors {
  return blank(input.note) ? { note: 'Enter the corrected field note' } : {}
}

const blank = (value: string) => value.trim() === ''

/**
 * Verification has no mandatory checklist: the Supervisor decides from the evidence shown.
 * The optional note needs no validation; the status rule is checked by the data layer.
 */
export function verifyErrors(input: VerifyInput): FieldErrors {
  void input
  return {}
}

/** REV-05: Reason * and Explanation * are required. */
export function flagErrors(input: FlagInput): FieldErrors {
  const errors: FieldErrors = {}
  if (blank(input.reason)) errors.reason = 'Select a reason'
  if (blank(input.explanation)) errors.explanation = 'Add a note explaining the flag before continuing'
  return errors
}

/** REV-06: at least one item and "Message to field worker *". */
export function correctionRequestErrors(input: CorrectionRequestInput): FieldErrors {
  const errors: FieldErrors = {}
  if (input.items.length === 0) errors.items = 'Select what the field worker should correct'
  if (blank(input.message)) errors.message = 'Enter a message to the field worker'
  return errors
}

const SEVERITIES: readonly string[] = ['Low', 'Moderate', 'High', 'Critical']

/** Diagnosis form: disease, symptoms, severity, clinical findings, reasoning and recommended action are required; the follow-up plan is optional. */
export function expertDiagnosisErrors(input: ExpertDiagnosisInput): FieldErrors {
  const errors: FieldErrors = {}
  if (blank(input.diseaseId)) errors.diseaseId = 'Select the confirmed disease'
  if (blank(input.symptomsConfirmed)) errors.symptomsConfirmed = 'Describe the symptoms confirmed'
  if (!SEVERITIES.includes(input.severity)) errors.severity = 'Select a severity level'
  if (blank(input.clinicalFindings)) errors.clinicalFindings = 'Enter the clinical findings'
  if (blank(input.reasoning)) errors.reasoning = 'Enter the reasoning behind the diagnosis'
  if (blank(input.recommendedAction)) errors.recommendedAction = 'Enter the recommended action'
  return errors
}

/** REV-12: "Disease expert *" and "Referral note *". */
export function referralErrors(input: ReferralInput): FieldErrors {
  const errors: FieldErrors = {}
  if (blank(input.expertId)) errors.expertId = 'Select a disease expert'
  if (blank(input.note)) errors.note = 'Describe why expert confirmation is needed'
  return errors
}

/** REV-10: both confirmations are required. */
export function approveErrors(input: ApproveCorrectionInput): FieldErrors {
  const errors: FieldErrors = {}
  if (!input.comparedRevisions || !input.originalUnchanged) errors.confirmations = 'Confirm both statements before approving'
  return errors
}

/** REV-11: "Reason *" and "A message is required when rejecting a correction". */
export function rejectErrors(input: RejectCorrectionInput): FieldErrors {
  const errors: FieldErrors = {}
  if (blank(input.reason)) errors.reason = 'Select a reason'
  if (blank(input.message)) errors.message = 'A message is required when rejecting a correction'
  return errors
}

// ── Derived views (REV-01 dashboard) ─────────────────────────────────────────

export function countBy<T, K extends string>(items: readonly T[], key: (item: T) => K, keys: readonly K[]): Record<K, number> {
  const counts = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>
  for (const item of items) counts[key(item)] += 1
  return counts
}

export interface AttentionItem {
  id: string
  title: string
  detail: string
  to: string
}

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Colombo' }).format(new Date(iso.length === 10 ? `${iso}T12:00:00+05:30` : iso))

/** REV-01 "Needs your attention": open corrections, follow-up flags and quarantine items in progress. */
export function attentionItems(workspace: ReviewWorkspace): AttentionItem[] {
  const items: AttentionItem[] = []
  for (const correction of workspace.corrections) {
    const to = `/review/corrections/${correction.id}`
    if (correction.status === 'resubmitted') items.push({ id: correction.id, title: `${correction.id} resubmitted`, detail: `${correction.observation.id} · decide approve or reject`, to })
    if (correction.status === 'requested') items.push({ id: correction.id, title: `${correction.id} awaiting field worker`, detail: `${correction.observation.id} · requested ${shortDate(correction.requestedAt)}`, to })
    if (correction.status === 'approved') items.push({ id: correction.id, title: `${correction.id} approved`, detail: `${correction.observation.id} · waiting for RevisionApplied`, to })
  }
  for (const observation of workspace.observations) {
    if (observation.reviewStatus === 'flagged' && workspace.followUpObservationIds.includes(observation.id)) {
      items.push({ id: observation.id, title: `${observation.id} flagged`, detail: `${observation.division.name} · follow-up needed`, to: `/review/observations/${observation.id}` })
    }
  }
  for (const item of workspace.divisionQuarantines.filter((row) => row.status === 'Active')) {
    const open = item.assignments.filter((row) => ['draft', 'assigned', 'in_progress'].includes(row.status)).length
    items.push({ id: item.id, title: `${item.id} · ${item.division.name} restricted`, detail: `Restricted Operations · ${open ? `${open} open quarantine assignment${open === 1 ? '' : 's'}` : 'no quarantine assignment yet'}`, to: `/review/quarantine/divisions/${item.id}` })
  }
  for (const item of workspace.quarantine) {
    const to = `/review/quarantine/${item.id}`
    if (item.state === 'released_pending_ingest') items.push({ id: item.id, title: `${item.id} released, pending ingest`, detail: `${item.division.name} · waiting for ingest receipt`, to })
    if (item.state === 'pending_decision') items.push({ id: item.id, title: `${item.id} pending decision`, detail: `${item.division.name} · supervisor decision required`, to })
    if (item.state === 'ingest_retry_required') items.push({ id: item.id, title: `${item.id} ingest retry required`, detail: `${item.division.name} · waiting for ingest retry`, to })
  }
  return items
}

/** Whole days between two instants, in Sri Lanka time (REV-01 "Age"). */
export function ageInDays(fromIso: string, nowIso: string): number {
  const day = (iso: string) => {
    const date = new Date(iso)
    const local = new Date(date.getTime() + 5.5 * 3600 * 1000)
    return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
  }
  return Math.round((day(nowIso) - day(fromIso)) / 86_400_000)
}

/** REV-08 stepper position (Rejected replaces steps 2–4, as on the COR-041 rejected frame). */
export function correctionSteps(correction: Correction): Array<{ id: string; label: string; detail: string; state: 'done' | 'current' | 'todo' | 'rejected' }> {
  const order: CorrectionStatus[] = ['requested', 'resubmitted', 'approved', 'applied']
  const dates: Record<string, string | null> = {
    requested: correction.requestedAt,
    resubmitted: correction.revision?.submittedAt ?? null,
    approved: correction.approvedAt,
    applied: correction.appliedAt,
  }
  if (correction.status === 'rejected') {
    return [
      { id: 'requested', label: 'Requested', detail: correction.requestedAt, state: 'done' },
      { id: 'rejected', label: 'Rejected', detail: correction.rejection?.at ?? '', state: 'rejected' },
    ]
  }
  const index = order.indexOf(correction.status)
  return order.map((status, position) => ({
    id: status,
    label: status[0].toUpperCase() + status.slice(1),
    detail: dates[status] ?? '',
    state: position < index || (position === index && status === 'applied') ? 'done' : position === index ? 'current' : 'todo',
  }))
}
