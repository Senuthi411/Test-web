import { contractPending } from '@/shared/api'
import type { AuditLogPort, ConfigurationPort } from '../application/ports'

/**
 * Audit log and system configuration in API mode.
 *
 * PENDING CONTRACT: the backend defines no audit-log, configuration, rule-evaluation or
 * maintenance endpoints. No request is sent and nothing is shown as saved, published or
 * enforced; screens present these as "not available". See
 * docs/api-integration/pending-contracts.md.
 */
export function createPendingAuditLogAdapter(): AuditLogPort {
  return {
    async listAuditLog() {
      return contractPending('identity.auditLog.list')
    },
  }
}

export function createPendingConfigurationAdapter(): ConfigurationPort {
  return {
    async getConfiguration() {
      return contractPending('configuration.get')
    },
    async saveDraft() {
      return contractPending('configuration.draft.save')
    },
    async discardDraft() {
      return contractPending('configuration.draft.discard')
    },
    async publishDraft() {
      return contractPending('configuration.publish')
    },
    async rollback() {
      return contractPending('configuration.rollback')
    },
  }
}
