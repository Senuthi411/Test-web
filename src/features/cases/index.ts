export type { CasesPort, CasesExportKind } from './application/ports'
export { createCasesUseCases } from './application/casesUseCases'
export { CasesContext, useCasesServices, type CasesServices } from './presentation/services/casesServices'
export type * from './domain/models'
export {
  CASE_STATUSES,
  CASE_STATUS_LABEL,
  CASE_SEVERITIES,
  CATALOG_ENTRY_STATUS_LABEL,
  DISEASE_CATEGORIES,
} from './domain/models'
export {
  CASE_LIFECYCLE_TRANSITIONS,
  nextCaseStatus,
  canTransitionCase,
  canRecordCaseDiagnosis,
  canCloseDiagnosedCase,
  validateRecordCaseDiagnosis,
  validateSaveCatalogDraft,
  validatePublishCatalogVersion,
  validateDeactivateDisease,
  computeCatalogDiseaseDiff,
} from './domain/rules'
