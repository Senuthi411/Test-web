import { contractPending, type HttpClient } from '@/shared/api'
import type { AuthPort } from '../application/ports'

/**
 * API Gateway sign-in.
 *
 * PENDING CONTRACT: the backend has not decided how access tokens are issued and
 * verified (monorepo `docs/decisions/pending-decisions.md`, P1) and no Identity OpenAPI
 * definition exists. Until both are approved this adapter sends no request and reports
 * that sign-in is unavailable in API mode.
 */
export function createHttpAuthAdapter(http: HttpClient): AuthPort {
  void http // Kept so the wiring is in place once the contract is approved.
  return {
    async signIn() {
      return contractPending('identity.auth.signIn')
    },
    async signOut() {
      return contractPending('identity.auth.signOut')
    },
  }
}
