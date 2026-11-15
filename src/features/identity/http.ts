/** API-mode adapters for Identity. Imported only by the composition root. */
import type { HttpClient } from '@/shared/api'
import type { AccountActivationPort, AccountPort, AuthPort, IdentityAdminPort, PasswordRecoveryPort } from './application/ports'
import { createPendingAccountActivationAdapter, createPendingPasswordRecoveryAdapter } from './infrastructure/pendingAuthFlowAdapters'
import { createHttpAuthAdapter } from './infrastructure/httpAuthAdapter'
import { createHttpAccountAdapter, createHttpIdentityAdminAdapter } from './infrastructure/httpIdentityAdapters'

export interface IdentityAdapters {
  auth: AuthPort
  admin: IdentityAdminPort
  account: AccountPort
  recovery: PasswordRecoveryPort
  activation: AccountActivationPort
}

export function createIdentityHttpAdapters(http: HttpClient): IdentityAdapters {
  return {
    auth: createHttpAuthAdapter(http),
    admin: createHttpIdentityAdminAdapter(http),
    account: createHttpAccountAdapter(http),
    recovery: createPendingPasswordRecoveryAdapter(),
    activation: createPendingAccountActivationAdapter(),
  }
}
