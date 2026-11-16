/**
 * Synthetic development dataset. Import only from fixture adapters
 * (`features/<feature>/infrastructure/fixture*`) and the composition root.
 */
export { FixtureStore, type FixtureStoreOptions } from './store'
export { FIXTURE_ACCOUNTS, FIXTURE_DEV_PASSWORD, findFixtureAccount, type FixtureAccount } from './accounts'
export { findIntegrityProblems } from './integrity'
export { persistFixtureSlice, type PersistedFixtureSlice } from './persistence'
export { assignments as captureAssignmentSeeds } from './seed/capture'
export { latestRevisionOf, projectRevision, revisionIdOf, revisionsOf, type ProjectedRevision } from './revisions'
export { FIXTURE_REFERENCE_DATE, createSeedDatabase } from './seed'
export type * from './records'
