import { describe, expect, it } from 'vitest'
import { FIXTURE_REFERENCE_DATE, FixtureStore } from '@/fixtures'
import { fixedClock } from '@/shared/utilities/clock'
import { createIdentityFixtureAdapters } from './fixtures'
import { createIdentityAdminUseCases } from './application/identityUseCases'
import type { UserUpdateInput } from './application/ports'
import { scopeReasonError } from './domain/scope'
import { divisionCreationError } from './domain/organisationRules'
import { newestFirst } from './domain/chronology'
import { toAuditLogEntries } from './infrastructure/fixtureAuditLogAdapter'
import { auditActivity, userActivity } from './infrastructure/fixtureRecords'
import { EMPTY_AUDIT_FILTERS, filterAuditLog } from './domain/auditLog'

function setup() {
  const store = new FixtureStore({ latencyMs: 0 })
  let actor: string | null = 'USR-001'
  const adapters = createIdentityFixtureAdapters(store, { clock: fixedClock(FIXTURE_REFERENCE_DATE), actorId: () => actor })
  const input = (id = 'USR-003'): UserUpdateInput => store.read((db) => {
    const u = db.users.find((user) => user.id === id)!
    return { fullName: u.fullName, email: u.email, phone: u.phone, employeeId: u.employeeId,
      preferredLanguage: u.preferredLanguage, role: u.role, roleDetails: u.roleDetails, status: u.status,
      scope: { estateIds: u.estateIds, divisionIds: u.divisionIds }, expectedVersion: u.version }
  })
  return { store, adapters, input, admin: createIdentityAdminUseCases(adapters.admin), actor: (id: string | null) => { actor = id } }
}

describe('COR-01 reasoned scope updates through both boundaries', () => {
  it.each([undefined, '', '  \n '])('rejects a missing/blank reason %s in the domain', (reason) => {
    expect(scopeReasonError(reason)).toBe('A reason is required for a privileged scope change')
  })

  it.each(['edit', 'scope'] as const)('rejects direct %s calls without a reason and leaves all records/audit unchanged', async (path) => {
    const s = setup(); const before = s.store.read((db) => db)
    const scope = { estateIds: ['EST-003'], divisionIds: [] }
    const operation = path === 'edit'
      ? s.adapters.admin.updateUser('USR-003', { ...s.input(), scope, fullName: 'Must not partially save' })
      : s.adapters.admin.updateUserScope('USR-003', { scope, expectedVersion: s.input().expectedVersion, reason: '  ' })
    await expect(operation).rejects.toMatchObject({ kind: 'validation', details: [{ path: 'reason' }] })
    expect(s.store.read((db) => db)).toEqual(before)
  })

  it('permits an ordinary edit without a reason and records a trimmed scope-change reason', async () => {
    const s = setup()
    await s.admin.updateUser('USR-003', { ...s.input(), fullName: 'Updated name' })
    await s.admin.updateUser('USR-003', { ...s.input(), scope: { estateIds: ['EST-003'], divisionIds: [] }, reason: '  Cover Mist Valley  ' })
    expect(s.store.read((db) => db.auditEvents.at(-1))).toMatchObject({ kind: 'scope_updated', previousValue: 'EST-002', scope: ['EST-003'], reasonCode: 'Cover Mist Valley' })
  })

  it('does not demand a reason to retain an Administrator’s all-estate scope after an estate is added', async () => {
    const s = setup()
    await s.admin.createEstate({ name: 'Additional estate', region: 'Test region', status: 'active' })
    const auditCount = s.store.read((db) => db.auditEvents.length)
    await expect(s.admin.updateUser('USR-001', { ...s.input('USR-001'), fullName: 'Updated Administrator' })).resolves.toMatchObject({ fullName: 'Updated Administrator' })
    expect(s.store.read((db) => db.auditEvents.slice(auditCount).map((event) => event.kind))).toEqual(['user_updated'])
  })

  it('requires a reason for the actual scope change accompanying a role change', async () => {
    const s = setup(); const before = s.store.read((db) => db)
    const input: UserUpdateInput = { ...s.input(), role: 'ADMINISTRATOR', roleDetails: { role: 'ADMINISTRATOR', mfaRequired: true }, scope: { estateIds: [], divisionIds: [] } }
    await expect(s.admin.updateUser('USR-003', input)).rejects.toMatchObject({ kind: 'validation', details: [{ path: 'reason' }] })
    expect(s.store.read((db) => db)).toEqual(before)
    await expect(s.admin.updateUser('USR-003', { ...input, reason: 'Expand organizational access' })).resolves.toMatchObject({ role: 'ADMINISTRATOR' })
  })

  it('retains authorization and optimistic-version checks ahead of any scope mutation', async () => {
    const s = setup(); const before = s.store.read((db) => db)
    const update = { ...s.input(), scope: { estateIds: ['EST-003'], divisionIds: [] }, reason: 'Coverage' }
    s.actor('USR-005')
    await expect(s.adapters.admin.updateUser('USR-003', update)).rejects.toMatchObject({ kind: 'forbidden' })
    s.actor('USR-001')
    await expect(s.admin.updateUser('USR-003', { ...update, expectedVersion: -1 })).rejects.toMatchObject({ kind: 'conflict' })
    expect(s.store.read((db) => db)).toEqual(before)
  })

  it('rejects an empty required scope through the direct adapter even with a reason', async () => {
    const s = setup(); const before = s.store.read((db) => db)
    await expect(s.adapters.admin.updateUserScope('USR-003', {
      scope: { estateIds: [], divisionIds: [] }, reason: 'Not a valid empty assignment', expectedVersion: s.input().expectedVersion,
    })).rejects.toMatchObject({ kind: 'validation', details: [{ path: 'estateIds' }] })
    expect(s.store.read((db) => db)).toEqual(before)
  })
})

describe('COR-04 mixed-offset chronology', () => {
  const instants = [
    { id: 'earlier-positive', at: '2026-10-21T10:00:00+05:30' }, // 04:30Z
    { id: 'later-utc', at: '2026-10-21T05:00:00Z' },
    { id: 'equal-positive', at: '2026-10-21T10:30:00+05:30' },
    { id: 'equal-negative', at: '2026-10-21T01:00:00-04:00' },
    { id: 'latest-negative', at: '2026-10-20T23:30:00-06:00' }, // 05:30Z
  ]
  const order = ['latest-negative', 'later-utc', 'equal-positive', 'equal-negative', 'earlier-positive']

  it('orders UTC and positive/negative offsets by instant with stable equal-instant order', () => {
    expect([...instants].sort(newestFirst).map((event) => event.id)).toEqual(order)
    expect(newestFirst(instants[1], instants[2])).toBe(0)
    expect(instants[0].id).toBe('earlier-positive') // no source-array mutation
  })

  it('uses the same chronology in audit logs, filtered results and user/estate activity without rewriting timestamps', () => {
    const s = setup()
    s.store.write((db) => {
      db.auditEvents = instants.map((event) => ({ ...event, actorId: 'USR-001', userId: 'USR-003', kind: 'user_updated' as const, estateIds: ['EST-002'], provenance: 'fixture-assigned' as const }))
      db.deviceSessions = []; db.users.find((u) => u.id === 'USR-003')!.scopeAssignedAt = null
    })
    const before = s.store.read((db) => db)
    s.store.read((db) => {
      const entries = toAuditLogEntries(db)
      expect(entries.map((event) => event.id)).toEqual(order)
      expect(filterAuditLog(entries, EMPTY_AUDIT_FILTERS).map((event) => event.id)).toEqual(order)
      expect(auditActivity(db, db.auditEvents).map((event) => event.id)).toEqual(order)
      expect(userActivity(db, db.users.find((u) => u.id === 'USR-003')!).map((event) => event.id)).toEqual(order)
      expect(entries.find((event) => event.id === 'equal-positive')?.at).toBe(instants[2].at)
    })
    expect(s.store.read((db) => db)).toEqual(before)
  })
})

describe('COR-03 organization boundaries', () => {
  it('expresses only the documented new-division parent rule', () => {
    expect(divisionCreationError('active')).toBeUndefined()
    expect(divisionCreationError('inactive')).toContain('inactive estate')
    expect(divisionCreationError(undefined)).toContain('existing estate')
  })

  it.each(['application', 'adapter'] as const)('rejects creation in an inactive estate at the %s boundary without partial changes', async (boundary) => {
    const s = setup()
    const estate = (await s.admin.getEstate('EST-001')).estate
    await s.admin.updateEstate(estate.id, { name: estate.name, region: estate.region, status: 'inactive' })
    const before = s.store.read((db) => db)
    const admin = boundary === 'application' ? s.admin : s.adapters.admin
    await expect(admin.createDivision({ estateId: estate.id, name: 'Must not exist', status: 'active' })).rejects.toMatchObject({ kind: 'validation', details: [{ path: 'estateId' }] })
    expect(s.store.read((db) => db)).toEqual(before)
  })

  it('allows valid creation, rejects duplicates atomically, and preserves the immutable parent on edit', async () => {
    const s = setup()
    const created = await s.admin.createDivision({ estateId: 'EST-001', name: 'New division', status: 'active' })
    const beforeDuplicate = s.store.read((db) => db)
    await expect(s.admin.createDivision({ estateId: 'EST-001', name: 'New division', status: 'active' })).rejects.toMatchObject({ kind: 'validation' })
    expect(s.store.read((db) => db)).toEqual(beforeDuplicate)
    // An extra runtime property must not reparent existing records.
    const edit = { name: 'Renamed division', status: 'active' as const, estateId: 'EST-002' }
    expect((await s.adapters.admin.updateDivision(created.id, edit)).estateId).toBe('EST-001')
  })

  it('allows existing division metadata edits under an inactive estate, without inventing a cascade rule', async () => {
    const s = setup(); const estate = (await s.admin.getEstate('EST-001')).estate
    await s.admin.updateEstate(estate.id, { name: estate.name, region: estate.region, status: 'inactive' })
    await expect(s.admin.updateDivision('DIV-001', { name: 'Renamed existing division', status: 'active' })).resolves.toMatchObject({ name: 'Renamed existing division' })
  })

  it('does not bypass Administrator authorization on organization writes', async () => {
    const s = setup(); s.actor('USR-003'); const before = s.store.read((db) => db)
    await expect(s.admin.createDivision({ estateId: 'EST-001', name: 'Forbidden', status: 'active' })).rejects.toMatchObject({ kind: 'forbidden' })
    expect(s.store.read((db) => db)).toEqual(before)
  })
})
