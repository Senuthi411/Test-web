import { act, render, screen, waitFor, within } from '@testing-library/react'
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
  DISEASE_EXPERT: { id: 'USR-005', fullName: 'Dr Tara Wijesinghe', email: 'dr.tara.wijesinghe@example.test', role: 'DISEASE_EXPERT', estateIds: ['EST-001', 'EST-002'], divisionIds: [] },
  REPORTING_USER: { id: 'USR-013', fullName: 'Maya Dissanayake', email: 'maya.dissanayake@example.test', role: 'REPORTING_USER', estateIds: ['EST-001', 'EST-002'], divisionIds: [] },
}

function signInAs(role: WebRole) {
  const user = USERS[role]
  if (!user) throw new Error('unknown test user')
  createBrowserSessionPersistence().save({ user, accessToken: null, source: 'fixtures', signedInAt: '2026-10-21T09:00:00+05:30' })
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

async function logIn(user: ReturnType<typeof userEvent.setup>, userId: string, password = FIXTURE_DEV_PASSWORD) {
  await user.type(await screen.findByRole('textbox', { name: 'Company User ID' }), userId)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Log In' }))
}

describe('AUTH-01 login', () => {
  it('renders the enterprise login with User ID and password only', async () => {
    renderFixtureApp('/login')
    expect(await screen.findByRole('heading', { name: 'Welcome Back' }, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText('Log in to continue to TeaLeaf Field Scout')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Company User ID' })).toHaveAttribute('placeholder', 'Enter your User ID')
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('checkbox', { name: 'Remember User ID' })).not.toBeChecked()
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/forgot-password')
    expect(screen.getByText('Secure Access')).toBeInTheDocument()
    expect(screen.getByText('Authorized company personnel only')).toBeInTheDocument()
    // The introduction beside the card (reference design); the card keeps the only h1.
    const intro = screen.getByRole('region', { name: 'Tea Estate Health Monitoring' })
    expect(within(intro).getByRole('heading', { level: 2, name: 'Tea Estate Health Monitoring' })).toBeInTheDocument()
    expect(within(intro).getByText(/From field observations to expert decisions/)).toBeInTheDocument()
    expect(within(intro).getAllByRole('listitem').map((item) => item.textContent?.trim())).toEqual(['Field Observations', 'Expert Decisions', 'Healthier Tea Estates'])
    expect(screen.getByText('Estate Intelligence Platform')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 }).map((heading) => heading.textContent)).toEqual(['Welcome Back'])
    // Decorative images are hidden from assistive technology.
    for (const image of document.querySelectorAll('main img')) expect(image).toHaveAttribute('alt', '')
    expect(screen.getByRole('button', { name: 'Log In' })).toHaveAttribute('type', 'submit')
    for (const removed of [/email/i, /sign up/i, /google/i, /microsoft/i, /development accounts/i, /demonstration data/i]) {
      expect(screen.queryByText(removed)).not.toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: /^Use / })).not.toBeInTheDocument()
  })

  it('signs an administrator in with a User ID and opens the dashboard', async () => {
    const user = userEvent.setup()
    const { router } = renderFixtureApp('/login')
    await logIn(user, 'USR-001')
    expect(await screen.findByRole('heading', { name: 'Administrator Dashboard' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin')
    expect(screen.getByText(/Wed 21 Oct 2026/)).toBeInTheDocument()
  })

  it.each([
    ['USR-003', '/review'],
    ['USR-005', '/cases'],
    ['USR-013', '/analytics'],
  ])('sends %s to the home page of their role (%s)', async (userId, home) => {
    const user = userEvent.setup()
    const { router } = renderFixtureApp('/login')
    await logIn(user, userId)
    await waitFor(() => expect(router.state.location.pathname).toBe(home), { timeout: 5000 })
  })

  it('returns to the requested page after log in', async () => {
    const user = userEvent.setup()
    const { router } = renderFixtureApp('/admin/estates')
    await logIn(user, 'usr-001')
    expect(await screen.findByRole('heading', { name: 'Estate Management' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/estates')
  })

  it('validates empty fields and focuses the User ID', async () => {
    const user = userEvent.setup()
    renderFixtureApp('/login')
    await user.click(await screen.findByRole('button', { name: 'Log In' }))
    expect(await screen.findByText('Enter your User ID')).toBeInTheDocument()
    expect(screen.getByText('Enter your password')).toBeInTheDocument()
    const userIdInput = screen.getByRole('textbox', { name: 'Company User ID' })
    expect(userIdInput).toHaveAttribute('aria-invalid', 'true')
    expect(userIdInput).toHaveAccessibleDescription('Enter your User ID')
    expect(userIdInput).toHaveFocus()
  })

  it('rejects an e-mail address or a malformed User ID without sending a request', async () => {
    const user = userEvent.setup()
    const { router } = renderFixtureApp('/login')
    await logIn(user, 'anika.perera@example.test', 'x')
    expect(await screen.findByText('Log in with your company User ID, not an e-mail address')).toBeInTheDocument()
    await user.clear(screen.getByRole('textbox', { name: 'Company User ID' }))
    await logIn(user, 'anika', 'x')
    expect(await screen.findByText('Enter a valid User ID, for example USR-003')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('opens Forgot Password from the login page', async () => {
    const user = userEvent.setup()
    const { router } = renderFixtureApp('/login')
    await user.click(await screen.findByRole('link', { name: 'Forgot password?' }))
    expect(await screen.findByRole('heading', { name: 'Forgot Password?' }, { timeout: 5000 })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/forgot-password')
  })

  it('uses the same message for an unknown User ID and a wrong password, and clears the password', async () => {
    const user = userEvent.setup()
    const { router } = renderFixtureApp('/login')
    await logIn(user, 'USR-001', 'not-the-password')
    expect(await screen.findByText('The User ID or password is incorrect.')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveValue('')
    await user.clear(screen.getByRole('textbox', { name: 'Company User ID' }))
    await logIn(user, 'USR-999', 'whatever')
    expect(await screen.findByText('The User ID or password is incorrect.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(window.sessionStorage.getItem('tealeaf.session')).toBeNull()
  })

  it('reports a disabled account', async () => {
    const user = userEvent.setup()
    const { store } = renderFixtureApp('/login')
    store.write((db) => {
      const target = db.users.find((item) => item.id === 'USR-002')
      if (target) target.status = 'inactive'
    })
    await logIn(user, 'USR-002')
    expect(await screen.findByText('Account disabled')).toBeInTheDocument()
    expect(screen.getByText('This account is disabled. Contact your administrator.')).toBeInTheDocument()
  })

  it('shows and hides the password without changing its value', async () => {
    const user = userEvent.setup()
    renderFixtureApp('/login')
    const password = await screen.findByLabelText('Password')
    await user.type(password, 'secret-value')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(password).toHaveAttribute('type', 'password')
    expect(password).toHaveValue('secret-value')
  })

  it('remembers only the User ID when "Remember User ID" is chosen', async () => {
    const user = userEvent.setup()
    renderFixtureApp('/login')
    await user.click(await screen.findByRole('checkbox', { name: 'Remember User ID' }))
    await logIn(user, 'USR-001')
    await screen.findByRole('heading', { name: 'Administrator Dashboard' })
    expect(window.localStorage.getItem('tealeaf.rememberedUserId')).toBe('USR-001')
    expect(window.localStorage.getItem('tealeaf.session')).toBeNull()
    expect(JSON.stringify({ ...window.localStorage })).not.toContain(FIXTURE_DEV_PASSWORD)
  })

  it('pre-fills a remembered User ID and keeps the password empty', async () => {
    window.localStorage.setItem('tealeaf.rememberedUserId', 'USR-003')
    renderFixtureApp('/login')
    expect(await screen.findByRole('textbox', { name: 'Company User ID' })).toHaveValue('USR-003')
    expect(screen.getByRole('checkbox', { name: 'Remember User ID' })).toBeChecked()
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })

  it('reports the sign-in service as unavailable in API mode and never signs in', async () => {
    const user = userEvent.setup()
    const container = await createContainer(API_CONFIG)
    const router = createMemoryRouter(createAppRoutes(), { initialEntries: ['/login'] })
    render(
      <AppProviders container={container}>
        <RouterProvider router={router} />
      </AppProviders>,
    )
    await logIn(user, 'USR-001')
    expect(await screen.findByText('Sign-in service unavailable')).toBeInTheDocument()
    expect(screen.getByText(/not connected yet, so no request was sent/)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(window.sessionStorage.getItem('tealeaf.session')).toBeNull()
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

  it.each([
    ['SUPERVISOR', '/admin/users/new'],
    ['DISEASE_EXPERT', '/admin/users/USR-001/edit'],
    ['REPORTING_USER', '/admin/audit-logs'],
    ['DISEASE_EXPERT', '/admin/roles'],
    ['REPORTING_USER', '/admin/roles/administrator'],
  ] as const)('denies %s direct access to %s, including removed Roles & Permissions links', async (role, path) => {
    signInAs(role)
    const { router } = renderFixtureApp(path)
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(path.split('?')[0])
    expect(screen.queryByRole('heading', { name: /Audit Logs|User Management|Create User|Edit User/, level: 1 })).not.toBeInTheDocument()
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
  it('shows a failed audit-log query and lets the administrator retry', async () => {
    signInAs('ADMINISTRATOR')
    const user = userEvent.setup()
    const { store } = renderFixtureApp('/admin/audit-logs')
    store.failNext('conflict')
    await user.click(await screen.findByRole('button', { name: 'Try again' }))
    const log = await screen.findByRole('table', { name: 'Administrative audit log' })
    expect(await within(log).findByText('Dr Tara Wijesinghe')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  it.each(['/admin/roles', '/admin/roles?tab=matrix', '/admin/roles/administrator'])('redirects the removed Roles & Permissions link %s to the Audit Logs', async (path) => {
    signInAs('ADMINISTRATOR')
    const { router } = renderFixtureApp(path)
    expect(await screen.findByRole('heading', { name: 'Audit Logs', level: 1 })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/audit-logs')
    expect(screen.queryByRole('table', { name: /Permission matrix/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Permission Matrix|Access History/ })).not.toBeInTheDocument()
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

  it('lists users without an Email column; the name opens the details, where the email is shown (ID-03)', async () => {
    signInAs('ADMINISTRATOR')
    const user = userEvent.setup()
    const { router } = renderFixtureApp('/admin/users')
    const table = await screen.findByRole('table', { name: 'Users' })
    await within(table).findByText('Dr Tara Wijesinghe')
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent?.replace(/[↕↑↓]/g, '').trim())).toEqual(['Employee', 'User ID', 'Role', 'Assigned Scope', 'Status', 'Actions'])
    expect(within(table).queryByText(/@example\.test/)).not.toBeInTheDocument()

    // Email and User ID remain searchable even though the column is gone.
    const search = screen.getByRole('searchbox', { name: 'Search users' })
    await user.type(search, 'dr.tara.wijesinghe@example.test')
    expect(await screen.findByText('Showing 1–1 of 1 demo users')).toBeInTheDocument()
    await user.clear(search)
    await user.type(search, 'usr-005')
    expect(await screen.findByText('Showing 1–1 of 1 demo users')).toBeInTheDocument()

    await user.click(within(table).getByRole('link', { name: 'Dr Tara Wijesinghe' }))
    expect(router.state.location.pathname).toBe('/admin/users/USR-005')
    expect((await screen.findAllByText(/dr\.tara\.wijesinghe@example\.test/)).length).toBeGreaterThan(0)
  })

  it('shows Administrator-focused estate KPIs instead of operational statistics (ID-10)', async () => {
    signInAs('ADMINISTRATOR')
    const user = userEvent.setup()
    renderFixtureApp('/admin/estates/EST-002')
    const divisionsKpi = await screen.findByRole('region', { name: 'Total divisions' }, { timeout: 5000 })
    expect(within(divisionsKpi).getByText('3')).toBeInTheDocument()
    expect(within(divisionsKpi).getByText('3 active')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Assigned employees' })).getByText('4')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Estate status' })).getByText('Active')).toBeInTheDocument()
    for (const removed of ['Observations', 'Pending review', 'Corrections requested', 'Expert-confirmed cases']) {
      expect(screen.queryByRole('region', { name: removed })).not.toBeInTheDocument()
    }

    const divisions = screen.getByRole('table', { name: /Divisions of/ })
    expect(within(divisions).getAllByRole('columnheader').map((header) => header.textContent?.trim())).toEqual(['Division', 'ID', 'Field workers', 'Status'])
    expect(screen.getByRole('button', { name: 'Edit estate' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Add division' })).toBeEnabled()

    // The other tabs are unchanged; Team lists the employees counted above.
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Overview', 'Divisions', 'Team', 'Activity'])
    await user.click(screen.getByRole('tab', { name: 'Team' }))
    for (const name of ['Malini Fernando', 'Dr Tara Wijesinghe', 'Hiruni Nadeesha', 'Ravindu Kumara']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument()
    }
    await user.click(screen.getByRole('tab', { name: 'Activity' }))
    expect(screen.getByText(/Recent estate activity/)).toBeInTheDocument()
  })

  it('requires a division, then creates the user after review (ID-05)', async () => {
    signInAs('ADMINISTRATOR')
    const user = userEvent.setup()
    const { router } = renderFixtureApp('/admin/users/new')
    await user.type(await screen.findByLabelText(/Full name/), 'Test Worker')
    await user.type(screen.getByLabelText(/Email/), 'test.worker@example.test')
    await fillContact(user)
    await user.selectOptions(screen.getByLabelText(/Role/), 'FIELD_WORKER')
    await user.selectOptions(screen.getByRole('combobox', { name: /Estate/ }), 'EST-001')
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
    expect(screen.getByText(/Test Worker was created with Company User ID USR-014\. Account status: Active\./)).toBeInTheDocument()
    // The invitation status comes from the create result: fixture mode never sends one.
    expect(screen.getByText(/No invitation was sent \(demonstration data\)\./)).toBeInTheDocument()
    expect(screen.queryByText(/Invitation sent/)).not.toBeInTheDocument()
  })

  it('shows role sections, the permissions preview and role-dependent asterisks only after a role is chosen', async () => {
    signInAs('ADMINISTRATOR')
    const user = userEvent.setup()
    renderFixtureApp('/admin/users/new')
    const role = await screen.findByLabelText(/Role/)
    expect(screen.getByRole('combobox', { name: /Estate/ })).toBeDisabled()
    expect(screen.getByText('Select a role first')).toBeInTheDocument()
    expect(screen.getByText('Role not selected')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /details$/ })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
    expect(screen.getByText(/No password is set here/)).toBeInTheDocument()
    expect(screen.getByText('Company User ID')).toBeInTheDocument()
    expect(screen.getByText(/Assigned by the system when the account is created/)).toBeInTheDocument()
    expect(screen.queryByText('Reporting User scope is a pending team decision')).not.toBeInTheDocument()

    await user.selectOptions(role, 'ADMINISTRATOR')
    expect(screen.getByText('All estates')).toBeInTheDocument()
    expect(screen.getByText('Two-factor authentication is mandatory')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /multi-factor|two-factor/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /Estates/ })).not.toBeInTheDocument()
    expect(screen.getByText('Manage users and scopes')).toBeInTheDocument()

    await user.selectOptions(role, 'SUPERVISOR')
    expect(screen.getByRole('group', { name: /Estates/ })).toBeInTheDocument()
    expect(screen.getByLabelText(/Reports to/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Office phone/)).toBeInTheDocument()
    expect(screen.queryByText('Two-factor authentication is mandatory')).not.toBeInTheDocument()
    expect(screen.getByText('Read scoped review queue')).toBeInTheDocument()

    await user.selectOptions(role, 'DISEASE_EXPERT')
    const registration = screen.getByLabelText(/Registration number/)
    expect(registration).toBeRequired()
    expect(screen.getByLabelText(/Institution/)).not.toBeRequired()
    expect(screen.getByLabelText(/Qualifications/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Reports to/)).not.toBeInTheDocument()

    await user.selectOptions(role, 'REPORTING_USER')
    expect(screen.getByText('Reporting User scope is a pending team decision')).toBeInTheDocument()
    expect(screen.getByText(/Estate-level access is used for now/)).toBeInTheDocument()
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
    await user.selectOptions(screen.getByRole('combobox', { name: /Estate/ }), 'EST-002')
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
    await user.selectOptions(screen.getByRole('combobox', { name: /Estate/ }), 'EST-001')
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
    expect(screen.getByRole('combobox', { name: /Estate/ })).toHaveValue('')
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

  it('creates an Administrator with mandatory two-factor authentication and global access', async () => {
    signInAs('ADMINISTRATOR')
    const user = userEvent.setup()
    renderFixtureApp('/admin/users/new')
    await user.type(await screen.findByLabelText(/Full name/), 'New Admin')
    await user.type(screen.getByLabelText(/Email/), 'new.admin@example.test')
    await fillContact(user)
    await user.selectOptions(screen.getByLabelText(/Role/), 'ADMINISTRATOR')
    await user.click(screen.getByRole('button', { name: 'Create user' }))
    const dialog = await screen.findByRole('dialog', { name: 'Review and create user' })
    expect(within(dialog).getByText('All estates')).toBeInTheDocument()
    expect(within(dialog).getByText('Required · set up at account activation')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Create user' }))
    expect(await screen.findByText('User created')).toBeInTheDocument()
    expect(screen.getByText('Two-factor authentication')).toBeInTheDocument()
  })

  it.each([
    ['unavailable', 'User service unavailable · the user was not saved'],
    ['forbidden', 'You are not allowed to make this change'],
  ] as const)('keeps the form and reports a %s error when creating fails', async (kind, title) => {
    signInAs('ADMINISTRATOR')
    const user = userEvent.setup()
    const { router, store } = renderFixtureApp('/admin/users/new')
    await user.type(await screen.findByLabelText(/Full name/), 'Failed Create')
    await user.type(screen.getByLabelText(/Email/), 'failed.create@example.test')
    await fillContact(user)
    await user.selectOptions(screen.getByLabelText(/Role/), 'REPORTING_USER')
    await user.click(screen.getByRole('checkbox', { name: 'Highland Tea Estate (EST-001)' }))
    await user.click(screen.getByRole('button', { name: 'Create user' }))
    const dialog = await screen.findByRole('dialog', { name: 'Review and create user' })
    store.failNext(kind)
    await user.click(within(dialog).getByRole('button', { name: 'Create user' }))
    expect(await screen.findByText(title)).toBeInTheDocument()
    expect(screen.queryByText('User created')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/users/new')
    expect(screen.getByLabelText(/Full name/)).toHaveValue('Failed Create')
  })

  it('edits a supervisor and saves the change (ID-06)', async () => {
    signInAs('ADMINISTRATOR')
    const user = userEvent.setup()
    const { router } = renderFixtureApp('/admin/users/USR-003/edit')
    expect(await screen.findByRole('heading', { name: 'Edit User' }, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText(/USR-003 · Changes are saved/)).toBeInTheDocument()
    expect(screen.queryByText('Company User ID')).not.toBeInTheDocument()
    const office = screen.getByLabelText(/Office phone/)
    await user.clear(office)
    await user.type(office, '0112345678')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Changes saved')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/users/USR-003')
    expect(screen.getByText('0112345678')).toBeInTheDocument()
  })

  it('changes a role in Edit User, shows it in the details and the list, and records it in the Audit Logs (ID-06, ID-18)', async () => {
    signInAs('ADMINISTRATOR')
    const user = userEvent.setup()
    const { router } = renderFixtureApp('/admin/users/USR-003/edit')
    await user.selectOptions(await screen.findByLabelText(/Role/, {}, { timeout: 5000 }), 'REPORTING_USER')
    // Supervisor-only values (office phone, reports to) are cleared after a confirmation.
    const dialog = screen.queryByRole('dialog', { name: /Change role to Reporting user/ })
    if (dialog) await user.click(within(dialog).getByRole('button', { name: 'Change role' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Changes saved')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/users/USR-003')
    expect(screen.getAllByText('Reporting user').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/EST-002|Riverbend/).length).toBeGreaterThan(0)

    await act(() => router.navigate('/admin/users'))
    const table = await screen.findByRole('table', { name: 'Users' })
    const row = (await within(table).findByRole('link', { name: 'Malini Fernando' })).closest('tr')!
    expect(within(row).getByText('Reporting user')).toBeInTheDocument()

    await act(() => router.navigate('/admin/audit-logs'))
    const log = await screen.findByRole('table', { name: 'Administrative audit log' }, { timeout: 5000 })
    await user.click(screen.getByRole('combobox', { name: /^Action:/ }))
    await user.click(within(screen.getByRole('listbox', { name: 'Action' })).getByRole('option', { name: 'Role changed' }))
    const entry = (await within(log).findAllByText(/Malini Fernando/))[0]!.closest('tr')!
    expect(within(entry).getByText('Role changed')).toBeInTheDocument()
    expect(within(entry).getByText('Anika Perera')).toBeInTheDocument()
    await user.click(within(entry).getByRole('button', { name: /^View details of record/ }))
    const record = await screen.findByRole('dialog', { name: 'Audit record' })
    expect(within(record).getAllByText(/Supervisor/).length).toBeGreaterThan(0)
    expect(within(record).getAllByText(/Reporting user/).length).toBeGreaterThan(0)
    expect(record.textContent).not.toMatch(/password|token|otp|secret/i)
  })

  it('does not keep estate scope when an edit changes a supervisor to a field worker', async () => {
    signInAs('ADMINISTRATOR')
    const user = userEvent.setup()
    renderFixtureApp('/admin/users/USR-003/edit')
    const role = await screen.findByLabelText(/Role/, {}, { timeout: 5000 })
    await user.selectOptions(role, 'FIELD_WORKER')
    const dialog = await screen.findByRole('dialog', { name: 'Change role to Field worker?' })
    expect(within(dialog).getByText('Estates')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Change role' }))
    expect(screen.getByRole('combobox', { name: /Estate/ })).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Estate is required')).toBeInTheDocument()
    expect(screen.getByText('Division is required')).toBeInTheDocument()
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
    const details = await screen.findByRole('dialog', { name: 'Session DS-3091' })
    await user.click(within(details).getByRole('button', { name: 'Revoke session' }))
    const dialog = await screen.findByRole('dialog', { name: 'Revoke session DS-3091?' })
    await user.click(within(dialog).getByRole('button', { name: 'Revoke session' }))
    expect(await screen.findByText('Session DS-3091 revoked')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Start recovery' })).toBeInTheDocument()
  })
})
