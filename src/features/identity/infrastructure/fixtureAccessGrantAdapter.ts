import { newestFirst } from '../domain/chronology'
import { AppError } from '@/shared/api'
import type { FixtureAuditEvent, FixtureStore, FixtureUser } from '@/fixtures'
import { ROLE_LABELS, type UserId, type UserRole } from '@/shared/types'
import type { Clock } from '@/shared/utilities/clock'
import {
  estatesOfDivisions,
  isOpenGrant,
  ROLE_GRANT_POLICY,
  type AccessGrant,
  type AccessHistoryEntry,
  type GrantRequestInput,
} from '../domain/accessGrants'
import type { AccessGrantPort } from '../application/ports'

export interface FixtureAccessGrantOptions {
  clock: Clock
  /** The signed-in user, who requests or ends grants. */
  actorId: () => UserId | null
}

const STATUS_LABEL = { active: 'Active', inactive: 'Inactive' } as const
const roleLabel = (value: string | undefined) => (value && value in ROLE_LABELS ? ROLE_LABELS[value as UserRole] : null)

/** The access-history form of an audit record, for identity and authorization changes only. */
function identityChange(event: FixtureAuditEvent): Pick<AccessHistoryEntry, 'action' | 'previousAccess' | 'newAccess'> | null {
  switch (event.kind) {
    case 'role_changed':
      return { action: 'permanent_role_changed', previousAccess: roleLabel(event.previousValue), newAccess: roleLabel(event.newValue) }
    case 'scope_updated':
      return { action: 'permanent_scope_changed', previousAccess: event.previousValue || null, newAccess: event.scope?.join(', ') ?? null }
    case 'account_status_changed':
      return {
        action: event.status === 'active' ? 'account_enabled' : 'account_disabled',
        previousAccess: event.previousValue === 'active' || event.previousValue === 'inactive' ? STATUS_LABEL[event.previousValue] : null,
        newAccess: event.status ? STATUS_LABEL[event.status] : null,
      }
    case 'device_session_revoked':
      return { action: 'device_access_revoked', previousAccess: null, newAccess: event.sessionId ? `Device session ${event.sessionId} revoked` : null }
    default:
      return null
  }
}

const invalid = (path: string, message: string) => new AppError('validation', message, { code: 'VALIDATION_FAILED', details: [{ path, message }] })
const forbidden = (message: string) => new AppError('forbidden', message, { code: 'FORBIDDEN' })

/**
 * DEMONSTRATION DATA ONLY (fixture mode). Starts with no grants and no grant history:
 * nothing is invented. Requests made in this tab are kept in memory and ALWAYS stay
 * "Pending approval", because no approval authority has been agreed; nothing here
 * approves, activates or enforces access. API mode never loads this file.
 */
export function createFixtureAccessGrantAdapter(store: FixtureStore, options: FixtureAccessGrantOptions): AccessGrantPort {
  const grants: AccessGrant[] = []
  const history: AccessHistoryEntry[] = []
  let sequence = 0

  const now = () => options.clock.now()
  const ref = (user: FixtureUser) => ({ id: user.id, fullName: user.fullName })
  const userById = (id: string | null) => (id ? store.read((db) => db.users.find((user) => user.id === id)) : undefined)

  /** Only an active Administrator may manage grants. */
  function requireAdministrator(): FixtureUser {
    const actor = userById(options.actorId())
    if (!actor || actor.role !== 'ADMINISTRATOR' || actor.status !== 'active') throw forbidden('Only an active Administrator can manage temporary access.')
    return actor
  }

  const scopeLabel = (grant: Pick<AccessGrant, 'estateIds' | 'divisionIds'>) => [...grant.estateIds, ...grant.divisionIds].join(', ')

  function record(grant: AccessGrant, action: AccessHistoryEntry['action'], actor: FixtureUser, reason: string) {
    // Newest first, so entries recorded at the same instant keep their real order.
    history.unshift({
      id: `AH-${String(history.length + 1).padStart(3, '0')}`,
      at: now().toISOString(),
      employee: grant.employee,
      action,
      previousAccess: null,
      newAccess: `${scopeLabel(grant)} · ${grant.startsAt} – ${grant.expiresAt}`,
      performedBy: ref(actor),
      reason,
      result: 'success',
    })
  }

  function checkRequest(input: GrantRequestInput, actor: FixtureUser): FixtureUser {
    const employee = userById(input.employeeId)
    if (!employee) throw invalid('employeeId', 'Select an existing employee')
    if (employee.id === actor.id) throw invalid('employeeId', 'You cannot grant temporary access to yourself')
    if (employee.status !== 'active') throw invalid('employeeId', 'This account is not active, so it cannot receive temporary access')
    const policy = ROLE_GRANT_POLICY[employee.role]
    if (!policy.options.some((option) => option.type === input.type)) throw invalid('type', 'This access type is not available for the employee’s role')

    const { estates, divisions } = store.read((db) => ({ estates: db.estates, divisions: db.divisions }))
    const divisionEstate = (id: string) => divisions.find((division) => division.id === id)?.estateId
    if (input.type === 'additional_estate') {
      if (input.estateIds.length === 0 || input.divisionIds.length > 0) throw invalid('estateIds', 'Select at least one estate')
      if (input.estateIds.some((id) => !estates.some((estate) => estate.id === id))) throw invalid('estateIds', 'Select existing estates')
      if (input.estateIds.some((id) => employee.estateIds.includes(id))) throw invalid('estateIds', 'The employee already holds this estate')
    } else {
      if (input.divisionIds.length === 0 || input.estateIds.length > 0) throw invalid('divisionIds', 'Select at least one division')
      if (input.divisionIds.some((id) => !divisionEstate(id))) throw invalid('divisionIds', 'Select existing divisions')
      if (input.divisionIds.some((id) => employee.divisionIds.includes(id))) throw invalid('divisionIds', 'The employee already holds this division')
      const own = estatesOfDivisions(employee.divisionIds, divisionEstate)
      if (employee.role === 'FIELD_WORKER' && input.divisionIds.some((id) => !own.includes(divisionEstate(id) ?? ''))) {
        throw invalid('divisionIds', 'Divisions must belong to the employee’s assigned estate')
      }
    }

    const start = Date.parse(input.startsAt)
    const expiry = Date.parse(input.expiresAt)
    if (Number.isNaN(start) || start < now().getTime() - 5 * 60 * 1000) throw invalid('startsAt', 'The start cannot be in the past')
    if (Number.isNaN(expiry) || expiry <= start) throw invalid('expiresAt', 'The expiry must be after the start')
    if (!input.reason.trim()) throw invalid('reason', 'Enter the business reason')

    const requested = new Set([...input.estateIds, ...input.divisionIds])
    const clash = grants.some(
      (grant) =>
        grant.employee.id === employee.id &&
        isOpenGrant(grant) &&
        [...grant.estateIds, ...grant.divisionIds].some((id) => requested.has(id)) &&
        Date.parse(grant.startsAt) < expiry &&
        Date.parse(grant.expiresAt) > start,
    )
    if (clash) {
      throw new AppError('conflict', 'An open grant already covers this scope in this period.', { code: 'GRANT_CONFLICT' })
    }
    return employee
  }

  return {
    listGrants(signal) {
      return store.run(() => {
        requireAdministrator()
        return grants.map((grant) => ({ ...grant }))
      }, signal)
    },

    requestGrant(input) {
      return store.run(() => {
        const actor = requireAdministrator()
        const employee = checkRequest(input, actor)
        sequence += 1
        const grant: AccessGrant = {
          id: `TAG-${String(sequence).padStart(3, '0')}`,
          employee: { ...ref(employee), role: employee.role },
          type: input.type,
          estateIds: [...input.estateIds],
          divisionIds: [...input.divisionIds],
          startsAt: input.startsAt,
          expiresAt: input.expiresAt,
          // No approval authority exists yet: a request is never approved or activated here.
          status: 'pending_approval',
          reason: input.reason.trim(),
          requestedBy: ref(actor),
          requestedAt: now().toISOString(),
          decidedBy: null,
          decidedAt: null,
          endedBy: null,
          endedAt: null,
          endReason: null,
        }
        grants.push(grant)
        record(grant, 'temporary_requested', actor, grant.reason)
        return { ...grant }
      })
    },

    endGrant(grantId, action, reason) {
      return store.run(() => {
        const actor = requireAdministrator()
        const grant = grants.find((item) => item.id === grantId)
        if (!grant) throw new AppError('not_found', 'This grant could not be found.')
        const allowed = action === 'revoke' ? grant.status === 'active' : grant.status === 'pending_approval' || grant.status === 'scheduled'
        if (!allowed) throw new AppError('conflict', 'This grant can no longer be changed.', { code: 'GRANT_STATE_CHANGED' })
        if (!reason.trim()) throw invalid('reason', 'Enter the reason')
        grant.status = action === 'revoke' ? 'revoked' : 'cancelled'
        grant.endedBy = ref(actor)
        grant.endedAt = now().toISOString()
        grant.endReason = reason.trim()
        record(grant, action === 'revoke' ? 'temporary_revoked' : 'temporary_cancelled', actor, grant.endReason)
        return { ...grant }
      })
    },

    listAccessHistory(signal) {
      return store.run(() => {
        requireAdministrator()
        // Identity changes are the fixture audit log's own records; nothing is added to them.
        const permanent = store.read((db) =>
          db.auditEvents.flatMap((event): AccessHistoryEntry[] => {
            const change = identityChange(event)
            const employee = event.userId ? db.users.find((user) => user.id === event.userId) : undefined
            if (!change || !employee) return []
            const actor = db.users.find((user) => user.id === event.actorId)
            return [
              {
                id: event.id,
                at: event.at,
                employee: { ...ref(employee), role: employee.role },
                ...change,
                performedBy: actor ? ref(actor) : null,
                reason: event.reasonCode ?? null,
                result: 'success',
              },
            ]
          }),
        )
        return [...history, ...permanent].sort(newestFirst)
      }, signal)
    },
  }
}
