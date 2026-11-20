import {
  createAccessGrantUseCases,
  createAccountActivationUseCases,
  createAccountUseCases,
  createAuditLogUseCases,
  createAuthUseCases,
  createConfigurationUseCases,
  createBrowserRememberedUserId,
  createBrowserSessionPersistence,
  createIdentityAdminUseCases,
  createPasswordRecoveryUseCases,
  type AuthUseCases,
  type RememberedUserIdPort,
  type IdentityServices,
} from '@/features/identity'
import { systemClock, type Clock } from '@/shared/utilities/clock'
import type { AppConfig } from './config'
import type { AdapterSet, FixtureControls } from './adapterSet'
import { createCaptureUseCases, type CaptureReadPort } from '@/features/capture'
import { createCasesUseCases, type CasesServices } from '@/features/cases'
import { createReviewUseCases, type ReviewServices } from '@/features/review'

export type { FixtureControls } from './adapterSet'

/** Everything the UI needs, wired to either fixture or HTTP adapters. */
export interface AppContainer {
  capture: CaptureReadPort
  cases: CasesServices
  review: ReviewServices
  config: AppConfig
  clock: Clock
  auth: AuthUseCases
  identity: IdentityServices
  /** Present only when `config.dataSource === 'fixtures'`. */
  fixtures: FixtureControls | null
}

/** sessionStorage, or null where the browser blocks it (private mode, blocked site data). */
function browserSessionStorage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
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
    adapters = fixtureModule.createFixtureAdapterSet(currentUserId, undefined, undefined, browserSessionStorage())
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
  remembered: RememberedUserIdPort = createBrowserRememberedUserId(),
): AppContainer {
  const fixtures = adapters.fixtures
  return {
    capture: createCaptureUseCases(adapters.capture),
    cases: { port: createCasesUseCases(adapters.cases), demo: config.dataSource === 'fixtures', clock },
    review: { port: createReviewUseCases(adapters.review), demo: config.dataSource === 'fixtures', clock },
    config,
    clock,
    auth: createAuthUseCases(adapters.identity.auth, persistence, config.dataSource, remembered),
    identity: {
      admin: createIdentityAdminUseCases(adapters.identity.admin, clock),
      account: createAccountUseCases(adapters.identity.account),
      recovery: createPasswordRecoveryUseCases(adapters.identity.recovery, persistence),
      activation: createAccountActivationUseCases(adapters.identity.activation),
      accessGrants: createAccessGrantUseCases(adapters.identity.accessGrants),
      auditLog: createAuditLogUseCases(adapters.identity.auditLog),
      configuration: createConfigurationUseCases(adapters.identity.configuration),
      clock,
      demo: config.dataSource === 'fixtures',
      simulateNextFailure: fixtures ? (kind) => fixtures.failNext(kind) : null,
    },
    fixtures,
  }
}
