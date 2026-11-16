import type { UserRole } from '@/shared/types'
import type { IdentityUser } from '../../../../domain/models'
import { useUsers } from '../../../services/queries'

export interface RoleCount {
  total: number
  active: number
}

/** Users per role, from the User Management source. `null` while loading or unavailable. */
export function useRoleCounts() {
  const users = useUsers()
  const counts = users.data ? countByRole(users.data) : null
  return { users, counts }
}

export function countByRole(users: readonly IdentityUser[]): Record<UserRole, RoleCount> {
  const counts = {} as Record<UserRole, RoleCount>
  for (const role of ['ADMINISTRATOR', 'SUPERVISOR', 'DISEASE_EXPERT', 'FIELD_WORKER', 'REPORTING_USER'] as const) counts[role] = { total: 0, active: 0 }
  for (const user of users) {
    counts[user.role].total += 1
    if (user.status === 'active') counts[user.role].active += 1
  }
  return counts
}

export const userCountLabel = (count: number) => `${count} ${count === 1 ? 'user' : 'users'}`

/** User Management filtered to a role (every status, so the count matches). */
export const usersWithRolePath = (role: UserRole) => `/admin/users?role=${role}&status=all`
