import { Badge, type BadgeTone } from '@/shared/components'
import { GRANT_STATUS_LABELS, type GrantStatus } from '../../../../domain/accessGrants'

const STATUS_TONES: Record<GrantStatus, BadgeTone> = {
  pending_approval: 'warning',
  scheduled: 'info',
  active: 'success',
  rejected: 'danger',
  expired: 'neutral',
  revoked: 'danger',
  cancelled: 'neutral',
}

export function GrantStatusBadge({ status }: { status: GrantStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{GRANT_STATUS_LABELS[status]}</Badge>
}
