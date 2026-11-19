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
  return screen.getByRole('region', { name: label }).textContent
}

describe('Security Center', { timeout: 30_000 }, () => {
  it('opens on Security Overview with four tabs and figures taken from the fixture records', async () => {
    const { store, adapters } = await renderSecurity('/admin/security')
    expect(await screen.findByRole('heading', { name: 'Security Center', level: 1 }, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Security Overview', 'Authentication Policies', 'Device Security', 'Security Events'])
    expect(screen.getByRole('tab', { name: 'Security Overview', selected: true })).toBeInTheDocument()

    const facts = store.read((db) => ({
      inactive: db.users.filter((user) => user.status === 'inactive').length,
      administrators: db.users.filter((user) => user.role === 'ADMINISTRATOR').length,
      active: db.deviceSessions.filter((session) => session.status === 'active').length,
    }))
    const recoveries = (await adapters.identity.admin.getDashboard()).openRecoveries.length
    expect(await screen.findByRole('region', { name: 'Inactive accounts' }, { timeout: 10_000 })).toBeInTheDocument()
    expect(kpiValue('Inactive accounts')).toContain(String(facts.inactive))
    expect(kpiValue('Administrators covered by MFA policy')).toContain(String(facts.administrators))
    expect(kpiValue('Administrators covered by MFA policy')).toContain('Enrollment status not reported')
    expect(kpiValue('Open recovery requests')).toContain(String(recoveries))
    expect(kpiValue('Active device sessions')).toContain(String(facts.active))
    const alerts = screen.getByRole('region', { name: 'Security & access alerts' })
    expect(within(alerts).getByText(/Not reported by the demonstration data: failed sign-ins, locked accounts/)).toBeInTheDocument()
    // Account security sits on the overview, with no account action.
    const signIns = await screen.findByRole('region', { name: 'Locked accounts and failed sign-ins' })
    expect(within(signIns).getAllByText(/not reported by the demonstration data/)).toHaveLength(2)
    expect(await screen.findByText('Every account is active.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /enable|disable|unlock|activate/i })).not.toBeInTheDocument()
  })

  it.each([
    ['mfa', 'Authentication Policies'],
    ['policies', 'Authentication Policies'],
    ['accounts', 'Security Overview'],
    ['audit', 'Security Events'],
    ['unknown', 'Security Overview'],
  ])('opens the earlier ?tab=%s link on %s', async (tab, label) => {
    await renderSecurity(`/admin/security?tab=${tab}`)
    expect(await screen.findByRole('tab', { name: label, selected: true }, { timeout: 10_000 })).toBeInTheDocument()
  })

  it('shows authentication policies read-only, with Administrator MFA and no reset action or secrets', async () => {
    const { store } = await renderSecurity('/admin/security?tab=authentication')
    expect(await screen.findByText('Read-only policy overview', {}, { timeout: 10_000 })).toBeInTheDocument()
    for (const group of ['Authentication', 'Account recovery', 'Exceptional access']) {
      expect(screen.getByRole('table', { name: `${group} policies` })).toBeInTheDocument()
    }
    expect(screen.queryByRole('table', { name: 'Sessions and devices policies' })).not.toBeInTheDocument()
    const row = (name: string) => screen.getByText(name).closest('tr')!
    expect(within(row('Administrator multi-factor sign-in')).getByText('Approved')).toBeInTheDocument()
    expect(within(row('Cross-estate temporary access approval')).getByText('Not defined yet')).toBeInTheDocument()

    const table = await screen.findByRole('table', { name: 'Administrator accounts and MFA' })
    const administrators = store.read((db) => db.users.filter((user) => user.role === 'ADMINISTRATOR'))
    expect(within(table).getAllByRole('row')).toHaveLength(administrators.length + 1)
    expect(screen.getByText('Awaiting backend contract')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reset|recover|disable|enrol/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/setup key:|secret:/i)).not.toBeInTheDocument()
    for (const role of ['textbox', 'checkbox', 'switch', 'spinbutton'] as const) expect(screen.queryByRole(role)).not.toBeInTheDocument()
  })

  it('shows device security: session figures, device policies and open recovery requests from the fixture adapters', async () => {
    let recoveryId = ''
    const { store } = await renderSecurity('/admin/security?tab=devices', {
      prepare: async (adapters) => {
        recoveryId = (await adapters.identity.admin.requestSessionRecovery('DS-3012')).id
      },
    })
    const facts = store.read((db) => ({
      active: db.deviceSessions.filter((session) => session.status === 'active').length,
      revoked: db.deviceSessions.filter((session) => session.status === 'revoked').length,
    }))
    expect(await screen.findByRole('region', { name: 'Revoked device sessions' }, { timeout: 10_000 })).toBeInTheDocument()
    expect(kpiValue('Active device sessions')).toContain(String(facts.active))
    expect(kpiValue('Revoked device sessions')).toContain(String(facts.revoked))
    const row = (name: string) => screen.getByText(name).closest('tr')!
    expect(within(row('Offline session validity (mobile)')).getByText('Proposed · not approved')).toBeInTheDocument()
    expect(within(row('Session expiration')).getByText('Not defined yet')).toBeInTheDocument()
    const recoveryTable = await screen.findByRole('table', { name: 'Open recovery requests' })
    expect(within(recoveryTable).getByText('DS-3012')).toBeInTheDocument()
    expect(within(recoveryTable).getByRole('link', { name: `Continue recovery ${recoveryId}` })).toHaveAttribute('href', '/admin/device-sessions/DS-3012/recovery')
    // No revoke here: revocation stays on Device Sessions, with its own confirmation.
    expect(screen.queryByRole('button', { name: /revoke/i })).not.toBeInTheDocument()
  })

  it('shows security events from the shared audit source, filterable by their own actions, with a details panel', async () => {
    const user = userEvent.setup()
    await renderSecurity('/admin/security?tab=events')
    const table = await screen.findByRole('table', { name: 'Security events' }, { timeout: 10_000 })
    expect(await within(table).findByText('Device session revoked')).toBeInTheDocument()
    expect(within(table).getByText('Scope changed')).toBeInTheDocument()
    // Division and estate records are not security events.
    expect(within(table).queryByText('Division reviewed')).not.toBeInTheDocument()
    await user.click(screen.getByRole('combobox', { name: /^Action:/ }))
    expect(within(screen.getByRole('listbox', { name: 'Action' })).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'All',
      'Role changed',
      'Scope changed',
      'Account status changed',
      'Device session revoked',
      'Session recovery requested',
      'Configuration publish rejected',
    ])
    await user.keyboard('{Escape}')
    await user.click(within(table).getByRole('button', { name: 'View details of record AUD-003' }))
    const dialog = await screen.findByRole('dialog', { name: 'Audit record' })
    expect(within(dialog).getByText('Device session DS-3012')).toBeInTheDocument()
    expect(within(dialog).getByText('DEVICE_SESSION_REVOKED')).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Audit Logs' })).toHaveAttribute('href', '/admin/audit-logs')
  })

  it('keeps the tab in the address', async () => {
    const user = userEvent.setup()
    const { router } = await renderSecurity('/admin/security')
    await user.click(await screen.findByRole('tab', { name: 'Device Security' }, { timeout: 10_000 }))
    expect(router.state.location.search).toBe('?tab=devices')
    await user.click(screen.getByRole('tab', { name: 'Security Overview' }))
    expect(router.state.location.search).toBe('')
  })

  it('shows access denied to a Supervisor', async () => {
    await renderSecurity('/admin/security', { role: 'SUPERVISOR' })
    expect(await screen.findByRole('heading', { name: 'Access denied' }, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Security Center' })).not.toBeInTheDocument()
  })

  it('shows unavailable states, and no figures, when the Identity contracts are pending', async () => {
    const patch = (adapters: AdapterSet) => {
      adapters.identity.admin.listUsers = pending
      adapters.identity.admin.getDashboard = pending
      adapters.identity.admin.listDeviceSessions = pending
      adapters.identity.admin.listSecurityAlerts = pending
    }
    await renderSecurity('/admin/security', { prepare: patch })
    expect(await screen.findByText(/does not provide account and session figures yet/, {}, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Inactive accounts' })).not.toBeInTheDocument()
    expect(await screen.findByText(/does not report security events yet/)).toBeInTheDocument()
  })

  it('shows security events as unavailable when the audit contract is pending', async () => {
    await renderSecurity('/admin/security?tab=events', {
      prepare: (adapters) => {
        adapters.identity.auditLog.listAuditLog = pending
      },
    })
    expect(await screen.findByText(/The audit log is not available yet/, {}, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Security events' })).not.toBeInTheDocument()
  })
})
