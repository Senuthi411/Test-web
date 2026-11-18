import type { RememberedUserIdPort } from '../application/ports'

const STORAGE_KEY = 'tealeaf.rememberedUserId'

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * "Remember User ID": keeps only the company User ID in localStorage. Passwords and
 * access tokens are never written here. Blocked storage simply means nothing is remembered.
 */
export function createBrowserRememberedUserId(): RememberedUserIdPort {
  return {
    load() {
      try {
        const value = storage()?.getItem(STORAGE_KEY)?.trim()
        return value ? value : null
      } catch {
        return null
      }
    },
    save(userId) {
      try {
        storage()?.setItem(STORAGE_KEY, userId)
      } catch {
        // Storage full or blocked: nothing is remembered.
      }
    },
    clear() {
      try {
        storage()?.removeItem(STORAGE_KEY)
      } catch {
        // Ignore.
      }
    },
  }
}
