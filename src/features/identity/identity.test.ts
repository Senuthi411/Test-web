import { describe, expect, it, vi } from 'vitest'
import { FIXTURE_DEV_PASSWORD, FIXTURE_REFERENCE_DATE, FixtureStore } from '@/fixtures'
import { fixedClock } from '@/shared/utilities/clock'
import {
  createAuthUseCases,
  createBrowserRememberedUserId,
  createBrowserSessionPersistence,
  type AuthPort,
  type Session,
  type SignInResult,
} from '@/features/identity'
import { createIdentityFixtureAdapters } from '@/features/identity/fixtures'
import { createIdentityHttpAdapters } from '@/features/identity/http'
import type { HttpClient } from '@/shared/api'

function fixtureAuth() {
  const store = new FixtureStore({ latencyMs: 0 })
  const persistence = createBrowserSessionPersistence()
  const remembered = createBrowserRememberedUserId()
  const auth = createAuthUseCases(
    createIdentityFixtureAdapters(store, { clock: fixedClock(FIXTURE_REFERENCE_DATE), actorId: () => 'USR-001' }).auth,
    persistence,
    'fixtures',
    remembered,
  )
  return { auth, persistence, remembered, store }
}

const NOT_REMEMBERED = { rememberUserId: false }

async function sessionOf(promise: Promise<SignInResult>): Promise<Session> {
  const result = await promise
  if (result.status !== 'signed_in') throw new Error('expected a session')
  return result.session
}

describe('fixture sign-in', () => {
  it('signs in with the company User ID and returns a fixture session without a token', async () => {
    const { auth } = fixtureAuth()
    const result = await auth.signIn({ userId: 'USR-001', password: FIXTURE_DEV_PASSWORD }, NOT_REMEMBERED)
    expect(result).toMatchObject({
      status: 'signed_in',
      session: {
        source: 'fixtures',
        accessToken: null,
        user: { id: 'USR-001', role: 'ADMINISTRATOR', estateIds: ['EST-001', 'EST-002', 'EST-003'] },
      },
    })
  })

  it('accepts a User ID ignoring case and surrounding spaces', async () => {
    const { auth } = fixtureAuth()
    const session = await sessionOf(auth.signIn({ userId: '  usr-003 ', password: FIXTURE_DEV_PASSWORD }, NOT_REMEMBERED))
    expect(session.user).toMatchObject({ id: 'USR-003', role: 'SUPERVISOR', estateIds: ['EST-002'] })
  })

  it('rejects e-mail addresses and other formats before any request is sent', async () => {
    const signIn = vi.fn()
    const port = { signIn } as unknown as AuthPort
    const auth = createAuthUseCases(port, createBrowserSessionPersistence(), 'api', createBrowserRememberedUserId())
    await expect(auth.signIn({ userId: 'anika.perera@example.test', password: 'x' }, NOT_REMEMBERED)).rejects.toMatchObject({
      kind: 'validation',
      details: [{ path: 'userId', message: 'Log in with your company User ID, not an e-mail address' }],
    })
    await expect(auth.signIn({ userId: 'anika.perera', password: 'x' }, NOT_REMEMBERED)).rejects.toMatchObject({
      details: [{ path: 'userId', message: 'Enter a valid User ID, for example USR-003' }],
    })
    expect(signIn).not.toHaveBeenCalled()
  })

  it('uses one message for a wrong password and an unknown User ID, and stores nothing', async () => {
    const { auth, persistence, remembered } = fixtureAuth()
    const message = 'The User ID or password is incorrect.'
    await expect(auth.signIn({ userId: 'USR-001', password: 'wrong' }, { rememberUserId: true })).rejects.toMatchObject({
      kind: 'validation',
      code: 'INVALID_CREDENTIALS',
      message,
    })
    await expect(auth.signIn({ userId: 'USR-999', password: 'wrong' }, { rememberUserId: true })).rejects.toMatchObject({
      kind: 'validation',
      code: 'INVALID_CREDENTIALS',
      message,
    })
    expect(persistence.load()).toBeNull()
    expect(remembered.load()).toBeNull()
  })

  it('reports a deactivated account and a mobile-only role after the password is accepted', async () => {
    const { auth, store } = fixtureAuth()
    store.write((db) => {
      const user = db.users.find((item) => item.id === 'USR-002')
      if (user) user.status = 'inactive'
      db.credentials.push({ userId: 'USR-007', email: 'ishara.kumari@example.test', username: 'ishara.kumari', password: FIXTURE_DEV_PASSWORD })
    })
    await expect(auth.signIn({ userId: 'USR-002', password: FIXTURE_DEV_PASSWORD }, NOT_REMEMBERED)).rejects.toMatchObject({
      kind: 'forbidden',
      code: 'ACCOUNT_DISABLED',
    })
    await expect(auth.signIn({ userId: 'USR-007', password: FIXTURE_DEV_PASSWORD }, NOT_REMEMBERED)).rejects.toMatchObject({
      kind: 'forbidden',
      code: 'WEB_ACCESS_NOT_PERMITTED',
    })
  })

  it('keeps the session for the tab only; "Remember User ID" stores the User ID and nothing else', async () => {
    const { auth, remembered } = fixtureAuth()
    await auth.signIn({ userId: 'USR-002', password: FIXTURE_DEV_PASSWORD }, { rememberUserId: true })
    expect(window.sessionStorage.getItem('tealeaf.session')).not.toBeNull()
    expect(window.localStorage.getItem('tealeaf.session')).toBeNull()
    expect(remembered.load()).toBe('USR-002')
    expect(auth.rememberedUserId()).toBe('USR-002')
    const local = JSON.stringify({ ...window.localStorage })
    expect(local).not.toContain(FIXTURE_DEV_PASSWORD)
    expect(local).not.toContain('accessToken')

    await auth.signIn({ userId: 'USR-002', password: FIXTURE_DEV_PASSWORD }, NOT_REMEMBERED)
    expect(remembered.load()).toBeNull()
    expect(auth.restore()?.user.id).toBe('USR-002')
  })

  it('never accepts an MFA code or enrollment in fixture mode', async () => {
    const { auth } = fixtureAuth()
    await expect(auth.verifyMfa({ challengeId: 'any' }, '123456')).rejects.toMatchObject({ kind: 'contract_pending' })
    await expect(auth.startMfaEnrollment({ enrollmentId: 'any' })).rejects.toMatchObject({ kind: 'contract_pending' })
    await expect(auth.confirmMfaEnrollment({ enrollmentId: 'any' }, '123456')).rejects.toMatchObject({ kind: 'contract_pending' })
    expect(auth.restore()).toBeNull()
  })

  it('clears the stored session on sign-out', async () => {
    const { auth } = fixtureAuth()
    const session = await sessionOf(auth.signIn({ userId: 'USR-013', password: FIXTURE_DEV_PASSWORD }, NOT_REMEMBERED))
    await auth.signOut(session)
    expect(auth.restore()).toBeNull()
  })

  it('does not load a session left in localStorage by an earlier build', () => {
    const stale = {
      user: { id: 'USR-001', fullName: 'Anika Perera', email: 'anika.perera@example.test', role: 'ADMINISTRATOR', estateIds: [], divisionIds: [] },
      accessToken: null,
      source: 'fixtures',
      signedInAt: '2026-10-21T10:00:00+05:30',
    }
    window.localStorage.setItem('tealeaf.session', JSON.stringify(stale))
    expect(createBrowserSessionPersistence().load()).toBeNull()
  })
})

describe('MFA sign-in (stubbed port until the Identity API defines it)', () => {
  const session: Session = {
    user: { id: 'USR-001', fullName: 'Anika Perera', email: 'anika.perera@example.test', role: 'ADMINISTRATOR', estateIds: [], divisionIds: [] },
    accessToken: 'token-from-backend',
    source: 'api',
    signedInAt: '2026-10-21T10:00:00+05:30',
  }

  it('stores the session only after the challenge is verified', async () => {
    const persistence = createBrowserSessionPersistence()
    const port: AuthPort = {
      signIn: async () => ({ status: 'mfa_required', challenge: { challengeId: 'ch-1' } }),
      verifyMfa: async (challenge, code) => {
        expect(challenge.challengeId).toBe('ch-1')
        expect(code).toBe('123456')
        return session
      },
      startMfaEnrollment: () => Promise.reject(new Error('not used')),
      confirmMfaEnrollment: () => Promise.reject(new Error('not used')),
      signOut: async () => undefined,
    }
    const auth = createAuthUseCases(port, persistence, 'api', createBrowserRememberedUserId())
    const result = await auth.signIn({ userId: 'USR-001', password: 'secret' }, NOT_REMEMBERED)
    expect(result).toEqual({ status: 'mfa_required', challenge: { challengeId: 'ch-1' } })
    expect(persistence.load()).toBeNull()
    await auth.verifyMfa({ challengeId: 'ch-1' }, ' 123456 ')
    expect(persistence.load()?.user.id).toBe('USR-001')
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
    persistence.save(fixtureSession)
    const apiAuth = createAuthUseCases(createIdentityHttpAdapters({} as HttpClient).auth, persistence, 'api', createBrowserRememberedUserId())
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
    const auth = createAuthUseCases(createIdentityHttpAdapters({} as HttpClient).auth, persistence, 'api', createBrowserRememberedUserId())
    await expect(auth.signIn({ userId: 'USR-001', password: FIXTURE_DEV_PASSWORD }, { rememberUserId: true })).rejects.toMatchObject({
      kind: 'contract_pending',
    })
    await expect(auth.verifyMfa({ challengeId: 'x' }, '123456')).rejects.toMatchObject({ kind: 'contract_pending' })
    expect(persistence.load()).toBeNull()
    expect(auth.rememberedUserId()).toBeNull()
  })
})
