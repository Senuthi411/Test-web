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

/**
 * Fixture container without simulated latency, so tests stay fast. `actorId` overrides
 * the user the data layer acts for (defaults to the signed-in user).
 */
function renderFixtureApp(path: string, actorId?: () => string | null) {
  const store = new FixtureStore({ latencyMs: 0 })
  const persistence = createBrowserSessionPersistence()
  const adapters = createFixtureAdapterSet(actorId ?? (() => persistence.load()?.user.id ?? null), store)
  const container = assembleContainer(FIXTURE_CONFIG, adapters, fixtureClock, persistence)
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] })
  render(
    <AppProviders container={container}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { router, store }
}

/** Fills the common Create User fields added for every role (synthetic values). */
async function fillContact(user: ReturnType<typeof userEvent.setup>, options: { phone?: boolean; employeeId?: string } = {}) {
  if (options.phone !== false) await user.type(screen.getByLabelText(/Phone number/), '0771234567')
  await user.type(screen.getByLabelText(/Employee \/ Staff ID/), options.employeeId ?? 'EMP-900')
  await user.selectOptions(screen.getByLabelText(/Preferred language/), 'si')
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
    await fillContact(user)
    await user.selectOptions(screen.getByLabelText(/Role/), 'FIELD_WORKER')
    await user.selectOptions(screen.getByLabelText(/Estate/), 'EST-001')
    await user.type(screen.getByLabelText(/Mobile number/), '0771234567')
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

  it('shows role sections, the permissions preview and role-dependent asterisks only after a role is chosen', async () => {
    signInAs('ADMINISTRATOR')
    const user = userEvent.setup()
    renderFixtureApp('/admin/users/new')
    const role = await screen.findByLabelText(/Role/)
    expect(screen.getByLabelText(/Estate/)).toBeDisabled()
    expect(screen.getByText('Select a role first')).toBeInTheDocument()
    expect(screen.getByText('Role not selected')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /details$/ })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
    expect(screen.getByText(/No password is set here/)).toBeInTheDocument()

    await user.selectOptions(role, 'ADMINISTRATOR')
    expect(screen.getByText('All estates')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Require multi-factor sign-in/ })).toBeChecked()
    expect(screen.getByText('Manage users and scopes')).toBeInTheDocument()

    await user.selectOptions(role, 'SUPERVISOR')
    expect(screen.getByRole('group', { name: /Estates/ })).toBeInTheDocument()
    expect(screen.getByLabelText(/Reports to/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Office phone/)).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /Require multi-factor sign-in/ })).not.toBeInTheDocument()
    expect(screen.getByText('Read scoped review queue')).toBeInTheDocument()

    await user.selectOptions(role, 'DISEASE_EXPERT')
    const registration = screen.getByLabelText(/Registration number/)
    expect(registration).toBeRequired()
    expect(screen.getByLabelText(/Institution/)).not.toBeRequired()
    expect(screen.getByLabelText(/Qualifications/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Reports to/)).not.toBeInTheDocument()

    await user.selectOptions(role, 'REPORTING_USER')
    expect(screen.getByLabelText(/Organisation or department/)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /Estates/ })).toBeInTheDocument()
    expect(screen.getByText('Read division analytics')).toBeInTheDocument()

    await user.selectOptions(role, 'FIELD_WORKER')
    expect(screen.getByLabelText(/Mobile number/)).toBeRequired()
    expect(screen.getByText('Mobile application access only. The web application never creates observations.')).toBeInTheDocument()
  })

  it('lists only the chosen estate\'s divisions and supervisors for a field worker', async () => {
    signInAs('ADMINISTRATOR')
    const user = userEvent.setup()
    renderFixtureApp('/admin/users/new')
    await user.selectOptions(await screen.findByLabelText(/Role/), 'FIELD_WORKER')
    expect(screen.getByLabelText(/Supervisor/)).toBeDisabled()
    await user.selectOptions(screen.getByLabelText(/Estate/), 'EST-002')
    const divisions = within(screen.getByRole('group', { name: /Divisions/ }))
      .getAllByRole('checkbox')
      .map((box) => box.closest('label')?.textContent)
    expect(divisions).toEqual(['Riverbank (DIV-004)', 'East Hills (DIV-005)', 'West Terrace (DIV-006)'])
    const supervisors = within(screen.getByLabelText(/Supervisor/)).getAllByRole('option').map((option) => option.textContent)
    expect(supervisors).toEqual(['No supervisor', 'Malini Fernando (USR-003)'])
    // The picker offers division identifiers only.
    expect(divisions.every((label) => /\(DIV-\d{3}\)$/.test(label ?? ''))).toBe(true)
  })

  it('asks before a role change clears entered fields, and keeps them when cancelled', async () => {
    signInAs('ADMINISTRATOR')
    const user = userEvent.setup()
    renderFixtureApp('/admin/users/new')
    await user.type(await screen.findByLabelText(/Full name/), 'Role Switch')
    const role = screen.getByLabelText(/Role/)
    await user.selectOptions(role, 'FIELD_WORKER')
    await user.selectOptions(screen.getByLabelText(/Estate/), 'EST-001')
    await user.click(screen.getByRole('checkbox', { name: 'North Ridge (DIV-001)' }))
    await user.type(screen.getByLabelText(/Mobile number/), '0771234567')

    await user.selectOptions(role, 'SUPERVISOR')
    let dialog = await screen.findByRole('dialog', { name: 'Change role to Supervisor?' })
    expect(within(dialog).getByText('Mobile number')).toBeInTheDocument()
    expect(within(dialog).getByText('Divisions')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Keep Field worker' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(role).toHaveValue('FIELD_WORKER')
    expect(screen.getByLabelText(/Mobile number/)).toHaveValue('0771234567')
    expect(screen.getByRole('checkbox', { name: 'North Ridge (DIV-001)' })).toBeChecked()

    await user.selectOptions(role, 'SUPERVISOR')
    dialog = await screen.findByRole('dialog', { name: 'Change role to Supervisor?' })
    await user.click(within(dialog).getByRole('button', { name: 'Change role' }))
    expect(role).toHaveValue('SUPERVISOR')
    expect(screen.queryByLabelText(/Mobile number/)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Full name/)).toHaveValue('Role Switch')

    // Back to Field worker: the cleared values do not come back.
    await user.selectOptions(role, 'FIELD_WORKER')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Mobile number/)).toHaveValue('')
    expect(screen.getByLabelText(/Estate/)).toHaveValue('')
  })

  it('validates required fields by role, links messages to inputs and focuses the first invalid field', async () => {
    signInAs('ADMINISTRATOR')
    const user = userEvent.setup()
    renderFixtureApp('/admin/users/new')
    await user.click(await screen.findByRole('button', { name: 'Create user' }))
    const fullName = screen.getByLabelText(/Full name/)
    expect(fullName).toHaveFocus()
    expect(fullName).toHaveAccessibleDescription('Full name is required')
    expect(screen.getByLabelText(/Phone number/)).toHaveAccessibleDescription('Phone number is required')
    expect(screen.getByLabelText(/Employee \/ Staff ID/)).toHaveAccessibleDescription('Employee / Staff ID is required')
    expect(screen.getByLabelText(/Preferred language/)).toHaveAccessibleDescription('Preferred language is required')
    expect(screen.getByText('Role is required')).toBeInTheDocument()

    await user.type(fullName, 'Expert')
    await user.type(screen.getByLabelText(/Email/), 'expert@example.test')
    await user.type(screen.getByLabelText(/Phone number/), '+9411')
    await fillContact(user, { phone: false })
    await user.selectOptions(screen.getByLabelText(/Role/), 'DISEASE_EXPERT')
    await user.type(screen.getByLabelText(/^NIC/), '12345')
    await user.click(screen.getByRole('button', { name: 'Create user' }))
    expect(screen.getByLabelText(/Phone number/)).toHaveFocus()
    expect(screen.getByLabelText(/Phone number/)).toHaveAccessibleDescription('Enter a Sri Lankan phone number: +94XXXXXXXXX or 0XXXXXXXXX')
    expect(screen.getByLabelText(/^NIC/)).toHaveAccessibleDescription('Enter a valid NIC: 9 digits followed by V or X, or 12 digits')
    expect(screen.getByText('Select at least one estate')).toBeInTheDocument()
    expect(screen.getByLabelText(/Registration number/)).toHaveAccessibleDescription('Registration number is required')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('rejects a duplicate Employee / Staff ID on the field', async () => {
    signInAs('ADMINISTRATOR')
    const user = userEvent.setup()
    renderFixtureApp('/admin/users/new')
    await user.type(await screen.findByLabelText(/Full name/), 'Duplicate Staff')
    await user.type(screen.getByLabelText(/Email/), 'duplicate.staff@example.test')
    await fillContact(user, { employeeId: 'EMP-003' })
    await user.selectOptions(screen.getByLabelText(/Role/), 'REPORTING_USER')
    await user.click(screen.getByRole('checkbox', { name: 'Highland Tea Estate (EST-001)' }))
    await user.click(screen.getByRole('button', { name: 'Create user' }))
    const dialog = await screen.findByRole('dialog', { name: 'Review and create user' })
    await user.click(within(dialog).getByRole('button', { name: 'Create user' }))
    expect(await screen.findByText('Another user already has this Employee / Staff ID')).toBeInTheDocument()
    expect(screen.getByLabelText(/Employee \/ Staff ID/)).toHaveFocus()
  })

  it('creates a supervisor with several estates and shows the NIC masked to Administrators', async () => {
    signInAs('ADMINISTRATOR')
    const user = userEvent.setup()
    const { router } = renderFixtureApp('/admin/users/new')
    await user.type(await screen.findByLabelText(/Full name/), 'Masked Nic')
    await user.type(screen.getByLabelText(/Email/), 'masked.nic@example.test')
    await fillContact(user)
    await user.type(screen.getByLabelText(/^NIC/), '199012345678')
    await user.type(screen.getByLabelText(/Date of birth/), '1990-05-01')
    await user.selectOptions(screen.getByLabelText(/Role/), 'SUPERVISOR')
    await user.click(screen.getByRole('checkbox', { name: 'Highland Tea Estate (EST-001)' }))
    await user.click(screen.getByRole('checkbox', { name: 'Mist Valley Tea Estate (EST-003)' }))
    await user.click(screen.getByRole('button', { name: 'Create user' }))
    const dialog = await screen.findByRole('dialog', { name: 'Review and create user' })
    expect(within(dialog).getByText('19•••••••••8')).toBeInTheDocument()
    expect(within(dialog).getByText('Highland Tea Estate, Mist Valley Tea Estate')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Create user' }))

    expect(await screen.findByText('User created')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/users/USR-014')
    expect(router.state.location.search).toBe('')
    const personal = screen.getByRole('heading', { name: 'Personal details' }).closest('section') as HTMLElement
    expect(within(personal).getByText('19•••••••••8')).toBeInTheDocument()
    expect(within(personal).getByText('1990-05-01')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('199012345678')
  })

  it('hides NIC and date of birth when the data layer is not reading as an Administrator', async () => {
    signInAs('ADMINISTRATOR')
    renderFixtureApp('/admin/users/USR-003', () => 'USR-003')
    expect(await screen.findByRole('heading', { name: 'Malini Fernando', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('EMP-003')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Personal details' })).not.toBeInTheDocument()
    expect(screen.queryByText('NIC')).not.toBeInTheDocument()
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
