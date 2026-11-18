import { contractPending, type HttpClient } from '@/shared/api'
import type { AuthPort } from '../application/ports'

/**
 * API Gateway sign-in (User ID + password, then Administrator MFA when required).
 *
 * PENDING CONTRACT: the backend has not decided how access tokens are issued and
 * verified (monorepo `docs/decisions/pending-decisions.md`, P1), and no Identity OpenAPI
 * definition exists for sign-in, MFA or sign-out. Until they are approved this adapter
 * sends no request; the login page reports that the sign-in service is unavailable.
 */
export function createHttpAuthAdapter(http: HttpClient): AuthPort {
  void http // Kept so the wiring is in place once the contract is approved.
  return {
    async signIn() {
      return contractPending('identity.auth.signIn')
    },
    async verifyMfa() {
      return contractPending('identity.auth.verifyMfa')
    },
    async startMfaEnrollment() {
      return contractPending('identity.auth.mfaEnrollment.start')
    },
    async confirmMfaEnrollment() {
      return contractPending('identity.auth.mfaEnrollment.confirm')
    },
    async signOut() {
      return contractPending('identity.auth.signOut')
    },
  }
}
