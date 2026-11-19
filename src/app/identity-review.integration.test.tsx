import { act, render, screen } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { FixtureStore, FIXTURE_DEV_PASSWORD } from '@/fixtures'
import { createIdentityFixtureAdapters } from '@/features/identity/fixtures'
import { createAuthUseCases } from '@/features/identity/application/authUseCases'
import { createBrowserSessionPersistence } from '@/features/identity/infrastructure/browserSessionPersistence'
import { createBrowserRememberedUserId } from '@/features/identity/infrastructure/browserRememberedUserId'
import { SessionProvider } from '@/features/identity/presentation/session/SessionProvider'
import { useSession } from '@/features/identity/presentation/session/sessionContext'
import { createFixtureAdapterSet, fixtureClock } from './composition/fixtureAdapters'

function Probe() {
  return <output data-testid="session">{JSON.stringify(useSession().state)}</output>
}

async function setup() {
  const store = new FixtureStore({ latencyMs: 0 })
  const persistence = createBrowserSessionPersistence()
  const adapters = createFixtureAdapterSet(() => persistence.load()?.user.id ?? null, store, fixtureClock, sessionStorage)
  const auth = createAuthUseCases(adapters.identity.auth, persistence, 'fixtures', createBrowserRememberedUserId())
  await auth.signIn({ userId: 'USR-003', password: FIXTURE_DEV_PASSWORD }, { rememberUserId: false })
  const cache = new QueryClient()
  const workspace = await adapters.review.getWorkspace()
  cache.setQueryData(['review', 'workspace'], workspace)
  cache.setQueryData(['capture', 'workspace'], await adapters.capture.getWorkspace())
  render(<SessionProvider auth={auth} onSessionEnded={() => cache.clear()}><Probe /></SessionProvider>)
  const admin = createIdentityFixtureAdapters(store, { clock: fixtureClock, actorId: () => 'USR-001' }).admin
  return { store, persistence, adapters, auth, admin, cache, workspace }
}

describe('combined Identity and Review authorization context', () => {
  it('keeps Review/Capture data and scope after an owner name update, denying cross-account writes', async () => {
    const s = await setup()
    const before = s.store.read((db) => ({ observations: db.observations, assignments: db.assignments }))
    await expect(s.adapters.identity.account.updateProfile('USR-001', { fullName: 'Forbidden', language: 'en' })).rejects.toMatchObject({ kind: 'forbidden' })
    await act(async () => { await s.adapters.identity.account.updateProfile('USR-003', { fullName: 'Updated Supervisor', language: 'en' }) })
    expect(screen.getByTestId('session')).toHaveTextContent('Updated Supervisor')
    expect(s.persistence.load()?.user.estateIds).toEqual(['EST-002'])
    expect(s.cache.getQueryData(['review', 'workspace'])).toEqual(s.workspace)
    const refreshed = await s.adapters.review.getWorkspace()
    expect(refreshed.actor).toMatchObject({ id: 'USR-003', fullName: 'Updated Supervisor' })
    expect(refreshed.observations.map((o) => o.id)).toEqual(s.workspace.observations.map((o) => o.id))
    expect(s.store.read((db) => ({ observations: db.observations, assignments: db.assignments }))).toEqual(before)
  })

  it('clears actual Review/Capture query caches and denies old-estate evidence after an admin scope change', async () => {
    const s = await setup()
    expect(s.workspace.observations.length).toBeGreaterThan(0)
    const previous = s.workspace.observations[0].id
    const { user } = await s.admin.getUser('USR-003')
    await act(async () => { await s.admin.updateUserScope(user.id, { scope: { estateIds: ['EST-003'], divisionIds: [] }, expectedVersion: user.version, reason: 'Approved coverage update' }) })
    expect(s.cache.getQueryData(['review', 'workspace'])).toBeUndefined()
    expect(s.cache.getQueryData(['capture', 'workspace'])).toBeUndefined()
    expect(s.persistence.load()?.user.estateIds).toEqual(['EST-003'])
    await expect(s.adapters.review.getObservationReview(previous)).rejects.toMatchObject({ kind: 'not_found' })
    expect((await s.adapters.review.getWorkspace()).observations.every((o) => o.estate.id === 'EST-003')).toBe(true)
  })

  it('does not restore Identity privileges from Review/Capture persisted data after sign-out', async () => {
    const s = await setup()
    await act(async () => { await s.adapters.identity.account.updateProfile('USR-003', { fullName: 'Persisted slice trigger', language: 'en' }) })
    expect(sessionStorage.getItem('tealeaf.fixtures.review')).not.toBeNull()
    expect(sessionStorage.getItem('tealeaf.fixtures.assignments')).not.toBeNull()
    await act(async () => { await s.auth.signOut(s.persistence.load()!) })
    const reloaded = createFixtureAdapterSet(() => s.persistence.load()?.user.id ?? null, new FixtureStore({ latencyMs: 0 }), fixtureClock, sessionStorage)
    expect(s.persistence.load()).toBeNull()
    await expect(reloaded.review.getWorkspace()).rejects.toMatchObject({ kind: 'unauthorized' })
    await expect(reloaded.identity.admin.listUsers()).rejects.toMatchObject({ kind: 'forbidden' })
  })
})
