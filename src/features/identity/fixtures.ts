/** Fixture-mode adapters for Identity. Imported only by the composition root. */
import type { FixtureStore } from '@/fixtures'
import type { AccessGrantPort, AccountActivationPort, AccountPort, AuditLogPort, AuthPort, ConfigurationPort, IdentityAdminPort, PasswordRecoveryPort } from './application/ports'
import { createFixtureAccessGrantAdapter } from './infrastructure/fixtureAccessGrantAdapter'
import { createFixtureAuditLogAdapter } from './infrastructure/fixtureAuditLogAdapter'
import { createFixtureConfigurationAdapter } from './infrastructure/fixtureConfigurationAdapter'
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
  accessGrants: AccessGrantPort
  auditLog: AuditLogPort
  configuration: ConfigurationPort
}

export function createIdentityFixtureAdapters(store: FixtureStore, options: FixtureIdentityOptions): IdentityAdapters {
  return {
    auth: createFixtureAuthAdapter(store),
    admin: createFixtureIdentityAdminAdapter(store, options),
    account: createFixtureAccountAdapter(store),
    recovery: createPendingPasswordRecoveryAdapter(),
    activation: createPendingAccountActivationAdapter(),
    accessGrants: createFixtureAccessGrantAdapter(store, options),
    auditLog: createFixtureAuditLogAdapter(store, options),
    configuration: createFixtureConfigurationAdapter(store, options),
  }
}
