import type { AccountPort, AuthPort, DevelopmentAccount, IdentityAdminPort } from '@/features/identity'
import type { AppErrorKind } from '@/shared/api'
import type { CaptureReadPort } from '@/features/capture'
import type { ReviewPort } from '@/features/review'

/** Development controls available only in fixture mode. */
export interface FixtureControls {
  /** Restores the original synthetic dataset, discarding simulated changes. */
  reset(): void
  /** Makes the next fixture request fail with the given error kind. */
  failNext(kind: AppErrorKind): void
  /** Development sign-in accounts (fixture mode only). */
  developmentAccounts: readonly DevelopmentAccount[]
}

/** One implementation of every port. Later phases add the other features' ports here. */
export interface AdapterSet {
  capture: CaptureReadPort
  identity: { auth: AuthPort; admin: IdentityAdminPort; account: AccountPort }
  review: ReviewPort
  fixtures: FixtureControls | null
}
