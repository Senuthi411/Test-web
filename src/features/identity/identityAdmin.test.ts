import { describe, expect, it } from 'vitest'
import { FIXTURE_DEV_PASSWORD, FIXTURE_REFERENCE_DATE, FixtureStore } from '@/fixtures'
import { createAccountUseCases, createAuthUseCases, createBrowserSessionPersistence, createIdentityAdminUseCases } from '@/features/identity'
import { createIdentityFixtureAdapters } from '@/features/identity/fixtures'
import { createIdentityHttpAdapters } from '@/features/identity/http'
import type { HttpClient } from '@/shared/api'
import { fixedClock } from '@/shared/utilities/clock'
import { describeScopeChange, effectiveScope, normaliseScope, scopeLevelFor } from './domain/scope'
import { validatePasswordChange, validateUserDraft } from './domain/rules'

function setup() {
  const store = new FixtureStore({ latencyMs: 0 })
  const adapters = createIdentityFixtureAdapters(store, { clock: fixedClock(FIXTURE_REFERENCE_DATE), actorId: () => 'USR-001' })
  return {
    store,
    admin: createIdentityAdminUseCases(adapters.admin),
    account: createAccountUseCases(adapters.account),
    auth: createAuthUseCases(adapters.auth, createBrowserSessionPersistence(), 'fixtures'),
  }
}

const topology = {
  estates: [
    { id: 'EST-001', name: 'Highland Tea Estate' },
    { id: 'EST-002', name: 'Riverbend Tea Estate' },
    { id: 'EST-003', name: 'Mist Valley Tea Estate' },
  ],
  divisions: Array.from({ length: 9 }, (_, index) => ({
    id: `DIV-00${index + 1}`,
    name: `Division ${index + 1}`,
    estateId: `EST-00${Math.floor(index / 3) + 1}`,
  })),
}

describe('scope rules', () => {
  it('assigns field workers at division level, experts and supervisors at estate level', () => {
    expect(scopeLevelFor('FIELD_WORKER')).toBe('division')
    expect(scopeLevelFor('SUPERVISOR')).toBe('estate')
    expect(scopeLevelFor('DISEASE_EXPERT')).toBe('estate')
    expect(scopeLevelFor('ADMINISTRATOR')).toBe('all_estates')
  })

  it('computes the ID-08 effective scope ("2 of 3", "6 of 9", Mist Valley unassigned)', () => {
    const scope = effectiveScope('estate', { estateIds: ['EST-001', 'EST-002'], divisionIds: [] }, topology)
    expect(scope.estates).toEqual({ covered: 2, total: 3 })
    expect(scope.divisions).toEqual({ covered: 6, total: 9 })
    expect(scope.unassignedEstates.map((estate) => estate.id)).toEqual(['EST-003'])
  })

  it('describes a scope change in the words of the ID-08 confirmation', () => {
    expect(
      describeScopeChange(
        'estate',
        { estateIds: ['EST-001', 'EST-002'], divisionIds: [] },
        { estateIds: ['EST-001', 'EST-002', 'EST-003'], divisionIds: [] },
        topology,
      ),
    ).toBe('Add EST-003 Mist Valley to estate-level scope')
  })

  it('drops identifiers that do not belong to the scope level', () => {
    expect(normaliseScope('division', { estateIds: ['EST-001'], divisionIds: ['DIV-002', 'DIV-001'] }, topology)).toEqual({
      estateIds: [],
      divisionIds: ['DIV-001', 'DIV-002'],
    })
  })
})

describe('form validation', () => {
  const estateOf = (id: string) => topology.divisions.find((division) => division.id === id)?.estateId

  it('requires a division for a field worker (ID-05, SCN-422)', () => {
    const errors = validateUserDraft(
      { fullName: 'Test Worker', email: 'test.worker@example.test', role: 'FIELD_WORKER', status: 'active', estateId: 'EST-001', divisionIds: [] },
      estateOf,
    )
    expect(errors).toEqual({ divisionIds: 'Division is required' })
  })

  it('rejects divisions from another estate and an invalid email', () => {
    const errors = validateUserDraft(
      { fullName: 'Test', email: 'not-an-email', role: 'FIELD_WORKER', status: 'active', estateId: 'EST-001', divisionIds: ['DIV-004'] },
      estateOf,
    )
    expect(errors).toMatchObject({ email: 'Enter a valid email address', divisionIds: 'Divisions must belong to the selected estate' })
  })

  it('checks the password rules from ID-14', () => {
    expect(validatePasswordChange({ currentPassword: 'x', newPassword: 'long-enough-pass', confirmPassword: '' })).toEqual({
      confirmPassword: 'Confirm your new password',
    })
    expect(validatePasswordChange({ currentPassword: 'x', newPassword: 'long-enough-pass', confirmPassword: 'different-pass' })).toEqual({
      confirmPassword: 'Passwords do not match',
    })
    expect(validatePasswordChange({ currentPassword: '', newPassword: 'short', confirmPassword: 'short' })).toMatchObject({
      currentPassword: 'Enter your current password',
      newPassword: 'Use at least 12 characters',
    })
  })
})

describe('fixture identity administration', () => {
  it('derives the ID-02 dashboard from the dataset', async () => {
    const { admin } = setup()
    const dashboard = await admin.getDashboard()
    expect(dashboard.activeUsers).toBe(13)
    expect(dashboard.estates).toHaveLength(3)
    expect(dashboard.divisionCount).toBe(9)
    expect(dashboard.activeDeviceSessions).toBe(5)
    expect(dashboard.revokedSessionsThisWeek).toBe(1)
    expect(dashboard.usersByRole.map((entry) => entry.count)).toEqual([6, 3, 2, 1, 1])
    expect(dashboard.attention.map((row) => [row.user.id, row.status])).toEqual([
      ['USR-007', 'active'],
      ['USR-011', 'session_revoked'],
      ['USR-006', 'active'],
      ['USR-004', 'active'],
    ])
    expect(dashboard.recentActivity[0]).toMatchObject({ title: 'Scope updated for Dr Tara Wijesinghe', detail: 'EST-001, EST-002' })
  })

  it('derives the ID-10 estate KPIs and ID-12 division counts', async () => {
    const { admin } = setup()
    const riverbend = await admin.getEstate('EST-002')
    expect(riverbend.stats).toEqual({ observations: 15, pendingReview: 5, correctionsRequested: 2, expertConfirmedCases: 2 })
    expect(riverbend.estate).toMatchObject({ supervisor: { id: 'USR-003' }, expert: { id: 'USR-005' } })
    const highland = await admin.getEstate('EST-001')
    expect(highland.stats).toEqual({ observations: 18, pendingReview: 9, correctionsRequested: 0, expertConfirmedCases: 1 })
    const mist = await admin.getEstate('EST-003')
    expect(mist.stats).toEqual({ observations: 15, pendingReview: 7, correctionsRequested: 1, expertConfirmedCases: 1 })

    const divisions = await admin.listDivisions()
    expect(divisions.map((division) => division.pendingReviewCount)).toEqual([5, 3, 1, 3, 1, 1, 4, 1, 2])

    const westTerrace = await admin.getDivision('DIV-006')
    expect(westTerrace.expertConfirmedCaseIds).toEqual(['CASE-006', 'CASE-042'])
    expect(westTerrace.recentObservations).toHaveLength(5)
    expect(westTerrace.supervisor?.id).toBe('USR-003')
  })

  it('creates a scoped user as USR-014, visible on every screen, and records it', async () => {
    const { admin } = setup()
    const created = await admin.createUser({
      fullName: '  Test Worker ',
      email: 'Test.Worker@Example.test',
      role: 'FIELD_WORKER',
      status: 'active',
      scope: { estateIds: [], divisionIds: ['DIV-001'] },
    })
    expect(created).toMatchObject({ id: 'USR-014', fullName: 'Test Worker', email: 'test.worker@example.test', divisionIds: ['DIV-001'], version: 1 })
    expect((await admin.listUsers()).some((user) => user.id === 'USR-014')).toBe(true)
    expect((await admin.getDivision('DIV-001')).division.fieldWorkers.map((worker) => worker.id)).toContain('USR-014')
    const dashboard = await admin.getDashboard()
    expect(dashboard.activeUsers).toBe(14)
    expect(dashboard.recentActivity[0]?.title).toBe('User created: Test Worker')
  })

  it('rejects a duplicate email and a missing division without changing the dataset', async () => {
    const { admin } = setup()
    await expect(
      admin.createUser({ fullName: 'Copy', email: 'anika.perera@example.test', role: 'SUPERVISOR', status: 'active', scope: { estateIds: ['EST-001'], divisionIds: [] } }),
    ).rejects.toMatchObject({ kind: 'validation', details: [{ path: 'email' }] })
    await expect(
      admin.createUser({ fullName: 'No Scope', email: 'no.scope@example.test', role: 'FIELD_WORKER', status: 'active', scope: { estateIds: [], divisionIds: [] } }),
    ).rejects.toMatchObject({ kind: 'validation' })
    expect(await admin.listUsers()).toHaveLength(13)
  })

  it('updates a scope with a reason and rejects a stale version with 409', async () => {
    const { admin } = setup()
    const before = (await admin.getUser('USR-005')).user
    const updated = await admin.updateUserScope('USR-005', {
      scope: { estateIds: ['EST-001', 'EST-002', 'EST-003'], divisionIds: [] },
      reason: 'Cover Mist Valley referrals',
      expectedVersion: before.version,
    })
    expect(updated.estateIds).toEqual(['EST-001', 'EST-002', 'EST-003'])
    expect(updated.version).toBe(before.version + 1)

    await expect(
      admin.updateUserScope('USR-005', { scope: { estateIds: ['EST-001'], divisionIds: [] }, reason: 'Stale edit', expectedVersion: before.version }),
    ).rejects.toMatchObject({ kind: 'conflict' })
    expect((await admin.getUser('USR-005')).user.estateIds).toEqual(['EST-001', 'EST-002', 'EST-003'])
  })

  it('requires a reason for a privileged scope change', async () => {
    const { admin } = setup()
    await expect(
      admin.updateUserScope('USR-005', { scope: { estateIds: ['EST-001'], divisionIds: [] }, reason: '   ', expectedVersion: 1 }),
    ).rejects.toMatchObject({ kind: 'validation' })
  })

  it('rejects malformed emails before creating or updating a user', async () => {
    const { admin } = setup()
    const input = { fullName: 'Invalid Email', email: 'invalid', role: 'ADMINISTRATOR' as const, status: 'active' as const, scope: { estateIds: [], divisionIds: [] } }
    await expect(admin.createUser(input)).rejects.toMatchObject({ kind: 'validation', details: [{ path: 'email' }] })
    await expect(admin.updateUser('USR-001', { ...input, expectedVersion: 1 })).rejects.toMatchObject({ kind: 'validation', details: [{ path: 'email' }] })
    expect(await admin.listUsers()).toHaveLength(13)
    expect((await admin.getUser('USR-001')).user.email).toBe('anika.perera@example.test')
  })

  it('preserves required scope when an empty assignment is submitted', async () => {
    const { admin } = setup()
    for (const id of ['USR-005', 'USR-007']) {
      const before = (await admin.getUser(id)).user
      await expect(admin.updateUserScope(id, { scope: { estateIds: [], divisionIds: [] }, reason: 'Remove scope', expectedVersion: before.version })).rejects.toMatchObject({ kind: 'validation' })
      expect((await admin.getUser(id)).user).toEqual(before)
    }
  })

  it('revokes an active device session once and opens a controlled recovery', async () => {
    const { admin } = setup()
    const revoked = await admin.revokeDeviceSession('DS-3091')
    expect(revoked).toMatchObject({ status: 'revoked', revokedReasonCode: 'DEVICE_SESSION_REVOKED' })
    await expect(admin.revokeDeviceSession('DS-3091')).rejects.toMatchObject({ kind: 'conflict' })
    expect((await admin.getDashboard()).activeDeviceSessions).toBe(4)

    await expect(admin.requestSessionRecovery('DS-3088')).rejects.toMatchObject({ kind: 'conflict' })
    const request = await admin.requestSessionRecovery('DS-3012')
    expect(request).toMatchObject({ id: 'REC-DS-3012', requestedBy: { id: 'USR-001' }, steps: ['done', 'pending', 'open', 'not_issued', 'waiting'] })
    expect(await admin.getRecoveryRequest('DS-3012')).toMatchObject({ id: 'REC-DS-3012' })
    // The revoked session itself is never reactivated.
    expect((await admin.listDeviceSessions()).find((session) => session.id === 'DS-3012')?.status).toBe('revoked')
  })

  it('adds estates and divisions with the next identifiers and confirms status changes', async () => {
    const { admin } = setup()
    const estate = await admin.createEstate({ name: 'Hill Crest Tea Estate', region: 'Matale', status: 'active' })
    expect(estate).toMatchObject({ id: 'EST-004', divisionCount: 0, observationCount: 0 })
    const division = await admin.createDivision({ name: 'Ridge', estateId: 'EST-004', status: 'active' })
    expect(division.id).toBe('DIV-010')
    await expect(admin.createDivision({ name: 'ridge', estateId: 'EST-004', status: 'active' })).rejects.toMatchObject({ kind: 'validation' })
    const disabled = await admin.updateDivision('DIV-010', { name: 'Ridge', status: 'inactive' })
    expect(disabled.status).toBe('inactive')
    expect((await admin.getEstate('EST-004')).estate.divisionCount).toBe(1)
  })

  it('never produces an export file in fixture mode', async () => {
    const { admin } = setup()
    await expect(admin.exportData('users')).resolves.toEqual({ simulated: true })
  })
})

describe('fixture account', () => {
  it('changes the password, so only the new one signs in', async () => {
    const { account, auth } = setup()
    await expect(account.changePassword('USR-001', { currentPassword: 'wrong', newPassword: 'a-new-password-1' })).rejects.toMatchObject({
      kind: 'validation',
      details: [{ path: 'currentPassword' }],
    })
    await account.changePassword('USR-001', { currentPassword: FIXTURE_DEV_PASSWORD, newPassword: 'a-new-password-1' })
    await expect(auth.signIn({ identifier: 'anika.perera', password: FIXTURE_DEV_PASSWORD, remember: false })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    })
    await expect(auth.signIn({ identifier: 'anika.perera', password: 'a-new-password-1', remember: false })).resolves.toMatchObject({
      user: { id: 'USR-001' },
    })
  })

  it('saves the profile name and notification preferences', async () => {
    const { account } = setup()
    const profile = await account.getProfile('USR-001')
    expect(profile.notificationPreferences).toEqual({ reviewEscalations: true, deviceSessionAlerts: true, weeklySummary: false })
    expect((await account.updateProfile('USR-001', { fullName: 'Anika P. Perera', language: 'en' })).user.fullName).toBe('Anika P. Perera')
    expect(await account.setNotificationPreference('USR-001', 'weeklySummary', true)).toMatchObject({ weeklySummary: true })
    await expect(account.updateProfile('USR-001', { fullName: ' ', language: 'en' })).rejects.toMatchObject({ kind: 'validation' })
  })
})

describe('API-mode identity adapters', () => {
  it('report every operation as contract pending and send no request', async () => {
    const request = () => {
      throw new Error('no request may be sent')
    }
    const http = { request, get: request, post: request, put: request, patch: request, delete: request } as unknown as HttpClient
    const adapters = createIdentityHttpAdapters(http)
    await expect(adapters.admin.listUsers()).rejects.toMatchObject({ kind: 'contract_pending' })
    await expect(adapters.admin.getDashboard()).rejects.toMatchObject({ kind: 'contract_pending' })
    await expect(adapters.admin.revokeDeviceSession('DS-3091')).rejects.toMatchObject({ kind: 'contract_pending' })
    await expect(adapters.account.getProfile('USR-001')).rejects.toMatchObject({ kind: 'contract_pending' })
  })
})
