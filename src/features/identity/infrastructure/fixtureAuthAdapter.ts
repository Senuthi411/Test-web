import { AppError } from '@/shared/api'
import { isWebRole } from '@/shared/types'
import type { FixtureStore } from '@/fixtures'
import type { AuthPort } from '../application/ports'
import { INVALID_CREDENTIALS, type Session } from '../domain/session'

/**
 * Fixture-mode sign-in against the development-only credentials seeded from
 * `src/fixtures/accounts.ts` (a password changed on ID-14 applies until the tab reloads).
 * Nothing leaves the browser; the resulting session has no access token.
 */
export function createFixtureAuthAdapter(store: FixtureStore): AuthPort {
  return {
    signIn(credentials, signal) {
      return store.run(() => {
        const identifier = credentials.identifier.trim().toLowerCase()
        const account = store.read((db) =>
          db.credentials.find((item) => item.email.toLowerCase() === identifier || item.username === identifier),
        )
        if (!account || account.password !== credentials.password) {
          throw new AppError('validation', 'The e-mail, username or password is incorrect.', {
            code: INVALID_CREDENTIALS,
          })
        }
        const user = store.read((db) => db.users.find((candidate) => candidate.id === account.userId))
        if (!user || user.status !== 'active' || !isWebRole(user.role)) {
          throw new AppError('forbidden', 'This account cannot sign in to the web application.')
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
        return session
      }, signal)
    },
    async signOut() {
      // Fixture sessions exist only in this browser; nothing to revoke.
    },
  }
}
