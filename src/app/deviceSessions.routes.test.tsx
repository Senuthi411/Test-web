import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { FixtureStore } from '@/fixtures'
import { createBrowserSessionPersistence } from '@/features/identity'
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

function renderSessions(path = '/admin/device-sessions', options: { api?: boolean; prepare?: (store: FixtureStore) => void } = {}) {
  const config = options.api ? API_CONFIG : FIXTURE_CONFIG
  const persistence = createBrowserSessionPersistence()
  persistence.save({ user: ADMIN, accessToken: null, source: config.dataSource, signedInAt: '2026-10-21T09:00:00+05:30' })
  const store = new FixtureStore({ latencyMs: 0 })
  options.prepare?.(store)
  const adapters = createFixtureAdapterSet(() => 'USR-001', store)
  const request = vi.fn(() => {
    throw new Error('no request may be sent')
  })
  if (options.api) {
    const http = { request, get: request, post: request, put: request, patch: request, delete: request } as unknown as HttpClient
    adapters.identity.admin = createIdentityHttpAdapters(http).admin
  }
  const container = assembleContainer(config, adapters, fixtureClock, persistence)
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] })
  render(
    <AppProviders container={container}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { router, store, request }
}

type User = ReturnType<typeof userEvent.setup>

const sessionsTable = () => screen.findByRole('table', { name: 'Device sessions' }, { timeout: 10_000 })

async function chooseAction(user: User, sessionId: string, action: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${sessionId}` }, { timeout: 10_000 }))
  await user.click(screen.getByRole('menuitem', { name: action }))
}

async function pickFilter(user: User, label: string, option: string) {
  await user.click(screen.getByRole('combobox', { name: new RegExp(`^${label}:`) }))
  await user.click(within(screen.getByRole('listbox', { name: label })).getByRole('option', { name: option }))
}

const drawer = (id: string) => screen.findByRole('dialog', { name: `Session ${id}` })

const rowIds = (table: HTMLElement) =>
  within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent)

describe('Device Sessions · details drawer', { timeout: 30_000 }, () => {
  it('shows a full-width table with no details panel until View details is chosen', async () => {
    renderSessions()
    const table = await sessionsTable()
    expect(await within(table).findByText('DS-3091')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^Session DS-/ })).not.toBeInTheDocument()
    // Clicking a row no longer opens anything.
    await userEvent.setup().click(within(table).getByText('Android 12 · Redmi Note 11'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the selected session, switches sessions, and closes with the button and Escape, returning focus to the trigger', async () => {
    const user = userEvent.setup()
    const { router } = renderSessions()
    await sessionsTable()
    await chooseAction(user, 'DS-3091', 'View details')
    let details = await drawer('DS-3091')
    expect(router.state.location.search).toBe('?session=DS-3091')
    expect(details).toHaveAttribute('aria-modal', 'true')
    expect(within(details).getByText('Android 14 · Pixel 7')).toBeInTheDocument()
    expect(within(details).getByRole('link', { name: /Yasith Perera \(USR-009\)|\(USR-009\)/ })).toHaveAttribute('href', '/admin/users/USR-009')
    expect(within(details).getByText('Not reported by the session data')).toBeInTheDocument()
    expect(within(details).queryByText('Revoked')).not.toBeInTheDocument()
    // Focus moves into the drawer.
    expect(details.contains(document.activeElement)).toBe(true)

    await user.click(within(details).getByRole('button', { name: 'Close session details' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(router.state.location.search).toBe('')
    expect(screen.getByRole('button', { name: 'Actions for DS-3091' })).toHaveFocus()

    // Another session replaces it; there is only ever one drawer.
    await chooseAction(user, 'DS-3088', 'View details')
    details = await drawer('DS-3088')
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(within(details).getByText('Android 13 · Galaxy A54')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Actions for DS-3088' })).toHaveFocus()
  })

  it('keeps Tab inside the open drawer', async () => {
    const user = userEvent.setup()
    renderSessions()
    await chooseAction(user, 'DS-3091', 'View details')
    const details = await drawer('DS-3091')
    for (let step = 0; step < 6; step += 1) {
      await user.tab()
      expect(details.contains(document.activeElement)).toBe(true)
    }
  })

  it('opens directly from a ?session= link, e.g. the dashboard alert', async () => {
    renderSessions('/admin/device-sessions?session=DS-3012')
    const details = await drawer('DS-3012')
    expect(within(details).getByText('DEVICE_SESSION_REVOKED')).toBeInTheDocument()
  })
})

describe('Device Sessions · actions by status', { timeout: 30_000 }, () => {
  it('active: View details and Revoke session, confirmed before anything changes', async () => {
    const user = userEvent.setup()
    const { store } = renderSessions()
    await user.click(await screen.findByRole('button', { name: 'Actions for DS-3091' }, { timeout: 10_000 }))
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent?.trim())).toEqual(['View details', 'Revoke session'])
    await user.keyboard('{Escape}')

    await chooseAction(user, 'DS-3091', 'View details')
    const details = await drawer('DS-3091')
    await user.click(within(details).getByRole('button', { name: 'Revoke session' }))
    const confirm = await screen.findByRole('dialog', { name: 'Revoke session DS-3091?' })
    expect(store.read((db) => db.deviceSessions.find((item) => item.id === 'DS-3091')?.status)).toBe('active')
    await user.click(within(confirm).getByRole('button', { name: 'Revoke session' }))
    expect(await screen.findByText('Session DS-3091 revoked')).toBeInTheDocument()
    // The drawer stays open on the same session, now revoked, with the recovery path.
    const updated = await drawer('DS-3091')
    expect(await within(updated).findByRole('button', { name: 'Start recovery' })).toBeInTheDocument()
    expect(within(updated).getByText(/Revoked sessions cannot be reactivated and cannot upload/)).toBeInTheDocument()
    expect(within(updated).queryByRole('button', { name: /Reactivate|Restore/ })).not.toBeInTheDocument()
  })

  it('changes nothing when the revoke confirmation is cancelled, and returns focus to the row menu', async () => {
    const user = userEvent.setup()
    const { store } = renderSessions()
    await sessionsTable()
    await chooseAction(user, 'DS-3091', 'Revoke session')
    const confirm = await screen.findByRole('dialog', { name: 'Revoke session DS-3091?' })
    expect(within(confirm).getByText(/cannot be reactivated/)).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByText('Session DS-3091 revoked')).not.toBeInTheDocument()
    expect(store.read((db) => db.deviceSessions.find((item) => item.id === 'DS-3091')?.status)).toBe('active')
    expect(screen.getByRole('button', { name: 'Actions for DS-3091' })).toHaveFocus()
  })

  it('revoked: View details and Start recovery, with the security warning; no reactivation', async () => {
    const user = userEvent.setup()
    const { router } = renderSessions()
    await user.click(await screen.findByRole('button', { name: 'Actions for DS-3012' }, { timeout: 10_000 }))
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent?.trim())).toEqual(['View details', 'Start recovery'])
    await user.click(screen.getByRole('menuitem', { name: 'View details' }))
    const details = await drawer('DS-3012')
    expect(within(details).getByText(/Revoked sessions cannot be reactivated and cannot upload\. Recovery needs an Administrator/)).toBeInTheDocument()
    expect(within(details).getByText('Revocation reason')).toBeInTheDocument()
    expect(within(details).queryByRole('button', { name: 'Revoke session' })).not.toBeInTheDocument()
    await user.click(within(details).getByRole('button', { name: 'Start recovery' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/device-sessions/DS-3012/recovery'))
    expect(await screen.findByText('Recovery ticket requested')).toBeInTheDocument()
  })

  it('signed out: View details only, and the drawer offers no action', async () => {
    const user = userEvent.setup()
    renderSessions()
    await user.click(await screen.findByRole('button', { name: 'Actions for DS-2977' }, { timeout: 10_000 }))
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent?.trim())).toEqual(['View details'])
    await user.click(screen.getByRole('menuitem', { name: 'View details' }))
    const details = await drawer('DS-2977')
    expect(within(details).getByText(/signed out on the device\. It cannot be used again/)).toBeInTheDocument()
    expect(within(details).queryByRole('button', { name: /Revoke|recovery/i })).not.toBeInTheDocument()
  })
})

describe('Device Sessions · table', { timeout: 30_000 }, () => {
  it('keeps search, filters, reset, sorting and pagination', async () => {
    const user = userEvent.setup()
    renderSessions('/admin/device-sessions', {
      prepare: (store) =>
        store.write((db) => {
          for (let index = 0; index < 12; index += 1) {
            db.deviceSessions.push({ id: `DS-40${String(index).padStart(2, '0')}`, userId: 'USR-010', device: 'Android 14 · Pixel 8', lastSeenAt: '2026-10-19T10:00:00+05:30', status: 'signed_out' })
          }
        }),
    })
    const table = await sessionsTable()
    // 7 seeded sessions within 30 days (DS-2977 included) + 12 added = 19, so two pages.
    expect(await screen.findByRole('navigation', { name: 'Pagination' })).toBeInTheDocument()
    expect(rowIds(table)).toHaveLength(15)
    await user.click(screen.getByRole('button', { name: 'Page 2' }))
    expect(rowIds(table)).toHaveLength(4)
    await user.click(screen.getByRole('button', { name: 'Page 1' }))

    await user.type(screen.getByRole('searchbox', { name: 'Search sessions' }), 'Redmi')
    await waitFor(() => expect(rowIds(table)).toEqual(['DS-3060']))
    await user.click(screen.getByRole('button', { name: 'Reset filters' }))
    await waitFor(() => expect(rowIds(table)).toHaveLength(15))

    await pickFilter(user, 'Status', 'Revoked')
    expect(rowIds(table)).toEqual(['DS-3012'])
    await pickFilter(user, 'Status', 'All')
    await pickFilter(user, 'Last seen', '7 days')
    expect(rowIds(table)).not.toContain('DS-2977')
    await user.click(screen.getByRole('button', { name: 'Reset filters' }))

    await user.click(within(table).getByRole('button', { name: /^Session/ }))
    const ascending = rowIds(table)
    expect(ascending[0]).toBe('DS-2977')
    await user.click(within(table).getByRole('button', { name: /^Session/ }))
    expect(rowIds(table)[0]).toBe('DS-4011')
  })

  it('filters by user from a ?user= link', async () => {
    renderSessions('/admin/device-sessions?user=USR-009')
    const table = await sessionsTable()
    await waitFor(() => expect(rowIds(table).sort()).toEqual(['DS-2977', 'DS-3091']))
    expect(screen.getByRole('combobox', { name: /^User:/ })).toBeInTheDocument()
  })
})

describe('Device Sessions · API mode', { timeout: 30_000 }, () => {
  it('shows the service as unavailable, sends no request and opens no drawer from fixture data', async () => {
    const { request } = renderSessions('/admin/device-sessions?session=DS-3012', { api: true })
    expect(await screen.findByRole('heading', { name: 'Device Sessions' }, { timeout: 10_000 })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('table', { name: 'Device sessions' })).not.toBeInTheDocument())
    expect(screen.queryByText('DS-3091')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(request).not.toHaveBeenCalled()
  })
})
