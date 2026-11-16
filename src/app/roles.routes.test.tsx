import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { FixtureStore } from '@/fixtures'
import { createBrowserSessionPersistence, type AccessGrantPort } from '@/features/identity'
import type { AccessGrant } from '@/features/identity/domain/accessGrants'
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

/** Fixture app; `accessGrants` replaces the grant port with a test double. */
function renderRoles(path: string, accessGrants?: AccessGrantPort) {
  signInAsAdministrator()
  const store = new FixtureStore({ latencyMs: 0 })
  const persistence = createBrowserSessionPersistence()
  const adapters = createFixtureAdapterSet(() => persistence.load()?.user.id ?? null, store)
  if (accessGrants) adapters.identity.accessGrants = accessGrants
  const container = assembleContainer(FIXTURE_CONFIG, adapters, fixtureClock, persistence)
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] })
  render(
    <AppProviders container={container}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { router, store }
}

const base = {
  type: 'additional_estate' as const,
  divisionIds: [],
  reason: 'Harvest cover',
  requestedBy: { id: 'USR-001', fullName: 'Anika Perera' },
  requestedAt: '2026-10-19T08:00:00+05:30',
  decidedBy: { id: 'USR-900', fullName: 'Approval Authority' },
  decidedAt: '2026-10-19T09:00:00+05:30',
  endedBy: null,
  endedAt: null,
  endReason: null,
}

/** Backend-reported grants in each state (the clock is 21 Oct 2026, 10:00). */
const GRANTS: AccessGrant[] = [
  { ...base, id: 'TAG-101', employee: { id: 'USR-003', fullName: 'Malini Fernando', role: 'SUPERVISOR' }, estateIds: ['EST-003'], startsAt: '2026-10-20T08:00:00+05:30', expiresAt: '2026-10-21T18:00:00+05:30', status: 'active' },
  { ...base, id: 'TAG-102', employee: { id: 'USR-005', fullName: 'Dr Tara Wijesinghe', role: 'DISEASE_EXPERT' }, estateIds: ['EST-003'], startsAt: '2026-10-25T08:00:00+05:30', expiresAt: '2026-10-28T08:00:00+05:30', status: 'scheduled' },
  { ...base, id: 'TAG-103', employee: { id: 'USR-002', fullName: 'Nimal Silva', role: 'SUPERVISOR' }, estateIds: ['EST-002'], startsAt: '2026-10-15T08:00:00+05:30', expiresAt: '2026-10-20T08:00:00+05:30', status: 'active', requestedAt: '2026-10-14T08:00:00+05:30' },
]

function stubPort(grants: AccessGrant[] = GRANTS) {
  const endGrant = vi.fn(async (id: string, action: 'revoke' | 'cancel', reason: string) => {
    const grant = grants.find((item) => item.id === id)!
    return { ...grant, status: action === 'revoke' ? ('revoked' as const) : ('cancelled' as const), endReason: reason }
  })
  const port: AccessGrantPort = {
    listGrants: async () => grants,
    requestGrant: vi.fn(),
    endGrant,
    listAccessHistory: async () => [],
  }
  return { port, endGrant }
}

/** Chooses an option of a toolbar FilterSelect (ARIA select-only combobox). */
async function pickFilter(user: ReturnType<typeof userEvent.setup>, label: string, option: string) {
  await user.click(screen.getByRole('combobox', { name: new RegExp(`^${label}:`) }))
  await user.click(within(screen.getByRole('listbox', { name: label })).getByRole('option', { name: option }))
}

const openTab = async (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(await screen.findByRole('tab', { name }, { timeout: 10_000 }))

describe('Roles & Permissions · Permission Matrix', { timeout: 30_000 }, () => {
  it('searches by name or code, filters by role and module, and shows read-only details', async () => {
    const user = userEvent.setup()
    renderRoles('/admin/roles')
    expect(await screen.findByRole('tab', { name: 'Permission Matrix', selected: true }, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.getByText('13 permissions match')).toBeInTheDocument()
    expect(screen.getByText('Core role permissions are read-only')).toBeInTheDocument()

    await user.type(screen.getByRole('searchbox', { name: 'Search permissions' }), 'quarantine')
    expect(screen.getByText('1 permission matches')).toBeInTheDocument()
    await user.clear(screen.getByRole('searchbox', { name: 'Search permissions' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search permissions' }), 'capture.own')
    expect(screen.getByText('2 permissions match')).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!)
    await pickFilter(user, 'Module', 'Cases')
    expect(screen.getByText('3 permissions match')).toBeInTheDocument()
    await pickFilter(user, 'Role', 'Field worker')
    expect(screen.getByText('0 permissions match')).toBeInTheDocument()
    expect(screen.getByText('No permissions match')).toBeInTheDocument()
    await user.click(within(screen.getByText('No permissions match').closest('div')!.parentElement!).getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByText('13 permissions match')).toBeInTheDocument()

    await user.click(screen.getByText('Decide quarantine'))
    expect(screen.getByText('Limited to the holder’s assigned estates or divisions (and any active temporary grant).')).toBeInTheDocument()
    expect(screen.getByText('No · core role permission, read-only')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /Granted/ })).not.toBeInTheDocument()
  })
})

describe('Roles & Permissions · Temporary Access', { timeout: 30_000 }, () => {
  it('requests access for a supervisor; the request stays Pending approval and is recorded in history', async () => {
    const user = userEvent.setup()
    renderRoles('/admin/roles?tab=temporary')
    expect(await screen.findByText('No temporary access', {}, { timeout: 10_000 })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Request temporary access' }))
    const dialog = await screen.findByRole('dialog', { name: 'Request temporary access' })
    await user.selectOptions(within(dialog).getByLabelText(/Employee/), 'USR-003')
    expect(within(dialog).getByText('USR-003')).toBeInTheDocument()
    expect(within(dialog).queryByRole('checkbox', { name: /Riverbend/ })).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('checkbox', { name: 'Mist Valley Tea Estate (EST-003)' }))
    fireEvent.change(within(dialog).getByLabelText(/Expiry/), { target: { value: '2026-10-24T17:00' } })
    await user.type(within(dialog).getByLabelText(/Business reason/), 'Harvest cover')
    expect(within(dialog).getByText('Unchanged · the role’s existing permissions apply in the added scope')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Submit request' }))

    expect(await screen.findByText('Temporary access requested')).toBeInTheDocument()
    expect(screen.getByText(/TAG-001 for Malini Fernando · Status: Pending approval/)).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Temporary access grants' })
    expect(within(table).getByText('Pending approval')).toBeInTheDocument()
    expect(within(table).queryByText('Active')).not.toBeInTheDocument()

    await openTab(user, 'Access History')
    const history = await screen.findByRole('table', { name: 'Access history' })
    expect(within(history).getByText('Temporary access requested')).toBeInTheDocument()
    await pickFilter(user, 'Action', 'Permanent scope changed')
    expect(within(history).queryByText('Temporary access requested')).not.toBeInTheDocument()
    expect(within(history).getByText('Permanent scope changed')).toBeInTheDocument()
  })

  it('blocks a self-grant, explains that Administrators have no options and rejects inactive accounts', async () => {
    const user = userEvent.setup()
    const { store } = renderRoles('/admin/roles?tab=temporary')
    store.write((db) => {
      db.users.find((item) => item.id === 'USR-002')!.status = 'inactive'
    })
    await user.click(await screen.findByRole('button', { name: 'Request temporary access' }, { timeout: 10_000 }))
    const dialog = await screen.findByRole('dialog', { name: 'Request temporary access' })
    await user.selectOptions(within(dialog).getByLabelText(/Employee/), 'USR-001')
    expect(within(dialog).getByText('Not available for this role')).toBeInTheDocument()
    expect(within(dialog).getByText(/separate high-risk workflow/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Submit request' })).toBeDisabled()

    await user.selectOptions(within(dialog).getByLabelText(/Employee/), 'USR-002')
    await user.click(within(dialog).getByRole('button', { name: 'Submit request' }))
    expect(await within(dialog).findByText(/not active, so it cannot receive temporary access/)).toBeInTheDocument()
    expect(screen.queryByText('Temporary access requested')).not.toBeInTheDocument()
  })

  it('limits a Field Worker to divisions of their own estate and shows the Disease Expert dependency', async () => {
    const user = userEvent.setup()
    renderRoles('/admin/roles?tab=temporary')
    await user.click(await screen.findByRole('button', { name: 'Request temporary access' }, { timeout: 10_000 }))
    const dialog = await screen.findByRole('dialog', { name: 'Request temporary access' })
    await user.selectOptions(within(dialog).getByLabelText(/Employee/), 'USR-007')
    expect(within(dialog).getByText(/Mobile app only/)).toBeInTheDocument()
    expect(within(dialog).getByRole('checkbox', { name: /Lower Slope \(DIV-003\)/ })).toBeInTheDocument()
    expect(within(dialog).queryByRole('checkbox', { name: /DIV-004/ })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('checkbox', { name: /DIV-001/ })).not.toBeInTheDocument()

    await user.selectOptions(within(dialog).getByLabelText(/Employee/), 'USR-005')
    expect(within(dialog).getByText(/case-access contract/)).toBeInTheDocument()
  })

  it('shows backend statuses, marks elapsed grants as expired and filters expiring-soon grants', async () => {
    const user = userEvent.setup()
    renderRoles('/admin/roles?tab=temporary', stubPort().port)
    await screen.findByRole('button', { name: 'Revoke TAG-101 for Malini Fernando' }, { timeout: 10_000 })
    const table = screen.getByRole('table', { name: 'Temporary access grants' })
    const row = (name: string) => within(table).getByText(name).closest('tr')!
    expect(within(row('Malini Fernando')).getByText('Active')).toBeInTheDocument()
    expect(within(row('Malini Fernando')).getByText('Expiring soon')).toBeInTheDocument()
    expect(within(row('Dr Tara Wijesinghe')).getByText('Scheduled')).toBeInTheDocument()
    expect(within(row('Nimal Silva')).getByText('Expired')).toBeInTheDocument()
    expect(within(row('Nimal Silva')).queryByRole('button')).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Expiring within 24 hours' }))
    expect(within(table).getByText('Malini Fernando')).toBeInTheDocument()
    expect(within(table).queryByText('Nimal Silva')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    await pickFilter(user, 'Status', 'Expired')
    expect(within(table).getByText('Nimal Silva')).toBeInTheDocument()
    expect(within(table).queryByText('Malini Fernando')).not.toBeInTheDocument()
  })

  it('revokes an active grant only after confirmation with a reason', async () => {
    const user = userEvent.setup()
    const { port, endGrant } = stubPort()
    renderRoles('/admin/roles?tab=temporary', port)
    await user.click(await screen.findByRole('button', { name: 'Revoke TAG-101 for Malini Fernando' }, { timeout: 10_000 }))
    const dialog = await screen.findByRole('dialog', { name: 'Revoke temporary access?' })
    expect(within(dialog).getByText(/loses EST-003 immediately/)).toBeInTheDocument()
    // The row button opens only the confirmation, not the row's details.
    expect(screen.queryByRole('dialog', { name: 'Temporary access TAG-101' })).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Revoke access' }))
    expect(within(dialog).getByText('Enter the reason')).toBeInTheDocument()
    expect(endGrant).not.toHaveBeenCalled()
    await user.type(within(dialog).getByLabelText(/Reason/), 'Harvest finished early')
    await user.click(within(dialog).getByRole('button', { name: 'Revoke access' }))
    await waitFor(() => expect(endGrant).toHaveBeenCalledWith('TAG-101', 'revoke', 'Harvest finished early'))
    expect(await screen.findByText('Access revoked')).toBeInTheDocument()
  })

  it('cancels a scheduled grant from its details, which link to permanent scope', async () => {
    const user = userEvent.setup()
    const { port, endGrant } = stubPort()
    renderRoles('/admin/roles?tab=temporary', port)
    await user.click(await screen.findByText('Dr Tara Wijesinghe', {}, { timeout: 10_000 }))
    const details = await screen.findByRole('dialog', { name: 'Temporary access TAG-102' })
    expect(within(details).getByText(/Approval Authority/)).toBeInTheDocument()
    expect(within(details).getByRole('link', { name: 'Change permanent access for Dr Tara Wijesinghe' })).toHaveAttribute('href', '/admin/users/USR-005/scope')
    await user.click(within(details).getByRole('button', { name: 'Cancel request' }))
    const dialog = await screen.findByRole('dialog', { name: 'Cancel temporary access?' })
    await user.type(within(dialog).getByLabelText(/Reason/), 'Visit postponed')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel grant' }))
    await waitFor(() => expect(endGrant).toHaveBeenCalledWith('TAG-102', 'cancel', 'Visit postponed'))
    expect(await screen.findByText('Request cancelled')).toBeInTheDocument()
  })

  it('keeps the dialog open and shows no success when revoking fails', async () => {
    const user = userEvent.setup()
    const { port } = stubPort()
    port.endGrant = vi.fn(async () => {
      throw new AppError('conflict', 'This grant can no longer be changed.')
    })
    renderRoles('/admin/roles?tab=temporary', port)
    await user.click(await screen.findByRole('button', { name: 'Revoke TAG-101 for Malini Fernando' }, { timeout: 10_000 }))
    const dialog = await screen.findByRole('dialog', { name: 'Revoke temporary access?' })
    await user.type(within(dialog).getByLabelText(/Reason/), 'Done')
    await user.click(within(dialog).getByRole('button', { name: 'Revoke access' }))
    expect(await within(dialog).findByText('This grant can no longer be changed.')).toBeInTheDocument()
    expect(screen.queryByText('Access revoked')).not.toBeInTheDocument()
  })

  it('shows the unavailable state for both tabs when the backend contracts are pending', async () => {
    const user = userEvent.setup()
    const pending = () => Promise.reject(new AppError('contract_pending', 'Not connected.'))
    renderRoles('/admin/roles?tab=temporary', { listGrants: pending, requestGrant: pending, endGrant: pending, listAccessHistory: pending })
    expect(await screen.findByText('Temporary access is not available yet', {}, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Request temporary access' })).not.toBeInTheDocument()
    await openTab(user, 'Access History')
    expect(await screen.findByText('Access history is not available yet')).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Access history' })).not.toBeInTheDocument()
  })
})
