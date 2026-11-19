import type {
  ApproveCorrectionInput,
  ExpertDiagnosisInput,
  QuarantineDivisionInput,
  ReleaseDivisionInput,
  EndProcessInput,
  DivisionQuarantine,
  Correction,
  CorrectionRequestInput,
  DecisionMeta,
  FlagInput,
  ObservationReview,
  ReferralInput,
  Referral,
  RejectCorrectionInput,
  ReviewDecision,
  ReviewWorkspace,
  VerifyInput,
} from '../domain/models'
import type { ResubmissionInput } from '../domain/rules'

export type ReviewExportKind = 'queue' | 'corrections' | 'history'

/** Result of an observation decision: the decision recorded and the observation's new status. */
export interface DecisionResult {
  decision: ReviewDecision
  correction?: Correction
  referral?: Referral
}

/**
 * Review data contract inside the frontend. It does not define backend endpoints: the
 * HTTP adapter reports `contract_pending` for every operation until the gateway
 * contract exists. All writes carry the expected version and an idempotency key.
 */
export interface ReviewPort {
  getWorkspace(signal?: AbortSignal): Promise<ReviewWorkspace>
  getObservationReview(observationId: string, signal?: AbortSignal): Promise<ObservationReview>
  /**
   * Claims an observation for review: Submitted → In review when opened, Resubmitted → In review
   * when the Supervisor starts reviewing the new revision. Other statuses are returned unchanged.
   */
  claim(observationId: string): Promise<ObservationReview>
  verify(observationId: string, input: VerifyInput, meta: DecisionMeta): Promise<DecisionResult>
  flag(observationId: string, input: FlagInput, meta: DecisionMeta): Promise<DecisionResult>
  requestCorrection(observationId: string, input: CorrectionRequestInput, meta: DecisionMeta): Promise<DecisionResult>
  refer(observationId: string, input: ReferralInput, meta: DecisionMeta): Promise<DecisionResult>
  approveCorrection(correctionId: string, input: ApproveCorrectionInput, meta: DecisionMeta): Promise<DecisionResult>
  rejectCorrection(correctionId: string, input: RejectCorrectionInput, meta: DecisionMeta): Promise<DecisionResult>
  /** Fixture-only stand-in for the system's RevisionApplied event (REV-06/REV-10). */
  simulateRevisionApplied(correctionId: string, expectedVersion: number): Promise<Correction>
  /**
   * Fixture-only stand-in for the Capture mobile app: the Field Worker resubmits a corrected
   * revision for a requested correction. A new revision is stored (earlier ones are kept
   * unchanged) and the observation becomes Resubmitted only after the write succeeds.
   */
  simulateResubmission(correctionId: string, input: ResubmissionInput, expectedVersion: number): Promise<Correction>
  /**
   * Records the expert's diagnosis for a Referred observation on the expert's behalf (case and
   * referral linked automatically, catalog version pinned). The case becomes Diagnosed, or Closed
   * with its closing time when `closeCase` is set. The Supervisor assigns any follow-up inspection.
   */
  recordExpertDiagnosis(observationId: string, input: ExpertDiagnosisInput, meta: DecisionMeta): Promise<ObservationReview>
  /** Close Case on an already Diagnosed case; stamps the closing time. */
  closeExpertCase(observationId: string, meta: DecisionMeta): Promise<ObservationReview>
  /**
   * Sets the observation's division to Restricted Operations and creates its quarantine record from the
   * recorded expert diagnosis. A division has at most one active quarantine: repeating the action returns
   * the existing one. Nothing is assigned automatically.
   */
  quarantineDivision(observationId: string, input: QuarantineDivisionInput, meta: DecisionMeta): Promise<ObservationReview>
  /**
   * Releases a division from its active quarantine: the quarantine record becomes Released (reason, time and
   * Supervisor kept, nothing deleted) and the division returns to Normal Operations. An explicit Supervisor
   * action only; it never assigns or creates work, and a released or unknown quarantine is refused.
   */
  releaseDivisionQuarantine(quarantineId: string, input: ReleaseDivisionInput, meta: DecisionMeta): Promise<DivisionQuarantine>
  /** End Process: completes the decision process, keeps the review status and diagnosis, and moves the observation to history. */
  endProcess(observationId: string, input: EndProcessInput, meta: DecisionMeta): Promise<DecisionResult>
  /** Export of a Review list. Fixture mode produces no file and says so (`simulated`). */
  exportList(kind: ReviewExportKind): Promise<{ simulated: boolean }>
}
