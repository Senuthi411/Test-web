/** API-mode adapters for Identity. Imported only by the composition root. */
import type { HttpClient } from '@/shared/api'
import type { AccessGrantPort, AccountActivationPort, AccountPort, AuditLogPort, AuthPort, ConfigurationPort, IdentityAdminPort, PasswordRecoveryPort } from './application/ports'
import { createPendingAccessGrantAdapter } from './infrastructure/pendingAccessGrantAdapter'
import { createPendingAuditLogAdapter, createPendingConfigurationAdapter } from './infrastructure/pendingConfigurationAdapters'
import { createPendingAccountActivationAdapter, createPendingPasswordRecoveryAdapter } from './infrastructure/pendingAuthFlowAdapters'
import { createHttpAuthAdapter } from './infrastructure/httpAuthAdapter'
import { createHttpAccountAdapter, createHttpIdentityAdminAdapter } from './infrastructure/httpIdentityAdapters'

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

export function createIdentityHttpAdapters(http: HttpClient): IdentityAdapters {
  return {
    auth: createHttpAuthAdapter(http),
    admin: createHttpIdentityAdminAdapter(http),
    account: createHttpAccountAdapter(http),
    recovery: createPendingPasswordRecoveryAdapter(),
    activation: createPendingAccountActivationAdapter(),
    accessGrants: createPendingAccessGrantAdapter(),
    auditLog: createPendingAuditLogAdapter(),
    configuration: createPendingConfigurationAdapter(),
  }
}
