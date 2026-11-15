import {
  codeError,
  normaliseCode,
  normaliseCompanyUserId,
  userIdError,
  type ActivationInvitation,
  type ActivationResult,
  type PasswordRecoveryRequest,
  type ResetAuthorization,
} from '../domain/authFlows'
import { newPasswordErrors } from '../domain/rules'
import { rejectField } from './authUseCases'
import type { AccountActivationPort, PasswordRecoveryPort, SessionPersistencePort } from './ports'

function rejectPassword(newPassword: string, confirmPassword: string) {
  const errors = newPasswordErrors(newPassword, confirmPassword)
  rejectField('newPassword', errors.newPassword ?? null)
  rejectField('confirmPassword', errors.confirmPassword ?? null)
}

export interface PasswordRecoveryUseCases {
  requestReset(userId: string, signal?: AbortSignal): Promise<PasswordRecoveryRequest>
  resendCode(recovery: PasswordRecoveryRequest, signal?: AbortSignal): Promise<PasswordRecoveryRequest>
  verifyCode(recovery: PasswordRecoveryRequest, code: string, signal?: AbortSignal): Promise<ResetAuthorization>
  /** Sets the new password, then forgets any local session (the backend revokes sessions). */
  completeReset(authorization: ResetAuthorization, newPassword: string, confirmPassword: string, signal?: AbortSignal): Promise<void>
}

export function createPasswordRecoveryUseCases(port: PasswordRecoveryPort, persistence: SessionPersistencePort): PasswordRecoveryUseCases {
  return {
    async requestReset(userId, signal) {
      rejectField('userId', userIdError(userId))
      return port.requestReset(normaliseCompanyUserId(userId), signal)
    },
    resendCode(recovery, signal) {
      return port.resendCode(recovery, signal)
    },
    async verifyCode(recovery, code, signal) {
      rejectField('code', codeError(code))
      return port.verifyCode(recovery, normaliseCode(code), signal)
    },
    async completeReset(authorization, newPassword, confirmPassword, signal) {
      rejectPassword(newPassword, confirmPassword)
      await port.completeReset(authorization, newPassword, signal)
      persistence.clear()
    },
  }
}

export interface AccountActivationUseCases {
  validateInvitation(token: string, signal?: AbortSignal): Promise<ActivationInvitation>
  activate(token: string, newPassword: string, confirmPassword: string, signal?: AbortSignal): Promise<ActivationResult>
}

export function createAccountActivationUseCases(port: AccountActivationPort): AccountActivationUseCases {
  return {
    validateInvitation(token, signal) {
      return port.validateInvitation(token, signal)
    },
    async activate(token, newPassword, confirmPassword, signal) {
      rejectPassword(newPassword, confirmPassword)
      return port.activate(token, newPassword, signal)
    },
  }
}
