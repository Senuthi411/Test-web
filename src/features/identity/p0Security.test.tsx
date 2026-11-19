import { act, render, screen } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { FIXTURE_DEV_PASSWORD, FIXTURE_REFERENCE_DATE, FixtureStore } from '@/fixtures'
import { fixedClock } from '@/shared/utilities/clock'
import type { IdentityAdminPort, UserInput } from './application/ports'
import { createAuthUseCases } from './application/authUseCases'
import { createIdentityAdminUseCases } from './application/identityUseCases'
import { createIdentityFixtureAdapters } from './fixtures'
import { createBrowserSessionPersistence } from './infrastructure/browserSessionPersistence'
import { createBrowserRememberedUserId } from './infrastructure/browserRememberedUserId'
import { SessionProvider } from './presentation/session/SessionProvider'
import { useSession } from './presentation/session/sessionContext'
import { LAST_ACTIVE_ADMINISTRATOR } from './domain/administratorSafety'

function setup() {
  const store = new FixtureStore({ latencyMs: 0 })
  let actor: string | null = 'USR-001'
  const adapters = createIdentityFixtureAdapters(store, { actorId: () => actor, clock: fixedClock(FIXTURE_REFERENCE_DATE) })
  const admin = createIdentityAdminUseCases(adapters.admin)
  const persistence = createBrowserSessionPersistence()
  const auth = createAuthUseCases(adapters.auth, persistence, 'fixtures', createBrowserRememberedUserId())
  const input = (id = 'USR-001'): UserInput & { expectedVersion: number } => store.read((db) => {
    const u = db.users.find((user) => user.id === id)!
    return { fullName: u.fullName, email: u.email, phone: u.phone, employeeId: u.employeeId,
      preferredLanguage: u.preferredLanguage, role: u.role, status: u.status, roleDetails: u.roleDetails,
      scope: { estateIds: u.estateIds, divisionIds: u.divisionIds }, expectedVersion: u.version }
  })
  const addAdministrator = () => store.write((db) => {
    const u = db.users.find((user) => user.id === 'USR-013')!
    u.role = 'ADMINISTRATOR'; u.roleDetails = { role: 'ADMINISTRATOR', mfaRequired: true }
    u.estateIds = []; u.divisionIds = []
  })
  return { store, adapters, admin, auth, persistence, input, addAdministrator, actor: (id: string | null) => { actor = id } }
}

describe('SEC-01 fixture administration authorization', () => {
  it.each([null, 'USR-MISSING', 'USR-003', 'USR-005', 'USR-013', 'USR-007'])('rejects every administrative operation for caller %s without mutations', async (actor) => {
    const s = setup()
    const input = s.input()
    const a = s.adapters.admin
    const operations = {
      getDashboard: () => a.getDashboard(), listSecurityAlerts: () => a.listSecurityAlerts(),
      listUsers: () => a.listUsers(), getUser: () => a.getUser('USR-001'),
      createUser: () => a.createUser(input), updateUser: () => a.updateUser('USR-001', input),
      updateUserScope: () => a.updateUserScope('USR-003', { scope: input.scope, reason: 'Audit', expectedVersion: 1 }),
      listEstates: () => a.listEstates(), getEstate: () => a.getEstate('EST-001'),
      createEstate: () => a.createEstate({ name: 'Test', region: 'Test', status: 'active' }),
      updateEstate: () => a.updateEstate('EST-001', { name: 'Test', region: 'Test', status: 'active' }),
      listDivisions: () => a.listDivisions(), getDivision: () => a.getDivision('DIV-001'),
      createDivision: () => a.createDivision({ name: 'Test', estateId: 'EST-001', status: 'active' }),
      updateDivision: () => a.updateDivision('DIV-001', { name: 'Test', status: 'active' }),
      listDeviceSessions: () => a.listDeviceSessions(), revokeDeviceSession: () => a.revokeDeviceSession('DS-3091'),
      getRecoveryRequest: () => a.getRecoveryRequest('DS-3091'), requestSessionRecovery: () => a.requestSessionRecovery('DS-3091'),
      exportData: () => a.exportData('users'),
    } satisfies Record<keyof IdentityAdminPort, () => Promise<unknown>>
    s.actor(actor)
    const before = s.store.read((db) => db)
    for (const operation of Object.values(operations)) await expect(operation()).rejects.toMatchObject({ kind: 'forbidden', code: 'FORBIDDEN' })
    expect(s.store.read((db) => db)).toEqual(before)
  })

  it('rejects an inactive Administrator, and rechecks the actor after request latency', async () => {
    const s = setup()
    s.store.setLatency(5)
    const request = s.admin.listUsers()
    s.store.write((db) => { db.users.find((u) => u.id === 'USR-001')!.status = 'inactive' })
    await expect(request).rejects.toMatchObject({ kind: 'forbidden' })
    await expect(s.admin.updateUser('USR-002', s.input('USR-002'))).rejects.toMatchObject({ kind: 'forbidden' })
  })

  it('allows an active Administrator to read and update another account', async () => {
    const s = setup()
    expect(await s.admin.listUsers()).toHaveLength(13)
    expect((await s.admin.updateUser('USR-002', { ...s.input('USR-002'), fullName: 'Updated supervisor' })).fullName).toBe('Updated supervisor')
  })
})

describe('SEC-02 self-service ownership', () => {
  it.each([null, 'USR-MISSING', 'USR-003'])('refuses all self-service operations on another account for caller %s', async (actor) => {
    const s = setup(); s.actor(actor)
    const a = s.adapters.account
    const before = s.store.read((db) => db)
    for (const operation of [() => a.getProfile('USR-001'),
      () => a.updateProfile('USR-001', { fullName: 'Unwanted', language: 'en' }),
      () => a.changePassword('USR-001', { currentPassword: FIXTURE_DEV_PASSWORD, newPassword: 'updated-secure-password' }),
      () => a.setNotificationPreference('USR-001', 'weeklySummary', true)]) {
      await expect(operation()).rejects.toMatchObject({ kind: 'forbidden' })
    }
    expect(s.store.read((db) => db)).toEqual(before)
  })

  it('allows a Supervisor to use all own-account operations, but not an inactive owner', async () => {
    const s = setup(); s.actor('USR-003')
    const a = s.adapters.account
    expect((await a.getProfile('USR-003')).user.id).toBe('USR-003')
    expect((await a.updateProfile('USR-003', { fullName: 'Own name', language: 'en' })).user.fullName).toBe('Own name')
    expect((await a.setNotificationPreference('USR-003', 'weeklySummary', true)).weeklySummary).toBe(true)
    await a.changePassword('USR-003', { currentPassword: FIXTURE_DEV_PASSWORD, newPassword: 'changed-secure-password' })
    await expect(s.auth.signIn({ userId: 'USR-003', password: 'changed-secure-password' }, { rememberUserId: false })).resolves.toMatchObject({ status: 'signed_in' })
    s.store.write((db) => { db.users.find((u) => u.id === 'USR-003')!.status = 'inactive' })
    await expect(a.getProfile('USR-003')).rejects.toMatchObject({ kind: 'forbidden' })
  })

  it('does not let an Administrator use self-service to edit someone else', async () => {
    const s = setup()
    await expect(s.adapters.account.updateProfile('USR-003', { fullName: 'Wrong workflow', language: 'en' })).rejects.toMatchObject({ kind: 'forbidden' })
  })
})

describe('SEC-03 last active Administrator', () => {
  it.each(['deactivation', 'demotion'])('rejects last-admin %s with no record, version or successful audit mutation', async (kind) => {
    const s = setup(); const before = s.store.read((db) => db)
    const input = s.input()
    const next: UserInput & { expectedVersion: number } = kind === 'deactivation' ? { ...input, status: 'inactive' }
      : { ...input, role: 'REPORTING_USER', scope: { estateIds: ['EST-001'], divisionIds: [] }, roleDetails: { role: 'REPORTING_USER', organisation: null } }
    await expect(s.admin.updateUser('USR-001', next)).rejects.toMatchObject({ code: LAST_ACTIVE_ADMINISTRATOR, kind: 'validation' })
    expect(s.store.read((db) => db)).toEqual(before)
  })

  it.each(['deactivation', 'demotion'])('allows %s when another active Administrator exists', async (kind) => {
    const s = setup(); s.addAdministrator()
    const input = s.input()
    const next: UserInput & { expectedVersion: number } = kind === 'deactivation' ? { ...input, status: 'inactive' }
      : { ...input, role: 'REPORTING_USER', scope: { estateIds: ['EST-001'], divisionIds: [] }, roleDetails: { role: 'REPORTING_USER', organisation: null } }
    await s.admin.updateUser('USR-001', { ...next, reason: 'P0 role/scope regression' })
    expect(s.store.read((db) => db.users.filter((u) => u.role === 'ADMINISTRATOR' && u.status === 'active'))).toHaveLength(1)
  })

  it('does not count an inactive second Administrator', async () => {
    const s = setup(); s.addAdministrator()
    s.store.write((db) => { db.users.find((u) => u.id === 'USR-013')!.status = 'inactive' })
    await expect(s.admin.updateUser('USR-001', { ...s.input(), status: 'inactive' })).rejects.toMatchObject({ code: LAST_ACTIVE_ADMINISTRATOR })
  })
})

function SessionProbe() {
  const { state } = useSession()
  return <output data-testid="session">{JSON.stringify(state)}</output>
}

describe('SEC-04 fixture current-session reconciliation', () => {
  async function signedIn(userId = 'USR-001') {
    const s = setup()
    await s.auth.signIn({ userId, password: FIXTURE_DEV_PASSWORD }, { rememberUserId: false })
    const cache = new QueryClient()
    cache.setQueryData(['sensitive'], 'old authorization data')
    const clear = vi.fn(() => cache.clear())
    render(<SessionProvider auth={s.auth} onSessionEnded={clear}><SessionProbe /></SessionProvider>)
    return { ...s, cache, clear }
  }

  it('invalidates a self-demoted session and clears sensitive cached data and persistence', async () => {
    const s = await signedIn()
    await act(async () => {
      s.addAdministrator()
      await s.admin.updateUser('USR-001', { ...s.input(), reason: 'P0 role/scope regression', role: 'REPORTING_USER',
        scope: { estateIds: ['EST-001'], divisionIds: [] }, roleDetails: { role: 'REPORTING_USER', organisation: null } })
    })
    expect(screen.getByTestId('session')).toHaveTextContent('signed_out')
    expect(s.persistence.load()).toBeNull()
    expect(s.cache.getQueryData(['sensitive'])).toBeUndefined()
    expect(s.clear).toHaveBeenCalledTimes(1)
    await expect(s.admin.listUsers()).rejects.toMatchObject({ kind: 'forbidden' })
  })

  it('signs out and clears storage/cache on allowed self-deactivation', async () => {
    const s = await signedIn()
    await act(async () => { s.addAdministrator(); await s.admin.updateUser('USR-001', { ...s.input(), status: 'inactive' }) })
    expect(screen.getByTestId('session')).toHaveTextContent('signed_out')
    expect(s.persistence.load()).toBeNull()
    expect(s.cache.getQueryData(['sensitive'])).toBeUndefined()
  })

  it('reconciles scope changes and clears scoped caches even outside the mutation hook', async () => {
    const s = await signedIn('USR-003')
    // The same fixture store can notify this session about an authorized admin's change.
    await act(async () => { await s.admin.updateUserScope('USR-003', {
      scope: { estateIds: ['EST-003'], divisionIds: [] }, reason: 'Updated coverage', expectedVersion: s.input('USR-003').expectedVersion,
    }) })
    expect(s.persistence.load()?.user.estateIds).toEqual(['EST-003'])
    expect(screen.getByTestId('session')).toHaveTextContent('EST-003')
    expect(s.clear).toHaveBeenCalledTimes(1)
  })

  it('does not clear another user’s session/cache on ordinary account edits and preserves profile name updates', async () => {
    const s = await signedIn()
    await act(async () => { await s.admin.updateUser('USR-002', { ...s.input('USR-002'), fullName: 'Another employee' }) })
    expect(s.persistence.load()?.user.role).toBe('ADMINISTRATOR')
    expect(s.clear).not.toHaveBeenCalled()
    await act(async () => { await s.adapters.account.updateProfile('USR-001', { fullName: 'Updated own name', language: 'en' }) })
    expect(screen.getByTestId('session')).toHaveTextContent('Updated own name')
    expect(s.persistence.load()?.user.fullName).toBe('Updated own name')
    expect(s.clear).not.toHaveBeenCalled()
    expect(s.cache.getQueryData(['sensitive'])).toBe('old authorization data')
  })

  it('restores current role/scope rather than stale storage and refuses inactive/missing/mobile-only accounts', async () => {
    const s = setup()
    await s.auth.signIn({ userId: 'USR-001', password: FIXTURE_DEV_PASSWORD }, { rememberUserId: false })
    const original = s.persistence.load()!
    s.store.write((db) => { const u = db.users.find((u) => u.id === 'USR-001')!; u.role = 'REPORTING_USER'; u.estateIds = ['EST-002'] })
    expect(s.auth.restore()).toBeNull()
    // A session issued for the current role can refresh its scope, not upgrade roles.
    s.persistence.save({ ...original, user: { ...original.user, role: 'REPORTING_USER' } })
    expect(s.auth.restore()?.user).toMatchObject({ role: 'REPORTING_USER', estateIds: ['EST-002'] })
    s.store.reset()
    expect(s.auth.restore()).toBeNull()
    for (const change of ['inactive', 'missing', 'mobile']) {
      s.store.reset(); s.persistence.save(original)
      s.store.write((db) => {
        const u = db.users.find((u) => u.id === 'USR-001')!
        if (change === 'inactive') u.status = 'inactive'
        if (change === 'mobile') u.role = 'FIELD_WORKER'
        if (change === 'missing') db.users = db.users.filter((u) => u.id !== 'USR-001')
      })
      expect(s.auth.restore()).toBeNull()
      expect(s.persistence.load()).toBeNull()
    }
  })
})
