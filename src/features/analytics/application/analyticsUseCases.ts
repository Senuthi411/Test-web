import { scopeSnapshot } from '../domain/selectors'
import type { AnalyticsScope } from '../domain/models'
import type { AnalyticsPort, AnalyticsUseCases } from './ports'

export function createAnalyticsUseCases(port: AnalyticsPort): AnalyticsUseCases {
  return {
    async loadSnapshot(scope: AnalyticsScope, signal?: AbortSignal) {
      return scopeSnapshot(await port.readSnapshot(signal), scope)
    },
  }
}
