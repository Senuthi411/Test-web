import type {
  ApproveCorrectionInput,
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
  verify(observationId: string, input: VerifyInput, meta: DecisionMeta): Promise<DecisionResult>
  flag(observationId: string, input: FlagInput, meta: DecisionMeta): Promise<DecisionResult>
  requestCorrection(observationId: string, input: CorrectionRequestInput, meta: DecisionMeta): Promise<DecisionResult>
  refer(observationId: string, input: ReferralInput, meta: DecisionMeta): Promise<DecisionResult>
  approveCorrection(correctionId: string, input: ApproveCorrectionInput, meta: DecisionMeta): Promise<DecisionResult>
  rejectCorrection(correctionId: string, input: RejectCorrectionInput, meta: DecisionMeta): Promise<DecisionResult>
  /** Fixture-only stand-in for the system's RevisionApplied event (REV-06/REV-10). */
  simulateRevisionApplied(correctionId: string, expectedVersion: number): Promise<Correction>
  /** Export of a Review list. Fixture mode produces no file and says so (`simulated`). */
  exportList(kind: ReviewExportKind): Promise<{ simulated: boolean }>
}
