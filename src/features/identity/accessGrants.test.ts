import { describe, expect, it } from 'vitest'
import { FixtureStore } from '@/fixtures'
import { isAppError } from '@/shared/api'
import { fixedClock } from '@/shared/utilities/clock'
import {
  EMPTY_GRANT_DRAFT,
  ROLE_GRANT_POLICY,
  displayGrantStatus,
  endActionFor,
  grantRequestFromDraft,
  isExpiringSoon,
  validateGrantDraft,
  type AccessGrant,
  type GrantContext,
  type GrantDraft,
  type GrantEmployee,
} from './domain/accessGrants'
import { PERMISSIONS, permissionModule, permissionScopeRestriction, rolesWithPermission, ROLE_PERMISSIONS_CONFIGURABLE } from './domain/roles'
import { createAccessGrantUseCases } from './application/accessGrantUseCases'
import { createFixtureAccessGrantAdapter } from './infrastructure/fixtureAccessGrantAdapter'
import { createPendingAccessGrantAdapter } from './infrastructure/pendingAccessGrantAdapter'

const NOW = new Date('2026-10-21T10:00:00+05:30')
const clock = fixedClock('2026-10-21T10:00:00+05:30')
const DIVISION_ESTATE: Record<string, string> = { 'DIV-001': 'EST-001', 'DIV-002': 'EST-001', 'DIV-003': 'EST-001', 'DIV-004': 'EST-002' }

const supervisor: GrantEmployee = { id: 'USR-003', role: 'SUPERVISOR', status: 'active', estateIds: ['EST-002'], divisionIds: [] }
const fieldWorker: GrantEmployee = { id: 'USR-007', role: 'FIELD_WORKER', status: 'active', estateIds: [], divisionIds: ['DIV-001', 'DIV-002'] }

const context = (employee: GrantContext['employee'], existing: AccessGrant[] = []): GrantContext => ({
  actorId: 'USR-001',
  employee: employee ? { ...employee, estateIds: [...employee.estateIds], divisionIds: [...employee.divisionIds] } : null,
  divisionEstate: (id) => DIVISION_ESTATE[id],
  now: NOW,
  existing,
})

const draft = (patch: Partial<GrantDraft>): GrantDraft => ({
  ...EMPTY_GRANT_DRAFT,
  employeeId: 'USR-003',
  type: 'additional_estate',
  estateIds: ['EST-003'],
  startsAt: '2026-10-22T08:00',
  expiresAt: '2026-10-24T17:00',
  reason: 'Cover for leave',
  ...patch,
})

const grant = (patch: Partial<AccessGrant>): AccessGrant => ({
  id: 'TAG-001',
  employee: { id: 'USR-003', fullName: 'Malini Fernando', role: 'SUPERVISOR' },
  type: 'additional_estate',
  estateIds: ['EST-003'],
  divisionIds: [],
  startsAt: '2026-10-20T08:00:00+05:30',
  expiresAt: '2026-10-25T08:00:00+05:30',
  status: 'active',
  reason: 'Cover',
  requestedBy: { id: 'USR-001', fullName: 'Anika Perera' },
  requestedAt: '2026-10-19T08:00:00+05:30',
  decidedBy: null,
  decidedAt: null,
  endedBy: null,
  endedAt: null,
  endReason: null,
  ...patch,
})

describe('permission registry', () => {
  it('derives module, roles and scope restriction for every permission', () => {
    for (const permission of PERMISSIONS) {
      expect(permission.description.length).toBeGreaterThan(10)
      expect(() => permissionModule(permission.code)).not.toThrow()
    }
    expect(permissionModule('review.quarantine.decide_scoped')).toBe('Review')
    expect(rolesWithPermission('identity.users.manage')).toEqual(['ADMINISTRATOR'])
    expect(permissionScopeRestriction('capture.own.read')).toMatch(/own records/)
    expect(permissionScopeRestriction('cases.catalog.read')).toMatch(/Not limited/)
    expect(ROLE_PERMISSIONS_CONFIGURABLE).toBe(false)
  })
})

describe('temporary access rules', () => {
  it('offers nothing to Administrators and additional estates to Supervisors and Disease Experts', () => {
    expect(ROLE_GRANT_POLICY.ADMINISTRATOR.options).toEqual([])
    expect(ROLE_GRANT_POLICY.SUPERVISOR.options.map((option) => option.type)).toEqual(['additional_estate'])
    expect(ROLE_GRANT_POLICY.DISEASE_EXPERT.options.map((option) => option.type)).toEqual(['additional_estate'])
    expect(ROLE_GRANT_POLICY.DISEASE_EXPERT.pending).toMatch(/case-access contract/)
    expect(ROLE_GRANT_POLICY.FIELD_WORKER.options.map((option) => option.type)).toEqual(['additional_division'])
    expect(ROLE_GRANT_POLICY.FIELD_WORKER.note).toMatch(/Mobile app only/)
    expect(ROLE_GRANT_POLICY.REPORTING_USER.pending).toMatch(/pending team decision/)
  })

  it('accepts a complete supervisor request and converts it to ISO instants', () => {
    expect(validateGrantDraft(draft({}), context(supervisor))).toEqual({})
    const request = grantRequestFromDraft(draft({}))
    expect(request.estateIds).toEqual(['EST-003'])
    expect(request.divisionIds).toEqual([])
    expect(new Date(request.startsAt).getTime()).toBe(new Date('2026-10-22T08:00').getTime())
  })

  it('rejects self-grants, inactive accounts and Administrators', () => {
    expect(validateGrantDraft(draft({ employeeId: 'USR-001' }), { ...context({ ...supervisor, id: 'USR-001' }) }).employeeId).toMatch(/yourself/)
    expect(validateGrantDraft(draft({}), context({ ...supervisor, status: 'inactive' })).employeeId).toMatch(/not active/)
    expect(validateGrantDraft(draft({ employeeId: 'USR-099' }), context({ ...supervisor, id: 'USR-099', role: 'ADMINISTRATOR' })).employeeId).toMatch(
      /cannot receive temporary access/,
    )
  })

  it('rejects scope already held, other estates for Field Workers and the wrong type', () => {
    expect(validateGrantDraft(draft({ estateIds: ['EST-002'] }), context(supervisor)).estateIds).toMatch(/already holds/)
    expect(validateGrantDraft(draft({ type: 'additional_division', estateIds: [] }), context(supervisor)).type).toMatch(/not available/)
    const fw = draft({ employeeId: 'USR-007', type: 'additional_division', estateIds: [], divisionIds: ['DIV-004'] })
    expect(validateGrantDraft(fw, context(fieldWorker)).divisionIds).toMatch(/assigned estate/)
    expect(validateGrantDraft({ ...fw, divisionIds: ['DIV-003'] }, context(fieldWorker))).toEqual({})
  })

  it('checks the period, the reason and overlaps with open grants', () => {
    expect(validateGrantDraft(draft({ startsAt: '2026-10-20T08:00' }), context(supervisor)).startsAt).toMatch(/past/)
    expect(validateGrantDraft(draft({ expiresAt: '2026-10-22T07:00' }), context(supervisor)).expiresAt).toMatch(/after the start/)
    expect(validateGrantDraft(draft({ reason: '  ' }), context(supervisor)).reason).toBeDefined()
    expect(validateGrantDraft(draft({}), context(supervisor, [grant({})])).estateIds).toMatch(/already covers/)
    expect(validateGrantDraft(draft({}), context(supervisor, [grant({ status: 'revoked' })]))).toEqual({})
  })

  it('shows an elapsed grant as expired, never promotes a status, and picks the end action', () => {
    expect(displayGrantStatus(grant({ expiresAt: '2026-10-21T09:00:00+05:30' }), NOW)).toBe('expired')
    expect(displayGrantStatus(grant({ status: 'pending_approval', startsAt: '2026-10-20T08:00:00+05:30' }), NOW)).toBe('pending_approval')
    expect(isExpiringSoon(grant({ expiresAt: '2026-10-21T20:00:00+05:30' }), NOW)).toBe(true)
    expect(isExpiringSoon(grant({}), NOW)).toBe(false)
    expect(endActionFor(grant({}), NOW)).toBe('revoke')
    expect(endActionFor(grant({ status: 'scheduled' }), NOW)).toBe('cancel')
    expect(endActionFor(grant({ status: 'pending_approval' }), NOW)).toBe('cancel')
    expect(endActionFor(grant({ status: 'rejected' }), NOW)).toBeNull()
  })
})

describe('temporary access adapters', () => {
  const request = { employeeId: 'USR-003', type: 'additional_estate' as const, estateIds: ['EST-003'], divisionIds: [], startsAt: '2026-10-22T02:30:00.000Z', expiresAt: '2026-10-24T11:30:00.000Z', reason: 'Cover for leave' }

  function fixture(actorId: string | null = 'USR-001') {
    const store = new FixtureStore({ latencyMs: 0 })
    return { store, port: createFixtureAccessGrantAdapter(store, { clock, actorId: () => actorId }) }
  }

  const kindOf = async (promise: Promise<unknown>) => {
    try {
      await promise
      return 'resolved'
    } catch (error) {
      return isAppError(error) ? error.kind : 'unknown'
    }
  }

  it('starts empty and always records a request as Pending approval, with history', async () => {
    const { port } = fixture()
    expect(await port.listGrants()).toEqual([])
    const created = await port.requestGrant(request)
    expect(created.status).toBe('pending_approval')
    expect(created.decidedBy).toBeNull()
    expect((await port.listGrants()).map((item) => item.status)).toEqual(['pending_approval'])
    const history = await port.listAccessHistory()
    expect(history[0]).toMatchObject({ action: 'temporary_requested', performedBy: { id: 'USR-001' }, result: 'success' })
  })

  it('refuses non-administrators, self-grants, inactive accounts and overlapping requests', async () => {
    expect(await kindOf(fixture('USR-003').port.requestGrant(request))).toBe('forbidden')
    expect(await kindOf(fixture('USR-003').port.listGrants())).toBe('forbidden')
    const { port, store } = fixture()
    expect(await kindOf(port.requestGrant({ ...request, employeeId: 'USR-001' }))).toBe('validation')
    store.write((db) => {
      db.users.find((user) => user.id === 'USR-002')!.status = 'inactive'
    })
    expect(await kindOf(port.requestGrant({ ...request, employeeId: 'USR-002' }))).toBe('validation')
    expect(await kindOf(port.requestGrant({ ...request, employeeId: 'USR-007', type: 'additional_division', estateIds: [], divisionIds: ['DIV-004'] }))).toBe(
      'validation',
    )
    await port.requestGrant(request)
    expect(await kindOf(port.requestGrant(request))).toBe('conflict')
  })

  it('cancels a pending request but cannot revoke it, and records the cancellation', async () => {
    const { port } = fixture()
    const created = await port.requestGrant(request)
    expect(await kindOf(port.endGrant(created.id, 'revoke', 'No longer needed'))).toBe('conflict')
    const cancelled = await port.endGrant(created.id, 'cancel', 'No longer needed')
    expect(cancelled).toMatchObject({ status: 'cancelled', endReason: 'No longer needed', endedBy: { id: 'USR-001' } })
    // Newest first; the seed's own identity audit records (scope change, device revocation) come after.
    expect((await port.listAccessHistory()).map((entry) => entry.action)).toEqual(['temporary_cancelled', 'temporary_requested', 'permanent_scope_changed', 'device_access_revoked'])
  })

  it('reports every operation as a pending contract in API mode and validates before sending', async () => {
    const port = createPendingAccessGrantAdapter()
    expect(await kindOf(port.listGrants())).toBe('contract_pending')
    expect(await kindOf(port.requestGrant(request))).toBe('contract_pending')
    expect(await kindOf(port.endGrant('TAG-001', 'revoke', 'x'))).toBe('contract_pending')
    expect(await kindOf(port.listAccessHistory())).toBe('contract_pending')
    const useCases = createAccessGrantUseCases(port)
    expect(await kindOf(useCases.requestGrant({ ...request, reason: ' ' }))).toBe('validation')
    expect(await kindOf(useCases.endGrant('TAG-001', 'revoke', ''))).toBe('validation')
  })
})
