import type { DataSource, EstateId, DivisionId, UserId, WebRole } from '@/shared/types'

/** A restricted session in which an Administrator must enrol an authenticator app. */
export interface MfaEnrollmentSession {
  enrollmentId: string
}

/** The signed-in web user as the frontend needs to know them. */
export interface SessionUser {
  id: UserId
  fullName: string
  email: string
  role: WebRole
  /** Estate-level scope. Display and navigation only — the backend enforces scope. */
  estateIds: EstateId[]
  divisionIds: DivisionId[]
}

export interface Session {
  user: SessionUser
  /** Bearer token for the API Gateway. Always null in fixture mode. */
  accessToken: string | null
  /** Which data source issued the session, so fixture sessions are never treated as live. */
  source: DataSource
  signedInAt: string
}

/**
 * AUTH-01 credentials: the company User ID (e.g. `USR-003`) and password. There is no
 * e-mail sign-in. The password is never stored or logged by the frontend.
 */
export interface SignInCredentials {
  userId: string
  password: string
}

/**
 * A second sign-in step requested by the backend (Administrator MFA). The challenge ID is
 * opaque to the frontend; it only identifies the pending sign-in.
 */
export interface MfaChallenge {
  challengeId: string
}

export type SignInResult =
  | { status: 'signed_in'; session: Session }
  /** Administrator with an enrolled authenticator: enter the TOTP code. */
  | { status: 'mfa_required'; challenge: MfaChallenge }
  /** Administrator without an authenticator yet: enrollment is mandatory before access. */
  | { status: 'mfa_enrollment_required'; enrollment: MfaEnrollmentSession }

/** Error code used when sign-in credentials are rejected (as opposed to an expired session). */
export const INVALID_CREDENTIALS = 'INVALID_CREDENTIALS'
/** The credentials were accepted but the account is deactivated. */
export const ACCOUNT_DISABLED = 'ACCOUNT_DISABLED'
/** The account belongs to a role without web access (Field Workers use the mobile app). */
export const WEB_ACCESS_NOT_PERMITTED = 'WEB_ACCESS_NOT_PERMITTED'
/** The MFA verification code was rejected or the challenge expired. */
export const MFA_CODE_REJECTED = 'MFA_CODE_REJECTED'
