import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/features/identity'
import type { AnalyticsScope } from '../../domain/models'
import { useAnalyticsServices } from './analyticsServices'

export const analyticsKeys = {
  all: ['analytics'] as const,
  snapshot: (userId: string, scope: AnalyticsScope) => ['analytics', 'snapshot', userId, scope.estateIds, scope.divisionIds ?? []] as const,
}

/** Loads the analytics snapshot for the signed-in user's estate scope (from the shared session). */
export function useAnalyticsSnapshot() {
  const { useCases } = useAnalyticsServices()
  const { state } = useSession()
  const user = state.status === 'signed_in' ? state.session.user : null
  const scope: AnalyticsScope = { estateIds: user?.estateIds ?? [], divisionIds: user?.divisionIds ?? [] }
  return useQuery({
    queryKey: analyticsKeys.snapshot(user?.id ?? '', scope),
    queryFn: ({ signal }) => useCases.loadSnapshot(scope, signal),
    enabled: user !== null,
  })
}
