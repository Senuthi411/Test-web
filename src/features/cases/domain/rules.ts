/**
 * Cases, Diagnosis & Disease Catalog business rules and invariants (Member 4).
 *
 * Key invariants enforced:
 * 1. Lifecycle State Machine:
 *    - `pending_link` -> `awaiting_diagnosis` (via `linkCase`, triggered when Review referral links to Case)
 *    - `awaiting_diagnosis` -> `diagnosed` (via `recordDiagnosis`)
 *    - `awaiting_diagnosis` -> `closed` (via `recordDiagnosis` with `closeCase: true`)
 *    - `diagnosed` -> `closed` (via `closeCase`)
 *    - `closed` is terminal (cannot be reopened or re-diagnosed).
 * 2. Suspected vs Confirmed Separation:
 *    - Mobile field workers submit a `suspectedDisease` with the observation.
 *    - Only an authenticated `DISEASE_EXPERT` within estate scope can record an official `confirmedDisease`,
 *      pinning the active `catalogVersion` at the moment of diagnosis.
 * 3. Catalog Version Pinning & Immutability:
 *    - Past diagnoses retain their pinned `catalogVersionPinned` even after a new catalog version (`v3`) is published.
 *    - Draft catalog changes (`v3 Draft`) are isolated from the active catalog (`v2`) until explicitly published.
 * 4. Advisory-Only AI Assistant:
 *    - AI responses are strictly advisory, include disease catalog citations, never auto-record a diagnosis,
 *      and degrade gracefully to a deterministic local catalog matcher when offline or unavailable.
 */
import type {
  CaseStatus,
  CatalogFieldDiff,
  DeactivateCatalogDiseaseInput,
  PublishCatalogVersionInput,
  RecordCaseDiagnosisInput,
  SaveCatalogDraftInput,
} from './models'
import { CASE_SEVERITIES, DISEASE_CATEGORIES } from './models'

export type CasesFieldErrors = Record<string, string>

export type CaseLifecycleAction = 'linkCase' | 'recordDiagnosis' | 'recordDiagnosisAndClose' | 'closeCase'

export const CASE_LIFECYCLE_TRANSITIONS: Readonly<
  Record<CaseStatus, Readonly<Partial<Record<CaseLifecycleAction, CaseStatus>>>>
> = {
  pending_link: {
    linkCase: 'awaiting_diagnosis',
  },
  awaiting_diagnosis: {
    recordDiagnosis: 'diagnosed',
    recordDiagnosisAndClose: 'closed',
  },
  diagnosed: {
    closeCase: 'closed',
  },
  closed: {},
}

export function nextCaseStatus(current: CaseStatus, action: CaseLifecycleAction): CaseStatus | null {
  return CASE_LIFECYCLE_TRANSITIONS[current][action] ?? null
}

export function canTransitionCase(current: CaseStatus, action: CaseLifecycleAction): boolean {
  return nextCaseStatus(current, action) !== null
}

export function canRecordCaseDiagnosis(status: CaseStatus): boolean {
  return status === 'awaiting_diagnosis'
}

export function canCloseDiagnosedCase(status: CaseStatus): boolean {
  return status === 'diagnosed'
}

const isBlank = (value: string | undefined | null): boolean => !value || value.trim() === ''

export function validateRecordCaseDiagnosis(input: RecordCaseDiagnosisInput): CasesFieldErrors {
  const errors: CasesFieldErrors = {}
  if (isBlank(input.diseaseId)) {
    errors.diseaseId = 'Select a confirmed disease from the active catalog'
  }
  if (!CASE_SEVERITIES.includes(input.severity)) {
    errors.severity = 'Select a valid clinical severity level'
  }
  if (!Array.isArray(input.symptomsConfirmed) || input.symptomsConfirmed.length === 0) {
    errors.symptomsConfirmed = 'Confirm at least one observed symptom'
  }
  if (isBlank(input.clinicalFindings) || input.clinicalFindings.trim().length < 10) {
    errors.clinicalFindings = 'Enter detailed clinical findings (at least 10 characters)'
  }
  if (isBlank(input.reasoning) || input.reasoning.trim().length < 10) {
    errors.reasoning = 'Enter diagnostic reasoning (at least 10 characters)'
  }
  if (isBlank(input.recommendedAction) || input.recommendedAction.trim().length < 8) {
    errors.recommendedAction = 'Enter recommended treatment or containment action'
  }
  return errors
}

export function validateSaveCatalogDraft(input: SaveCatalogDraftInput): CasesFieldErrors {
  const errors: CasesFieldErrors = {}
  if (isBlank(input.name)) errors.name = 'Enter the disease name'
  if (isBlank(input.pathogen)) errors.pathogen = 'Enter the scientific pathogen name'
  if (!DISEASE_CATEGORIES.includes(input.category)) errors.category = 'Select a valid disease category'
  if (isBlank(input.summary)) errors.summary = 'Enter a clinical summary for this disease'
  if (isBlank(input.diagnosticCriteria)) errors.diagnosticCriteria = 'Enter diagnostic criteria'
  if (isBlank(input.treatmentGuidance)) errors.treatmentGuidance = 'Enter recommended treatment guidance'
  if (!Array.isArray(input.symptomIds) || input.symptomIds.length === 0) {
    errors.symptomIds = 'Link at least one catalog symptom'
  }
  return errors
}

export function validatePublishCatalogVersion(input: PublishCatalogVersionInput): CasesFieldErrors {
  const errors: CasesFieldErrors = {}
  if (isBlank(input.releaseNotes)) {
    errors.releaseNotes = 'Enter release notes summarizing the catalog changes'
  }
  if (!input.confirmPinnedUnchanged) {
    errors.confirmPinnedUnchanged = 'Confirm that existing diagnoses remain pinned to their original catalog version'
  }
  return errors
}

export function validateDeactivateDisease(input: DeactivateCatalogDiseaseInput): CasesFieldErrors {
  const errors: CasesFieldErrors = {}
  if (isBlank(input.diseaseId)) errors.diseaseId = 'Disease ID is required'
  if (isBlank(input.reason)) errors.reason = 'Enter a reason for deactivating this catalog entry'
  return errors
}

export interface DiffComparableDisease {
  name: string
  pathogen: string
  category: string
  summary: string
  diagnosticCriteria: string
  differentialDiagnosis: string
  treatmentGuidance: string
  symptomIds: string[]
}

/**
 * Computes a field-by-field diff between the active catalog version (e.g., CURRENT v2)
 * and a proposed draft version (e.g., NEW DRAFT v3).
 */
export function computeCatalogDiseaseDiff(
  current: DiffComparableDisease,
  proposed: DiffComparableDisease,
): CatalogFieldDiff[] {
  const pairs: Array<{ field: string; label: string; before: string; after: string }> = [
    { field: 'name', label: 'Disease Name', before: current.name, after: proposed.name },
    { field: 'pathogen', label: 'Pathogen', before: current.pathogen, after: proposed.pathogen },
    { field: 'category', label: 'Category', before: current.category, after: proposed.category },
    { field: 'summary', label: 'Clinical Summary', before: current.summary, after: proposed.summary },
    {
      field: 'diagnosticCriteria',
      label: 'Diagnostic Criteria',
      before: current.diagnosticCriteria,
      after: proposed.diagnosticCriteria,
    },
    {
      field: 'differentialDiagnosis',
      label: 'Differential Diagnosis',
      before: current.differentialDiagnosis,
      after: proposed.differentialDiagnosis,
    },
    {
      field: 'treatmentGuidance',
      label: 'Treatment Guidance',
      before: current.treatmentGuidance,
      after: proposed.treatmentGuidance,
    },
    {
      field: 'symptomIds',
      label: 'Linked Symptoms',
      before: current.symptomIds.join(', '),
      after: proposed.symptomIds.join(', '),
    },
  ]

  return pairs.map((item) => ({
    ...item,
    changed: item.before.trim() !== item.after.trim(),
  }))
}
