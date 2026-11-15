import { useEffect, useState } from 'react'

/** Whole seconds until `targetIso` (never negative), or null when no time was provided. */
export function useCountdown(targetIso: string | null): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!targetIso) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [targetIso])
  if (!targetIso) return null
  const target = Date.parse(targetIso)
  if (Number.isNaN(target)) return null
  return Math.max(0, Math.ceil((target - now) / 1000))
}

export function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
