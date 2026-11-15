/** Fixture-mode adapters for Identity. Imported only by the composition root. */
import type { FixtureStore } from '@/fixtures'
import type { AccountActivationPort, AccountPort, AuthPort, IdentityAdminPort, PasswordRecoveryPort } from './application/ports'
import { createPendingAccountActivationAdapter, createPendingPasswordRecoveryAdapter } from './infrastructure/pendingAuthFlowAdapters'
import { createFixtureAccountAdapter } from './infrastructure/fixtureAccountAdapter'
import { createFixtureAuthAdapter } from './infrastructure/fixtureAuthAdapter'
import { createFixtureIdentityAdminAdapter, type FixtureIdentityOptions } from './infrastructure/fixtureIdentityAdminAdapter'

export interface IdentityAdapters {
  auth: AuthPort
  admin: IdentityAdminPort
  account: AccountPort
  recovery: PasswordRecoveryPort
  activation: AccountActivationPort
}

export function createIdentityFixtureAdapters(store: FixtureStore, options: FixtureIdentityOptions): IdentityAdapters {
  return {
    auth: createFixtureAuthAdapter(store),
    admin: createFixtureIdentityAdminAdapter(store, options),
    account: createFixtureAccountAdapter(store),
    recovery: createPendingPasswordRecoveryAdapter(),
    activation: createPendingAccountActivationAdapter(),
  }
}
