import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { Card, ErrorState, Skeleton, Badge } from '@/shared/components'
import { ASSIGNMENT_STATUS, type AssignmentStatus } from '../domain/assignment'

export function Boundary<T>({ query, children }: { query: UseQueryResult<T>; children: (data: T) => ReactNode }) {
  if (query.isPending) return <Card aria-busy="true" aria-label="Loading Capture"><Skeleton height={260} /></Card>
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  return children(query.data)
}
export function Status({ value }: { value: AssignmentStatus }) {
  return <Badge tone={value === 'cancelled' ? 'danger' : value === 'completed' ? 'success' : value === 'submitted' ? 'purple' : value === 'assigned' ? 'info' : value === 'in_progress' ? 'warning' : 'neutral'}>{ASSIGNMENT_STATUS[value]}</Badge>
}
