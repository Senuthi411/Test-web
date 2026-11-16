import type { BadgeTone } from '@/shared/components'
import type { PendingActionKind, SecurityAlert, SecurityAlertKind, SecurityAlertSeverity } from '../../../../domain/adminDashboard'
import type { AttentionReason } from '../../../../domain/models'

export const ALERT_KIND_LABELS: Record<SecurityAlertKind, { title: string; explanation: string; plural: string }> = {
  failed_sign_in: { title: 'Failed sign-in attempts', explanation: 'Repeated failed sign-ins were recorded for this account.', plural: 'failed sign-ins' },
  account_locked: { title: 'Account locked', explanation: 'The account was locked by the Identity service.', plural: 'locked accounts' },
  session_flagged: { title: 'Device session flagged', explanation: 'The Identity service flagged this device session.', plural: 'flagged device sessions' },
  mfa_enrollment_pending: {
    title: 'Administrator MFA enrollment pending',
    explanation: 'This Administrator has not completed multi-factor enrollment.',
    plural: 'Administrator MFA enrollment',
  },
  device_session_revoked: {
    title: 'Device session revoked',
    explanation: 'The session was revoked and no controlled recovery has been requested.',
    plural: 'revoked device sessions',
  },
}

export const SEVERITY: Record<SecurityAlertSeverity, { label: string; tone: BadgeTone }> = {
  high: { label: 'High', tone: 'danger' },
  medium: { label: 'Medium', tone: 'warning' },
  low: { label: 'Low', tone: 'info' },
}

/** Where an alert's action leads, using existing management pages. */
export function alertAction(alert: SecurityAlert): { to: string; label: string } | null {
  if (alert.sessionId) return { to: `/admin/device-sessions?session=${alert.sessionId}`, label: 'Review device session' }
  if (alert.employee) return { to: `/admin/users/${alert.employee.id}`, label: 'Review user' }
  return null
}

export const PENDING_ACTION_LABELS: Record<PendingActionKind, { title: string; status: string; tone: BadgeTone; action: string }> = {
  session_recovery: { title: 'Device session recovery', status: 'In progress', tone: 'info', action: 'Continue recovery' },
}

export const ATTENTION_REASON_LABELS: Record<AttentionReason, string> = {
  inactive: 'Inactive account',
  missing_scope: 'No estate or division assigned',
  inactive_scope: 'Assigned to an inactive estate or division',
  sessions_revoked: 'All device sessions revoked',
}
