/**
 * Review business rules. Each rule cites the approved screen it comes from. Where the
 * designs are silent, the rule is the most conservative reading and is recorded in
 * docs/phase5-review-completion-report.md ("Interpretations").
 */
import type {
  ApproveCorrectionInput,
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
 * Decisions a Supervisor may record in each review status.
 * - In review (claimed, REV-03): all four decisions.
 * - Flagged: the concern is followed up by requesting a correction from the field worker.
 * - Verified: the observation may still be referred to a disease expert for confirmation.
 * - Submitted is claimed (moved to In review) when the Supervisor opens it; Correction
 *   requested and Referred wait for the field worker or the expert, so nothing is offered.
 */
// Resubmitted (a corrected revision) is reviewed like any other observation once the
// Supervisor starts the review (Resubmitted → In review); decisions apply to the latest revision.
// Submitted and Resubmitted wait for the Supervisor to start the review. Verified and Flagged
// are final. Referred waits for the expert; once the expert decision is in (Decision) the
// Supervisor finalises it by verifying or flagging.
const ALLOWED_DECISIONS: Record<ReviewStatus, readonly ObservationDecision[]> = {
  submitted: [],
  resubmitted: [],
  in_review: ['verify', 'flag', 'requestCorrection', 'refer'],
  flagged: [],
  verified: [],
  correction_requested: [],
  referred: [],
  decision: ['verify', 'flag'],
}

/** Verified and Flagged are the final review outcomes (Referred and Decision are not). */
export function isFinalReviewStatus(status: ReviewStatus): boolean {
  return status === 'verified' || status === 'flagged'
}

const DAY_MS = 86_400_000
const instantOf = (iso: string) => new Date(iso.includes('T') ? iso : `${iso}T12:00:00+05:30`).getTime()
/** A finalised observation stays in the Review Queue for 24 hours after its final decision, then moves to Observation History. */
export function observationArchivedAt(finalisedAt: string | null, nowIso: string): string | null {
  if (!finalisedAt) return null
  const archive = instantOf(finalisedAt) + DAY_MS
  return instantOf(nowIso) >= archive ? new Date(archive).toISOString() : null
}

export function allowedDecisions(status: ReviewStatus): readonly ObservationDecision[] {
  return ALLOWED_DECISIONS[status]
}

/** Whether `decision` (or, without one, any decision) may be recorded in `status`. */
export function canDecide(status: ReviewStatus, decision?: ObservationDecision): boolean {
  const allowed = ALLOWED_DECISIONS[status]
  return decision ? allowed.includes(decision) : allowed.length > 0
}

/** Submitted and Resubmitted move to In review only when the Supervisor starts the review (never on opening). */
export function canStartReview(status: ReviewStatus): boolean {
  return status === 'submitted' || status === 'resubmitted'
}
/** Kept for callers: claiming is the same as starting the review. */
export const canClaim = canStartReview

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
