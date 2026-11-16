import type { UserRole } from '@/shared/types'

export const userCountLabel = (count: number) => `${count} ${count === 1 ? 'user' : 'users'}`

/** User Management filtered to a role (every status, so the count matches). */
export const usersWithRolePath = (role: UserRole) => `/admin/users?role=${role}&status=all`
