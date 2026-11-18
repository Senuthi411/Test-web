import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { FixtureStore } from '@/fixtures'
import { createBrowserSessionPersistence, type AccessGrantPort } from '@/features/identity'
import type { AccessGrant } from '@/features/identity/domain/accessGrants'
import type { SecurityAlertFeed } from '@/features/identity/domain/adminDashboard'
import { createIdentityHttpAdapters } from '@/features/identity/http'
import type { HttpClient } from '@/shared/api'
import { assembleContainer } from './composition/container'
import type { AppConfig } from './composition/config'
import { createFixtureAdapterSet, fixtureClock } from './composition/fixtureAdapters'
import { AppProviders } from './providers/AppProviders'
import { createAppRoutes } from './routing/routes'

const FIXTURE_CONFIG: AppConfig = { dataSource: 'fixtures', apiBaseUrl: '', apiTimeoutMs: 15_000 }
const API_CONFIG: AppConfig = { dataSource: 'api', apiBaseUrl: 'http://localhost:3000/api/v1', apiTimeoutMs: 15_000 }
const ADMIN = { id: 'USR-001', fullName: 'Anika Perera', email: 'anika.perera@example.test', role: 'ADMINISTRATOR' as const, estateIds: ['EST-001', 'EST-002', 'EST-003'], divisionIds: [] }

interface Overrides {
  accessGrants?: AccessGrantPort
  securityAlerts?: SecurityAlertFeed
  /** API mode: Identity administration and grants use the API-mode adapters (no contract yet). */
  api?: boolean
  /** Changes the demonstration dataset before the app renders. */
  prepare?: (store: FixtureStore) => void
}

function renderDashboard(path = '/admin', overrides: Overrides = {}) {
  const config = overrides.api ? API_CONFIG : FIXTURE_CONFIG
  const persistence = createBrowserSessionPersistence()
  persistence.save({ user: ADMIN, accessToken: null, source: config.dataSource, signedInAt: '2026-10-21T09:00:00+05:30' })
  const store = new FixtureStore({ latencyMs: 0 })
  overrides.prepare?.(store)
  const adapters = createFixtureAdapterSet(() => 'USR-001', store)
  if (overrides.api) {
    const refuse = () => {
      throw new Error('no request may be sent')
    }
    const http = { request: refuse, get: refuse, post: refuse, put: refuse, patch: refuse, delete: refuse } as unknown as HttpClient
    const api = createIdentityHttpAdapters(http)
    adapters.identity.admin = api.admin
    adapters.identity.accessGrants = api.accessGrants
  }
  if (overrides.accessGrants) adapters.identity.accessGrants = overrides.accessGrants
  if (overrides.securityAlerts) {
    const feed = overrides.securityAlerts
    adapters.identity.admin = { ...adapters.identity.admin, listSecurityAlerts: async () => feed }
  }
  const container = assembleContainer(config, adapters, fixtureClock, persistence)
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
  decidedBy: null,
  decidedAt: null,
  endedBy: null,
  endedAt: null,
  endReason: null,
}

/** Backend-reported grants (the clock is 21 Oct 2026, 10:00). */
const GRANTS: AccessGrant[] = [
  { ...base, id: 'TAG-101', employee: { id: 'USR-003', fullName: 'Malini Fernando', role: 'SUPERVISOR' }, estateIds: ['EST-003'], startsAt: '2026-10-20T08:00:00+05:30', expiresAt: '2026-10-21T18:00:00+05:30', status: 'active' },
  { ...base, id: 'TAG-102', employee: { id: 'USR-005', fullName: 'Dr Tara Wijesinghe', role: 'DISEASE_EXPERT' }, estateIds: ['EST-003'], startsAt: '2026-10-25T08:00:00+05:30', expiresAt: '2026-10-28T08:00:00+05:30', status: 'scheduled' },
  { ...base, id: 'TAG-103', employee: { id: 'USR-002', fullName: 'Nimal Silva', role: 'SUPERVISOR' }, estateIds: ['EST-002'], startsAt: '2026-10-15T08:00:00+05:30', expiresAt: '2026-10-20T08:00:00+05:30', status: 'active' },
  { ...base, id: 'TAG-104', employee: { id: 'USR-004', fullName: 'Kavishka Jay', role: 'SUPERVISOR' }, estateIds: ['EST-001'], startsAt: '2026-10-23T08:00:00+05:30', expiresAt: '2026-10-24T08:00:00+05:30', status: 'pending_approval' },
  { ...base, id: 'TAG-105', employee: { id: 'USR-006', fullName: 'Dr Sahan Amarasinghe', role: 'DISEASE_EXPERT' }, estateIds: ['EST-001'], startsAt: '2026-10-20T08:00:00+05:30', expiresAt: '2026-10-25T08:00:00+05:30', status: 'revoked' },
]

const grantPort = (grants: AccessGrant[]): AccessGrantPort => ({
  listGrants: async () => grants,
  requestGrant: async () => {
    throw new Error('not used')
  },
  endGrant: async () => {
    throw new Error('not used')
  },
  listAccessHistory: async () => [],
})

const section = (name: string) => screen.findByRole('region', { name }, { timeout: 10_000 })

describe('Administrator Dashboard · demonstration data', { timeout: 30_000 }, () => {
  it('keeps the KPI cards, with counts and links from the dashboard source', async () => {
    renderDashboard()
    const active = await section('Active users')
    expect(within(active).getByText('16')).toBeInTheDocument()
    expect(within(await section('Total divisions')).getByText('All divisions active')).toBeInTheDocument()
    expect(within(await section('Active device sessions')).getByText('1 session revoked this week')).toBeInTheDocument()
    expect(active.closest('a')).toHaveAttribute('href', '/admin/users')
    // Eight KPIs, each derived from a recorded source.
    expect(within(await section('Total users')).getByText('16')).toBeInTheDocument()
    expect(within(await section('Active estates')).getByText('3')).toBeInTheDocument()
    // The attention KPI counts the rows of the "Users requiring attention" list.
    const attentionRows = within(await screen.findByRole('table', { name: 'Users requiring attention' }, { timeout: 10_000 })).getAllByRole('row').length - 1
    expect(within(await section('Accounts requiring attention')).getByText(String(attentionRows))).toBeInTheDocument()
    expect(await within(await section('Security alerts')).findByText('1 alert recorded')).toBeInTheDocument()
    expect(await within(await section('Enabled business rules')).findByText(/of 3 templates · not evaluated yet/)).toBeInTheDocument()
    expect(within(await section('Enabled business rules')).getByText('0')).toBeInTheDocument()
    expect(screen.getByText(/Demonstration reference date Wed 21 Oct 2026/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create user' })).toHaveAttribute('href', '/admin/users/new')
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument()
  })

  it('shows the revoked device session as a demonstration alert and names the kinds not reported', async () => {
    renderDashboard()
    const alerts = await section('Security & access alerts')
    const list = await within(alerts).findByRole('list', { name: 'Security alerts' })
    expect(within(list).getByText('Device session revoked')).toBeInTheDocument()
    expect(within(list).getByText(/Sewmi Raj \(USR-011\) · DS-3012/)).toBeInTheDocument()
    expect(within(list).getByRole('link', { name: 'Review device session DS-3012' })).toHaveAttribute('href', '/admin/device-sessions?session=DS-3012')
    expect(within(alerts).getByText('Demonstration records, not real incidents.')).toBeInTheDocument()
    expect(within(alerts).getByText(/Not reported by the demonstration data: failed sign-ins, locked accounts, flagged device sessions, Administrator MFA enrollment\./)).toBeInTheDocument()
  })

  it('starts with no pending actions and shows no temporary-access section, metric or link', async () => {
    renderDashboard()
    const pending = await section('Pending administrative actions')
    expect(await within(pending).findByText('No pending administrative actions')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Temporary access overview' })).not.toBeInTheDocument()
    expect(screen.queryByText(/temporary access/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /temporary/i })).not.toBeInTheDocument()
    for (const link of screen.getAllByRole('link')) expect(link.getAttribute('href') ?? '').not.toContain('tab=temporary')
  })

  it('summarises account statuses it supports and marks invitation states as not reported', async () => {
    const user = userEvent.setup()
    const { router } = renderDashboard()
    const summary = await section('Account status distribution')
    const statuses = await within(summary).findByRole('list', { name: 'Accounts by status' })
    expect(within(statuses).getByText('16')).toBeInTheDocument()
    expect(within(statuses).getByText('Not reported')).toBeInTheDocument()
    await user.click(within(summary).getByRole('link', { name: 'View inactive users' }))
    expect(router.state.location.search).toBe('?status=inactive')
    expect(await screen.findByRole('combobox', { name: /^Status: Inactive/ }, { timeout: 10_000 })).toBeInTheDocument()
  })

  it('lists users requiring attention with User ID, reason and an action, and the recent activity with its actor', async () => {
    renderDashboard()
    const table = await screen.findByRole('table', { name: 'Users requiring attention' }, { timeout: 10_000 })
    const sewmi = within(table).getByText('Sewmi Raj').closest('tr')!
    expect(within(sewmi).getByText('USR-011')).toBeInTheDocument()
    expect(within(sewmi).getByText('All device sessions revoked')).toBeInTheDocument()
    expect(within(sewmi).getByText('Session revoked')).toBeInTheDocument()
    expect(within(sewmi).getByRole('link', { name: 'Review sessions: Sewmi Raj' })).toHaveAttribute('href', '/admin/device-sessions?user=USR-011')
    const ishara = within(table).getByText('Ishara Kumari').closest('tr')!
    expect(within(ishara).getByText('Listed by the demonstration design; no issue recorded')).toBeInTheDocument()
    expect(within(ishara).getByRole('link', { name: 'Review user: Ishara Kumari' })).toHaveAttribute('href', '/admin/users/USR-007')

    const activity = await section('Recent administrative activity')
    expect(within(activity).getByRole('link', { name: 'Scope updated for Dr Tara Wijesinghe' })).toHaveAttribute('href', '/admin/users/USR-005')
    expect(within(activity).getAllByText(/by Anika Perera/).length).toBeGreaterThan(0)
    expect(within(activity).getByRole('link', { name: 'View audit logs' })).toHaveAttribute('href', '/admin/audit-logs')
  })

  it('moves a revoked session from alerts to pending actions once recovery is requested, without listing the user twice', async () => {
    renderDashboard('/admin', {
      prepare: (store) =>
        store.write((db) => {
          db.recoveryRequests.push({ id: 'REC-DS-3012', sessionId: 'DS-3012', requestedBy: 'USR-001', requestedAt: '2026-10-21T09:30:00+05:30', steps: ['done', 'pending', 'open', 'not_issued', 'waiting'] })
        }),
    })
    const alerts = await section('Security & access alerts')
    expect(await within(alerts).findByText('No security alerts')).toBeInTheDocument()
    const pending = await section('Pending administrative actions')
    const list = await within(pending).findByRole('list', { name: 'Pending administrative actions' })
    expect(within(list).getByText('Device session recovery')).toBeInTheDocument()
    expect(within(list).getByText('In progress')).toBeInTheDocument()
    expect(within(list).getByRole('link', { name: 'Continue recovery REC-DS-3012 for Sewmi Raj' })).toHaveAttribute('href', '/admin/device-sessions/DS-3012/recovery')
    const table = await screen.findByRole('table', { name: 'Users requiring attention' })
    expect(within(table).queryByText('Sewmi Raj')).not.toBeInTheDocument()
    expect(within(table).getByText('Ishara Kumari')).toBeInTheDocument()
  })
})

describe('Administrator Dashboard · reported sources', { timeout: 30_000 }, () => {
  it('does not read or show temporary grants even when a grant source reports pending requests', async () => {
    const listGrants = vi.fn(async () => GRANTS)
    renderDashboard('/admin', { accessGrants: { ...grantPort(GRANTS), listGrants } })
    const pending = await section('Pending administrative actions')
    expect(await within(pending).findByText('No pending administrative actions')).toBeInTheDocument()
    expect(listGrants).not.toHaveBeenCalled()
    expect(screen.queryByText(/TAG-10/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
  })

  it('shows alerts with their reported severity, and an empty state when a full source reports none', async () => {
    renderDashboard('/admin', {
      securityAlerts: {
        reportedKinds: ['failed_sign_in', 'account_locked', 'session_flagged', 'mfa_enrollment_pending', 'device_session_revoked'],
        alerts: [
          { id: 'SEC-1', kind: 'failed_sign_in', at: '2026-10-21T09:10:00+05:30', employee: { id: 'USR-003', fullName: 'Malini Fernando', role: 'SUPERVISOR' }, sessionId: null, device: null, severity: 'high', reasonCode: null },
        ],
      },
    })
    const alerts = await section('Security & access alerts')
    expect(await within(alerts).findByText('Failed sign-in attempts')).toBeInTheDocument()
    expect(within(alerts).getByText('High')).toBeInTheDocument()
    expect(within(alerts).getByRole('link', { name: 'Review user' })).toHaveAttribute('href', '/admin/users/USR-003')
    expect(within(alerts).queryByText(/Not reported by/)).not.toBeInTheDocument()
  })

  it('shows "No security alerts" for an empty feed', async () => {
    renderDashboard('/admin', { securityAlerts: { reportedKinds: ['device_session_revoked'], alerts: [] } })
    const alerts = await section('Security & access alerts')
    expect(await within(alerts).findByText('No security alerts')).toBeInTheDocument()
    expect(within(alerts).getByText('No revoked device sessions need review in the demonstration data.')).toBeInTheDocument()
  })
})

describe('Administrator Dashboard · API mode', { timeout: 30_000 }, () => {
  it('shows every section as not available yet, with no fixture counts or alerts', async () => {
    renderDashboard('/admin', { api: true })
    expect(await screen.findByRole('heading', { name: 'Administrator Dashboard' }, { timeout: 10_000 })).toBeInTheDocument()
    expect(await screen.findByText(/does not provide dashboard counts yet/)).toBeInTheDocument()
    expect(await screen.findByText(/does not report security events yet/)).toBeInTheDocument()
    expect(screen.getAllByText('Not available yet').length).toBeGreaterThanOrEqual(7)
    expect(screen.queryByRole('region', { name: 'Active users' })).not.toBeInTheDocument()
    expect(screen.queryByText('16')).not.toBeInTheDocument()
    expect(screen.queryByText('DS-3012', { exact: false })).not.toBeInTheDocument()
    expect(screen.queryByText(/Demonstration/)).not.toBeInTheDocument()
    expect(screen.queryByText('No security alerts')).not.toBeInTheDocument()
    expect(screen.queryByText('No pending administrative actions')).not.toBeInTheDocument()
  })
})
