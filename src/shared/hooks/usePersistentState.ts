import { useCallback, useState } from 'react'

function read<T>(key: string, fallback: T, isValid: (value: unknown) => value is T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    const parsed: unknown = JSON.parse(raw)
    return isValid(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

/**
 * UI preference persisted in localStorage (e.g. sidebar collapsed). Never use this for
 * business data. Storage failures (private mode, quota) fall back to in-memory state.
 */
export function usePersistentState<T>(key: string, fallback: T, isValid: (value: unknown) => value is T) {
  const [value, setValue] = useState<T>(() => read(key, fallback, isValid))
  const update = useCallback(
    (next: T) => {
      setValue(next)
      try {
        window.localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // Preference stays in memory for this tab.
      }
    },
    [key],
  )
  return [value, update] as const
}
