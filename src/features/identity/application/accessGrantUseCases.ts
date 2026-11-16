import type { AccessGrant, AccessHistoryEntry, GrantRequestInput } from '../domain/accessGrants'
import type { AccessGrantPort } from './ports'
import { rejectField } from './authUseCases'

export interface AccessGrantUseCases {
  listGrants(signal?: AbortSignal): Promise<AccessGrant[]>
  requestGrant(input: GrantRequestInput): Promise<AccessGrant>
  endGrant(grantId: string, action: 'revoke' | 'cancel', reason: string): Promise<AccessGrant>
  listAccessHistory(signal?: AbortSignal): Promise<AccessHistoryEntry[]>
}

/**
 * Temporary access. Checks that need no data (reason, period) run here before a request is
 * sent; everything else (role, scope, conflicts, approval) is the backend's decision.
 */
export function createAccessGrantUseCases(port: AccessGrantPort): AccessGrantUseCases {
  return {
    listGrants: (signal) => port.listGrants(signal),
    async requestGrant(input) {
      rejectField('reason', input.reason.trim() ? null : 'Enter the business reason')
      const start = Date.parse(input.startsAt)
      const expiry = Date.parse(input.expiresAt)
      rejectField('startsAt', Number.isNaN(start) ? 'Enter a valid start date and time' : null)
      rejectField('expiresAt', Number.isNaN(expiry) || expiry <= start ? 'The expiry must be after the start' : null)
      return port.requestGrant({ ...input, reason: input.reason.trim() })
    },
    async endGrant(grantId, action, reason) {
      rejectField('reason', reason.trim() ? null : `Enter the reason for ${action === 'revoke' ? 'revoking' : 'cancelling'} this grant`)
      return port.endGrant(grantId, action, reason.trim())
    },
    listAccessHistory: (signal) => port.listAccessHistory(signal),
  }
}
