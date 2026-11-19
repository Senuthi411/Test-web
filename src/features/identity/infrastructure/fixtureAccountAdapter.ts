import { AppError } from '@/shared/api'
import type { FixtureStore, FixtureUser } from '@/fixtures'
import type { UserId } from '@/shared/types'
import type { AccountPort } from '../application/ports'
import type { Profile } from '../domain/models'
import { toIdentityUser } from './fixtureRecords'
import { requireAccountOwner, type FixtureActor } from './fixtureAuthorization'

function missing(): AppError {
  return new AppError('not_found', 'Your account could not be found.')
}

/** The signed-in user's own account in fixture mode. Changes stay in this browser tab. */
export function createFixtureAccountAdapter(store: FixtureStore, actor: FixtureActor): AccountPort {
  const run = <T>(userId: UserId, operation: () => T, signal?: AbortSignal): Promise<T> =>
    store.run(() => {
      store.read((db) => requireAccountOwner(db, actor, userId))
      return operation()
    }, signal)

  const toProfile = (user: FixtureUser, db: Parameters<Parameters<FixtureStore['read']>[0]>[0]): Profile => ({
    user: toIdentityUser(db, user),
    language: user.language,
    notificationPreferences: { ...user.notificationPreferences },
  })

  const mutate = <T>(userId: UserId, change: (user: FixtureUser) => T) =>
    run(userId, () =>
      store.write((db) => {
        const user = db.users.find((item) => item.id === userId)
        if (!user) throw missing()
        return change(user)
      }),
    )

  return {
    getProfile(userId, signal) {
      return run(userId,
        () =>
          store.read((db) => {
            const user = db.users.find((item) => item.id === userId)
            if (!user) throw missing()
            return toProfile(user, db)
          }),
        signal,
      )
    },

    updateProfile(userId, input) {
      return run(userId, () =>
        store.write((db) => {
          const user = db.users.find((item) => item.id === userId)
          if (!user) throw missing()
          user.fullName = input.fullName
          user.language = input.language
          user.version += 1
          return toProfile(user, db)
        }),
      )
    },

    changePassword(userId, input) {
      return run(userId, () =>
        store.write((db) => {
          const credential = db.credentials.find((item) => item.userId === userId)
          if (!credential) throw new AppError('forbidden', 'This account has no web password to change.')
          if (credential.password !== input.currentPassword) {
            const message = 'Current password is incorrect'
            throw new AppError('validation', message, { code: 'VALIDATION_FAILED', details: [{ path: 'currentPassword', message }] })
          }
          credential.password = input.newPassword
        }),
      )
    },

    setNotificationPreference(userId, key, enabled) {
      return mutate(userId, (user) => {
        user.notificationPreferences[key] = enabled
        return { ...user.notificationPreferences }
      })
    },
  }
}
