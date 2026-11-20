import type { AccessGrantPort, AccountActivationPort, AccountPort, AuditLogPort, AuthPort, ConfigurationPort, IdentityAdminPort, PasswordRecoveryPort } from '@/features/identity'
import type { AppErrorKind } from '@/shared/api'
import type { CaptureReadPort } from '@/features/capture'
import type { CasesPort } from '@/features/cases'
import type { ReviewPort } from '@/features/review'

/** Development controls available only in fixture mode. */
export interface FixtureControls {
  /** Restores the original synthetic dataset, discarding simulated changes. */
  reset(): void
  /** Makes the next fixture request fail with the given error kind. */
  failNext(kind: AppErrorKind): void
}

/** One implementation of every port. Later phases add the other features' ports here. */
export interface AdapterSet {
  capture: CaptureReadPort
  cases: CasesPort
  identity: {
    auth: AuthPort
    admin: IdentityAdminPort
    account: AccountPort
    recovery: PasswordRecoveryPort
    activation: AccountActivationPort
    accessGrants: AccessGrantPort
    auditLog: AuditLogPort
    configuration: ConfigurationPort
  }
  review: ReviewPort
  fixtures: FixtureControls | null
}
