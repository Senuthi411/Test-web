export type { CaptureObservation } from './domain/observation'
export type { ObservationRevision, RevisionDifference } from './domain/revision'
export { changeSummary, revisionDifferences } from './domain/revision'
/** Side-by-side revision comparison, reused by Review for resubmitted observations. */
export { RevisionComparison } from './presentation/RevisionComparison'
/** Read-only Assignment History, shown as a section of the Supervisor History page. */
export { AssignmentHistorySection } from './presentation/AssignmentPages'
export type { CaptureReadPort } from './application/ports'
export { createCaptureUseCases } from './application/captureUseCases'
export { CaptureContext } from './presentation/services'
/** Synthetic evidence image, reused by Review (REV-03/04/09). */
export { EvidenceImage } from './presentation/EvidenceImage'
