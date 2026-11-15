import { contractPending } from '@/shared/api'
import type { AccountActivationPort, PasswordRecoveryPort } from '../application/ports'

/**
 * Password recovery and account activation.
 *
 * PENDING CONTRACT: the Identity OpenAPI defines no recovery, OTP or activation endpoints
 * (monorepo P1/P8). Both data sources use these adapters: no request is sent and nothing
 * is simulated. An OTP is never accepted, a password is never changed and an account is
 * never activated in the browser.
 */
export function createPendingPasswordRecoveryAdapter(): PasswordRecoveryPort {
  return {
    async requestReset() {
      return contractPending('identity.recovery.request')
    },
    async resendCode() {
      return contractPending('identity.recovery.resend')
    },
    async verifyCode() {
      return contractPending('identity.recovery.verify')
    },
    async completeReset() {
      return contractPending('identity.recovery.complete')
    },
  }
}

export function createPendingAccountActivationAdapter(): AccountActivationPort {
  return {
    async validateInvitation() {
      return contractPending('identity.activation.validate')
    },
    async activate() {
      return contractPending('identity.activation.activate')
    },
  }
}
