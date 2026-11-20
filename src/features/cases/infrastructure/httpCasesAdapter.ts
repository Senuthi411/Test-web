import { contractPending, type HttpClient } from '@/shared/api'
import type { CasesPort } from '../application/ports'

/**
 * API-mode Cases adapter (Member 4).
 * Follows the team frontend contract: never guesses backend routes or substitutes
 * fixture data in API mode (`VITE_DATA_SOURCE=api`). Reports `contract_pending`
 * until the Cases backend microservice gateway contract is connected.
 */
export function createHttpCasesAdapter(http: HttpClient): CasesPort {
  void http
  return {
    async getWorkspace() {
      return contractPending('cases.workspace.get')
    },
    async getCase() {
      return contractPending('cases.records.get')
    },
    async getDisease() {
      return contractPending('cases.catalog.diseases.get')
    },
    async linkPendingReferral() {
      return contractPending('cases.referrals.link')
    },
    async recordDiagnosis() {
      return contractPending('cases.diagnoses.record')
    },
    async closeCase() {
      return contractPending('cases.records.close')
    },
    async saveCatalogDraft() {
      return contractPending('cases.catalog.drafts.save')
    },
    async publishCatalogVersion() {
      return contractPending('cases.catalog.versions.publish')
    },
    async deactivateDisease() {
      return contractPending('cases.catalog.diseases.deactivate')
    },
    async sendAiPrompt() {
      return contractPending('cases.aiAssistant.prompt')
    },
    async markAllNotificationsRead() {
      return contractPending('cases.notifications.markAllRead')
    },
    async exportList() {
      return contractPending('cases.exports.create')
    },
  }
}
