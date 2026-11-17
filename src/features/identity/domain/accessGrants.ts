import type { DivisionId, EstateId, UserId, UserRole } from '@/shared/types'
import type { PersonRef } from './models'
import { REPORTING_USER_SCOPE_LEVEL } from './scope'

/**
 * Temporary access: time-limited additional SCOPE for an employee, within the capabilities
 * their role already has. A grant never adds a permission, never changes the employee's
 * role and never replaces their permanent scope.
 *
 * PENDING CONTRACT AND POLICY: the Identity API defines no grant, approval or access-history
 * operations, and no approval authority has been agreed. The backend decides every status;
 * the frontend only requests, lists and explains. See docs/api-integration/pending-contracts.md.
 */

/** Lifecycle as reported by the backend. `cancelled`: a request or scheduled grant withdrawn before it started. */
export type GrantStatus = 'pending_approval' | 'scheduled' | 'active' | 'rejected' | 'expired' | 'revoked' | 'cancelled'

export const GRANT_STATUS_LABELS: Record<GrantStatus, string> = {
  pending_approval: 'Pending approval',
  scheduled: 'Scheduled',
  active: 'Active',
  rejected: 'Rejected',
  expired: 'Expired',
  revoked: 'Revoked',
  cancelled: 'Cancelled',
}

export type GrantType = 'additional_estate' | 'additional_division'

export interface AccessGrant {
  id: string
  employee: PersonRef & { role: UserRole }
  type: GrantType
  /** Additional estates (estate-level roles). */
  estateIds: EstateId[]
  /** Additional divisions (Field Workers, inside their assigned estate). */
  divisionIds: DivisionId[]
  startsAt: string
  expiresAt: string
  status: GrantStatus
  reason: string
  requestedBy: PersonRef
  requestedAt: string
  /** Whoever approved or rejected the request, when the backend reports one. */
  decidedBy: PersonRef | null
  decidedAt: string | null
  endedBy: PersonRef | null
  endedAt: string | null
  endReason: string | null
}

export interface GrantRequestInput {
  employeeId: UserId
  type: GrantType
  estateIds: EstateId[]
  divisionIds: DivisionId[]
  startsAt: string
  expiresAt: string
  reason: string
}

/** What an employee can be granted, by role. `null`: nothing through this workflow. */
export interface GrantOption {
  type: GrantType
  label: string
}

export interface RoleGrantPolicy {
  options: readonly GrantOption[]
  /** Explanation shown in the form for this role. */
  note: string
  /** Shown as a warning: a dependency that is not decided yet. */
  pending?: string
}

export const ROLE_GRANT_POLICY: Record<UserRole, RoleGrantPolicy> = {
  ADMINISTRATOR: {
    options: [],
    note: 'Administrators already hold all estates. Temporary administrative delegation is a separate high-risk workflow and is not available here.',
  },
  SUPERVISOR: {
    options: [{ type: 'additional_estate', label: 'Additional estates' }],
    note: 'Review and quarantine permissions apply in the granted estates only, for the granted period.',
  },
  DISEASE_EXPERT: {
    options: [{ type: 'additional_estate', label: 'Additional estates' }],
    note: 'Case and diagnosis access still depends on case assignment and backend authorisation.',
    pending: 'Access to individual cases needs an approved case-access contract and is not available yet.',
  },
  FIELD_WORKER: {
    options: [{ type: 'additional_division', label: 'Additional divisions (same estate)' }],
    note: 'Mobile app only. Divisions within the assigned estate; moving to another estate uses a separate workflow. Never grants review, diagnosis or administration.',
  },
  REPORTING_USER: {
    options: [
      REPORTING_USER_SCOPE_LEVEL === 'estate'
        ? { type: 'additional_estate', label: 'Additional reporting estates' }
        : { type: 'additional_division', label: 'Additional reporting divisions' },
    ],
    note: 'Analytics and reporting only.',
    pending: 'Reporting User scope (estate, division or both) is a pending team decision; the current estate-level model is used.',
  },
}

export interface GrantDraft {
  employeeId: UserId | ''
  type: GrantType | ''
  estateIds: EstateId[]
  divisionIds: DivisionId[]
  /** Local date and time as entered (YYYY-MM-DDTHH:mm). */
  startsAt: string
  expiresAt: string
  reason: string
}

export const EMPTY_GRANT_DRAFT: GrantDraft = { employeeId: '', type: '', estateIds: [], divisionIds: [], startsAt: '', expiresAt: '', reason: '' }

export type GrantField = keyof GrantDraft

export interface GrantEmployee {
  id: UserId
  role: UserRole
  status: 'active' | 'inactive'
  estateIds: EstateId[]
  divisionIds: DivisionId[]
}

export interface GrantContext {
  /** The signed-in Administrator. */
  actorId: UserId | null
  employee: GrantEmployee | null
  /** Estate of each division. */
  divisionEstate: (id: DivisionId) => EstateId | undefined
  now: Date
  existing: readonly AccessGrant[]
}

/** Statuses that hold, or may come to hold, access. */
const OPEN_STATUSES: readonly GrantStatus[] = ['pending_approval', 'scheduled', 'active']

/** Grants whose status still matters for conflicts and actions. */
export function isOpenGrant(grant: Pick<AccessGrant, 'status'>): boolean {
  return OPEN_STATUSES.includes(grant.status)
}

/** Parses a local date-time input; null when it is not a valid date. */
export function parseLocalDateTime(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Allowed lateness of a start time, so "now" entered a minute ago is still accepted. */
const START_GRACE_MS = 5 * 60 * 1000

/** Estates a Field Worker's divisions belong to. */
export function estatesOfDivisions(divisionIds: readonly DivisionId[], divisionEstate: GrantContext['divisionEstate']): EstateId[] {
  return [...new Set(divisionIds.map(divisionEstate).filter((id): id is EstateId => Boolean(id)))]
}

/**
 * Frontend checks before a request is sent. The backend repeats them and remains the
 * authority (authorisation, approval policy, conflicts it alone can see).
 */
export function validateGrantDraft(draft: GrantDraft, context: GrantContext): Partial<Record<GrantField, string>> {
  const errors: Partial<Record<GrantField, string>> = {}
  const { employee } = context
  if (!draft.employeeId || !employee) errors.employeeId = 'Select an employee'
  else if (employee.id === context.actorId) errors.employeeId = 'You cannot grant temporary access to yourself'
  else if (employee.status !== 'active') errors.employeeId = 'This account is not active, so it cannot receive temporary access'
  else if (ROLE_GRANT_POLICY[employee.role].options.length === 0) errors.employeeId = 'This role cannot receive temporary access through this workflow'

  if (employee && !errors.employeeId) {
    const option = ROLE_GRANT_POLICY[employee.role].options.find((item) => item.type === draft.type)
    if (!draft.type) errors.type = 'Select an access type'
    else if (!option) errors.type = 'This access type is not available for the employee’s role'
    else if (draft.type === 'additional_estate') {
      if (draft.estateIds.length === 0) errors.estateIds = 'Select at least one estate'
      else if (draft.estateIds.some((id) => employee.estateIds.includes(id))) errors.estateIds = 'The employee already holds this estate'
    } else {
      const ownEstates = estatesOfDivisions(employee.divisionIds, context.divisionEstate)
      if (draft.divisionIds.length === 0) errors.divisionIds = 'Select at least one division'
      else if (draft.divisionIds.some((id) => employee.divisionIds.includes(id))) errors.divisionIds = 'The employee already holds this division'
      else if (employee.role === 'FIELD_WORKER' && draft.divisionIds.some((id) => !ownEstates.includes(context.divisionEstate(id) ?? ''))) {
        errors.divisionIds = 'Divisions must belong to the employee’s assigned estate'
      }
    }
  }

  const start = parseLocalDateTime(draft.startsAt)
  const expiry = parseLocalDateTime(draft.expiresAt)
  if (!draft.startsAt) errors.startsAt = 'Enter a start date and time'
  else if (!start) errors.startsAt = 'Enter a valid start date and time'
  else if (start.getTime() < context.now.getTime() - START_GRACE_MS) errors.startsAt = 'The start cannot be in the past'
  if (!draft.expiresAt) errors.expiresAt = 'Enter an expiry date and time'
  else if (!expiry) errors.expiresAt = 'Enter a valid expiry date and time'
  else if (start && expiry.getTime() <= start.getTime()) errors.expiresAt = 'The expiry must be after the start'

  if (!draft.reason.trim()) errors.reason = 'Enter the business reason'

  if (employee && start && expiry && !errors.employeeId && !errors.estateIds && !errors.divisionIds) {
    const requested = new Set([...draft.estateIds, ...draft.divisionIds])
    const clash = context.existing.some(
      (grant) =>
        grant.employee.id === employee.id &&
        isOpenGrant(grant) &&
        [...grant.estateIds, ...grant.divisionIds].some((id) => requested.has(id)) &&
        Date.parse(grant.startsAt) < expiry.getTime() &&
        Date.parse(grant.expiresAt) > start.getTime(),
    )
    if (clash) errors.estateIds = errors.divisionIds = 'An open grant already covers this scope in this period'
  }
  return errors
}

/** The draft as a request. Times are sent as ISO 8601 instants. */
export function grantRequestFromDraft(draft: GrantDraft): GrantRequestInput {
  const start = parseLocalDateTime(draft.startsAt)
  const expiry = parseLocalDateTime(draft.expiresAt)
  if (!draft.employeeId || !draft.type || !start || !expiry) throw new Error('Incomplete grant draft')
  return {
    employeeId: draft.employeeId,
    type: draft.type,
    estateIds: draft.type === 'additional_estate' ? [...draft.estateIds].sort() : [],
    divisionIds: draft.type === 'additional_division' ? [...draft.divisionIds].sort() : [],
    startsAt: start.toISOString(),
    expiresAt: expiry.toISOString(),
    reason: draft.reason.trim(),
  }
}

/**
 * Status to SHOW. An active grant past its expiry is shown as expired even if the backend's
 * clean-up has not run; access is never extended by the screen. Nothing is ever promoted to
 * active here: activation is the backend's decision.
 */
export function displayGrantStatus(grant: Pick<AccessGrant, 'status' | 'expiresAt'>, now: Date): GrantStatus {
  if ((grant.status === 'active' || grant.status === 'scheduled') && Date.parse(grant.expiresAt) <= now.getTime()) return 'expired'
  return grant.status
}

/** Within this time of expiry an active grant counts as "expiring soon" (list filter only). */
export const EXPIRING_SOON_MS = 24 * 60 * 60 * 1000

/**
 * Whether a grant currently holds access: the backend reports it active AND now lies inside
 * its start–expiry interval. Pending, scheduled, expired, revoked, rejected and cancelled
 * grants never count, and neither does an "active" grant before its start or after expiry.
 */
export function isCurrentlyActive(grant: Pick<AccessGrant, 'status' | 'startsAt' | 'expiresAt'>, now: Date): boolean {
  const time = now.getTime()
  return grant.status === 'active' && Date.parse(grant.startsAt) <= time && time < Date.parse(grant.expiresAt)
}

export function isExpiringSoon(grant: Pick<AccessGrant, 'status' | 'startsAt' | 'expiresAt'>, now: Date): boolean {
  const remaining = Date.parse(grant.expiresAt) - now.getTime()
  return isCurrentlyActive(grant, now) && remaining <= EXPIRING_SOON_MS
}

export interface GrantSummary {
  active: number
  pendingApproval: number
  /** Active grants that expire within EXPIRING_SOON_MS. */
  expiringSoon: number
}

export function summariseGrants(grants: readonly AccessGrant[], now: Date): GrantSummary {
  return {
    active: grants.filter((grant) => isCurrentlyActive(grant, now)).length,
    pendingApproval: grants.filter((grant) => grant.status === 'pending_approval').length,
    expiringSoon: grants.filter((grant) => isExpiringSoon(grant, now)).length,
  }
}

/**
 * The grants most worth an Administrator's attention, in order: requests waiting for
 * approval (oldest first), active grants expiring soon (soonest first), other active grants
 * (most recently started first), then scheduled grants (next to start first). Ended grants
 * are left out.
 */
export function relevantGrants(grants: readonly AccessGrant[], now: Date, limit = 5): AccessGrant[] {
  const rank = (grant: AccessGrant): [number, number] => {
    if (grant.status === 'pending_approval') return [0, Date.parse(grant.requestedAt)]
    if (isExpiringSoon(grant, now)) return [1, Date.parse(grant.expiresAt)]
    if (isCurrentlyActive(grant, now)) return [2, -Date.parse(grant.startsAt)]
    if (displayGrantStatus(grant, now) === 'scheduled') return [3, Date.parse(grant.startsAt)]
    return [9, 0]
  }
  return grants
    .map((grant) => ({ grant, rank: rank(grant) }))
    .filter((item) => item.rank[0] < 9)
    .sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1])
    .slice(0, limit)
    .map((item) => item.grant)
}

/** Which end action applies: revoke a running grant, cancel one that has not started. */
export function endActionFor(grant: Pick<AccessGrant, 'status' | 'expiresAt'>, now: Date): 'revoke' | 'cancel' | null {
  const status = displayGrantStatus(grant, now)
  if (status === 'active') return 'revoke'
  if (status === 'pending_approval' || status === 'scheduled') return 'cancel'
  return null
}

/** Access-history entries, as recorded by the backend's audit log. Read-only. */
export type AccessHistoryAction =
  | 'temporary_requested'
  | 'temporary_approved'
  | 'temporary_rejected'
  | 'temporary_activated'
  | 'temporary_expired'
  | 'temporary_revoked'
  | 'temporary_cancelled'
  | 'permanent_role_changed'
  | 'permanent_scope_changed'
  | 'account_enabled'
  | 'account_disabled'
  | 'device_access_revoked'

/**
 * Identity and authorization events shown to Administrators (dashboard activity; the full
 * record is in the Audit Logs). Temporary-access entries are operational and are not part of this view.
 */
export const IDENTITY_HISTORY_ACTIONS: readonly AccessHistoryAction[] = [
  'permanent_role_changed',
  'permanent_scope_changed',
  'account_enabled',
  'account_disabled',
  'device_access_revoked',
]

export function isIdentityHistoryAction(action: AccessHistoryAction): boolean {
  return IDENTITY_HISTORY_ACTIONS.includes(action)
}

export const ACCESS_HISTORY_ACTION_LABELS: Record<AccessHistoryAction, string> = {
  account_enabled: 'Account enabled',
  account_disabled: 'Account disabled',
  device_access_revoked: 'Device access revoked',
  temporary_requested: 'Temporary access requested',
  temporary_approved: 'Temporary access approved',
  temporary_rejected: 'Temporary access rejected',
  temporary_activated: 'Temporary access activated',
  temporary_expired: 'Temporary access expired',
  temporary_revoked: 'Temporary access revoked',
  temporary_cancelled: 'Temporary access cancelled',
  permanent_role_changed: 'Permanent role changed',
  permanent_scope_changed: 'Permanent scope changed',
}

export type AccessHistoryResult = 'success' | 'rejected' | 'failed'

export interface AccessHistoryEntry {
  id: string
  at: string
  employee: PersonRef & { role: UserRole }
  action: AccessHistoryAction
  previousAccess: string | null
  newAccess: string | null
  performedBy: PersonRef | null
  reason: string | null
  result: AccessHistoryResult
}
