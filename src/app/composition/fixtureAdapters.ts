import { FIXTURE_REFERENCE_DATE, FixtureStore } from '@/fixtures'
import { FIXTURE_DEVELOPMENT_ACCOUNTS, createIdentityFixtureAdapters } from '@/features/identity/fixtures'
import type { UserId } from '@/shared/types'
import { fixedClock, type Clock } from '@/shared/utilities/clock'
import type { AdapterSet } from './adapterSet'
import { createFixtureCaptureAdapter } from '@/features/capture/fixtures'
import { createFixtureReviewAdapter } from '@/features/review/fixtures'

/** Fixture records are dated around the designs' "today" (21 Oct 2026), so the clock is pinned to it. */
export const fixtureClock: Clock = fixedClock(FIXTURE_REFERENCE_DATE)

export function createFixtureAdapterSet(
  actorId: () => UserId | null,
  store = new FixtureStore(),
  clock: Clock = fixtureClock,
): AdapterSet {
  return {
    capture: createFixtureCaptureAdapter(store, actorId),
    identity: createIdentityFixtureAdapters(store, { clock, actorId }),
    review: createFixtureReviewAdapter(store, { clock, actorId }),
    fixtures: {
      reset: () => store.reset(),
      failNext: (kind) => store.failNext(kind),
      developmentAccounts: FIXTURE_DEVELOPMENT_ACCOUNTS,
    },
  }
}
