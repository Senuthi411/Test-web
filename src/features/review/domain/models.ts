/**
 * Review domain models. Statuses and labels are taken verbatim from the approved Review
 * screens (REV-01–REV-17, local export of Figma file "Review"). No status outside these
 * lists is introduced, except Resubmitted: the label of a corrected revision that reached
 * the server (REV-07 correction status), shown in the Review Queue so corrected observations
 * are distinguishable from first-time submissions.
 */
import type { ObservationRevision } from '@/features/capture'

/** Observation review status (REV-02 tabs). */
/**
 * `decision` is not stored: it is shown for a Referred observation whose expert referral has
 * a diagnosis (the expert decision is available for the Supervisor to finalise).
 */
export type ReviewStatus = 'submitted' | 'resubmitted' | 'in_review' | 'flagged' | 'correction_requested' | 'referred' | 'decision' | 'verified'

export const REVIEW_STATUSES: readonly ReviewStatus[] = ['submitted', 'resubmitted', 'in_review', 'flagged', 'correction_requested', 'referred', 'decision', 'verified']

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  submitted: 'Submitted',
  resubmitted: 'Resubmitted',
  in_review: 'In review',
  flagged: 'Flagged',
  correction_requested: 'Correction requested',
  referred: 'Referred',
  decision: 'Decision',
  verified: 'Verified',
}

/** Correction lifecycle (REV-07 tabs, REV-08 stepper). "Approved is not Applied." */
export type CorrectionStatus = 'requested' | 'resubmitted' | 'approved' | 'applied' | 'rejected'

export const CORRECTION_STATUSES: readonly CorrectionStatus[] = ['requested', 'resubmitted', 'approved', 'applied', 'rejected']

export const CORRECTION_STATUS_LABEL: Record<CorrectionStatus, string> = {
  requested: 'Requested',
  resubmitted: 'Resubmitted',
  approved: 'Approved',
  applied: 'Applied',
  rejected: 'Rejected',
}

/** REV-06 "What should the field worker correct?" options. */
export const CORRECTION_ITEMS = ['Retake a clearer image', 'Confirm symptom details', 'Correct division', 'Other'] as const
export type CorrectionItem = (typeof CORRECTION_ITEMS)[number]

/** REV-17 decision types (tabs). */
export type DecisionType = 'verification' | 'flag' | 'correction' | 'referral' | 'quarantine'

export const DECISION_TYPE_LABEL: Record<DecisionType, string> = {
  verification: 'Verification',
  flag: 'Flag',
  correction: 'Correction',
  referral: 'Referral',
  quarantine: 'Quarantine',
}

/** REV-17 "Decision" column values. Approval and RevisionApplied follow REV-10/REV-06 wording. */
export type DecisionOutcome =
  | 'verified'
  | 'flagged'
  | 'correction_requested'
  | 'correction_approved'
  | 'correction_rejected'
  | 'revision_applied'
  | 'referred'
  | 'released'

export const DECISION_OUTCOME_LABEL: Record<DecisionOutcome, string> = {
  verified: 'Verified',
  flagged: 'Flagged',
  correction_requested: 'Correction requested',
  correction_approved: 'Correction approved',
  correction_rejected: 'Correction rejected',
  revision_applied: 'RevisionApplied',
  referred: 'Referred',
  released: 'Released',
}

/** REV-13 link status and case status. */
export type ReferralLinkStatus = 'pending_case_link' | 'linked'
export type ReferralCaseStatus = 'awaiting_diagnosis' | 'diagnosed'

/** REV-14 quarantine states. */
export type QuarantineState = 'pending_decision' | 'released_pending_ingest' | 'ingest_retry_required' | 'rejected'

export const QUARANTINE_STATE_LABEL: Record<QuarantineState, string> = {
  pending_decision: 'Pending decision',
  released_pending_ingest: 'Released pending ingest',
  ingest_retry_required: 'Ingest retry required',
  rejected: 'Rejected',
}

export interface PersonRef {
  id: string
  fullName: string
}

export interface ReviewObservation {
  id: string
  estate: { id: string; name: string }
  division: { id: string; name: string }
  fieldWorker: PersonRef
  suspectedDisease: { id: string; name: string }
  /** ISO date-time (+05:30). */
  capturedAt: string
  reviewStatus: ReviewStatus
  gpsAccuracyM: number
  catalogVersion: number
  /** Number of the latest submitted revision (1 = original submission). */
  revisionNumber: number
  /** Fieldwork assignment the observation was submitted for; null for an independent observation. */
  assignmentId: string | null
  /** Time of the final decision (Verified or Flagged); null while the review is not finished. */
  finalisedAt: string | null
  /** When the observation moved from the Review Queue to Observation History (24 h after finalisedAt). */
  archivedAt: string | null
}

/** The expert's diagnosis received through the referral (status Decision). */
export interface ExpertDecision {
  referralId: string
  caseId: string | null
  expert: string
  disease: string
  statement: string
  decidedAt: string
}

/** A revision as the Supervisor reviews it: the Capture revision plus its review outcome. */
export interface ReviewRevision extends ObservationRevision {
  /** Review status of the latest revision; for earlier revisions, the last decision recorded on them. */
  statusLabel: string
  decisions: Array<{ id: string; outcome: DecisionOutcome; decidedAt: string; decidedBy: string; note: string | null }>
}

/** A correction request as shown beside the revision that answers it. */
export interface RevisionRequest {
  correctionId: string
  /** The revision the correction was requested on. */
  onRevision: number
  requestedRevision: number
  requestedBy: string
  requestedAt: string
  items: string[]
  message: string
  status: CorrectionStatus
  /** Correction record version (for the fixture-only resubmission). */
  version: number
}

export interface ReviewEvidence {
  imageId: string
  altText: string
  /** Where the displayed image comes from. Demonstration images are never genuine field evidence. */
  imageSource: { kind: 'synthetic_illustration' | 'licensed_photo'; attribution: string; license: string | null; sourceUrl: string | null }
  latitude: number
  longitude: number
  receivedAt: string
}

export interface ReviewHistoryStep {
  id: string
  title: string
  /** ISO date or date-time, when known. */
  at: string | null
  by: string | null
  /** Fixed explanatory text from the design (e.g. "received from mobile"). */
  detail: string | null
  state: 'done' | 'open'
}

/** REV-03 detail: the observation plus its review record (REV-nnn, version). */
export interface ObservationReview {
  observation: ReviewObservation
  reviewId: string
  version: number
  evidence: ReviewEvidence | null
  symptoms: string[]
  fieldNote: string | null
  history: ReviewHistoryStep[]
  /** Revision number a new correction request would ask for (REV-06). */
  nextRevisionNumber: number
  /** Open correction for this observation, if any. */
  correctionId: string | null
  referralId: string | null
  experts: ExpertOption[]
  /** Every submitted revision, oldest first. The last one is the revision under review. */
  revisions: ReviewRevision[]
  /** Correction requests, each linked to the revision it was requested on. */
  requests: RevisionRequest[]
  expertDecision: ExpertDecision | null
}

export interface ExpertOption extends PersonRef {
  estateIds: string[]
  /** Case IDs with status "Awaiting diagnosis" (REV-12 selected-expert card). */
  awaitingCaseIds: string[]
}

export interface CorrectionRevision {
  id: string
  number: number
  submittedAt: string
  changes: Array<{ field: string; before: string; after: string }>
}

export interface Correction {
  id: string
  observation: ReviewObservation
  requestedBy: PersonRef
  requestedAt: string
  requestedRevision: number
  items: string[]
  message: string
  status: CorrectionStatus
  version: number
  revision: CorrectionRevision | null
  appliedRevision: number | null
  approvedAt: string | null
  appliedAt: string | null
  rejection: { at: string; by: PersonRef; reason: string; message: string } | null
  evidenceImageId: string | null
}

export interface Referral {
  id: string
  observation: ReviewObservation
  expert: PersonRef
  referredBy: PersonRef
  referredAt: string
  note: string | null
  linkStatus: ReferralLinkStatus
  caseId: string | null
  caseCreatedAt: string | null
  caseStatus: ReferralCaseStatus | null
  diagnosis: { id: string; disease: { id: string; name: string }; at: string; statement: string } | null
}

export interface QuarantineItem {
  id: string
  deviceObservationId: string
  estate: { id: string; name: string }
  division: { id: string; name: string }
  capturedAt: string
  quarantinedAt: string
  reason: string
  state: QuarantineState
  ingestReceipt: string | null
  decision: { id: string; outcome: 'release'; by: PersonRef; at: string; reason: string } | null
}

export interface ReviewDecision {
  id: string
  type: DecisionType
  outcome: DecisionOutcome
  recordId: string
  targetId: string
  decidedBy: PersonRef
  decidedAt: string
  note: string | null
  /** Observation revision the decision applies to; null for quarantine decisions. */
  revision: { id: string; number: number } | null
  /** Division of the observation or quarantine item. */
  divisionId: string | null
}

export interface ReviewWorkspace {
  actor: PersonRef
  estates: Array<{ id: string; name: string }>
  divisions: Array<{ id: string; name: string; estateId: string }>
  observations: ReviewObservation[]
  corrections: Correction[]
  referrals: Referral[]
  quarantine: QuarantineItem[]
  decisions: ReviewDecision[]
  /** Flagged observations recorded as needing follow-up (REV-01 "Needs your attention"). */
  followUpObservationIds: string[]
}

// ── Decision inputs ──────────────────────────────────────────────────────────

export interface DecisionMeta {
  expectedVersion: number
  /** One key per submitted form; repeating it never applies a decision twice. */
  idempotencyKey: string
}

export interface VerifyInput {
  note: string
  /** No longer required or validated (verification has no mandatory checklist). */
  checklist?: boolean[]
}

export interface FlagInput {
  reason: string
  category: string
  explanation: string
  notifyFieldWorker: boolean
}

export interface CorrectionRequestInput {
  items: string[]
  message: string
}

export interface ReferralInput {
  expertId: string
  note: string
}

export interface ApproveCorrectionInput {
  comparedRevisions: boolean
  originalUnchanged: boolean
  note: string
}

export interface RejectCorrectionInput {
  reason: string
  message: string
  notifyFieldWorker: boolean
}
