import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { FixtureStore } from '@/fixtures'
import { createBrowserSessionPersistence } from '@/features/identity'
import { AppError } from '@/shared/api'
import { assembleContainer } from './composition/container'
import type { AppConfig } from './composition/config'
import { createFixtureAdapterSet, fixtureClock } from './composition/fixtureAdapters'
import { AppProviders } from './providers/AppProviders'
import { createAppRoutes } from './routing/routes'

const FIXTURE_CONFIG: AppConfig = { dataSource: 'fixtures', apiBaseUrl: '', apiTimeoutMs: 15_000 }

function signInAsAdministrator() {
  createBrowserSessionPersistence().save({
    user: { id: 'USR-001', fullName: 'Anika Perera', email: 'anika.perera@example.test', role: 'ADMINISTRATOR', estateIds: ['EST-001', 'EST-002', 'EST-003'], divisionIds: [] },
    accessToken: null,
    source: 'fixtures',
    signedInAt: '2026-10-21T09:00:00+05:30',
  })
}

type AdapterSet = ReturnType<typeof createFixtureAdapterSet>

/** Fixture app; `patch` can replace adapters with test doubles (e.g. pending contracts). */
function renderRoles(path: string, patch?: (adapters: AdapterSet, store: FixtureStore) => void) {
  signInAsAdministrator()
  const store = new FixtureStore({ latencyMs: 0 })
  const persistence = createBrowserSessionPersistence()
  const adapters = createFixtureAdapterSet(() => persistence.load()?.user.id ?? null, store)
  patch?.(adapters, store)
  const container = assembleContainer(FIXTURE_CONFIG, adapters, fixtureClock, persistence)
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] })
  render(
    <AppProviders container={container}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { router, store }
}

const pending = () => Promise.reject(new AppError('contract_pending', 'Not connected.'))

/** Chooses an option of a toolbar FilterSelect (ARIA select-only combobox). */
async function pickFilter(user: ReturnType<typeof userEvent.setup>, label: string, option: string) {
  await user.click(screen.getByRole('combobox', { name: new RegExp(`^${label}:`) }))
  await user.click(within(screen.getByRole('listbox', { name: label })).getByRole('option', { name: option }))
}

const ROLE_NAMES = ['Administrator', 'Supervisor', 'Disease expert', 'Field worker', 'Reporting user']

describe('Roles & Permissions · tabs', { timeout: 30_000 }, () => {
  it.each(['/admin/roles', '/admin/roles?tab=overview', '/admin/roles?tab=temporary'])(
    'opens %s on the Permission Matrix, with exactly two tabs and no Role Overview or Temporary Access',
    async (path) => {
      renderRoles(path)
      expect(await screen.findByRole('tab', { name: 'Permission Matrix', selected: true }, { timeout: 10_000 })).toBeInTheDocument()
      expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Permission Matrix', 'Access History'])
      expect(screen.queryByRole('tab', { name: /Overview|Temporary/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('list', { name: 'System roles' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /temporary access/i })).not.toBeInTheDocument()
      expect(screen.getByText(/Review the permissions of the predefined system roles and audit access changes./)).toBeInTheDocument()
      // Fixture mode keeps the demonstration disclaimer.
      expect(screen.getByText(/Demonstration data: the backend enforces the real permissions./)).toBeInTheDocument()
      expect(screen.getByText(/The backend enforces every permission and scope on each request/)).toBeInTheDocument()
    },
  )

  it('moves between tabs with the keyboard and keeps the tab in the address', async () => {
    const user = userEvent.setup()
    const { router } = renderRoles('/admin/roles')
    const matrix = await screen.findByRole('tab', { name: 'Permission Matrix', selected: true }, { timeout: 10_000 })
    matrix.focus()
    await user.keyboard('{ArrowRight}')
    expect(await screen.findByRole('tab', { name: 'Access History', selected: true })).toHaveFocus()
    expect(router.state.location.search).toBe('?tab=history')
    await user.keyboard('{ArrowLeft}')
    expect(await screen.findByRole('tab', { name: 'Permission Matrix', selected: true })).toHaveFocus()
    expect(router.state.location.search).toBe('')
  })
})

describe('Roles & Permissions · role detail', { timeout: 30_000 }, () => {
  it('opens a role’s details from its matrix column header', async () => {
    const user = userEvent.setup()
    const { router } = renderRoles('/admin/roles')
    const table = await screen.findByRole('table', { name: 'Permission matrix' }, { timeout: 10_000 })
    for (const name of ROLE_NAMES) expect(within(table).getByRole('link', { name: `View details of the ${name} role` })).toBeInTheDocument()
    await user.click(within(table).getByRole('link', { name: 'View details of the Supervisor role' }))
    expect(router.state.location.pathname).toBe('/admin/roles/supervisor')
    expect(await screen.findByRole('heading', { name: 'Supervisor', level: 1 }, { timeout: 10_000 })).toBeInTheDocument()
  })

  it('opens filtered User Management from a role’s details', async () => {
    const user = userEvent.setup()
    const { router } = renderRoles('/admin/roles/disease-expert')
    await user.click(await screen.findByRole('link', { name: 'View in User Management' }, { timeout: 10_000 }))
    expect(router.state.location.pathname).toBe('/admin/users')
    expect(await screen.findByRole('combobox', { name: 'Role: Disease expert' }, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Status: All' })).toBeInTheDocument()
    const table = await screen.findByRole('table', { name: 'Users' })
    expect(within(table).getAllByText('Disease expert').length).toBeGreaterThan(0)
    for (const other of ['Supervisor', 'Field worker', 'Administrator']) expect(within(table).queryByText(other)).not.toBeInTheDocument()
  })

  it('shows role details: access, scope rules, limitations, allowed actions and assigned users with management links', async () => {
    const { store } = renderRoles('/admin/roles/field-worker')
    expect(await screen.findByRole('heading', { name: 'Field worker', level: 1 }, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Field worker', current: 'page' })).toBeInTheDocument()
    expect(screen.getByText('Mobile app only')).toBeInTheDocument()
    expect(screen.getByText('Assigned divisions within one estate')).toBeInTheDocument()
    expect(screen.getByText(/Division-level scope/)).toBeInTheDocument()
    expect(screen.getByText('Security limitations')).toBeInTheDocument()

    const actions = screen.getByRole('region', { name: 'Allowed actions of the Field worker role' })
    expect(within(actions).getByText('Create observation, mobile')).toBeInTheDocument()
    expect(within(actions).getAllByRole('img', { name: 'Allowed within scope' }).length).toBeGreaterThan(0)
    expect(within(actions).queryByText('Decide quarantine')).not.toBeInTheDocument()

    const fieldWorkers = store.read((db) => db.users.filter((item) => item.role === 'FIELD_WORKER'))
    const table = await screen.findByRole('table', { name: 'Users with the Field worker role' })
    expect(within(table).getAllByRole('row')).toHaveLength(fieldWorkers.length + 1)
    expect(screen.getByText(new RegExp(`^${fieldWorkers.length} users?$`))).toBeInTheDocument()
    const first = fieldWorkers[0]!
    expect(within(table).getByRole('link', { name: `Manage role of ${first.fullName}` })).toHaveAttribute('href', `/admin/users/${first.id}/edit`)
    expect(within(table).getByRole('link', { name: `View access scope of ${first.fullName}` })).toHaveAttribute('href', `/admin/users/${first.id}/scope`)
    expect(screen.getByRole('link', { name: 'View in User Management' })).toHaveAttribute('href', '/admin/users?role=FIELD_WORKER&status=all')
  })

  it('says assigned users are unavailable when the Identity service is not connected, without inventing numbers', async () => {
    renderRoles('/admin/roles/supervisor', (adapters) => {
      adapters.identity.admin.listUsers = pending
    })
    expect(await screen.findByText('User accounts are not available yet: the Identity service is not connected.', {}, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.getByText('Not available')).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Users with the Supervisor role' })).not.toBeInTheDocument()
    // The role definition itself does not depend on the service.
    expect(screen.getByText('Web application')).toBeInTheDocument()
  })
})

describe('Roles & Permissions · Permission Matrix', { timeout: 30_000 }, () => {
  it('searches, filters by role and module, clears filters and shows read-only details', async () => {
    const user = userEvent.setup()
    renderRoles('/admin/roles?tab=matrix')
    expect(await screen.findByText('13 permissions match', {}, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Permission legend' })).toBeInTheDocument()

    await user.type(screen.getByRole('searchbox', { name: 'Search permissions' }), 'quarantine')
    expect(screen.getByText('1 permission matches')).toBeInTheDocument()
    await user.clear(screen.getByRole('searchbox', { name: 'Search permissions' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search permissions' }), 'capture.own')
    expect(screen.getByText('2 permissions match')).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!)
    await pickFilter(user, 'Module', 'Disease diagnosis & cases')
    expect(screen.getByText('3 permissions match')).toBeInTheDocument()
    await pickFilter(user, 'Role', 'Field worker')
    expect(screen.getByText('0 permissions match')).toBeInTheDocument()
    expect(screen.getByText('No permissions match')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' }).at(-1)!)
    expect(screen.getByText('13 permissions match')).toBeInTheDocument()

    await pickFilter(user, 'Role', 'Supervisor')
    const table = screen.getByRole('table', { name: 'Permission matrix' })
    expect(within(within(table).getAllByRole('row')[0]!).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Permission', 'Supervisor'])
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!)

    await user.click(screen.getByRole('button', { name: /Decide quarantine/ }))
    const details = screen.getByRole('region', { name: 'Permission details' })
    expect(within(details).getByText('Limited to the holder’s assigned estates or divisions.')).toBeInTheDocument()
    expect(within(details).getByText('No · core role permission, read-only')).toBeInTheDocument()
    expect(within(details).getByText('Observation review')).toBeInTheDocument()
    // Read-only: no toggles anywhere in the matrix.
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('shows allowed, scoped and not-allowed cells with text labels, grouped by module', async () => {
    renderRoles('/admin/roles?tab=matrix')
    const table = await screen.findByRole('table', { name: 'Permission matrix' }, { timeout: 10_000 })
    const groups = within(table).getAllByRole('button', { expanded: true }).map((button) => button.textContent?.replace(/\s*\(\d+\)$/, ''))
    expect(groups).toEqual(['Identity & user management', 'Estate & division administration', 'Observation review', 'Disease diagnosis & cases', 'Observation capture', 'Reporting & analytics'])

    const row = (name: RegExp) => within(table).getByRole('button', { name }).closest('tr')!
    expect(within(row(/Decide quarantine/)).getByRole('img', { name: 'Allowed within scope for Supervisor' })).toBeInTheDocument()
    expect(within(row(/Decide quarantine/)).getByRole('img', { name: 'Not allowed for Field worker' })).toBeInTheDocument()
    expect(within(row(/Read disease catalog/)).getByRole('img', { name: 'Allowed for Disease expert' })).toBeInTheDocument()
    expect(within(row(/Manage users and scopes/)).getByRole('img', { name: 'Allowed for Administrator' })).toBeInTheDocument()
    expect(within(row(/Read own observations/)).getByRole('img', { name: 'Allowed within scope for Field worker' })).toBeInTheDocument()
  })

  it('collapses and expands module groups with the mouse and the keyboard', async () => {
    const user = userEvent.setup()
    renderRoles('/admin/roles?tab=matrix')
    const table = await screen.findByRole('table', { name: 'Permission matrix' }, { timeout: 10_000 })
    const review = within(table).getByRole('button', { name: /^Observation review/ })
    await user.click(review)
    expect(review).toHaveAttribute('aria-expanded', 'false')
    expect(within(table).queryByRole('button', { name: /Decide quarantine/ })).not.toBeInTheDocument()

    review.focus()
    await user.keyboard('{Enter}')
    expect(review).toHaveAttribute('aria-expanded', 'true')
    expect(within(table).getByRole('button', { name: /Decide quarantine/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Collapse all' }))
    expect(within(table).queryAllByRole('button', { expanded: true })).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Collapse all' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Expand all' }))
    expect(within(table).queryAllByRole('button', { expanded: false })).toHaveLength(0)

    // While a search is active every matching group stays open.
    await user.click(review)
    await user.type(screen.getByRole('searchbox', { name: 'Search permissions' }), 'quarantine')
    expect(within(table).getByRole('button', { name: /^Observation review/ })).toBeDisabled()
    expect(within(table).getByRole('button', { name: /Decide quarantine/ })).toBeInTheDocument()
  })

  it('compares two roles from the same permission data', async () => {
    const user = userEvent.setup()
    renderRoles('/admin/roles?tab=matrix')
    const compare = await screen.findByRole('region', { name: 'Compare roles' }, { timeout: 10_000 })
    expect(within(compare).getByRole('region', { name: 'Only Supervisor' })).toHaveTextContent('Decide quarantine')
    expect(within(compare).getByRole('region', { name: 'Only Disease expert' })).toHaveTextContent('Write diagnosis')
    expect(within(compare).getByRole('region', { name: 'Shared' })).toHaveTextContent('None')
    expect(within(compare).getByText(/Supervisor: Assigned estates/)).toBeInTheDocument()

    await pickFilter(user, 'Second role', 'Field worker')
    expect(within(compare).getByText(/Field worker: Mobile app only/)).toBeInTheDocument()
    expect(within(compare).getByRole('region', { name: 'Only Field worker' })).toHaveTextContent('Create observation, mobile')
    await pickFilter(user, 'Second role', 'Supervisor')
    expect(within(compare).getByText('Choose two different roles to compare them.')).toBeInTheDocument()
  })
})

describe('Roles & Permissions · Access History', { timeout: 30_000 }, () => {
  it('lists only identity events from the audit log and filters by event type, actor, employee and date', async () => {
    const user = userEvent.setup()
    renderRoles('/admin/roles?tab=history')
    const table = await screen.findByRole('table', { name: 'Access history' }, { timeout: 10_000 })
    expect(await within(table).findByText('Device access revoked')).toBeInTheDocument()
    expect(within(table).getByText('Permanent scope changed')).toBeInTheDocument()
    expect(within(table).queryByText(/Temporary access/)).not.toBeInTheDocument()
    expect(within(table).getAllByText('Anika Perera').length).toBeGreaterThan(0)
    expect(within(table).getByRole('link', { name: 'View Sewmi Raj' })).toHaveAttribute('href', '/admin/users/USR-011')

    await pickFilter(user, 'Event type', 'Device access revoked')
    expect(within(table).getByText('Sewmi Raj')).toBeInTheDocument()
    expect(within(table).queryByText('Permanent scope changed')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))

    await pickFilter(user, 'Actor', 'Anika Perera')
    expect(within(table).getByText('Device access revoked')).toBeInTheDocument()
    await user.type(screen.getByRole('searchbox', { name: 'Employee' }), 'USR-005')
    expect(within(table).getByText('Permanent scope changed')).toBeInTheDocument()
    expect(within(table).queryByText('Sewmi Raj')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2030-01-01' } })
    expect(await screen.findByText('No records match these filters')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2029-01-01' } })
    expect(screen.getByText('The end date is before the start date')).toBeInTheDocument()
  })

  it('shows a recorded role change with the previous and new role', async () => {
    // Test-only audit record, of the kind Edit User writes (see adminDashboard.test.ts).
    renderRoles('/admin/roles?tab=history', (_, store) => {
      store.write((db) => {
        db.auditEvents.push({ id: 'AUD-900', at: '2026-10-21T09:30:00+05:30', kind: 'role_changed', actorId: 'USR-001', userId: 'USR-013', previousValue: 'REPORTING_USER', newValue: 'SUPERVISOR', estateIds: [], provenance: 'fixture-assigned' })
      })
    })
    const table = await screen.findByRole('table', { name: 'Access history' }, { timeout: 10_000 })
    const row = (await within(table).findByText('Permanent role changed')).closest('tr')!
    expect(within(row).getByText('Reporting user')).toBeInTheDocument()
    expect(within(row).getByText('Supervisor')).toBeInTheDocument()
  })

  it('shows the unavailable state, and no records, when the access-history contract is pending', async () => {
    renderRoles('/admin/roles?tab=history', (adapters) => {
      adapters.identity.accessGrants.listAccessHistory = pending
    })
    expect(await screen.findByText('Access history is not available yet', {}, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Access history' })).not.toBeInTheDocument()
  })
})
