import type { AnalyticsScope, AnalyticsSnapshot } from '../domain/models'

/**
 * Read-only analytics source. Adapters return the snapshot already limited to the signed-in
 * Reporting User's estate scope; the backend remains the authority on scope.
 */
export interface AnalyticsPort {
  readSnapshot(signal?: AbortSignal): Promise<AnalyticsSnapshot>
}

export interface AnalyticsUseCases {
  /** Reads the snapshot and applies the session scope again before any aggregation. */
  loadSnapshot(scope: AnalyticsScope, signal?: AbortSignal): Promise<AnalyticsSnapshot>
}
