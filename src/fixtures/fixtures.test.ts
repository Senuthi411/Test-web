import { describe, expect, it } from 'vitest'
import { FIXTURE_ACCOUNTS, FixtureStore, createSeedDatabase, findIntegrityProblems } from '@/fixtures'
import { isWebRole } from '@/shared/types'

const db = createSeedDatabase()

function countBy<T>(items: readonly T[], key: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    counts[key(item)] = (counts[key(item)] ?? 0) + 1
    return counts
  }, {})
}

describe('fixture dataset', () => {
  it('is referentially consistent', () => {
    expect(findIntegrityProblems(db)).toEqual([])
  })

  it('has the Figma record counts', () => {
    expect(db.estates).toHaveLength(3)
    expect(db.divisions).toHaveLength(9)
    expect(db.users).toHaveLength(13)
    expect(db.diseases).toHaveLength(4)
    expect(db.observations).toHaveLength(48)
    expect(db.observations[0]?.id).toBe('OBS-001')
    expect(db.observations[47]?.id).toBe('OBS-048')
  })

  it('places observations in divisions by the Figma pattern (OBS-005/014/023 → East Hills)', () => {
    const eastHills = db.observations.filter((o) => o.divisionId === 'DIV-005').map((o) => o.id)
    expect(eastHills).toEqual(['OBS-005', 'OBS-014', 'OBS-023', 'OBS-032', 'OBS-041'])
    expect(countBy(db.observations, (o) => o.divisionId)).toMatchObject({ 'DIV-001': 6, 'DIV-003': 6, 'DIV-004': 5, 'DIV-006': 5, 'DIV-009': 5 })
  })

  it('reproduces the AN-01 totals for the reporting user scope (EST-001 + EST-002)', () => {
    const maya = db.users.find((u) => u.id === 'USR-013')!
    const divisionIds = new Set(db.divisions.filter((d) => maya.estateIds.includes(d.estateId)).map((d) => d.id))
    const scoped = db.observations.filter((o) => divisionIds.has(o.divisionId))
    const byStatus = countBy(scoped, (o) => o.reviewStatus)

    expect(scoped).toHaveLength(33) // "Total observations 33"
    expect(byStatus.verified).toBe(5) // "Verified 5"
    expect(byStatus.submitted).toBe(8) // "Submitted 8"
    expect(byStatus.in_review).toBe(6) // "In review 6"
    expect(countBy(scoped, (o) => o.suspectedDiseaseId)).toEqual({ 'DIS-001': 8, 'DIS-002': 9, 'DIS-003': 8, 'DIS-004': 8 })
  })

  it('provides one development account per web role, each linked to an active user', () => {
    const roles = FIXTURE_ACCOUNTS.map((account) => db.users.find((u) => u.id === account.userId))
    roles.forEach((user) => {
      expect(user?.status).toBe('active')
      expect(user && isWebRole(user.role)).toBe(true)
    })
    expect(new Set(roles.map((user) => user?.role))).toEqual(new Set(['ADMINISTRATOR', 'SUPERVISOR', 'DISEASE_EXPERT', 'REPORTING_USER']))
    FIXTURE_ACCOUNTS.forEach((account) => {
      expect(db.users.find((u) => u.id === account.userId)?.email).toBe(account.email)
    })
  })
})

describe('FixtureStore', () => {
  it('returns copies, so callers cannot mutate the dataset by accident', () => {
    const store = new FixtureStore({ latencyMs: 0 })
    const estates = store.read((data) => data.estates)
    estates[0]!.name = 'Changed'
    expect(store.read((data) => data.estates[0]!.name)).toBe('Highland Tea Estate')
  })

  it('notifies subscribers on write and restores the seed on reset', () => {
    const store = new FixtureStore({ latencyMs: 0 })
    let notified = 0
    store.subscribe(() => (notified += 1))
    store.write((data) => {
      data.estates[0]!.status = 'inactive'
    })
    expect(store.read((data) => data.estates[0]!.status)).toBe('inactive')
    store.reset()
    expect(store.read((data) => data.estates[0]!.status)).toBe('active')
    expect(notified).toBe(2)
  })

  it('simulates an injected failure once', async () => {
    const store = new FixtureStore({ latencyMs: 0 })
    store.failNext('unavailable')
    await expect(store.run(() => 1)).rejects.toMatchObject({ kind: 'unavailable', code: 'FIXTURE_SIMULATED_FAILURE' })
    await expect(store.run(() => 1)).resolves.toBe(1)
  })

  it('rejects with cancelled when the request is aborted', async () => {
    const store = new FixtureStore({ latencyMs: 50 })
    const controller = new AbortController()
    const pending = store.run(() => 1, controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ kind: 'cancelled' })
  })
})
