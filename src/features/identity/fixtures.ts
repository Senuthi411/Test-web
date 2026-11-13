/** Fixture-mode adapters for Identity. Imported only by the composition root. */
import { FIXTURE_ACCOUNTS, type FixtureStore } from '@/fixtures'
import type { AccountPort, AuthPort, IdentityAdminPort } from './application/ports'
import type { DevelopmentAccount } from './presentation/services/identityServices'
import { createFixtureAccountAdapter } from './infrastructure/fixtureAccountAdapter'
import { createFixtureAuthAdapter } from './infrastructure/fixtureAuthAdapter'
import { createFixtureIdentityAdminAdapter, type FixtureIdentityOptions } from './infrastructure/fixtureIdentityAdminAdapter'

export interface IdentityAdapters {
  auth: AuthPort
  admin: IdentityAdminPort
  account: AccountPort
}

export function createIdentityFixtureAdapters(store: FixtureStore, options: FixtureIdentityOptions): IdentityAdapters {
  return {
    auth: createFixtureAuthAdapter(store),
    admin: createFixtureIdentityAdminAdapter(store, options),
    account: createFixtureAccountAdapter(store),
  }
}

/** Development accounts listed on the sign-in screen in fixture mode only. */
export const FIXTURE_DEVELOPMENT_ACCOUNTS: readonly DevelopmentAccount[] = FIXTURE_ACCOUNTS.map(
  ({ email, password, persona }) => ({ email, password, persona }),
)
