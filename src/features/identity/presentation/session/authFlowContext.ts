import { createContext, useContext } from 'react'
import type { MfaEnrollmentSession, PasswordRecoveryRequest, ResetAuthorization } from '../../domain/authFlows'
import type { MfaChallenge } from '../../domain/session'

/**
 * Backend-issued references for an authentication flow in progress. Held in memory only:
 * never in localStorage, sessionStorage or the URL. A reload therefore ends the flow, and
 * the screens ask the user to start again.
 */
export interface AuthFlowState {
  /** Administrator TOTP step, and where to go afterwards. */
  mfa: { challenge: MfaChallenge; next: string | null } | null
  /** Mandatory Administrator authenticator enrollment. */
  enrollment: { enrollment: MfaEnrollmentSession; next: string | null } | null
  /** Forgot Password: the OTP step. */
  recovery: PasswordRecoveryRequest | null
  /** Forgot Password: short-lived authorisation to set the new password. */
  reset: ResetAuthorization | null
}

export interface AuthFlowContextValue extends AuthFlowState {
  update(patch: Partial<AuthFlowState>): void
  /** Forgets every reference (after success, cancellation or expiry). */
  clear(): void
}

export const EMPTY_AUTH_FLOW: AuthFlowState = { mfa: null, enrollment: null, recovery: null, reset: null }

export const AuthFlowContext = createContext<AuthFlowContextValue | null>(null)

export function useAuthFlow(): AuthFlowContextValue {
  const value = useContext(AuthFlowContext)
  if (!value) throw new Error('useAuthFlow must be used inside <AuthFlowProvider>.')
  return value
}
