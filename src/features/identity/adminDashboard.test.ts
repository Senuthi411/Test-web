import { describe, expect, it } from 'vitest'
import { FIXTURE_REFERENCE_DATE, FixtureStore } from '@/fixtures'
import type { HttpClient } from '@/shared/api'
import { fixedClock } from '@/shared/utilities/clock'
import { createIdentityFixtureAdapters } from './fixtures'
import { createIdentityHttpAdapters } from './http'
import { isCurrentlyActive, isIdentityHistoryAction, relevantGrants, summariseGrants, type AccessGrant, type AccessHistoryEntry } from './domain/accessGrants'
import {
  attentionReasons,
  pendingAdministrativeActions,
  unreportedAlertKinds,
  withoutPendingDuplicates,
  type AttentionFacts,
} from './domain/adminDashboard'
import type { AttentionRow, OpenRecovery } from './domain/models'

const NOW = new Date('2026-10-21T10:00:00+05:30')

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

/** One grant in each situation the overview must tell apart. */
const GRANTS: AccessGrant[] = [
  grant({ id: 'ACTIVE' }),
  grant({ id: 'EXPIRING', expiresAt: '2026-10-21T18:00:00+05:30' }),
  grant({ id: 'PENDING-OLD', status: 'pending_approval', startsAt: '2026-10-22T08:00:00+05:30', requestedAt: '2026-10-18T08:00:00+05:30' }),
  grant({ id: 'PENDING-NEW', status: 'pending_approval', startsAt: '2026-10-22T08:00:00+05:30', requestedAt: '2026-10-20T08:00:00+05:30' }),
  grant({ id: 'SCHEDULED', status: 'scheduled', startsAt: '2026-10-23T08:00:00+05:30' }),
  // Reported active, but past expiry or before its start: never counted as active.
  grant({ id: 'ELAPSED', expiresAt: '2026-10-21T09:00:00+05:30' }),
  grant({ id: 'NOT-STARTED', startsAt: '2026-10-22T08:00:00+05:30' }),
  grant({ id: 'EXPIRED', status: 'expired', expiresAt: '2026-10-20T09:00:00+05:30' }),
  grant({ id: 'REVOKED', status: 'revoked' }),
  grant({ id: 'REJECTED', status: 'rejected' }),
  grant({ id: 'CANCELLED', status: 'cancelled' }),
]

describe('temporary access overview', () => {
  it('counts only grants that are active inside their interval, pending requests, and active grants ending within 24 hours', () => {
    expect(summariseGrants(GRANTS, NOW)).toEqual({ active: 2, pendingApproval: 2, expiringSoon: 1 })
    expect(GRANTS.filter((item) => isCurrentlyActive(item, NOW)).map((item) => item.id)).toEqual(['ACTIVE', 'EXPIRING'])
  })

  it('excludes scheduled, expired, revoked and not-yet-started grants from the active count', () => {
    for (const id of ['SCHEDULED', 'ELAPSED', 'NOT-STARTED', 'EXPIRED', 'REVOKED', 'PENDING-OLD']) {
      expect(summariseGrants(GRANTS.filter((item) => item.id === id), NOW).active, id).toBe(0)
    }
    expect(summariseGrants([], NOW)).toEqual({ active: 0, pendingApproval: 0, expiringSoon: 0 })
  })

  it('lists pending requests first, then expiring, active and scheduled grants, leaving ended ones out', () => {
    expect(relevantGrants(GRANTS, NOW, 10).map((item) => item.id)).toEqual(['PENDING-OLD', 'PENDING-NEW', 'EXPIRING', 'ACTIVE', 'SCHEDULED'])
    expect(relevantGrants(GRANTS, NOW, 2).map((item) => item.id)).toEqual(['PENDING-OLD', 'PENDING-NEW'])
  })
})

const facts = (patch: Partial<AttentionFacts>): AttentionFacts => ({
  role: 'FIELD_WORKER',
  status: 'active',
  estateIds: [],
  divisionIds: ['DIV-001'],
  sessionStatuses: ['active'],
  inactiveScopeIds: [],
  ...patch,
})

describe('users requiring attention', () => {
  it('derives each reason from a recorded fact and nothing else', () => {
    expect(attentionReasons(facts({}))).toEqual([])
    expect(attentionReasons(facts({ status: 'inactive' }))).toEqual(['inactive'])
    expect(attentionReasons(facts({ divisionIds: [] }))).toEqual(['missing_scope'])
    expect(attentionReasons(facts({ role: 'ADMINISTRATOR', divisionIds: [] }))).toEqual([])
    expect(attentionReasons(facts({ inactiveScopeIds: ['DIV-001'] }))).toEqual(['inactive_scope'])
    expect(attentionReasons(facts({ sessionStatuses: ['revoked', 'signed_out'] }))).toEqual(['sessions_revoked'])
    expect(attentionReasons(facts({ sessionStatuses: ['revoked', 'active'] }))).toEqual([])
    // No device session at all is not an issue (e.g. web-only roles).
    expect(attentionReasons(facts({ sessionStatuses: [] }))).toEqual([])
  })
})

const recovery: OpenRecovery = {
  id: 'REC-DS-3012',
  sessionId: 'DS-3012',
  employee: { id: 'USR-011', fullName: 'Sewmi Raj', role: 'FIELD_WORKER' },
  requestedBy: { id: 'USR-001', fullName: 'Anika Perera' },
  requestedAt: '2026-10-21T09:00:00+05:30',
}

describe('pending administrative actions', () => {
  it('lists open device-session recoveries only, oldest first', () => {
    const later = { ...recovery, id: 'REC-DS-9999', requestedAt: '2026-10-21T09:50:00+05:30' }
    const actions = pendingAdministrativeActions([later, recovery])
    expect(actions.map((action) => [action.kind, action.id, action.subject])).toEqual([
      ['session_recovery', 'REC-DS-3012', 'DS-3012'],
      ['session_recovery', 'REC-DS-9999', 'DS-3012'],
    ])
    expect(pendingAdministrativeActions([])).toEqual([])
  })

  it('keeps an account out of "Users requiring attention" when its only issue is a pending recovery', () => {
    const row = (id: string, reasons: AttentionRow['reasons']): AttentionRow => ({
      user: { id, fullName: id, role: 'FIELD_WORKER', scopeIds: [] },
      status: reasons.includes('sessions_revoked') ? 'session_revoked' : 'active',
      reasons,
      lastDeviceSessionAt: null,
    })
    const rows = [row('USR-011', ['sessions_revoked']), row('USR-007', []), row('USR-012', ['sessions_revoked'])]
    const actions = pendingAdministrativeActions([recovery])
    expect(withoutPendingDuplicates(rows, actions).map((item) => item.user.id)).toEqual(['USR-007', 'USR-012'])
    // Another issue keeps the row, without the reason already handled.
    expect(withoutPendingDuplicates([row('USR-011', ['inactive', 'sessions_revoked'])], actions)[0]?.reasons).toEqual(['inactive'])
  })
})

describe('identity access history', () => {
  function setup() {
    const store = new FixtureStore({ latencyMs: 0 })
    const adapters = createIdentityFixtureAdapters(store, { clock: fixedClock(FIXTURE_REFERENCE_DATE), actorId: () => 'USR-001' })
    return { admin: adapters.admin, history: adapters.accessGrants }
  }

  const identityEntries = (entries: AccessHistoryEntry[]) => entries.filter((entry) => isIdentityHistoryAction(entry.action))

  it('records role and account-status changes made in Edit User as their own audit and history events', async () => {
    const { admin, history } = setup()
    const { user } = await admin.getUser('USR-013')
    await admin.updateUser('USR-013', {
      reason: 'Administrative scope change',
      fullName: user.fullName,
      email: user.email,
      role: 'ADMINISTRATOR',
      status: 'inactive',
      scope: { estateIds: [], divisionIds: [] },
      phone: user.phone,
      employeeId: user.employeeId,
      preferredLanguage: user.preferredLanguage,
      roleDetails: { role: 'ADMINISTRATOR', mfaRequired: true },
      expectedVersion: user.version,
    })
    const entries = identityEntries(await history.listAccessHistory()).filter((entry) => entry.employee.id === 'USR-013')
    expect(entries.map((entry) => [entry.action, entry.previousAccess, entry.newAccess])).toEqual(
      expect.arrayContaining([
        ['permanent_role_changed', 'Reporting user', 'Administrator'],
        ['account_disabled', 'Active', 'Inactive'],
      ]),
    )
    for (const entry of entries) expect(entry.performedBy).toMatchObject({ id: 'USR-001' })
  })

  it('keeps the previous permanent scope of a scope change and reports device-session revocations', async () => {
    const { admin, history } = setup()
    const before = (await admin.getUser('USR-005')).user
    await admin.updateUserScope('USR-005', { scope: { estateIds: ['EST-001'], divisionIds: [] }, reason: 'Coverage change', expectedVersion: before.version })
    const entries = identityEntries(await history.listAccessHistory())
    const scope = entries.find((entry) => entry.action === 'permanent_scope_changed' && entry.employee.id === 'USR-005')
    expect(scope?.newAccess).toContain('EST-001')
    expect(scope?.previousAccess).toBeTruthy()
    expect(scope?.previousAccess).not.toBe(scope?.newAccess)
    expect(entries.find((entry) => entry.action === 'device_access_revoked')).toMatchObject({ employee: { id: 'USR-011' }, newAccess: expect.stringContaining('DS-3012') })
  })

  it('never lists fieldwork assignments as identity events', async () => {
    const { history } = setup()
    for (const entry of identityEntries(await history.listAccessHistory())) {
      expect(['permanent_role_changed', 'permanent_scope_changed', 'account_enabled', 'account_disabled', 'device_access_revoked']).toContain(entry.action)
    }
  })
})

describe('fixture dashboard sources', () => {
  function setup() {
    const store = new FixtureStore({ latencyMs: 0 })
    const adapters = createIdentityFixtureAdapters(store, { clock: fixedClock(FIXTURE_REFERENCE_DATE), actorId: () => 'USR-001' })
    return { store, admin: adapters.admin }
  }

  it('reports revoked device sessions only, and says which alert kinds it does not record', async () => {
    const { admin } = setup()
    const feed = await admin.listSecurityAlerts()
    expect(feed.reportedKinds).toEqual(['device_session_revoked'])
    expect(feed.alerts).toEqual([
      expect.objectContaining({ kind: 'device_session_revoked', sessionId: 'DS-3012', employee: expect.objectContaining({ id: 'USR-011' }), severity: null }),
    ])
    expect(unreportedAlertKinds(feed)).toEqual(['failed_sign_in', 'account_locked', 'session_flagged', 'mfa_enrollment_pending'])
  })

  it('moves a revoked session from alerts to pending actions once recovery is requested', async () => {
    const { admin } = setup()
    expect((await admin.getDashboard()).openRecoveries).toEqual([])
    await admin.requestSessionRecovery('DS-3012')
    expect((await admin.listSecurityAlerts()).alerts).toEqual([])
    const dashboard = await admin.getDashboard()
    expect(dashboard.openRecoveries).toEqual([expect.objectContaining({ sessionId: 'DS-3012', employee: expect.objectContaining({ id: 'USR-011' }) })])
    const actions = pendingAdministrativeActions(dashboard.openRecoveries)
    expect(withoutPendingDuplicates(dashboard.attention, actions).map((row) => row.user.id)).toEqual(['USR-007', 'USR-006', 'USR-004'])
  })

  it('derives division counts, attention reasons and activity actors from the dataset', async () => {
    const { admin, store } = setup()
    const dashboard = await admin.getDashboard()
    expect([dashboard.divisionCount, dashboard.activeDivisionCount]).toEqual([9, 9])
    expect(dashboard.attention.map((row) => [row.user.id, row.reasons])).toEqual([
      ['USR-007', []],
      ['USR-011', ['sessions_revoked']],
      ['USR-006', []],
      ['USR-004', []],
    ])
    expect(dashboard.recentActivity[0]?.actor).toEqual({ id: 'USR-001', fullName: 'Anika Perera' })

    // A rule that starts to apply adds the account to the list.
    store.write((db) => {
      db.users.find((user) => user.id === 'USR-009')!.status = 'inactive'
      db.divisions.find((division) => division.id === 'DIV-009')!.status = 'inactive'
    })
    const changed = await admin.getDashboard()
    expect(changed.activeDivisionCount).toBe(8)
    expect(changed.attention.slice(4).map((row) => [row.user.id, row.reasons])).toEqual([
      ['USR-009', ['inactive']],
      ['USR-012', ['inactive_scope']],
    ])
  })

  it('has no security-alert source in API mode and sends no request', async () => {
    const request = () => {
      throw new Error('no request may be sent')
    }
    const http = { request, get: request, post: request, put: request, patch: request, delete: request } as unknown as HttpClient
    await expect(createIdentityHttpAdapters(http).admin.listSecurityAlerts()).rejects.toMatchObject({ kind: 'contract_pending' })
  })
})
