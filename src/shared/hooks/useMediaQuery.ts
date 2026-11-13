import { useSyncExternalStore } from 'react'

function supported() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
}

/** Live result of a CSS media query (false where matchMedia is unavailable, e.g. tests). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (!supported()) return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => (supported() ? window.matchMedia(query).matches : false),
    () => false,
  )
}
