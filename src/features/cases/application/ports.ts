import type {
  AiConversationThread,
  CaseRecord,
  CasesDecisionMeta,
  CasesWorkspace,
  CatalogDiseaseDetail,
  DeactivateCatalogDiseaseInput,
  PublishCatalogVersionInput,
  RecordCaseDiagnosisInput,
  SaveCatalogDraftInput,
  SendAiAdvisoryPromptInput,
} from '../domain/models'

export type CasesExportKind = 'assigned' | 'catalog' | 'history'

/**
 * Cases data contract inside the frontend (Member 4).
 * In API mode, the HTTP adapter reports `contract_pending` until backend gateway routes are wired,
 * never silently substituting fixture data.
 */
export interface CasesPort {
  getWorkspace(signal?: AbortSignal): Promise<CasesWorkspace>
  getCase(caseOrReferralId: string, signal?: AbortSignal): Promise<CaseRecord>
  getDisease(diseaseId: string, signal?: AbortSignal): Promise<CatalogDiseaseDetail>
  /** Links a pending referral (e.g., REF-099) to a newly created case record (pending_link -> awaiting_diagnosis). */
  linkPendingReferral(referralId: string, meta: CasesDecisionMeta): Promise<CaseRecord>
  /** Records an official expert diagnosis, pinning the active catalog version and updating Review referral status. */
  recordDiagnosis(caseId: string, input: RecordCaseDiagnosisInput, meta: CasesDecisionMeta): Promise<CaseRecord>
  /** Closes an already-diagnosed case (diagnosed -> closed). */
  closeCase(caseId: string, meta: CasesDecisionMeta): Promise<CaseRecord>
  /** Saves a draft catalog entry or draft modification for the upcoming catalog version (e.g., v3 Draft). */
  saveCatalogDraft(input: SaveCatalogDraftInput, meta: CasesDecisionMeta): Promise<CatalogDiseaseDetail>
  /** Publishes the current catalog draft version as the new active catalog version without mutating past pinned diagnoses. */
  publishCatalogVersion(input: PublishCatalogVersionInput, meta: CasesDecisionMeta): Promise<CasesWorkspace>
  /** Deactivates an active disease entry from future selections while preserving historical diagnoses. */
  deactivateDisease(input: DeactivateCatalogDiseaseInput, meta: CasesDecisionMeta): Promise<CatalogDiseaseDetail>
  /** Sends an advisory-only prompt to the AI Assistant (with automatic fallback to deterministic catalog matcher in degraded mode). */
  sendAiPrompt(input: SendAiAdvisoryPromptInput): Promise<AiConversationThread>
  /** Marks notifications as read. */
  markAllNotificationsRead(): Promise<CasesWorkspace>
  /** Exports a Cases table; fixture mode reports simulated=true. */
  exportList(kind: CasesExportKind): Promise<{ simulated: boolean }>
}
