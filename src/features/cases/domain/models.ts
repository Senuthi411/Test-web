/**
 * Cases, Diagnosis & Disease Catalog domain models (Member 4).
 * Covers CASE-01 through CASE-10 plus the extended expert flows:
 * - Expert Dashboard (CASE-01)
 * - Assigned Cases & Pending Link referrals (CASE-02, CASE-10)
 * - Case Detail Overview, Linked Evidence, Compare, Record/Confirm Diagnosis, Follow-up, Timeline (CASE-03..CASE-06)
 * - Disease Catalog & Symptoms, Draft Editor, Field-by-Field Diff, Version History, Publish & Deactivate (CASE-07, CASE-08)
 * - Case History Table & Disease Timeline (CASE-09)
 * - Advisory-Only AI Assistant with Degraded Fallback Mode & Global Scoped Search
 */
import type { ObservationRevision } from '@/features/capture'

export type CaseStatus = 'pending_link' | 'awaiting_diagnosis' | 'diagnosed' | 'closed'

export const CASE_STATUSES: readonly CaseStatus[] = ['pending_link', 'awaiting_diagnosis', 'diagnosed', 'closed']

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  pending_link: 'Pending link',
  awaiting_diagnosis: 'Awaiting diagnosis',
  diagnosed: 'Diagnosed',
  closed: 'Closed',
}

export type CaseSeverity = 'Low' | 'Moderate' | 'High' | 'Critical'
export const CASE_SEVERITIES: readonly CaseSeverity[] = ['Low', 'Moderate', 'High', 'Critical']

export type CaseFollowUpPriority = 'P1' | 'P2' | 'P3'

export type CatalogEntryStatus = 'active' | 'draft' | 'inactive'
export const CATALOG_ENTRY_STATUS_LABEL: Record<CatalogEntryStatus, string> = {
  active: 'Active',
  draft: 'Draft',
  inactive: 'Inactive',
}

export type DiseaseCategory = 'Fungal' | 'Algal' | 'Bacterial' | 'Nutritional'
export const DISEASE_CATEGORIES: readonly DiseaseCategory[] = ['Fungal', 'Algal', 'Bacterial', 'Nutritional']

export interface CasePersonRef {
  id: string
  fullName: string
  role?: string
}

export interface CaseLocationRef {
  id: string
  name: string
}

export interface CaseEvidenceRevision {
  revisionId: string
  revisionNumber: number
  label: string
  statusBadge: 'Original' | 'Superseded' | 'Corrected · Active' | 'Official final'
  isOfficialFinal: boolean
  imageId: string
  assetKey: string
  mimeType: string
  sha256: string
  capturedAt: string
  receivedAt: string
  submittedBy: CasePersonRef
  latitude: number
  longitude: number
  gpsAccuracyM: number
  symptoms: string[]
  fieldNote: string
}

export interface CaseDiagnosisRecord {
  id: string
  caseId: string
  referralId: string
  observationId: string
  confirmedDisease: {
    id: string
    name: string
    pathogen: string
    category: DiseaseCategory
  }
  suspectedDisease: {
    id: string
    name: string
  }
  catalogVersionPinned: number
  severity: CaseSeverity
  symptomsConfirmed: string[]
  clinicalFindings: string
  reasoning: string
  recommendedAction: string
  followUpPlan: {
    priority: CaseFollowUpPriority
    description: string
    monitoringWindow: string
    inspectionFocus: string
  } | null
  recordedBy: CasePersonRef
  diagnosedAt: string
  closedAt: string | null
  caseStatus: 'Diagnosed' | 'Closed'
}

export interface CaseTimelineEvent {
  id: string
  at: string
  title: string
  actor: string
  actorRole: string
  category: 'Capture' | 'Review' | 'Referral' | 'Case' | 'Diagnosis' | 'Catalog'
  detail: string
  badgeTone: 'teal' | 'warning' | 'success' | 'neutral' | 'error'
}

export interface CaseRecord {
  /** For linked cases: CASE-023. For pending link referrals: REF-099 (caseId is null). */
  id: string
  caseId: string | null
  referralId: string
  observationId: string
  status: CaseStatus
  version: number
  estate: CaseLocationRef
  division: CaseLocationRef
  fieldWorker: CasePersonRef
  referredBy: CasePersonRef
  assignedExpert: CasePersonRef
  capturedAt: string
  referredAt: string
  caseCreatedAt: string | null
  referralNote: string
  suspectedDisease: {
    id: string
    name: string
    pathogen: string
    category: DiseaseCategory
  }
  confirmedDisease: {
    id: string
    name: string
    pathogen: string
    category: DiseaseCategory
  } | null
  catalogVersion: number
  gpsAccuracyM: number
  latitude: number
  longitude: number
  observedSymptoms: string[]
  fieldNote: string
  revisions: CaseEvidenceRevision[]
  captureRevisions: ObservationRevision[]
  diagnosis: CaseDiagnosisRecord | null
  timeline: CaseTimelineEvent[]
}

export interface CatalogSymptom {
  id: string
  name: string
  plantPart: 'Young flush leaf' | 'Mature leaf' | 'Upper & lower epidermis' | 'Leaf margin & apex' | 'Stem & petiole'
  description: string
  progressionStage: 'Early' | 'Intermediate' | 'Advanced'
  linkedDiseaseIds: string[]
  status: 'active' | 'draft'
}

export interface CatalogReferenceImage {
  id: string
  caption: string
  stage: string
  sourceAttribution: string
  assetLabel: string
}

export interface CatalogFieldDiff {
  field: string
  label: string
  before: string
  after: string
  changed: boolean
}

export interface CatalogDiseaseDetail {
  id: string
  name: string
  pathogen: string
  category: DiseaseCategory
  catalogVersion: number
  status: CatalogEntryStatus
  summary: string
  diagnosticCriteria: string
  differentialDiagnosis: string
  treatmentGuidance: string
  favorableConditions: string
  typicalSeverity: CaseSeverity
  symptomIds: string[]
  symptoms: CatalogSymptom[]
  referenceImages: CatalogReferenceImage[]
  linkedCaseIds: string[]
  updatedAt: string
  updatedBy: string
  draftChanges: {
    targetVersion: number
    updatedAt: string
    updatedBy: string
    note: string
    proposed: {
      name: string
      pathogen: string
      category: DiseaseCategory
      summary: string
      diagnosticCriteria: string
      differentialDiagnosis: string
      treatmentGuidance: string
      symptomIds: string[]
    }
    diffs: CatalogFieldDiff[]
  } | null
}

export interface CatalogVersionRecord {
  version: number
  status: 'Published' | 'Active' | 'Draft'
  publishedAt: string | null
  publishedBy: string
  diseaseCount: number
  symptomCount: number
  releaseNotes: string
  changesSummary: string[]
}

export interface CaseHistoryEntry {
  id: string
  caseId: string
  referralId: string
  observationId: string
  estate: CaseLocationRef
  division: CaseLocationRef
  suspectedDisease: { id: string; name: string }
  confirmedDisease: { id: string; name: string }
  category: DiseaseCategory
  severity: CaseSeverity
  catalogVersion: number
  expert: CasePersonRef
  referredBy: CasePersonRef
  referredAt: string
  diagnosedAt: string
  closedAt: string | null
  turnaroundHours: number
  status: 'Diagnosed' | 'Closed'
  clinicalSummary: string
  recommendedAction: string
}

export interface AiCitation {
  code: string
  title: string
  version: string
  excerpt: string
}

export interface AiChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  createdAt: string
  content: string
  attachedContext: {
    caseId?: string
    observationId?: string
    diseaseId?: string
  } | null
  citations: AiCitation[]
  isDegradedFallback: boolean
}

export interface AiConversationThread {
  id: string
  title: string
  updatedAt: string
  contextBadge: string
  messages: AiChatMessage[]
}

export interface CasesNotificationItem {
  id: string
  title: string
  detail: string
  at: string
  unread: boolean
  category: 'Referral' | 'Diagnosis' | 'Catalog'
  to: string
}

export interface CasesDecisionMeta {
  expectedVersion: number
  idempotencyKey: string
}

export interface RecordCaseDiagnosisInput {
  diseaseId: string
  severity: CaseSeverity
  symptomsConfirmed: string[]
  clinicalFindings: string
  reasoning: string
  recommendedAction: string
  followUpPriority: CaseFollowUpPriority
  followUpDescription: string
  monitoringWindow: string
  inspectionFocus: string
  closeCase: boolean
}

export interface SaveCatalogDraftInput {
  diseaseId?: string
  name: string
  pathogen: string
  category: DiseaseCategory
  summary: string
  diagnosticCriteria: string
  differentialDiagnosis: string
  treatmentGuidance: string
  symptomIds: string[]
  note: string
}

export interface PublishCatalogVersionInput {
  releaseNotes: string
  confirmPinnedUnchanged: boolean
}

export interface DeactivateCatalogDiseaseInput {
  diseaseId: string
  reason: string
}

export interface SendAiAdvisoryPromptInput {
  threadId: string
  prompt: string
  contextCaseId?: string
  contextDiseaseId?: string
  simulateDegradedMode?: boolean
}

export interface CasesWorkspace {
  actor: CasePersonRef
  estates: CaseLocationRef[]
  divisions: Array<CaseLocationRef & { estateId: string }>
  cases: CaseRecord[]
  diseases: CatalogDiseaseDetail[]
  symptoms: CatalogSymptom[]
  catalogVersions: CatalogVersionRecord[]
  history: CaseHistoryEntry[]
  aiThreads: AiConversationThread[]
  notifications: CasesNotificationItem[]
  kpis: {
    awaitingDiagnosisCount: number
    diagnosedCount: number
    pendingLinkCount: number
    avgDiagnosisHours: number
    activeCatalogVersion: number
    draftCatalogVersion: number | null
  }
}
