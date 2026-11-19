import { AppError } from '@/shared/api'
import type { FixtureDatabase, FixtureUser } from '@/fixtures'
import type { UserId } from '@/shared/types'

/** Supplied by the composition root from session persistence, never from a form. */
export interface FixtureActor {
  actorId: () => UserId | null
}

export function requireActiveActor(db: Readonly<FixtureDatabase>, actor: FixtureActor): FixtureUser {
  const id = actor.actorId()
  const user = id ? db.users.find((candidate) => candidate.id === id) : undefined
  if (!user || user.status !== 'active') {
    throw new AppError('forbidden', 'An active signed-in account is required.', { code: 'FORBIDDEN' })
  }
  return user
}

export function requireAdministrator(db: Readonly<FixtureDatabase>, actor: FixtureActor): FixtureUser {
  const user = requireActiveActor(db, actor)
  if (user.role !== 'ADMINISTRATOR') {
    throw new AppError('forbidden', 'Only an active Administrator can perform this operation.', { code: 'FORBIDDEN' })
  }
  return user
}

export function requireAccountOwner(db: Readonly<FixtureDatabase>, actor: FixtureActor, userId: UserId): FixtureUser {
  const user = requireActiveActor(db, actor)
  if (user.id !== userId) {
    throw new AppError('forbidden', 'You can only access your own account here. Use User Management to administer other users.', { code: 'FORBIDDEN' })
  }
  return user
}
