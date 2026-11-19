import type { UserRole } from '@/shared/types'
import type { RecordStatus } from './models'

export const LAST_ACTIVE_ADMINISTRATOR = 'LAST_ACTIVE_ADMINISTRATOR'
export const LAST_ACTIVE_ADMINISTRATOR_MESSAGE = 'At least one active Administrator must remain. Activate another Administrator before changing this account’s role or status.'

type AccountStatus = { id: string; role: UserRole; status: RecordStatus }

/** Minimal invariant; no approval, delegation or transfer policy is implied. */
export function removesLastActiveAdministrator(accounts: readonly AccountStatus[], current: AccountStatus, next: Pick<AccountStatus, 'role' | 'status'>): boolean {
  return current.role === 'ADMINISTRATOR' && current.status === 'active'
    && (next.role !== 'ADMINISTRATOR' || next.status !== 'active')
    && !accounts.some((account) => account.id !== current.id && account.role === 'ADMINISTRATOR' && account.status === 'active')
}
