import type { ReactNode } from 'react'
import { Banner, ErrorState, Skeleton } from '@/shared/components'
import { isServiceUnavailable } from '../../../components/helpers'
import styles from './AdminDashboard.module.css'

interface QueryState {
  isPending: boolean
  isError: boolean
  error: unknown
  refetch: () => unknown
}

/**
 * Loading, unavailable and error states for one dashboard section. A section whose source
 * has no backend contract says so; it never shows zeros or an empty list in its place.
 */
export function SectionBoundary({ queries, unavailable, children }: { queries: readonly QueryState[]; unavailable: string; children: () => ReactNode }) {
  const failed = queries.find((query) => query.isError)
  if (failed) {
    if (isServiceUnavailable(failed.error)) {
      return (
        <Banner tone="info" title="Not available yet">
          {unavailable}
        </Banner>
      )
    }
    return <ErrorState error={failed.error} onRetry={() => queries.forEach((query) => query.isError && void query.refetch())} />
  }
  if (queries.some((query) => query.isPending)) {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-label="Loading">
        <Skeleton height={14} />
        <Skeleton height={14} />
        <Skeleton width="60%" height={14} />
      </div>
    )
  }
  return <>{children()}</>
}
