import { contractPending, type HttpClient } from '@/shared/api'
import type { AnalyticsPort } from '../application/ports'

/**
 * API-mode Analytics adapter. No Analytics gateway contract is approved, so the read
 * reports contract_pending and no request is sent. Endpoints are not guessed.
 */
export function createHttpAnalyticsAdapter(http: HttpClient): AnalyticsPort {
  void http
  return {
    async readSnapshot() { return contractPending('analytics.snapshot.read') },
  }
}
