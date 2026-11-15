/**
 * Enterprise authentication flows: Administrator TOTP MFA, password recovery by e-mail
 * OTP and account activation. Every reference below (challenge, enrollment, recovery,
 * reset authorisation, activation token) is issued by the backend and is opaque to the
 * frontend. The frontend never creates, stores in browser storage or verifies them.
 *
 * PENDING CONTRACT: field names follow the approved decisions but the Identity OpenAPI
 * does not define them yet (see docs/api-integration/pending-contracts.md).
 */
import type { Session } from './session'

/** Approved policy: e-mail OTPs and authenticator (TOTP) codes have 6 digits. */
export const CODE_LENGTH = 6
/** Approved policy: an e-mail OTP is valid for 5 minutes (the backend enforces it). */
export const RECOVERY_CODE_VALIDITY_MINUTES = 5

/** A restricted session in which an Administrator must enrol an authenticator app. */
export interface MfaEnrollmentSession {
  enrollmentId: string
}

/** What the backend provides to set up an authenticator app. Never logged or stored. */
export interface MfaEnrollmentDetails {
  /** A backend-rendered QR code image (`data:image/...`), or null if not provided. */
  qrCodeImage: string | null
  /** The setup key to type into the app manually, or null if not provided. */
  setupKey: string | null
  /** The account name the authenticator app will show, if provided. */
  accountLabel: string | null
}

export interface MfaEnrollmentResult {
  /** A session when enrollment completes a sign-in; null when the user must log in next. */
  session: Session | null
  /** One-time recovery codes, shown once if the approved design issues them. */
  recoveryCodes: string[] | null
}

/** A password recovery request. The backend returns one whether or not the account exists. */
export interface PasswordRecoveryRequest {
  recoveryId: string
  /** When the current code expires (ISO 8601), if the backend says. */
  codeExpiresAt: string | null
  /** When "Resend code" becomes available (ISO 8601), if the backend says. */
  resendAvailableAt: string | null
}

/** Short-lived authorisation to set a new password, issued after the OTP is verified. */
export interface ResetAuthorization {
  resetToken: string
  expiresAt: string | null
}

/** A valid activation invitation, as described by the backend. */
export interface ActivationInvitation {
  userId: string | null
  fullName: string | null
  /** True for Administrators: an authenticator app must be enrolled after the password. */
  requiresMfaEnrollment: boolean
}

export type ActivationResult =
  | { status: 'activated' }
  | { status: 'mfa_enrollment_required'; enrollment: MfaEnrollmentSession }

/* Error codes the screens react to. Frontend names until the Identity API confirms them. */
export const MFA_CHALLENGE_EXPIRED = 'MFA_CHALLENGE_EXPIRED'
export const TOO_MANY_ATTEMPTS = 'TOO_MANY_ATTEMPTS'
export const OTP_INVALID = 'OTP_INVALID'
export const OTP_EXPIRED = 'OTP_EXPIRED'
export const RESEND_COOLDOWN = 'RESEND_COOLDOWN'
export const RESEND_UNAVAILABLE = 'RESEND_UNAVAILABLE'
export const RECOVERY_SESSION_EXPIRED = 'RECOVERY_SESSION_EXPIRED'
export const RESET_AUTHORIZATION_EXPIRED = 'RESET_AUTHORIZATION_EXPIRED'
export const ACTIVATION_TOKEN_INVALID = 'ACTIVATION_TOKEN_INVALID'
export const ACTIVATION_TOKEN_EXPIRED = 'ACTIVATION_TOKEN_EXPIRED'
export const ACTIVATION_TOKEN_USED = 'ACTIVATION_TOKEN_USED'

/**
 * Company User ID format. It matches the identifiers the system issues today (`USR-`
 * followed by digits, e.g. USR-003). Confirm against the Identity contract; this is the
 * only place to change it.
 */
export const COMPANY_USER_ID_PATTERN = /^USR-\d{3,}$/i

export const USER_ID_MESSAGES = {
  required: 'Enter your User ID',
  email: 'Log in with your company User ID, not an e-mail address',
  format: 'Enter a valid User ID, for example USR-003',
} as const

/** Validation message for a Company User ID, or null when it is acceptable. */
export function userIdError(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return USER_ID_MESSAGES.required
  if (trimmed.includes('@')) return USER_ID_MESSAGES.email
  if (!COMPANY_USER_ID_PATTERN.test(trimmed)) return USER_ID_MESSAGES.format
  return null
}

/** Canonical form sent to the backend: trimmed and upper-case (USR-003). */
export function normaliseCompanyUserId(value: string): string {
  return value.trim().toUpperCase()
}

/** Keeps digits only, up to {@link CODE_LENGTH} (pasted codes may contain spaces). */
export function normaliseCode(value: string): string {
  return value.replace(/\D/g, '').slice(0, CODE_LENGTH)
}

export function codeError(value: string): string | null {
  const code = normaliseCode(value)
  if (!code) return 'Enter the 6-digit code'
  if (code.length !== CODE_LENGTH) return 'The code has 6 digits'
  return null
}
