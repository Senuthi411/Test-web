import { AppError, contractPending } from '@/shared/api'
import { isWebRole } from '@/shared/types'
import type { FixtureStore } from '@/fixtures'
import type { AuthPort } from '../application/ports'
import { ACCOUNT_DISABLED, INVALID_CREDENTIALS, WEB_ACCESS_NOT_PERMITTED, type Session } from '../domain/session'

const REJECTED = 'The User ID or password is incorrect.'

/**
 * Fixture-mode sign-in against the development-only credentials seeded from
 * `src/fixtures/accounts.ts` (a password changed on ID-14 applies until the tab reloads).
 * Sign-in uses the company User ID. Nothing leaves the browser; the resulting session has
 * no access token.
 *
 * Fixture mode is a development data source only (never loaded in API mode). It has no
 * authenticator, so it never issues an MFA challenge or enrollment; the MFA screens are
 * exercised with stubbed ports in tests until the backend contract exists.
 */
export function createFixtureAuthAdapter(store: FixtureStore): AuthPort {
  return {
    signIn(credentials, signal) {
      return store.run(() => {
        const userId = credentials.userId.trim().toLowerCase()
        const account = store.read((db) => db.credentials.find((item) => item.userId.toLowerCase() === userId))
        // One message for an unknown User ID and a wrong password.
        if (!account || account.password !== credentials.password) {
          throw new AppError('validation', REJECTED, { code: INVALID_CREDENTIALS })
        }
        const user = store.read((db) => db.users.find((candidate) => candidate.id === account.userId))
        if (!user) throw new AppError('validation', REJECTED, { code: INVALID_CREDENTIALS })
        if (user.status !== 'active') {
          throw new AppError('forbidden', 'This account is disabled. Contact your administrator.', { code: ACCOUNT_DISABLED })
        }
        if (!isWebRole(user.role)) {
          throw new AppError('forbidden', 'This account uses the TeaLeaf mobile app and cannot sign in to the web application.', {
            code: WEB_ACCESS_NOT_PERMITTED,
          })
        }
        const session: Session = {
          user: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            estateIds: user.estateIds,
            divisionIds: user.divisionIds,
          },
          accessToken: null,
          source: 'fixtures',
          signedInAt: new Date().toISOString(),
        }
        return { status: 'signed_in' as const, session }
      }, signal)
    },
    // Demonstration data has no authenticator: no challenge is ever issued, and no code or
    // enrollment is ever accepted.
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
      // Fixture sessions exist only in this browser; nothing to revoke.
    },
  }
}
