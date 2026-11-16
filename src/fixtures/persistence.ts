import type { ZodType } from 'zod'
import type { FixtureDatabase } from './records'
import type { FixtureStore } from './store'

/** A part of the fixture dataset that the running app keeps across browser refreshes. */
export interface PersistedFixtureSlice<T> {
  /** sessionStorage key. */
  key: string
  /** Validates stored data; anything that fails is discarded and the seed is kept. */
  schema: ZodType<T>
  select(db: Readonly<FixtureDatabase>): T
  /** Extra check against the current seed (e.g. referenced records still exist). */
  consistent?(db: Readonly<FixtureDatabase>, saved: T): boolean
  restore(db: FixtureDatabase, saved: T): void
}

/**
 * Restores `slice` from `storage` (when valid) and saves it after every change to the store,
 * including {@link FixtureStore.reset}. Without storage, or when storage fails, the store keeps
 * its in-memory behaviour. Only the running app passes storage; tests keep pure memory.
 */
export function persistFixtureSlice<T>(store: FixtureStore, storage: Storage | null, slice: PersistedFixtureSlice<T>): void {
  if (!storage) return
  const saved = store.read((db) => {
    try {
      const raw = storage.getItem(slice.key)
      if (raw === null) return null
      const parsed = slice.schema.safeParse(JSON.parse(raw))
      if (!parsed.success) return null
      return !slice.consistent || slice.consistent(db, parsed.data) ? parsed.data : null
    } catch {
      return null
    }
  })
  if (saved !== null) store.write((db) => slice.restore(db, saved))
  store.subscribe(() => {
    try {
      storage.setItem(slice.key, JSON.stringify(store.read(slice.select)))
    } catch {
      // Quota or blocked storage: the change stays in memory for this tab.
    }
  })
}
