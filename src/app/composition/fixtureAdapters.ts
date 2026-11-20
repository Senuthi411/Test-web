import { FIXTURE_REFERENCE_DATE, FixtureStore } from '@/fixtures'
import { createIdentityFixtureAdapters } from '@/features/identity/fixtures'
import type { UserId } from '@/shared/types'
import { fixedClock, type Clock } from '@/shared/utilities/clock'
import type { AdapterSet } from './adapterSet'
import { createFixtureCaptureAdapter, persistFixtureCaptureState } from '@/features/capture/fixtures'
import { createFixtureCasesAdapter, persistFixtureCasesState } from '@/features/cases/fixtures'
import { createFixtureReviewAdapter, persistFixtureReviewState } from '@/features/review/fixtures'

/** Fixture records are dated around the designs' "today" (21 Oct 2026), so the clock is pinned to it. */
export const fixtureClock: Clock = fixedClock(FIXTURE_REFERENCE_DATE)

/**
 * @param storage When given (the running app passes sessionStorage), Review state, Cases state, and Fieldwork
 * Assignments are kept across browser refreshes. Tests omit it and keep purely in-memory data.
 */
export function createFixtureAdapterSet(
  actorId: () => UserId | null,
  store = new FixtureStore(),
  clock: Clock = fixtureClock,
  storage: Storage | null = null,
): AdapterSet {
  // Capture first: it restores simulated mobile observations that saved Review state refers to.
  persistFixtureCaptureState(store, storage)
  persistFixtureReviewState(store, storage)
  persistFixtureCasesState(store, storage)
  return {
    capture: createFixtureCaptureAdapter(store, actorId, clock),
    cases: createFixtureCasesAdapter(store, { clock, actorId }),
    identity: createIdentityFixtureAdapters(store, { clock, actorId }),
    review: createFixtureReviewAdapter(store, { clock, actorId }),
    fixtures: {
      reset: () => store.reset(),
      failNext: (kind) => store.failNext(kind),
    },
  }
}
