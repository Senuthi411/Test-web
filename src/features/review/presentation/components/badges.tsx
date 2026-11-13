import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { Badge, Card, ErrorState, Skeleton, type BadgeTone } from '@/shared/components'
import {
  CORRECTION_STATUS_LABEL,
  DECISION_OUTCOME_LABEL,
  QUARANTINE_STATE_LABEL,
  REVIEW_STATUS_LABEL,
  type CorrectionStatus,
  type DecisionOutcome,
  type QuarantineState,
  type ReferralCaseStatus,
  type ReferralLinkStatus,
  type ReviewStatus,
} from '../../domain/models'

/** REV-02 status chip colours. */
const REVIEW_TONE: Record<ReviewStatus, BadgeTone> = {
  submitted: 'info',
  in_review: 'purple',
  flagged: 'danger',
  correction_requested: 'warning',
  referred: 'lime',
  verified: 'success',
}

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  return <Badge tone={REVIEW_TONE[status]}>{REVIEW_STATUS_LABEL[status]}</Badge>
}

const CORRECTION_TONE: Record<CorrectionStatus, BadgeTone> = {
  requested: 'warning',
  resubmitted: 'purple',
  approved: 'info',
  applied: 'success',
  rejected: 'danger',
}

export function CorrectionStatusBadge({ status }: { status: CorrectionStatus }) {
  return <Badge tone={CORRECTION_TONE[status]}>{CORRECTION_STATUS_LABEL[status]}</Badge>
}

const OUTCOME_TONE: Record<DecisionOutcome, BadgeTone> = {
  verified: 'success',
  flagged: 'danger',
  correction_requested: 'warning',
  correction_approved: 'info',
  correction_rejected: 'warning',
  revision_applied: 'success',
  referred: 'lime',
  released: 'info',
}

export function OutcomeBadge({ outcome }: { outcome: DecisionOutcome }) {
  return <Badge tone={OUTCOME_TONE[outcome]}>{DECISION_OUTCOME_LABEL[outcome]}</Badge>
}

export function LinkStatusBadge({ status }: { status: ReferralLinkStatus }) {
  return status === 'linked' ? <Badge tone="success">Linked</Badge> : <Badge tone="warning">Pending case link</Badge>
}

export function CaseStatusBadge({ status }: { status: ReferralCaseStatus | null }) {
  if (status === 'diagnosed') return <Badge tone="success">Diagnosed</Badge>
  if (status === 'awaiting_diagnosis') return <Badge tone="warning">Awaiting diagnosis</Badge>
  return <Badge tone="neutral">Not created</Badge>
}

const QUARANTINE_TONE: Record<QuarantineState, BadgeTone> = {
  pending_decision: 'warning',
  released_pending_ingest: 'info',
  ingest_retry_required: 'danger',
  rejected: 'neutral',
}

export function QuarantineBadge({ state }: { state: QuarantineState }) {
  return <Badge tone={QUARANTINE_TONE[state]}>{QUARANTINE_STATE_LABEL[state]}</Badge>
}

/** Loading / error wrapper for Review queries. */
export function QueryBoundary<T>({ query, label, children }: { query: UseQueryResult<T>; label: string; children: (data: T) => ReactNode }) {
  if (query.isPending) {
    return (
      <Card aria-busy="true" aria-label={`Loading ${label}`}>
        <Skeleton height={260} />
      </Card>
    )
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  return <>{children(query.data)}</>
}
