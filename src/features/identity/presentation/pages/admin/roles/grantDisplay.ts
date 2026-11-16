import { isAppError } from '@/shared/api'
import { formatDateTime } from '@/shared/utilities/format'
import type { AccessGrant } from '../../../../domain/accessGrants'

/** Granted scope as codes, e.g. "EST-002, EST-003". */
export const grantScope = (grant: Pick<AccessGrant, 'estateIds' | 'divisionIds'>) => [...grant.estateIds, ...grant.divisionIds].join(', ')

export const grantPeriod = (grant: Pick<AccessGrant, 'startsAt' | 'expiresAt'>) => `${formatDateTime(grant.startsAt)} – ${formatDateTime(grant.expiresAt)}`

/** The service is not connected yet (API mode: no grant or audit contract). */
export const isServiceUnavailable = (error: unknown) => isAppError(error) && error.kind === 'contract_pending'

/** A date-time input value (YYYY-MM-DDTHH:mm) in local time. */
export function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
