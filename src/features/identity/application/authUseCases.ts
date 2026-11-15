import { AppError } from '@/shared/api'
import type { DataSource } from '@/shared/types'
import { codeError, normaliseCode, userIdError, type MfaEnrollmentDetails, type MfaEnrollmentResult, type MfaEnrollmentSession } from '../domain/authFlows'
import { normaliseUserId, type MfaChallenge, type Session, type SignInCredentials, type SignInResult } from '../domain/session'
import type { AuthPort, RememberedUserIdPort, SessionPersistencePort } from './ports'

export interface SignInOptions {
  /** "Remember User ID": keep the User ID (only) for the next visit. */
  rememberUserId: boolean
}

export interface AuthUseCases {
  /**
   * Signs in with a Company User ID and password. Resolves with a session, an MFA
   * challenge ({@link AuthUseCases.verifyMfa}) or a mandatory MFA enrollment.
   */
  signIn(credentials: SignInCredentials, options: SignInOptions, signal?: AbortSignal): Promise<SignInResult>
  verifyMfa(challenge: MfaChallenge, code: string, signal?: AbortSignal): Promise<Session>
  startMfaEnrollment(enrollment: MfaEnrollmentSession, signal?: AbortSignal): Promise<MfaEnrollmentDetails>
  confirmMfaEnrollment(enrollment: MfaEnrollmentSession, code: string, signal?: AbortSignal): Promise<MfaEnrollmentResult>
  signOut(session: Session): Promise<void>
  /** Returns a stored session issued by the current data source, if any. */
  restore(): Session | null
  /** Forgets the local session without contacting the backend (expiry, password reset). */
  discard(): void
  /** Stores updated session details (e.g. the user's new name) without signing in again. */
  replace(session: Session): void
  /** The User ID remembered on this device, if the user chose "Remember User ID". */
  rememberedUserId(): string | null
}

/** Rejects with a validation AppError (same shape as the backend's) when `message` is set. */
export function rejectField(path: string, message: string | null): void {
  if (message) throw new AppError('validation', message, { details: [{ path, message }] })
}

export function createAuthUseCases(
  auth: AuthPort,
  persistence: SessionPersistencePort,
  dataSource: DataSource,
  remembered: RememberedUserIdPort,
): AuthUseCases {
  return {
    async signIn(credentials, options, signal) {
      rejectField('userId', userIdError(credentials.userId))
      const userId = normaliseUserId(credentials.userId)
      const result = await auth.signIn({ userId, password: credentials.password }, signal)
      // The password step succeeded, so the preference applies. A failed attempt changes nothing.
      if (options.rememberUserId) remembered.save(userId)
      else remembered.clear()
      // Only a completed sign-in creates a session; MFA steps never do.
      if (result.status === 'signed_in') persistence.save(result.session)
      return result
    },
    async verifyMfa(challenge, code, signal) {
      rejectField('code', codeError(code))
      const session = await auth.verifyMfa(challenge, normaliseCode(code), signal)
      persistence.save(session)
      return session
    },
    startMfaEnrollment(enrollment, signal) {
      return auth.startMfaEnrollment(enrollment, signal)
    },
    async confirmMfaEnrollment(enrollment, code, signal) {
      rejectField('code', codeError(code))
      const result = await auth.confirmMfaEnrollment(enrollment, normaliseCode(code), signal)
      if (result.session) persistence.save(result.session)
      return result
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
    rememberedUserId() {
      return remembered.load()
    },
  }
}
