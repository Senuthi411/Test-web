import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { FIXTURE_DEV_PASSWORD, FixtureStore } from '@/fixtures'
import { createBrowserSessionPersistence, type Session } from '@/features/identity'
import type { WebRole } from '@/shared/types'
import { assembleContainer, createContainer } from './composition/container'
import type { AppConfig } from './composition/config'
import { createFixtureAdapterSet, fixtureClock } from './composition/fixtureAdapters'
import { AppProviders } from './providers/AppProviders'
import { createAppRoutes } from './routing/routes'

const FIXTURE_CONFIG: AppConfig = { dataSource: 'fixtures', apiBaseUrl: '', apiTimeoutMs: 15_000 }
const API_CONFIG: AppConfig = { dataSource: 'api', apiBaseUrl: 'http://localhost:3000/api/v1', apiTimeoutMs: 15_000 }

const USERS: Partial<Record<WebRole, Session['user']>> = {
  ADMINISTRATOR: { id: 'USR-001', fullName: 'Anika Perera', email: 'anika.perera@example.test', role: 'ADMINISTRATOR', estateIds: ['EST-001', 'EST-002', 'EST-003'], divisionIds: [] },
  SUPERVISOR: { id: 'USR-003', fullName: 'Malini Fernando', email: 'malini.fernando@example.test', role: 'SUPERVISOR', estateIds: ['EST-002'], divisionIds: [] },
}

function signInAs(role: 'ADMINISTRATOR' | 'SUPERVISOR') {
  const user = USERS[role]
  if (!user) throw new Error('unknown test user')
  createBrowserSessionPersistence().save({ user, accessToken: null, source: 'fixtures', signedInAt: '2026-10-21T09:00:00+05:30' }, false)
}

/** Fixture container without simulated latency, so tests stay fast. */
function renderFixtureApp(path: string) {
  const store = new FixtureStore({ latencyMs: 0 })
  const persistence = createBrowserSessionPersistence()
  const adapters = createFixtureAdapterSet(() => persistence.load()?.user.id ?? null, store)
  const container = assembleContainer(FIXTURE_CONFIG, adapters, fixtureClock, persistence)
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] })
  render(
    <AppProviders container={container}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { router, store }
}

describe('AUTH-01 login', () => {
  it('signs an administrator in and opens the dashboard', async () => {
    const user = userEvent.setup()
    const { router } = renderFixtureApp('/login')
    await user.type(await screen.findByPlaceholderText('Email or username'), 'anika.perera@example.test')
    await user.type(screen.getByPlaceholderText('Password'), FIXTURE_DEV_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Sign In' }))
    expect(await screen.findByRole('heading', { name: 'Administrator Dashboard' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin')
    expect(screen.getByText(/Wed 21 Oct 2026/)).toBeInTheDocument()
  })

  it('returns to the requested page after sign-in', async () => {
    const user = userEvent.setup()
    const { router } = renderFixtureApp('/admin/estates')
    await user.type(await screen.findByPlaceholderText('Email or username'), 'anika.perera')
    await user.type(screen.getByPlaceholderText('Password'), FIXTURE_DEV_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Sign In' }))
    expect(await screen.findByRole('heading', { name: 'Estate Management' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/estates')
  })

  it('validates empty fields and rejects a wrong password without signing in', async () => {
    const user = userEvent.setup()
    const { router } = renderFixtureApp('/login')
    await user.click(await screen.findByRole('button', { name: 'Sign In' }))
    expect(await screen.findByText('Enter your email or username')).toBeInTheDocument()
    expect(screen.getByText('Enter your password')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Email or username'), 'anika.perera')
    await user.type(screen.getByPlaceholderText('Password'), 'not-the-password')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))
    expect(await screen.findByText('The email, username or password is incorrect.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(window.sessionStorage.getItem('tealeaf.session')).toBeNull()
  })

  it('explains that password reset is not available', async () => {
    const user = userEvent.setup()
    renderFixtureApp('/login')
    await user.click(await screen.findByRole('button', { name: 'Forgot password?' }))
    const dialog = await screen.findByRole('dialog', { name: 'Password reset is not available' })
    expect(within(dialog).getByText(/contact your administrator/)).toBeInTheDocument()
  })

  it('reports API-mode sign-in as not yet available and lists no development accounts', async () => {
    const user = userEvent.setup()
    const container = await createContainer(API_CONFIG)
    const router = createMemoryRouter(createAppRoutes(), { initialEntries: ['/login'] })
    render(
      <AppProviders container={container}>
        <RouterProvider router={router} />
      </AppProviders>,
    )
    expect(screen.queryByText(/Development accounts/)).not.toBeInTheDocument()
    await user.type(await screen.findByPlaceholderText('Email or username'), 'anika.perera@example.test')
    await user.type(screen.getByPlaceholderText('Password'), FIXTURE_DEV_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Sign In' }))
    expect(await screen.findByText('Sign-in is not available yet')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(screen.queryByText('Demonstration data · UI design only')).not.toBeInTheDocument()
  })
})

describe('role-based access', () => {
  it('shows ID-15 access denied to a supervisor opening administration', async () => {
    signInAs('SUPERVISOR')
    const { router } = renderFixtureApp('/admin/users')
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument()
    expect(screen.getByText(/Your role \(Supervisor\) does not have access/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'User Management' })).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/users')
  })

  it('lets every role open its own profile', async () => {
    signInAs('SUPERVISOR')
    renderFixtureApp('/profile')
    expect(await screen.findByRole('heading', { name: 'My Profile' })).toBeInTheDocument()
    expect(await screen.findByText('EST-002')).toBeInTheDocument()
  })

  it('shows the session-expired screen after a 401', async () => {
    signInAs('ADMINISTRATOR')
    const { router, store } = renderFixtureApp('/admin/users')
    store.failNext('unauthorized')
    expect(await screen.findByRole('heading', { name: 'Your session has expired' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/session-expired')
    expect(screen.getByText('Changes you had not submitted were not saved.')).toBeInTheDocument()
    expect(window.sessionStorage.getItem('tealeaf.session')).toBeNull()
  })

  it('clears an existing session when the expired page is opened directly', async () => {
    signInAs('ADMINISTRATOR')
    const user = userEvent.setup()
    const { router } = renderFixtureApp('/session-expired')
    await user.click(await screen.findByRole('link', { name: 'Sign in again' }))
    expect(await screen.findByRole('heading', { name: 'Welcome Back' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(window.sessionStorage.getItem('tealeaf.session')).toBeNull()
  })
})

describe('identity administration screens', () => {
  it('shows a failed role-user query and lets the administrator retry', async () => {
    signInAs('ADMINISTRATOR')
    const user = userEvent.setup()
    const { store } = renderFixtureApp('/admin/roles/administrator')
    store.failNext('conflict')
    await user.click(await screen.findByRole('button', { name: 'Try again' }))
    const assigned = await screen.findByRole('table', { name: 'Users with the Administrator role' })
    expect(await within(assigned).findByText('Anika Perera')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  it('reloads the latest user after an edit conflict without resetting fixture changes', async () => {
    signInAs('ADMINISTRATOR')
    const user = userEvent.setup()
    const { store } = renderFixtureApp('/admin/users/USR-005/edit')
    const name = await screen.findByLabelText(/Full name/)
    await user.clear(name)
    await user.type(name, 'My stale draft')
    store.write((db) => {
      const edited = db.users.find((item) => item.id === 'USR-005')!
      edited.fullName = 'Updated by another administrator'
      edited.version += 1
      db.estates[0]!.region = 'Preserved fixture change'
    })
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText(/Changed by another administrator/)).toBeInTheDocument()
    expect(name).toHaveValue('My stale draft')
    await user.click(screen.getByRole('button', { name: /^Reload latest$/ }))
    expect(await screen.findByDisplayValue('Updated by another administrator')).toBeInTheDocument()
    expect(store.read((db) => db.estates[0]?.region)).toBe('Preserved fixture change')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Changes saved', { exact: true })).toBeInTheDocument()
  })

  it('derives the dashboard KPIs (ID-02)', async () => {
    signInAs('ADMINISTRATOR')
    renderFixtureApp('/admin')
    const active = await screen.findByRole('region', { name: 'Active users' })
    expect(within(active).getByText('13')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Active device sessions' })).getByText('1 session revoked this week')).toBeInTheDocument()
    expect(screen.getByText('Session revoked')).toBeInTheDocument()
  })

  it('searches and filters users (ID-03)', async () => {
    signInAs('ADMINISTRATOR')
    const user = userEvent.setup()
    renderFixtureApp('/admin/users')
    expect(await screen.findByText('Showing 1–13 of 13 demo users')).toBeInTheDocument()
    await user.type(screen.getByRole('searchbox', { name: 'Search users' }), 'hiruni')
    expect(await screen.findByText('Showing 1–1 of 1 demo users')).toBeInTheDocument()
    expect(screen.getByText('Hiruni Nadeesha')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reset filters' }))
    expect(await screen.findByText('Showing 1–13 of 13 demo users')).toBeInTheDocument()
  })

  it('requires a division, then creates the user after review (ID-05)', async () => {
    signInAs('ADMINISTRATOR')
    const user = userEvent.setup()
    const { router } = renderFixtureApp('/admin/users/new')
    await user.type(await screen.findByLabelText(/Full name/), 'Test Worker')
    await user.type(screen.getByLabelText(/Email/), 'test.worker@example.test')
    await user.selectOptions(screen.getByLabelText(/Role/), 'FIELD_WORKER')
    await user.selectOptions(screen.getByLabelText(/Estate/), 'EST-001')
    await user.click(screen.getByRole('button', { name: 'Create user' }))
    expect(await screen.findByText('Division is required')).toBeInTheDocument()
    expect(screen.getByText('Division is required before the account can be created (SCN-422).')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'North Ridge (DIV-001)' }))
    await user.click(screen.getByRole('button', { name: 'Create user' }))
    const dialog = await screen.findByRole('dialog', { name: 'Review and create user' })
    expect(within(dialog).getByText('Highland Tea Estate · North Ridge (DIV-001)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Create user' }))

    expect(await screen.findByText('User created')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/users/USR-014')
    expect(screen.getByRole('heading', { name: 'Test Worker', level: 1 })).toBeInTheDocument()
  })

  it('revokes a device session after confirmation (ID-13)', async () => {
    signInAs('ADMINISTRATOR')
    const user = userEvent.setup()
    renderFixtureApp('/admin/device-sessions?session=DS-3091')
    const panel = await screen.findByRole('heading', { name: 'Session DS-3091' })
    const card = panel.closest('section') ?? document.body
    await user.click(within(card as HTMLElement).getByRole('button', { name: 'Revoke session' }))
    const dialog = await screen.findByRole('dialog', { name: 'Revoke session DS-3091?' })
    await user.click(within(dialog).getByRole('button', { name: 'Revoke session' }))
    expect(await screen.findByText('Session DS-3091 revoked')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Start recovery' })).toBeInTheDocument()
  })
})
