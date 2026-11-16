import { contractPending } from '@/shared/api'
import type { AccessGrantPort } from '../application/ports'

/**
 * Temporary access grants and access history in API mode.
 *
 * PENDING CONTRACT: the backend defines no grant, approval or audit-history endpoints
 * (audit logging is "Planned"). No request is sent, no grant is approved and no history
 * record is shown. Screens present these as "service unavailable".
 */
export function createPendingAccessGrantAdapter(): AccessGrantPort {
  return {
    async listGrants() {
      return contractPending('identity.accessGrants.list')
    },
    async requestGrant() {
      return contractPending('identity.accessGrants.request')
    },
    async endGrant() {
      return contractPending('identity.accessGrants.end')
    },
    async listAccessHistory() {
      return contractPending('identity.accessHistory.list')
    },
  }
}
