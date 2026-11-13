import { contractPending, type HttpClient } from '@/shared/api'
import type { ReviewPort } from '../application/ports'

/**
 * API-mode Review adapter. No Review gateway contract is approved, so every operation
 * reports contract_pending and no request is sent. Endpoints are not guessed.
 */
export function createHttpReviewAdapter(http: HttpClient): ReviewPort {
  void http
  return {
    async getWorkspace() { return contractPending('review.workspace.get') },
    async getObservationReview() { return contractPending('review.observations.get') },
    async verify() { return contractPending('review.observations.verify') },
    async flag() { return contractPending('review.observations.flag') },
    async requestCorrection() { return contractPending('review.observations.requestCorrection') },
    async refer() { return contractPending('review.observations.refer') },
    async approveCorrection() { return contractPending('review.corrections.approve') },
    async rejectCorrection() { return contractPending('review.corrections.reject') },
    async exportList() { return contractPending('review.exports.create') },
    async simulateRevisionApplied() { return contractPending('review.corrections.revisionApplied.fixtureOnly') },
  }
}
