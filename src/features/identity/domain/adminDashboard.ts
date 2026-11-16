import type { DivisionId, EstateId, UserRole } from '@/shared/types'
import type { AttentionReason, AttentionRow, DeviceSessionStatus, OpenRecovery, PersonRef, RecordStatus } from './models'

/**
 * Administrator Dashboard rules (ID-02). Everything here is derived from records a source
 * reports; nothing is inferred (no "suspicious" activity, no approvals, no invitation state).
 */

// ---------------------------------------------------------------------------------------
// Security & access alerts
// ---------------------------------------------------------------------------------------

/**
 * Security events an Identity source may report. PENDING CONTRACT: the backend defines no
 * security-event operation, so in API mode none is shown. A source states which kinds it
 * records (`reportedKinds`); a kind it does not record is "not reported", never "none".
 */
export type SecurityAlertKind =
  | 'failed_sign_in'
  | 'account_locked'
  | 'session_flagged'
  | 'mfa_enrollment_pending'
  | 'device_session_revoked'

export const SECURITY_ALERT_KINDS: readonly SecurityAlertKind[] = [
  'failed_sign_in',
  'account_locked',
  'session_flagged',
  'mfa_enrollment_pending',
  'device_session_revoked',
]

/** Severity as given by the source. The frontend never assigns one. */
export type SecurityAlertSeverity = 'high' | 'medium' | 'low'

export interface SecurityAlert {
  id: string
  kind: SecurityAlertKind
  at: string
  employee: (PersonRef & { role: UserRole }) | null
  sessionId: string | null
  device: string | null
  severity: SecurityAlertSeverity | null
  reasonCode: string | null
}

export interface SecurityAlertFeed {
  alerts: SecurityAlert[]
  /** The kinds this source records. */
  reportedKinds: SecurityAlertKind[]
}

/** Kinds the source does not record, so the screen can say they are not reported. */
export function unreportedAlertKinds(feed: Pick<SecurityAlertFeed, 'reportedKinds'>): SecurityAlertKind[] {
  return SECURITY_ALERT_KINDS.filter((kind) => !feed.reportedKinds.includes(kind))
}

// ---------------------------------------------------------------------------------------
// Users requiring attention
// ---------------------------------------------------------------------------------------

export interface AttentionFacts {
  role: UserRole
  status: RecordStatus
  estateIds: readonly EstateId[]
  divisionIds: readonly DivisionId[]
  sessionStatuses: readonly DeviceSessionStatus[]
  /** Assigned estates or divisions whose own status is inactive. */
  inactiveScopeIds: readonly string[]
}

/** The account issues that apply, from recorded facts only. */
export function attentionReasons(facts: AttentionFacts): AttentionReason[] {
  const reasons: AttentionReason[] = []
  if (facts.status === 'inactive') reasons.push('inactive')
  if (facts.role !== 'ADMINISTRATOR' && facts.estateIds.length === 0 && facts.divisionIds.length === 0) reasons.push('missing_scope')
  if (facts.inactiveScopeIds.length > 0) reasons.push('inactive_scope')
  if (facts.sessionStatuses.includes('revoked') && !facts.sessionStatuses.includes('active')) reasons.push('sessions_revoked')
  return reasons
}

// ---------------------------------------------------------------------------------------
// Pending administrative actions
// ---------------------------------------------------------------------------------------

/**
 * Administrator tasks. Operational work (fieldwork assignments, temporary responsibility,
 * Supervisor handovers) belongs to the Supervisor workflow and is not listed here.
 */
export type PendingActionKind = 'session_recovery'

export interface PendingAction {
  id: string
  kind: PendingActionKind
  employee: PersonRef & { role: UserRole }
  /** When the task started (request time). */
  at: string
  /** The device session. */
  subject: string
}

/** Tasks waiting on an Administrator, oldest first. */
export function pendingAdministrativeActions(recoveries: readonly OpenRecovery[]): PendingAction[] {
  return recoveries
    .map((recovery): PendingAction => ({
      id: recovery.id,
      kind: 'session_recovery',
      employee: recovery.employee,
      at: recovery.requestedAt,
      subject: recovery.sessionId,
    }))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}

/**
 * Keeps an account out of "Users requiring attention" when its only issue is already a
 * pending action: revoked sessions whose recovery has been requested.
 */
export function withoutPendingDuplicates(rows: readonly AttentionRow[], actions: readonly PendingAction[]): AttentionRow[] {
  const recovering = new Set(actions.filter((action) => action.kind === 'session_recovery').map((action) => action.employee.id))
  return rows.flatMap((row) => {
    if (!recovering.has(row.user.id) || !row.reasons.includes('sessions_revoked')) return [row]
    const reasons = row.reasons.filter((reason) => reason !== 'sessions_revoked')
    return reasons.length === 0 ? [] : [{ ...row, reasons }]
  })
}
