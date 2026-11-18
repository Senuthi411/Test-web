import { isAppError } from '@/shared/api'
import {
  MFA_CHALLENGE_EXPIRED,
  OTP_EXPIRED,
  OTP_INVALID,
  RECOVERY_SESSION_EXPIRED,
  RESEND_COOLDOWN,
  RESEND_UNAVAILABLE,
  RESET_AUTHORIZATION_EXPIRED,
  TOO_MANY_ATTEMPTS,
} from '../../../domain/authFlows'
import { ACCOUNT_DISABLED, INVALID_CREDENTIALS, MFA_CODE_REJECTED, WEB_ACCESS_NOT_PERMITTED } from '../../../domain/session'

/** Neutral help for employees without a recovery e-mail. Reveals nothing about any account. */
export const SUPPORT_NOTE = 'Unable to access your recovery email? Contact your company Administrator for assistance.'

/** Shown after every recovery request, whether or not the account exists. */
export const GENERIC_RECOVERY_MESSAGE =
  'If an eligible account exists, a verification code will be sent to its registered recovery email.'

export interface AuthFailure {
  tone: 'error' | 'warning'
  title: string
  message: string
  /** The flow cannot continue (expired or locked); the user must start again. */
  restart: boolean
}

const failure = (tone: AuthFailure['tone'], title: string, message: string, restart = false): AuthFailure => ({ tone, title, message, restart })

/**
 * One message per backend outcome. Credential failures share a single message so no
 * screen reveals whether a User ID exists. `service` names the service in "unavailable"
 * messages, e.g. "Sign-in" or "Password reset".
 */
export function describeAuthFailure(error: unknown, service: string): AuthFailure {
  const unavailable = `${service} service unavailable`
  if (!isAppError(error)) return failure('error', 'Something went wrong', 'Try again.')
  switch (error.code) {
    case INVALID_CREDENTIALS:
      return failure('error', 'Log in failed', 'The User ID or password is incorrect.')
    case ACCOUNT_DISABLED:
      return failure('error', 'Account disabled', 'This account is disabled. Contact your administrator.')
    case WEB_ACCESS_NOT_PERMITTED:
      return failure('error', 'Web access not available', 'This account uses the TeaLeaf mobile app and cannot sign in to the web application.')
    case MFA_CODE_REJECTED:
      return failure('error', 'Verification failed', 'The code is incorrect. Check your authenticator app and try again.')
    case MFA_CHALLENGE_EXPIRED:
      return failure('warning', 'Verification expired', 'Your verification session has expired. Log in again to continue.', true)
    case TOO_MANY_ATTEMPTS:
      return failure('error', 'Too many attempts', 'Too many incorrect codes were entered. Start again.', true)
    case OTP_INVALID:
      return failure('error', 'Incorrect code', 'The verification code is incorrect.')
    case OTP_EXPIRED:
      return failure('warning', 'Code expired', 'This code has expired. Request a new code.')
    case RESEND_COOLDOWN:
      return failure('warning', 'Please wait', 'A new code can be requested shortly.')
    case RESEND_UNAVAILABLE:
      return failure('warning', 'Resend unavailable', 'No more codes can be sent right now. Try again later or contact your company Administrator.')
    case RECOVERY_SESSION_EXPIRED:
    case RESET_AUTHORIZATION_EXPIRED:
      return failure('warning', 'Session expired', 'Your password reset session has expired. Start again.', true)
  }
  switch (error.kind) {
    case 'contract_pending':
      return failure('warning', unavailable, `The ${service.toLowerCase()} service is not connected yet, so no request was sent.`)
    case 'unavailable':
    case 'timeout':
      return failure('warning', unavailable, 'The service did not respond. Try again in a few minutes.')
    case 'offline':
      return failure('warning', 'You are offline', 'Check your connection and try again.')
    case 'unauthorized':
      return failure('warning', 'Session expired', 'This session has expired. Start again.', true)
    case 'validation':
    case 'forbidden':
      return failure('error', 'Request not accepted', error.message)
    default:
      return failure('error', 'Something went wrong', 'Try again.')
  }
}
