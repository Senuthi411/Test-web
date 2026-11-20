import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { isAppError } from '@/shared/api'
import { Badge, Card, ErrorState, Skeleton } from '@/shared/components'
import type { CaseSeverity, CaseStatus, CatalogEntryStatus, DiseaseCategory } from '../../domain/models'
import { CASE_STATUS_LABEL, CATALOG_ENTRY_STATUS_LABEL } from '../../domain/models'

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const tone =
    status === 'awaiting_diagnosis'
      ? 'warning'
      : status === 'diagnosed'
        ? 'success'
        : status === 'pending_link'
          ? 'teal'
          : 'neutral'
  return <Badge tone={tone}>{CASE_STATUS_LABEL[status]}</Badge>
}

export function SeverityBadge({ severity }: { severity: CaseSeverity }) {
  const tone =
    severity === 'Critical' || severity === 'High'
      ? 'danger'
      : severity === 'Moderate'
        ? 'warning'
        : 'neutral'
  return <Badge tone={tone}>{severity}</Badge>
}

export function CatalogStatusBadge({ status }: { status: CatalogEntryStatus }) {
  const tone = status === 'active' ? 'success' : status === 'draft' ? 'warning' : 'neutral'
  return <Badge tone={tone}>{CATALOG_ENTRY_STATUS_LABEL[status]}</Badge>
}

export function DiseaseCategoryBadge({ category }: { category: DiseaseCategory }) {
  const tone = category === 'Fungal' ? 'teal' : category === 'Algal' ? 'warning' : 'neutral'
  return <Badge tone={tone}>{category}</Badge>
}

export function CasesQueryBoundary<T>({
  query,
  label,
  children,
}: {
  query: UseQueryResult<T>
  label: string
  children: (data: T) => ReactNode
}) {
  if (query.isPending) {
    return (
      <Card aria-busy="true" aria-label={`Loading ${label}`}>
        <Skeleton height={22} width="35%" />
        <Skeleton height={160} />
      </Card>
    )
  }

  if (query.isError) {
    const error = query.error
    const pending = isAppError(error) && error.kind === 'contract_pending'
    const forbidden = isAppError(error) && error.kind === 'forbidden'
    const notFound = isAppError(error) && error.kind === 'not_found'

    if (forbidden) {
      return <ErrorState error={error} title="403 · Access Denied (Out of Estate Scope)" />
    }

    if (notFound) {
      return <ErrorState error={error} title="404 · Case or Catalog Record Not Found" />
    }

    return (
      <ErrorState
        error={error}
        title={pending ? 'Cases backend service not connected' : `Could not load ${label}`}
        onRetry={pending ? undefined : () => void query.refetch()}
      />
    )
  }

  return <>{children(query.data)}</>
}
