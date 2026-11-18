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
  | 'process_ended'
  | 'quarantined'
  | 'quarantine_assignment'
  | 'quarantine_released'

export const DECISION_OUTCOME_LABEL: Record<DecisionOutcome, string> = {
  verified: 'Verified',
  flagged: 'Flagged',
  correction_requested: 'Correction requested',
  correction_approved: 'Correction approved',
  correction_rejected: 'Correction rejected',
  revision_applied: 'RevisionApplied',
  referred: 'Referred',
  released: 'Released',
  process_ended: 'Process ended',
  quarantined: 'Quarantined',
  quarantine_assignment: 'Quarantine assignment',
  quarantine_released: 'Quarantine released',
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
  /** When the observation moved from the Review Queue to Observation History (24 h after finalisedAt, or when End Process was used). */
  archivedAt: string | null
  /** When the Supervisor ended the decision process (End Process); null otherwise. The review status is not changed by it. */
  processEndedAt: string | null
}

export const SEVERITY_LEVELS = ['Low', 'Moderate', 'High', 'Critical'] as const
export type SeverityLevel = (typeof SEVERITY_LEVELS)[number]

/** The expert's full diagnosis for an observation's case (sections A–H of the diagnosis record). */
export interface ExpertDiagnosis {
  /** A. Case and reference details (linked automatically). */
  caseId: string | null
  referralId: string
  observationId: string
  estate: { id: string; name: string }
  division: { id: string; name: string }
  expert: string
  diagnosedAt: string
  /** B. Decision status. */
  caseStatus: 'Diagnosed' | 'Closed'
  closedAt: string | null
  /** C. Confirmed disease from the Active Disease Catalog, with the catalog version pinned at diagnosis. */
  disease: { id: string; name: string }
  catalogVersion: number | null
  /** D–H. */
  symptomsConfirmed: string
  severity: SeverityLevel | null
  clinicalFindings: string
  reasoning: string
  recommendedAction: string
  followUpDescription: string
  monitoringWindow: string
  inspectionFocus: string
}

export type DivisionOperationalStatus = 'normal' | 'restricted'
export const OPERATIONAL_STATUS_LABEL: Record<DivisionOperationalStatus, string> = { normal: 'Normal Operations', restricted: 'Restricted Operations' }

/**
 * A division quarantine: the division is under Restricted Operations (normal field activities are
 * restricted; only Supervisor-authorised assignments are allowed). The disease and severity are the
 * expert's findings at the time the Supervisor quarantined the division.
 */
export interface DivisionQuarantine {
  id: string
  estate: { id: string; name: string }
  division: { id: string; name: string }
  observationId: string
  caseId: string | null
  referralId: string | null
  disease: { id: string; name: string } | null
  severity: string | null
  reason: string
  policy: 'Restricted Operations'
  status: 'Active' | 'Released'
  /** Set once the Supervisor has released the division from this quarantine. */
  release: { at: string; by: string; reason: string } | null
  /** The division's current operational status (from the division record). */
  operationalStatus: DivisionOperationalStatus
  initiatedBy: string
  initiatedAt: string
  /** Quarantine Assignments created under this quarantine, with their current status. */
  assignments: Array<{ id: string; title: string; status: string; fieldWorker: string | null }>
  history: Array<{ id: string; event: string; at: string; by: string; note: string | null }>
  /** The expert diagnosis the quarantine acts on. */
  diagnosis: ExpertDiagnosis | null
}

/** An Active Disease Catalog entry offered when recording a diagnosis. */
export interface CatalogDisease {
  id: string
  name: string
  catalogVersion: number
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
  /** The expert referral for this observation (case linked once the case exists). */
  referral: { id: string; caseId: string | null; expert: string } | null
  experts: ExpertOption[]
  /** Every submitted revision, oldest first. The last one is the revision under review. */
  revisions: ReviewRevision[]
  /** Correction requests, each linked to the revision it was requested on. */
  requests: RevisionRequest[]
  expertDecision: ExpertDecision | null
  /** The recorded expert diagnosis (all sections); null until one is recorded. */
  expertDiagnosis: ExpertDiagnosis | null
  /** Active Disease Catalog entries, for the diagnosis form. */
  catalog: CatalogDisease[]
  /** Set when this observation's division is under Restricted Operations. */
  divisionQuarantine: DivisionQuarantine | null
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
  diagnosis: { id: string; disease: { id: string; name: string }; at: string; statement: string; severity: string | null } | null
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
  divisions: Array<{ id: string; name: string; estateId: string; operationalStatus: DivisionOperationalStatus }>
  /** Division quarantines (Restricted Operations) in the Supervisor's estates. */
  divisionQuarantines: DivisionQuarantine[]
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

/** Sections C–H of the diagnosis form; the catalog version and case links are added by the data layer. */
export interface ExpertDiagnosisInput {
  diseaseId: string
  symptomsConfirmed: string
  severity: string
  clinicalFindings: string
  reasoning: string
  recommendedAction: string
  followUpDescription: string
  monitoringWindow: string
  inspectionFocus: string
  /** Close Case: records the diagnosis as Closed with its closing time; otherwise the case stays Diagnosed. */
  closeCase: boolean
}

export interface ReleaseDivisionInput {
  /** Why the division is released from quarantine (required). */
  reason: string
}

export interface QuarantineDivisionInput {
  /** Why the division is quarantined; defaults to the expert's findings in the form. */
  reason: string
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
