import { isAppError } from '@/shared/api'

const TZ = 'Asia/Colombo'
const hasTime = (iso: string) => iso.includes('T')
const instant = (iso: string) => new Date(hasTime(iso) ? iso : `${iso}T12:00:00+05:30`)

export function formatCaseDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: TZ,
  }).format(instant(iso))
}

export function formatCaseDateTime(iso: string): string {
  if (!hasTime(iso)) return formatCaseDate(iso)
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TZ,
  }).format(instant(iso))
  return `${formatCaseDate(iso)} · ${time}`
}

export function formatCaseShortDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: TZ,
  }).format(instant(iso))
}

export function formatCaseLongDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TZ,
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('weekday')} ${get('day')} ${get('month')} ${get('year')}`
}

export function casesErrorText(error: unknown): string {
  return isAppError(error) ? error.message : 'Something went wrong. Please try again.'
}

export function isForbiddenError(error: unknown): boolean {
  return isAppError(error) && error.kind === 'forbidden'
}

export function isNotFoundError(error: unknown): boolean {
  return isAppError(error) && error.kind === 'not_found'
}

export const casesPaths = {
  dashboard: '/cases',
  assigned: '/cases/assigned',
  catalog: '/cases/catalog',
  catalogDisease: (diseaseId: string) => `/cases/catalog/${encodeURIComponent(diseaseId)}`,
  history: '/cases/history',
  pendingReferral: (referralId: string) => `/cases/referrals/${encodeURIComponent(referralId)}`,
  caseDetail: (caseId: string) => `/cases/${encodeURIComponent(caseId)}`,
  caseEvidence: (caseId: string) => `/cases/${encodeURIComponent(caseId)}/evidence`,
  caseDiagnose: (caseId: string) => `/cases/${encodeURIComponent(caseId)}/diagnose`,
  caseConfirm: (caseId: string) => `/cases/${encodeURIComponent(caseId)}/diagnose/confirm`,
}
