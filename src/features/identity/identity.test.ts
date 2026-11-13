import { describe, expect, it } from 'vitest'
import { FIXTURE_DEV_PASSWORD, FIXTURE_REFERENCE_DATE, FixtureStore } from '@/fixtures'
import { fixedClock } from '@/shared/utilities/clock'
import { createAuthUseCases, createBrowserSessionPersistence, type Session } from '@/features/identity'
import { createIdentityFixtureAdapters } from '@/features/identity/fixtures'
import { createIdentityHttpAdapters } from '@/features/identity/http'
import type { HttpClient } from '@/shared/api'

function fixtureAuth() {
  const store = new FixtureStore({ latencyMs: 0 })
  const persistence = createBrowserSessionPersistence()
  const auth = createAuthUseCases(createIdentityFixtureAdapters(store, { clock: fixedClock(FIXTURE_REFERENCE_DATE), actorId: () => 'USR-001' }).auth, persistence, 'fixtures')
  return { auth, persistence }
}

describe('fixture sign-in', () => {
  it('signs in with an e-mail address and returns a fixture session without a token', async () => {
    const { auth } = fixtureAuth()
    const session = await auth.signIn({ identifier: 'anika.perera@example.test', password: FIXTURE_DEV_PASSWORD, remember: false })
    expect(session).toMatchObject({
      source: 'fixtures',
      accessToken: null,
      user: { id: 'USR-001', role: 'ADMINISTRATOR', estateIds: ['EST-001', 'EST-002', 'EST-003'] },
    })
  })

  it('accepts a username, ignoring case and surrounding spaces', async () => {
    const { auth } = fixtureAuth()
    const session = await auth.signIn({ identifier: '  Malini.Fernando ', password: FIXTURE_DEV_PASSWORD, remember: false })
    expect(session.user).toMatchObject({ id: 'USR-003', role: 'SUPERVISOR', estateIds: ['EST-002'] })
  })

  it('rejects a wrong password with INVALID_CREDENTIALS and stores nothing', async () => {
    const { auth, persistence } = fixtureAuth()
    await expect(auth.signIn({ identifier: 'anika.perera', password: 'wrong', remember: false })).rejects.toMatchObject({
      kind: 'validation',
      code: 'INVALID_CREDENTIALS',
    })
    expect(persistence.load()).toBeNull()
  })

  it('keeps the session for the tab only, unless "remember me" is chosen', async () => {
    const { auth } = fixtureAuth()
    await auth.signIn({ identifier: 'nimal.silva', password: FIXTURE_DEV_PASSWORD, remember: false })
    expect(window.sessionStorage.getItem('tealeaf.session')).not.toBeNull()
    expect(window.localStorage.getItem('tealeaf.session')).toBeNull()

    await auth.signIn({ identifier: 'nimal.silva', password: FIXTURE_DEV_PASSWORD, remember: true })
    expect(window.localStorage.getItem('tealeaf.session')).not.toBeNull()
    expect(auth.restore()?.user.id).toBe('USR-002')
  })

  it('clears the stored session on sign-out', async () => {
    const { auth } = fixtureAuth()
    const session = await auth.signIn({ identifier: 'maya.dissanayake', password: FIXTURE_DEV_PASSWORD, remember: true })
    await auth.signOut(session)
    expect(auth.restore()).toBeNull()
  })
})

describe('session restore', () => {
  const fixtureSession: Session = {
    user: { id: 'USR-001', fullName: 'Anika Perera', email: 'anika.perera@example.test', role: 'ADMINISTRATOR', estateIds: [], divisionIds: [] },
    accessToken: null,
    source: 'fixtures',
    signedInAt: '2026-10-21T10:00:00+05:30',
  }

  it('never reuses a fixture session in API mode', () => {
    const persistence = createBrowserSessionPersistence()
    persistence.save(fixtureSession, false)
    const apiAuth = createAuthUseCases(createIdentityHttpAdapters({} as HttpClient).auth, persistence, 'api')
    expect(apiAuth.restore()).toBeNull()
    expect(persistence.load()).toBeNull()
  })

  it('ignores corrupt or tampered storage', () => {
    window.sessionStorage.setItem('tealeaf.session', '{not json')
    expect(createBrowserSessionPersistence().load()).toBeNull()
    window.sessionStorage.setItem('tealeaf.session', JSON.stringify({ ...fixtureSession, user: { ...fixtureSession.user, role: 'FIELD_WORKER' } }))
    expect(createBrowserSessionPersistence().load()).toBeNull()
  })
})

describe('API-mode sign-in', () => {
  it('is reported as pending (no endpoint is guessed) and never falls back to fixture accounts', async () => {
    const persistence = createBrowserSessionPersistence()
    const auth = createAuthUseCases(createIdentityHttpAdapters({} as HttpClient).auth, persistence, 'api')
    await expect(
      auth.signIn({ identifier: 'anika.perera@example.test', password: FIXTURE_DEV_PASSWORD, remember: false }),
    ).rejects.toMatchObject({ kind: 'contract_pending' })
    expect(persistence.load()).toBeNull()
  })
})
