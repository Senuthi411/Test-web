import type { DataSource } from '@/shared/types'
import type { Session, SignInCredentials } from '../domain/session'
import type { AuthPort, SessionPersistencePort } from './ports'

export interface AuthUseCases {
  signIn(credentials: SignInCredentials, signal?: AbortSignal): Promise<Session>
  signOut(session: Session): Promise<void>
  /** Returns a stored session issued by the current data source, if any. */
  restore(): Session | null
  /** Forgets the local session without contacting the backend (used when it has expired). */
  discard(): void
  /** Stores updated session details (e.g. the user's new name) without signing in again. */
  replace(session: Session): void
}

export function createAuthUseCases(
  auth: AuthPort,
  persistence: SessionPersistencePort,
  dataSource: DataSource,
): AuthUseCases {
  return {
    async signIn(credentials, signal) {
      const session = await auth.signIn(credentials, signal)
      persistence.save(session, credentials.remember)
      return session
    },
    async signOut(session) {
      persistence.clear()
      await auth.signOut(session)
    },
    restore() {
      const stored = persistence.load()
      // A session from the other data source (e.g. a fixture session after switching to
      // API mode) must never be reused.
      if (!stored || stored.source !== dataSource) {
        if (stored) persistence.clear()
        return null
      }
      return stored
    },
    discard() {
      persistence.clear()
    },
    replace(session) {
      persistence.update(session)
    },
  }
}
