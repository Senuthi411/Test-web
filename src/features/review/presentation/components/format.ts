import { isAppError } from '@/shared/api'

const TZ = 'Asia/Colombo'
const hasTime = (iso: string) => iso.includes('T')
const instant = (iso: string) => new Date(hasTime(iso) ? iso : `${iso}T12:00:00+05:30`)

/** "15 Oct 2026". Date-only fixture values never gain an invented time. */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ }).format(instant(iso))
}

/** "20 Oct 2026 · 09:00", or just the date when no time is recorded. */
export function formatDateTime(iso: string): string {
  if (!hasTime(iso)) return formatDate(iso)
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(instant(iso))
  return `${formatDate(iso)} · ${time}`
}

/** "15 Oct" (REV-03 history, REV-01 attention). */
export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: TZ }).format(instant(iso))
}

/** "Wed 21 Oct 2026" (REV-01 subtitle). */
export function formatLongDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('weekday')} ${get('day')} ${get('month')} ${get('year')}`
}

export function errorText(error: unknown): string {
  return isAppError(error) ? error.message : 'Something went wrong. Try again.'
}

export function isConflict(error: unknown): boolean {
  return isAppError(error) && error.kind === 'conflict'
}

export const reviewPaths = {
  dashboard: '/review',
  queue: '/review/queue',
  observation: (id: string) => `/review/observations/${encodeURIComponent(id)}`,
  decision: (id: string, kind: 'verify' | 'flag' | 'request-correction' | 'refer') => `/review/observations/${encodeURIComponent(id)}/${kind}`,
  corrections: '/review/corrections',
  correction: (id: string) => `/review/corrections/${encodeURIComponent(id)}`,
  compare: (id: string) => `/review/corrections/${encodeURIComponent(id)}/compare`,
  approve: (id: string) => `/review/corrections/${encodeURIComponent(id)}/approve`,
  reject: (id: string) => `/review/corrections/${encodeURIComponent(id)}/reject`,
  referrals: '/review/referrals',
  quarantine: '/review/quarantine',
  quarantineItem: (id: string) => `/review/quarantine/${encodeURIComponent(id)}`,
  history: '/review/history',
  evidence: (id: string) => `/observations/${encodeURIComponent(id)}/evidence`,
  assignments: '/assignments',
}
