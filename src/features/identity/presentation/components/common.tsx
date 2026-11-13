import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { UseQueryResult } from '@tanstack/react-query'
import { Avatar, Badge, Card, ErrorState, Skeleton, type BadgeTone } from '@/shared/components'
import { ROLE_LABELS, type UserRole } from '@/shared/types'
import type { DeviceSessionStatus, ObservationReviewStatus, RecordStatus } from '../../domain/models'
import { SESSION_STATUS_LABEL } from './helpers'
import styles from './identity.module.css'

/** ID-03 role badge tones. */
const ROLE_TONE: Record<UserRole, BadgeTone> = {
  ADMINISTRATOR: 'purple',
  SUPERVISOR: 'info',
  DISEASE_EXPERT: 'lime',
  FIELD_WORKER: 'success',
  REPORTING_USER: 'neutral',
}

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <Badge tone={ROLE_TONE[role]} dot={false}>
      {ROLE_LABELS[role]}
    </Badge>
  )
}

export function StatusBadge({ status, inactiveLabel = 'Inactive' }: { status: RecordStatus; inactiveLabel?: string }) {
  return <Badge tone={status === 'active' ? 'success' : 'neutral'}>{status === 'active' ? 'Active' : inactiveLabel}</Badge>
}

const SESSION_TONE: Record<DeviceSessionStatus, BadgeTone> = { active: 'success', revoked: 'danger', signed_out: 'neutral' }

export function SessionStatusBadge({ status }: { status: DeviceSessionStatus }) {
  return <Badge tone={SESSION_TONE[status]}>{SESSION_STATUS_LABEL[status]}</Badge>
}

const REVIEW_STATUS: Record<ObservationReviewStatus, { label: string; tone: BadgeTone }> = {
  submitted: { label: 'Submitted', tone: 'info' },
  in_review: { label: 'In review', tone: 'warning' },
  flagged: { label: 'Flagged', tone: 'danger' },
  correction_requested: { label: 'Correction requested', tone: 'warning' },
  referred: { label: 'Referred', tone: 'purple' },
  verified: { label: 'Verified', tone: 'success' },
}

export function ReviewStatusBadge({ status }: { status: ObservationReviewStatus }) {
  const { label, tone } = REVIEW_STATUS[status]
  return <Badge tone={tone}>{label}</Badge>
}

/** Avatar + name, linking to the user's detail page when `to` is given. */
export function PersonCell({ name, to, size = 28 }: { name: string; to?: string; size?: number }) {
  return (
    <span className={styles.person}>
      <Avatar name={name} size={size} />
      {to ? (
        <Link to={to} className={styles.link} onClick={(event) => event.stopPropagation()}>
          {name}
        </Link>
      ) : (
        <span className={styles.personName}>{name}</span>
      )}
    </span>
  )
}

/** Loading and error handling for a query that a whole page depends on. */
export function QueryBoundary<T>({
  query,
  children,
  skeleton,
}: {
  query: UseQueryResult<T>
  children: (data: T) => ReactNode
  skeleton?: ReactNode
}) {
  if (query.isPending) {
    return (
      skeleton ?? (
        <Card aria-busy="true" aria-label="Loading">
          <div className={styles.skeletonStack}>
            <Skeleton width="40%" height={20} />
            <Skeleton height={14} />
            <Skeleton height={14} />
            <Skeleton width="70%" height={14} />
          </div>
        </Card>
      )
    )
  }
  if (query.isError) {
    return (
      <Card>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </Card>
    )
  }
  return <>{children(query.data)}</>
}
