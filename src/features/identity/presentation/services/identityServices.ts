import { createContext, useContext } from 'react'
import type { AppErrorKind } from '@/shared/api'
import type { Clock } from '@/shared/utilities/clock'
import type { AccountUseCases, IdentityAdminUseCases } from '../../application/identityUseCases'

export interface DevelopmentAccount {
  email: string
  password: string
  persona: string
}

/** What the Identity screens need from the composition root. */
export interface IdentityServices {
  admin: IdentityAdminUseCases
  account: AccountUseCases
  clock: Clock
  /**
   * True in fixture mode: screens label their data as demonstration data and may offer
   * development aids. Never true in API mode.
   */
  demo: boolean
  /** Fixture mode only: the development sign-in accounts. Empty in API mode. */
  developmentAccounts: readonly DevelopmentAccount[]
  /** Fixture mode only: makes the next request fail (e.g. ID-08 "Simulate 409 conflict"). */
  simulateNextFailure: ((kind: AppErrorKind) => void) | null
}

export const IdentityServicesContext = createContext<IdentityServices | null>(null)

export function useIdentityServices(): IdentityServices {
  const value = useContext(IdentityServicesContext)
  if (!value) throw new Error('useIdentityServices must be used inside <IdentityServicesContext.Provider>.')
  return value
}
