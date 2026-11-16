import { render, screen, within } from '@testing-library/react'
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

const USERS = {
  ADMINISTRATOR: { id: 'USR-001', fullName: 'Anika Perera', email: 'anika.perera@example.test', role: 'ADMINISTRATOR', estateIds: ['EST-001', 'EST-002', 'EST-003'], divisionIds: [] },
  SUPERVISOR: { id: 'USR-002', fullName: 'Nimal Silva', email: 'nimal.silva@example.test', role: 'SUPERVISOR', estateIds: ['EST-001'], divisionIds: [] },
} as const

type AdapterSet = ReturnType<typeof createFixtureAdapterSet>

/** Fixture app; `prepare` runs before rendering (test doubles, or fixture operations that add records). */
async function renderSecurity(
  path: string,
  options: { role?: keyof typeof USERS; prepare?: (adapters: AdapterSet, store: FixtureStore) => unknown } = {},
) {
  const { id, fullName, email, role, estateIds, divisionIds } = USERS[options.role ?? 'ADMINISTRATOR']
  createBrowserSessionPersistence().save({
    user: { id, fullName, email, role, estateIds: [...estateIds], divisionIds: [...divisionIds] },
    accessToken: null,
    source: 'fixtures',
    signedInAt: '2026-10-21T09:00:00+05:30',
  })
  const store = new FixtureStore({ latencyMs: 0 })
  const persistence = createBrowserSessionPersistence()
  const adapters = createFixtureAdapterSet(() => persistence.load()?.user.id ?? null, store)
  await options.prepare?.(adapters, store)
  const container = assembleContainer(FIXTURE_CONFIG, adapters, fixtureClock, persistence)
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] })
  render(
    <AppProviders container={container}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { router, store, adapters }
}

const pending = () => Promise.reject(new AppError('contract_pending', 'Not connected.'))

/** The value shown on a KPI card, found by its label. */
function kpiValue(label: string) {
  const card = screen.getByText(label).closest('a')!
  return card.textContent
}

describe('Security & Settings', { timeout: 30_000 }, () => {
  it('opens on the overview with five tabs and figures taken from the fixture records', async () => {
    const { store, adapters } = await renderSecurity('/admin/security')
    expect(await screen.findByRole('heading', { name: 'Security & Settings', level: 1 }, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Overview', 'MFA', 'Account Security', 'Policies', 'Security Audit Log'])
    expect(screen.getByRole('tab', { name: 'Overview', selected: true })).toBeInTheDocument()

    const facts = store.read((db) => ({
      inactive: db.users.filter((user) => user.status === 'inactive').length,
      administrators: db.users.filter((user) => user.role === 'ADMINISTRATOR').length,
      active: db.deviceSessions.filter((session) => session.status === 'active').length,
    }))
    const recoveries = (await adapters.identity.admin.getDashboard()).openRecoveries.length
    expect(await screen.findByText('Inactive accounts', {}, { timeout: 10_000 })).toBeInTheDocument()
    expect(kpiValue('Inactive accounts')).toContain(String(facts.inactive))
    expect(kpiValue('Administrators requiring MFA')).toContain(String(facts.administrators))
    expect(kpiValue('Administrators requiring MFA')).toContain('Enrollment status not reported')
    expect(kpiValue('Open recovery requests')).toContain(String(recoveries))
    expect(kpiValue('Active device sessions')).toContain(String(facts.active))
    // The shared alerts card, with the kinds the demonstration data does not record.
    const alerts = screen.getByRole('region', { name: 'Security & access alerts' })
    expect(within(alerts).getByText(/Not reported by the demonstration data: failed sign-ins, locked accounts/)).toBeInTheDocument()
    expect(within(alerts).queryByRole('link', { name: 'Security & Settings' })).not.toBeInTheDocument()
  })

  it('lists Administrator MFA read-only, with no reset action and no secrets', async () => {
    const { store } = await renderSecurity('/admin/security?tab=mfa')
    const table = await screen.findByRole('table', { name: 'Administrator accounts and MFA' }, { timeout: 10_000 })
    const administrators = store.read((db) => db.users.filter((user) => user.role === 'ADMINISTRATOR'))
    expect(within(table).getAllByRole('row')).toHaveLength(administrators.length + 1)
    expect(within(table).getAllByText('Not reported')).toHaveLength(administrators.length)
    expect(screen.getByText('Awaiting backend contract')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reset|recover|disable|enrol/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/setup key:|secret:/i)).not.toBeInTheDocument()
  })

  it('says which account events are not reported, and shows empty states when no account is inactive and no recovery is open', async () => {
    await renderSecurity('/admin/security?tab=accounts')
    const signIns = await screen.findByRole('region', { name: 'Locked accounts and failed sign-ins' }, { timeout: 10_000 })
    expect(await within(signIns).findByText(/Account locked/)).toBeInTheDocument()
    expect(within(signIns).getAllByText(/not reported by the demonstration data/)).toHaveLength(2)
    expect(await screen.findByText('Every account is active.')).toBeInTheDocument()
    expect(screen.getByText('No recovery is waiting.')).toBeInTheDocument()
    // No account action can be taken here: it stays on the user's page.
    expect(screen.queryByRole('button', { name: /enable|disable|unlock|activate/i })).not.toBeInTheDocument()
  })

  it('lists an inactive account and an open recovery request recorded by the fixture adapters', async () => {
    let recoveryId = ''
    await renderSecurity('/admin/security?tab=accounts', {
      prepare: async (adapters, store) => {
        store.write((db) => {
          db.users.find((user) => user.id === 'USR-011')!.status = 'inactive'
        })
        recoveryId = (await adapters.identity.admin.requestSessionRecovery('DS-3012')).id
      },
    })
    const inactiveTable = await screen.findByRole('table', { name: 'Inactive accounts' }, { timeout: 10_000 })
    expect(await within(inactiveTable).findByRole('link', { name: 'Review account of Sewmi Raj' })).toHaveAttribute('href', '/admin/users/USR-011')
    expect(within(inactiveTable).getAllByRole('row')).toHaveLength(2)

    const recoveryTable = screen.getByRole('table', { name: 'Open recovery requests' })
    expect(within(recoveryTable).getAllByRole('row')).toHaveLength(2)
    expect(within(recoveryTable).getByText('DS-3012')).toBeInTheDocument()
    expect(within(recoveryTable).getByRole('link', { name: `Continue recovery ${recoveryId}` })).toHaveAttribute('href', '/admin/device-sessions/DS-3012/recovery')
  })

  it('shows policies read-only and marks the proposed offline validity as not approved', async () => {
    await renderSecurity('/admin/security?tab=policies')
    expect(await screen.findByText('Read-only policy overview', {}, { timeout: 10_000 })).toBeInTheDocument()
    for (const group of ['Authentication', 'Account recovery', 'Sessions and devices', 'Exceptional access']) {
      expect(screen.getByRole('table', { name: `${group} policies` })).toBeInTheDocument()
    }
    const row = (name: string) => screen.getByText(name).closest('tr')!
    expect(within(row('Administrator multi-factor sign-in')).getByText('Approved')).toBeInTheDocument()
    expect(within(row('Offline session validity (mobile)')).getByText('Proposed · not approved')).toBeInTheDocument()
    expect(within(row('Session expiration')).getByText('Not defined yet')).toBeInTheDocument()
    expect(within(row('Cross-estate temporary access approval')).getByText('Not defined yet')).toBeInTheDocument()
    for (const role of ['textbox', 'checkbox', 'switch', 'spinbutton', 'combobox'] as const) {
      expect(screen.queryByRole(role)).not.toBeInTheDocument()
    }
  })

  it('shows the security subset of the audit log, filterable by its own event types', async () => {
    const user = userEvent.setup()
    await renderSecurity('/admin/security?tab=audit')
    const table = await screen.findByRole('table', { name: 'Security audit log' }, { timeout: 10_000 })
    expect(await within(table).findByText('Device access revoked')).toBeInTheDocument()
    expect(within(table).queryByText('Permanent scope changed')).not.toBeInTheDocument()
    expect(within(table).queryByText('Permanent role changed')).not.toBeInTheDocument()
    await user.click(screen.getByRole('combobox', { name: /^Event type:/ }))
    expect(within(screen.getByRole('listbox', { name: 'Event type' })).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'All',
      'Account enabled',
      'Account disabled',
      'Device access revoked',
    ])
    expect(screen.getByRole('link', { name: 'Roles & Permissions › Access History' })).toHaveAttribute('href', '/admin/roles?tab=history')
  })

  it('keeps the tab in the address', async () => {
    const user = userEvent.setup()
    const { router } = await renderSecurity('/admin/security')
    await user.click(await screen.findByRole('tab', { name: 'Policies' }, { timeout: 10_000 }))
    expect(router.state.location.search).toBe('?tab=policies')
    await user.click(screen.getByRole('tab', { name: 'Overview' }))
    expect(router.state.location.search).toBe('')
  })

  it('shows access denied to a Supervisor', async () => {
    await renderSecurity('/admin/security', { role: 'SUPERVISOR' })
    expect(await screen.findByRole('heading', { name: 'Access denied' }, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Security & Settings' })).not.toBeInTheDocument()
  })

  it('shows unavailable states, and no figures, when the Identity contracts are pending', async () => {
    const patch = (adapters: AdapterSet) => {
      adapters.identity.admin.listUsers = pending
      adapters.identity.admin.getDashboard = pending
      adapters.identity.admin.listDeviceSessions = pending
      adapters.identity.admin.listSecurityAlerts = pending
      adapters.identity.accessGrants.listAccessHistory = pending
    }
    await renderSecurity('/admin/security', { prepare: patch })
    expect(await screen.findByText(/does not provide account and session figures yet/, {}, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.queryByText('Inactive accounts')).not.toBeInTheDocument()
    expect(await screen.findByText(/does not report security events yet/)).toBeInTheDocument()
  })

  it('shows the audit log as unavailable when the access-history contract is pending', async () => {
    await renderSecurity('/admin/security?tab=audit', {
      prepare: (adapters) => {
        adapters.identity.accessGrants.listAccessHistory = pending
      },
    })
    expect(await screen.findByText('Security audit log is not available yet', {}, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Security audit log' })).not.toBeInTheDocument()
  })
})
