import { z } from 'zod'
import { WEB_ROLES } from '@/shared/types'
import type { SessionPersistencePort } from '../application/ports'
import type { Session } from '../domain/session'

const STORAGE_KEY = 'tealeaf.session'

const storedSessionSchema = z.object({
  user: z.object({
    id: z.string(),
    fullName: z.string(),
    email: z.string(),
    role: z.enum(WEB_ROLES),
    estateIds: z.array(z.string()),
    divisionIds: z.array(z.string()),
  }),
  accessToken: z.string().nullable(),
  source: z.enum(['fixtures', 'api']),
  signedInAt: z.string(),
})

function safeStorage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

/**
 * Stores the session in sessionStorage only, so it ends with the browser tab.
 * "Remember User ID" keeps the User ID, never the session or its token. Earlier builds
 * could keep a session in localStorage; such an entry is never loaded and is removed on
 * save and clear. Storage can be unavailable (private mode, blocked site data); the app
 * then simply asks the user to sign in again after a reload.
 */
export function createBrowserSessionPersistence(): SessionPersistencePort {
  const clear = () => {
    for (const kind of ['session', 'local'] as const) {
      try {
        safeStorage(kind)?.removeItem(STORAGE_KEY)
      } catch {
        // Ignore.
      }
    }
  }

  return {
    load() {
      try {
        const raw = safeStorage('session')?.getItem(STORAGE_KEY)
        if (!raw) return null
        const parsed = storedSessionSchema.safeParse(JSON.parse(raw))
        return parsed.success ? (parsed.data satisfies Session) : null
      } catch {
        // Corrupt entry: treat as signed out.
        return null
      }
    },
    update(session) {
      try {
        const storage = safeStorage('session')
        if (storage?.getItem(STORAGE_KEY)) storage.setItem(STORAGE_KEY, JSON.stringify(session))
      } catch {
        // Ignore: the in-memory session is still updated.
      }
    },
    save(session) {
      clear()
      try {
        safeStorage('session')?.setItem(STORAGE_KEY, JSON.stringify(session))
      } catch {
        // Storage full or blocked: the session still works until reload.
      }
    },
    clear,
  }
}
