/**
 * Record shapes for the synthetic development dataset.
 *
 * These are storage records for fixture mode only. They are deliberately independent
 * of feature domain models: each feature's fixture adapter maps these records into its
 * own domain types, exactly as its HTTP adapter will map gateway responses.
 *
 * All identifiers, names and e-mail addresses are synthetic (domain `example.test`)
 * and match the approved Figma designs.
 */
import type { UserRole } from '@/shared/types'

/** Where a value came from, so reviewers can tell Figma-sourced data from filler. */
export type FixtureProvenance =
  /** Shown verbatim in an approved Figma frame. */
  | 'figma'
  /** Derived from Figma counts/patterns (e.g. per-division totals) but not shown row by row. */
  | 'derived'
  /** Not shown in Figma; chosen for the fixture so totals stay consistent. */
  | 'fixture-assigned'

export type RecordStatus = 'active' | 'inactive'

export interface FixtureEstate {
  id: string
  name: string
  region: string
  status: RecordStatus
  /** Shown on ID-09/ID-10; supervisors and experts are derived from user scopes. */
  createdAt: string | null
}

export interface FixtureDivision {
  id: string
  name: string
  estateId: string
  status: RecordStatus
  /**
   * Operational status. Absent means Normal Operations. Restricted Operations is set only by an active
   * division quarantine and is restored from the persisted quarantine records.
   */
  operationalStatus?: 'normal' | 'restricted'
}

export interface FixtureNotificationPreferences {
  reviewEscalations: boolean
  deviceSessionAlerts: boolean
  weeklySummary: boolean
}

export interface FixtureUser {
  id: string
  fullName: string
  email: string
  role: UserRole
  status: RecordStatus
  /** Estate-level scope (administrators, supervisors, experts, reporting users). */
  estateIds: string[]
  /** Division-level scope (field workers). */
  divisionIds: string[]
  /** "Created" on ID-04. Null where the design shows "—". */
  createdAt: string | null
  /**
   * Web sign-in time ("Last sign-in" on ID-04/ID-14). Date-only values ("2026-10-20") are
   * shown without a time, as in the design ("Yesterday"). Field workers sign in on mobile;
   * their value is derived from their latest device session instead.
   */
  lastSignInAt: string | null
  /** Date the current scope was assigned ("Assigned" column on ID-04). */
  scopeAssignedAt: string | null
  /** Incremented on every change; a stale version on update is a 409 conflict. */
  version: number
  /** ID-14 "Language". */
  language: 'en'
  /** ID-14 "Notifications" toggles. */
  notificationPreferences: FixtureNotificationPreferences
  /** Sri Lankan phone number without spaces (synthetic in the seed). */
  phone: string
  /** Employee / Staff ID, unique ignoring case (synthetic in the seed). */
  employeeId: string
  /** Create User "Preferred language": Sinhala, Tamil or English. */
  preferredLanguage: 'si' | 'ta' | 'en'
  /**
   * Personal details, Administrator only. The NIC is stored upper-case and is only ever
   * returned masked. Not seeded: the dataset holds no NICs or dates of birth.
   */
  nic: string | null
  dateOfBirth: string | null
  /** Details of the user's role; `role` always equals the user's role. */
  roleDetails: FixtureRoleDetails
}

/** Role-specific account details (Create User role sections). */
export type FixtureRoleDetails =
  | { role: 'ADMINISTRATOR'; mfaRequired: boolean }
  | { role: 'SUPERVISOR'; reportsToId: string | null; officePhone: string | null }
  | { role: 'DISEASE_EXPERT'; qualifications: string | null; registrationNumber: string; institution: string | null }
  | { role: 'FIELD_WORKER'; supervisorId: string | null; mobileNumber: string }
  | { role: 'REPORTING_USER'; organisation: string | null }

/** Development-only sign-in credentials (fixture mode). Seeded from `accounts.ts`. */
export interface FixtureCredential {
  userId: string
  email: string
  username: string
  password: string
}

export interface FixtureDisease {
  id: string
  name: string
  pathogen: string
  category: 'Fungal' | 'Algal'
  catalogVersion: number
  status: RecordStatus
}

/** Review status values as labelled in the Review Queue tabs (REV-02). */
export type FixtureReviewStatus =
  | 'submitted'
  /** A corrected revision reached the server and waits for review (Review Queue "Resubmitted"). */
  | 'resubmitted'
  | 'in_review'
  | 'flagged'
  | 'correction_requested'
  | 'referred'
  | 'verified'

export interface FixtureObservation {
  id: string
  deviceObservationId: string
  divisionId: string
  fieldWorkerId: string
  /** ISO 8601 with +05:30 offset. */
  capturedAt: string
  suspectedDiseaseId: string
  reviewStatus: FixtureReviewStatus
  catalogVersion: number
  syncStatus: 'synced'
  /** GPS accuracy radius in metres ("GPS ACCURACY" on ID-12). */
  gpsAccuracyM: number
  provenance: FixtureProvenance
}

export type FixtureDeviceSessionStatus = 'active' | 'revoked' | 'signed_out'

export interface FixtureDeviceSession {
  id: string
  userId: string
  device: string
  lastSeenAt: string
  status: FixtureDeviceSessionStatus
  revokedAt?: string
  revokedReasonCode?: string
}

/**
 * Expert case. Phase 3 seeds only the expert-confirmed cases counted on ID-10/ID-12
 * ("Expert-confirmed cases"); Phase 6 adds the open cases and diagnoses.
 */
export interface FixtureCase {
  id: string
  observationId: string
  status: 'confirmed'
  provenance: FixtureProvenance
}

export type FixtureAuditKind =
  | 'user_invited'
  | 'user_created'
  | 'user_updated'
  | 'scope_updated'
  | 'estate_created'
  | 'estate_updated'
  | 'division_created'
  | 'division_updated'
  | 'division_reviewed'
  | 'device_session_revoked'
  | 'session_recovery_requested'
  | 'role_changed'
  | 'account_status_changed'
  | 'configuration_draft_saved'
  | 'configuration_draft_discarded'
  | 'configuration_published'
  | 'configuration_rolled_back'
  | 'configuration_publish_rejected'

/** Administrative audit trail ("Recent administrative activity", ID-02 / ID-10). */
export interface FixtureAuditEvent {
  id: string
  at: string
  kind: FixtureAuditKind
  actorId: string
  /** Estates the event concerns, used to show it on an estate's Activity tab. */
  estateIds: string[]
  userId?: string
  divisionId?: string
  estateId?: string
  sessionId?: string
  reasonCode?: string
  /** Scope after the change (scope_updated). */
  scope?: string[]
  /**
   * Value before the change, when it was recorded: scope ids (scope_updated), role
   * (role_changed) or status (account_status_changed).
   */
  previousValue?: string
  /** Role after the change (role_changed). Status changes use `status`. */
  newValue?: string
  status?: RecordStatus
  /** Configuration version the event produced or concerns (configuration_* kinds). */
  configurationVersion?: number
  /** Short description of a configuration change. */
  summary?: string
  /** Whether the attempted action succeeded. Absent means it succeeded. */
  outcome?: 'success' | 'failure'
  provenance: FixtureProvenance
}

/** A stored configuration version (System Settings). The document is kept as plain data. */
export interface FixtureConfigurationVersion {
  version: number
  document: Record<string, unknown>
  createdAt: string
  createdBy: string | null
  kind: 'baseline' | 'publish' | 'rollback'
  reason: string
  restoredFrom?: number
}

export interface FixtureConfigurationDraft {
  document: Record<string, unknown>
  baseVersion: number
  savedAt: string
  savedBy: string | null
}

export type FixtureRecoveryStepStatus = 'done' | 'pending' | 'open' | 'not_issued' | 'waiting'

/** Controlled recovery of a revoked device session (ID-13 recovery-requested). */
export interface FixtureRecoveryRequest {
  id: string
  sessionId: string
  requestedBy: string
  requestedAt: string
  /** The five recovery steps, in the order shown on the design. */
  steps: FixtureRecoveryStepStatus[]
}

/** The complete in-memory dataset. Later phases extend this with review, case and analytics records. */
export interface FixtureDatabase {
  captureEvidence: FixtureCaptureEvidence[]
  /**
   * Submitted revisions of observations, never changed once stored. Revision 1 (the
   * original submission) is derived from the observation and its evidence until a
   * correction is resubmitted, when it is stored alongside the new revision.
   */
  observationRevisions: FixtureObservationRevision[]
  assignments: FixtureAssignment[]
  estates: FixtureEstate[]
  divisions: FixtureDivision[]
  users: FixtureUser[]
  diseases: FixtureDisease[]
  observations: FixtureObservation[]
  deviceSessions: FixtureDeviceSession[]
  credentials: FixtureCredential[]
  cases: FixtureCase[]
  auditEvents: FixtureAuditEvent[]
  /**
   * System Settings versions, oldest first. Empty in the seed: the fixture adapter creates
   * the baseline (version 1) from the domain defaults on first use. Never deleted.
   */
  configurationVersions: FixtureConfigurationVersion[]
  configurationDraft: FixtureConfigurationDraft | null
  recoveryRequests: FixtureRecoveryRequest[]
  /**
   * The users listed under "Users requiring attention" on ID-02. The design does not state
   * the selection rule, so the list is data, not a derived rule (see figma-inconsistencies).
   */
  dashboardAttentionUserIds: string[]
  reviewRecords: FixtureReviewRecord[]
  reviewDecisions: FixtureReviewDecision[]
  corrections: FixtureCorrection[]
  referrals: FixtureReferral[]
  quarantineItems: FixtureQuarantineItem[]
  /** Review-screen details for observations (REV-03 symptoms and field note). */
  reviewObservationDetails: FixtureReviewObservationDetail[]
  /** Flagged observations listed under REV-01 "Needs your attention" (data, not a derived rule). */
  reviewFollowUpObservationIds: string[]
  /** Divisions under Restricted Operations (absent until the first one is applied). */
  divisionQuarantines?: FixtureDivisionQuarantine[]
}

/** Approved Phase 4 examples; absent evidence means the detailed fixture is unavailable. */
export interface FixtureCaptureEvidence {
  observationId: string
  imageId: string
  assetKey: string
  mimeType: string
  receivedAt: string
  latitude: number
  longitude: number
  syncReceipt?: string
  idempotencyKey?: string
  altText: string
  /**
   * Provenance of the displayed image. Demonstration images must never be presented as
   * genuine field evidence; licensed photos must carry licence and source.
   */
  imageSource: FixtureImageSource
  note?: string
  revisedNote?: string
  revisionId?: string
  revisionSubmittedAt?: string
}

/** The values a Field Worker submitted in one revision of an observation. */
export interface FixtureRevisionValues {
  divisionId: string
  suspectedDiseaseId: string
  latitude: number | null
  longitude: number | null
  gpsAccuracyM: number
  /** Photograph submitted with this revision; null when none is specified. */
  imageId: string | null
  symptoms: string[]
  note: string | null
}

/** One submitted revision of a logical observation (OBSR-005-2 = OBS-005 revision 2). */
export interface FixtureObservationRevision {
  id: string
  observationId: string
  number: number
  submittedAt: string
  submittedBy: string
  /** The correction request this revision answers; null for the original submission. */
  correctionId: string | null
  values: FixtureRevisionValues
  provenance: FixtureProvenance
}

export interface FixtureImageSource {
  kind: 'synthetic_illustration' | 'licensed_photo'
  attribution: string
  license: string | null
  sourceUrl: string | null
}

export interface FixtureAssignment {
  id: string
  title: string
  instructions: string | null
  estateId: string
  divisionId: string
  fieldWorkerId: string | null
  createdBy: string
  createdAt: string | null
  dueDate: string
  priority: 'Low' | 'Medium' | 'High'
  status: 'draft' | 'assigned' | 'in_progress' | 'submitted' | 'completed' | 'cancelled' | 'reassigned'
  observationIds: string[]
  version: number
  activity: string[]
  /** When the Field Worker accepted the task in the mobile app (simulated); null until then. */
  acceptedAt: string | null
  /** Task template the assignment was created from; null for custom tasks and older records. */
  templateId?: string | null
  /** Completion requirements configured by the Supervisor; absent on older records. */
  requirements?: FixtureTaskRequirements | null
  /** Shared by the per-worker assignments created together for one task. */
  groupId?: string | null
  /** Inspection (requests an observation) or Task (work with completion evidence); older records are inspections. */
  type?: 'inspection' | 'task'
  /** When the worker's submission was acknowledged (status submitted, shown as Done). */
  submittedAt?: string | null
  submission?: FixtureTaskSubmission | null
  /** When the Supervisor completed the assignment; Assignment History is calculated from it. */
  completedAt?: string | null
  /** Set on a Quarantine Assignment: the active division quarantine it works under. */
  quarantine?: FixtureQuarantineAssignment | null
}

/** Quarantine-specific part of a Quarantine Assignment. Linked fields are copied from the quarantine record by the data layer. */
export interface FixtureQuarantineAssignment {
  quarantineId: string
  caseId: string | null
  observationId: string
  diseaseId: string | null
  diseaseName: string | null
  objective: string
  inspectionFocus: string
  monitoringWindow: string
  /** Supervisor authorisation, recorded when the assignment is assigned. */
  authorisedBy: string | null
  authorisedAt: string | null
}

export interface FixtureTaskRequirements {
  fields: Array<{ label: string; required: boolean }>
  photos: { level: 'required' | 'optional' | 'not_required'; minimum: number }
  completionNotes: 'required' | 'optional' | 'not_required'
}

/** A Field Worker's Task submission (simulated mobile-app data). */
export interface FixtureTaskSubmission {
  submittedAt: string
  outcome: string
  responses: Array<{ label: string; value: string }>
  photoIds: string[]
  completionNotes: string | null
  gps: { latitude: number; longitude: number; accuracyM: number } | null
}

// ── Review (Phase 5) ─────────────────────────────────────────────────────────
// Date-only values ("2026-10-05") are used where the design shows no time.

/** REV-03 review record ("REV-014 · version 1"). */
export interface FixtureReviewRecord {
  id: string
  observationId: string
  version: number
  claimedBy: string | null
  claimedAt: string | null
  /** Each time a Supervisor started reviewing a resubmitted revision (Resubmitted → In review). */
  reviewStarts?: Array<{ revisionNumber: number; at: string; by: string }>
  /** Set by End Process: the observation's decision process is complete and it moves to Observation History. */
  processEndedAt?: string | null
  processEndedBy?: string | null
  provenance: FixtureProvenance
}

export interface FixtureReviewDecision {
  id: string
  type: 'verification' | 'flag' | 'correction' | 'referral' | 'quarantine' | 'review'
  outcome: 'verified' | 'flagged' | 'correction_requested' | 'correction_approved' | 'correction_rejected' | 'revision_applied' | 'referred' | 'released' | 'process_ended' | 'quarantined' | 'quarantine_assignment' | 'quarantine_released' | 'review_started' | 'resubmitted' | 'expert_decision'
  recordId: string
  targetId: string
  estateId: string
  decidedBy: string
  decidedAt: string
  note: string | null
  idempotencyKey: string | null
  /** The observation revision the decision was made on; absent on seeded decisions, which all predate any resubmission (revision 1). */
  revisionId?: string | null
  revisionNumber?: number | null
  details?: Record<string, string | boolean | string[]>
  provenance: FixtureProvenance
}

export interface FixtureCorrection {
  id: string
  observationId: string
  requestedBy: string
  requestedAt: string
  requestedRevision: number
  items: string[]
  message: string
  status: 'requested' | 'resubmitted' | 'approved' | 'applied' | 'rejected'
  version: number
  /** The field worker's revision; its values come from captureEvidence (never overwritten). */
  revisionId: string | null
  approvedAt: string | null
  approvedBy: string | null
  appliedAt: string | null
  rejection: { at: string; by: string; reason: string; message: string; notifyFieldWorker: boolean } | null
  provenance: FixtureProvenance
}

export interface FixtureReferral {
  id: string
  observationId: string
  expertId: string
  referredBy: string
  referredAt: string
  note: string | null
  linkStatus: 'pending_case_link' | 'linked'
  caseId: string | null
  caseCreatedAt: string | null
  caseStatus: 'awaiting_diagnosis' | 'diagnosed' | null
  diagnosis: { id: string; diseaseId: string; at: string; statement: string; details?: FixtureDiagnosisDetails } | null
  provenance: FixtureProvenance
}

/** Full expert diagnosis, recorded by the Supervisor on the expert's behalf. Seeded diagnoses have no details. */
export interface FixtureDiagnosisDetails {
  severity: 'Low' | 'Moderate' | 'High' | 'Critical'
  symptomsConfirmed: string
  clinicalFindings: string
  reasoning: string
  recommendedAction: string
  followUpDescription: string
  monitoringWindow: string
  inspectionFocus: string
  /** Active Disease Catalog version pinned when the diagnosis was recorded. */
  catalogVersion: number
  caseStatus: 'Diagnosed' | 'Closed'
  closedAt: string | null
  recordedBy: string
}

/** A division placed under the Restricted Operations policy from an expert diagnosis. */
export interface FixtureDivisionQuarantine {
  id: string
  divisionId: string
  estateId: string
  observationId: string
  caseId: string | null
  policy: 'restricted_operations'
  quarantinedBy: string
  quarantinedAt: string
  /** Snapshot of the expert diagnosis the Supervisor acted on. */
  diagnosisId?: string | null
  diseaseId?: string | null
  severity?: string | null
  reason?: string
  /** Active until the Supervisor releases the division; a released quarantine is kept with its history. */
  status?: 'active' | 'released'
  releasedAt?: string | null
  releasedBy?: string | null
  releaseReason?: string | null
  /** Quarantine Assignments created under this quarantine. */
  assignmentIds?: string[]
  history?: FixtureQuarantineEvent[]
}

export interface FixtureQuarantineEvent {
  id: string
  event: string
  at: string
  by: string
  note: string | null
}

export interface FixtureQuarantineItem {
  id: string
  deviceObservationId: string
  estateId: string
  divisionId: string
  capturedAt: string
  quarantinedAt: string
  reason: string
  state: 'pending_decision' | 'released_pending_ingest' | 'ingest_retry_required' | 'rejected'
  ingestReceipt: string | null
  decision: { id: string; outcome: 'release'; by: string; at: string; reason: string } | null
  provenance: FixtureProvenance
}

export interface FixtureReviewObservationDetail {
  observationId: string
  symptoms: string[]
  fieldNote: string
  provenance: FixtureProvenance
}
