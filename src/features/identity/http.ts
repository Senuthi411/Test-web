/** API-mode adapters for Identity. Imported only by the composition root. */
import type { HttpClient } from '@/shared/api'
import type { AccountPort, AuthPort, IdentityAdminPort } from './application/ports'
import { createHttpAuthAdapter } from './infrastructure/httpAuthAdapter'
import { createHttpAccountAdapter, createHttpIdentityAdminAdapter } from './infrastructure/httpIdentityAdapters'

export interface IdentityAdapters {
  auth: AuthPort
  admin: IdentityAdminPort
  account: AccountPort
}

export function createIdentityHttpAdapters(http: HttpClient): IdentityAdapters {
  return {
    auth: createHttpAuthAdapter(http),
    admin: createHttpIdentityAdminAdapter(http),
    account: createHttpAccountAdapter(http),
  }
}
