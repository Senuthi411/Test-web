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
    async claim() { return contractPending('review.observations.claim') },
    async verify() { return contractPending('review.observations.verify') },
    async flag() { return contractPending('review.observations.flag') },
    async requestCorrection() { return contractPending('review.observations.requestCorrection') },
    async refer() { return contractPending('review.observations.refer') },
    async approveCorrection() { return contractPending('review.corrections.approve') },
    async rejectCorrection() { return contractPending('review.corrections.reject') },
    async recordExpertDiagnosis() { return contractPending('review.observations.expertDiagnosis.record') },
    async closeExpertCase() { return contractPending('review.observations.expertDiagnosis.close') },
    async quarantineDivision() { return contractPending('review.observations.divisionQuarantine.apply') },
    // Division quarantine, the division operational status and Quarantine Assignments need gateway operations that are not defined yet.
    async releaseDivisionQuarantine() { return contractPending('review.divisionQuarantines.release') },
    async endProcess() { return contractPending('review.observations.endProcess') },
    async exportList() { return contractPending('review.exports.create') },
    async simulateRevisionApplied() { return contractPending('review.corrections.revisionApplied.fixtureOnly') },
    // Resubmission happens in the Capture mobile app; the web never submits revisions.
    async simulateResubmission() { return contractPending('capture.observations.resubmitRevision.fixtureOnly') },
  }
}
