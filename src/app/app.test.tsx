import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { createBrowserSessionPersistence, type Session } from '@/features/identity'
import { AppError } from '@/shared/api'
import type { WebRole } from '@/shared/types'
import { createContainer } from './composition/container'
import type { AppConfig } from './composition/config'
import { AppProviders } from './providers/AppProviders'
import { createQueryClient, shouldRetry } from './providers/queryClient'
import { ROLE_NAVIGATION } from './routing/navigation'
import { createAppRoutes } from './routing/routes'
import { safeNextPath } from '@/shared/utilities/safeNextPath'

const FIXTURE_CONFIG: AppConfig = { dataSource: 'fixtures', apiBaseUrl: '', apiTimeoutMs: 15_000 }

const USERS: Record<WebRole, Session['user']> = {
  ADMINISTRATOR: { id: 'USR-001', fullName: 'Anika Perera', email: 'anika.perera@example.test', role: 'ADMINISTRATOR', estateIds: ['EST-001', 'EST-002', 'EST-003'], divisionIds: [] },
  SUPERVISOR: { id: 'USR-003', fullName: 'Malini Fernando', email: 'malini.fernando@example.test', role: 'SUPERVISOR', estateIds: ['EST-002'], divisionIds: [] },
  DISEASE_EXPERT: { id: 'USR-005', fullName: 'Dr Tara Wijesinghe', email: 'dr.tara.wijesinghe@example.test', role: 'DISEASE_EXPERT', estateIds: ['EST-001', 'EST-002'], divisionIds: [] },
  REPORTING_USER: { id: 'USR-013', fullName: 'Maya Dissanayake', email: 'maya.dissanayake@example.test', role: 'REPORTING_USER', estateIds: ['EST-001', 'EST-002'], divisionIds: [] },
}

function signInAs(role: WebRole, source: Session['source'] = 'fixtures') {
  createBrowserSessionPersistence().save(
    { user: USERS[role], accessToken: null, source, signedInAt: '2026-10-21T09:00:00+05:30' },
    false,
  )
}

async function renderApp(path: string, config: AppConfig = FIXTURE_CONFIG) {
  const container = await createContainer(config)
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] })
  render(
    <AppProviders container={container}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return router
}

describe('route guards', () => {
  it('sends signed-out users to the login page and remembers where they were going', async () => {
    const router = await renderApp('/review/queue?tab=flagged')
    expect(await screen.findByRole('heading', { name: 'Welcome Back' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(new URLSearchParams(router.state.location.search).get('next')).toBe('/review/queue?tab=flagged')
  })

  it.each([
    ['ADMINISTRATOR', '/admin'],
    ['SUPERVISOR', '/review'],
    ['DISEASE_EXPERT', '/cases'],
    ['REPORTING_USER', '/analytics'],
  ] as const)('sends %s from / to its home area %s', async (role, home) => {
    signInAs(role)
    const router = await renderApp('/')
    await screen.findByRole('navigation', { name: 'Main' })
    expect(router.state.location.pathname).toBe(home)
  })

  it('shows access denied, keeping the URL, when the role does not match', async () => {
    signInAs('REPORTING_USER')
    const router = await renderApp('/admin/users')
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/users')
  })

  it('does not reuse a fixture session when the app runs in API mode', async () => {
    signInAs('ADMINISTRATOR', 'fixtures')
    const router = await renderApp('/admin', { dataSource: 'api', apiBaseUrl: 'http://localhost:3000/api/v1', apiTimeoutMs: 15_000 })
    await screen.findByRole('heading', { name: 'Welcome Back' })
    expect(router.state.location.pathname).toBe('/login')
  })

  it('accepts only in-app paths as the post-login destination', () => {
    expect(safeNextPath('/review/queue?tab=1')).toBe('/review/queue?tab=1')
    expect(safeNextPath('https://evil.test')).toBeNull()
    expect(safeNextPath('//evil.test')).toBeNull()
    expect(safeNextPath('/\\evil.test')).toBeNull()
    expect(safeNextPath(null)).toBeNull()
  })
})

describe('application shell', () => {
  it.each(Object.keys(ROLE_NAVIGATION) as WebRole[])('shows the Figma sidebar for %s', async (role) => {
    signInAs(role)
    await renderApp('/')
    const nav = await screen.findByRole('navigation', { name: 'Main' })
    const labels = within(nav).getAllByRole('link').map((link) => link.textContent?.trim())
    expect(labels).toEqual(ROLE_NAVIGATION[role].items.map((item) => item.label))
    expect(within(screen.getByRole('complementary', { name: 'Sidebar' })).getByText(USERS[role].fullName)).toBeInTheDocument()
  })

  it('marks the current page and shows breadcrumbs and the screen placeholder', async () => {
    // Review (Phase 5) is implemented; Cases (Phase 6) still renders placeholders.
    signInAs('DISEASE_EXPERT')
    await renderApp('/cases/assigned')
    const nav = await screen.findByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'Assigned Cases' })).toHaveAttribute('aria-current', 'page')
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(crumbs).getByText('Cases')).toBeInTheDocument()
    expect(within(crumbs).getByText('Assigned Cases')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText(/CASE-02 Assigned Cases is scheduled for Phase 6/)).toBeInTheDocument()
  })

  it('labels fixture mode as demonstration data', async () => {
    signInAs('ADMINISTRATOR')
    await renderApp('/admin')
    expect(await screen.findByText('Demo data')).toBeInTheDocument()
    expect(screen.getByText('Demonstration data · UI design only')).toBeInTheDocument()
  })

  it('collapses the sidebar and remembers the choice', async () => {
    signInAs('DISEASE_EXPERT')
    const user = userEvent.setup()
    await renderApp('/cases')
    await user.click(await screen.findByRole('button', { name: 'Collapse sidebar' }))
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('link', { name: 'Assigned Cases' })).toBeInTheDocument()
    expect(window.localStorage.getItem('tealeaf.sidebarCollapsed')).toBe('true')
  })

  it('signs out from the profile menu and clears the stored session', async () => {
    signInAs('ADMINISTRATOR')
    const user = userEvent.setup()
    const router = await renderApp('/admin')
    await user.click(await screen.findByRole('button', { name: 'Account menu for Anika Perera' }))
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('heading', { name: 'Welcome Back' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(window.sessionStorage.getItem('tealeaf.session')).toBeNull()
  })

  it('answers global search honestly instead of pretending to search', async () => {
    signInAs('REPORTING_USER')
    const user = userEvent.setup()
    await renderApp('/analytics')
    const search = await screen.findByRole('searchbox', { name: 'Search' })
    expect(search).toHaveAttribute('placeholder', 'Search reports and filters')
    await user.type(search, 'freshness{Enter}')
    expect(await screen.findByText('Search is not available yet')).toBeInTheDocument()
  })
})

describe('query client', () => {
  it('ends the session on a 401 from any query', async () => {
    const onUnauthorized = vi.fn()
    const client = createQueryClient(onUnauthorized)
    await expect(
      client.fetchQuery({
        queryKey: ['x'],
        retry: false,
        queryFn: () => Promise.reject(new AppError('unauthorized', 'expired')),
      }),
    ).rejects.toBeInstanceOf(AppError)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('retries transient failures only', () => {
    expect(shouldRetry(0, new AppError('unavailable', 'x'))).toBe(true)
    expect(shouldRetry(2, new AppError('unavailable', 'x'))).toBe(false)
    expect(shouldRetry(0, new AppError('forbidden', 'x'))).toBe(false)
    expect(shouldRetry(0, new AppError('contract_pending', 'x'))).toBe(false)
  })
})
