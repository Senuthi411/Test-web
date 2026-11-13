/**
 * Display formatting. The approved designs show all times in Sri Lanka time
 * (UTC+05:30), e.g. "06 Oct 2026 · 13:15", so formatting is pinned to that zone
 * rather than the viewer's browser zone.
 */
export const DISPLAY_TIME_ZONE = 'Asia/Colombo'

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: DISPLAY_TIME_ZONE,
})

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: DISPLAY_TIME_ZONE,
})

/** "06 Oct 2026" */
export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso))
}

/** "13:15" */
export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso))
}

/** "06 Oct 2026 · 13:15" */
export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} · ${formatTime(iso)}`
}

const dayMonthFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  timeZone: DISPLAY_TIME_ZONE,
})

const isoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: DISPLAY_TIME_ZONE,
})

/** "2026-09-14" in Sri Lanka time. Accepts a full timestamp or a date-only value. */
export function formatIsoDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return isoDateFormatter.format(new Date(value))
}

function dayKey(date: Date): string {
  return isoDateFormatter.format(date)
}

/**
 * Relative label used in tables and detail panels, as written in the designs:
 * "Today · 07:58", "Yesterday · 17:20", "20 Oct · 08:15", or "06 Oct 2025 · 13:15"
 * for another year. A date-only value ("2026-10-20") omits the time ("Yesterday").
 */
export function formatRelativeDateTime(value: string, now: Date): string {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const instant = dateOnly ? new Date(`${value}T12:00:00+05:30`) : new Date(value)
  const today = dayKey(now)
  const yesterday = dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000))
  const key = dayKey(instant)
  const day =
    key === today
      ? 'Today'
      : key === yesterday
        ? 'Yesterday'
        : key.slice(0, 4) === today.slice(0, 4)
          ? dayMonthFormatter.format(instant)
          : formatDate(instant.toISOString())
  return dateOnly ? day : `${day} · ${formatTime(instant.toISOString())}`
}

/** "Anika Perera" → "AP", "Dr Tara Wijesinghe" → "TW" (honorific dropped, as in the designs). */
export function initialsOf(fullName: string): string {
  const parts = fullName
    .split(/\s+/)
    .filter((part) => part.length > 0 && !/^(dr|mr|mrs|ms|prof)\.?$/i.test(part))
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return `${first}${last}`.toUpperCase()
}

/** Formats a ratio as a whole percentage, e.g. 5/33 → "15%". */
export function formatPercent(part: number, whole: number): string {
  if (whole === 0) return '0%'
  return `${Math.round((part / whole) * 100)}%`
}
