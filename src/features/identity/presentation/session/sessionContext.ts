import { createContext, useContext } from 'react'
import type { Session, SessionUser, SignInCredentials } from '../../domain/session'

export type SessionState =
  | { status: 'signed_out' }
  | { status: 'signed_in'; session: Session }
  /** The backend (or fixture simulation) reported 401; the user must sign in again. */
  | { status: 'expired' }

export interface SessionContextValue {
  state: SessionState
  signIn(credentials: SignInCredentials, signal?: AbortSignal): Promise<Session>
  signOut(): Promise<void>
  /** Marks the session as expired after a 401 response. */
  expire(): void
  /** Applies a change the user made to their own account (e.g. their name on ID-14). */
  updateUser(patch: Partial<Pick<SessionUser, 'fullName'>>): void
}

export const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside <SessionProvider>.')
  return value
}

/** The signed-in session. Only use beneath a route guard that guarantees sign-in. */
export function useCurrentSession(): Session {
  const { state } = useSession()
  if (state.status !== 'signed_in') {
    throw new Error('useCurrentSession was called without a signed-in session.')
  }
  return state.session
}
