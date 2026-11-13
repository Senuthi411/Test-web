import {
  createAccountUseCases,
  createAuthUseCases,
  createBrowserSessionPersistence,
  createIdentityAdminUseCases,
  type AuthUseCases,
  type IdentityServices,
} from '@/features/identity'
import { systemClock, type Clock } from '@/shared/utilities/clock'
import type { AppConfig } from './config'
import type { AdapterSet, FixtureControls } from './adapterSet'
import { createCaptureUseCases, type CaptureReadPort } from '@/features/capture'
import { createReviewUseCases, type ReviewServices } from '@/features/review'

export type { FixtureControls } from './adapterSet'

/** Everything the UI needs, wired to either fixture or HTTP adapters. */
export interface AppContainer {
  capture: CaptureReadPort
  review: ReviewServices
  config: AppConfig
  clock: Clock
  auth: AuthUseCases
  identity: IdentityServices
  /** Present only when `config.dataSource === 'fixtures'`. */
  fixtures: FixtureControls | null
}

/**
 * The composition root: the only place that chooses between fixture and HTTP adapters.
 * Only the chosen adapter set is loaded, so fixture records and development accounts are
 * never downloaded in API mode.
 */
export async function createContainer(config: AppConfig): Promise<AppContainer> {
  const persistence = createBrowserSessionPersistence()
  const currentUserId = () => persistence.load()?.user.id ?? null

  let clock: Clock = systemClock
  let adapters: AdapterSet
  if (config.dataSource === 'fixtures') {
    const fixtureModule = await import('./fixtureAdapters')
    clock = fixtureModule.fixtureClock
    adapters = fixtureModule.createFixtureAdapterSet(currentUserId)
  } else {
    adapters = (await import('./httpAdapters')).createHttpAdapterSet(config, () => persistence.load()?.accessToken ?? null)
  }

  return assembleContainer(config, adapters, clock, persistence)
}

/** Builds the use cases on top of an adapter set (also used by tests). */
export function assembleContainer(
  config: AppConfig,
  adapters: AdapterSet,
  clock: Clock,
  persistence = createBrowserSessionPersistence(),
): AppContainer {
  const fixtures = adapters.fixtures
  return {
    capture: createCaptureUseCases(adapters.capture),
    review: { port: createReviewUseCases(adapters.review), demo: config.dataSource === 'fixtures', clock },
    config,
    clock,
    auth: createAuthUseCases(adapters.identity.auth, persistence, config.dataSource),
    identity: {
      admin: createIdentityAdminUseCases(adapters.identity.admin),
      account: createAccountUseCases(adapters.identity.account),
      clock,
      demo: config.dataSource === 'fixtures',
      developmentAccounts: fixtures?.developmentAccounts ?? [],
      simulateNextFailure: fixtures ? (kind) => fixtures.failNext(kind) : null,
    },
    fixtures,
  }
}
