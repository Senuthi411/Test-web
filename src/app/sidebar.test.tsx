import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { createBrowserSessionPersistence, type Session } from '@/features/identity'
import type { WebRole } from '@/shared/types'
import { createContainer } from './composition/container'
import type { AppConfig } from './composition/config'
import { AppProviders } from './providers/AppProviders'
import { createAppRoutes } from './routing/routes'

const FIXTURE_CONFIG: AppConfig = { dataSource: 'fixtures', apiBaseUrl: '', apiTimeoutMs: 15_000 }
const API_CONFIG: AppConfig = { dataSource: 'api', apiBaseUrl: 'http://localhost:3000/api/v1', apiTimeoutMs: 15_000 }

/** Session users for these tests. The sidebar must show whoever is signed in. */
const USERS: Record<WebRole, Session['user']> = {
  ADMINISTRATOR: { id: 'USR-001', fullName: 'Anika Perera', email: 'anika.perera@example.test', role: 'ADMINISTRATOR', estateIds: ['EST-001', 'EST-002', 'EST-003'], divisionIds: [] },
  SUPERVISOR: { id: 'USR-003', fullName: 'Malini Fernando', email: 'malini.fernando@example.test', role: 'SUPERVISOR', estateIds: ['EST-002'], divisionIds: [] },
  DISEASE_EXPERT: { id: 'USR-005', fullName: 'Dr Tara Wijesinghe', email: 'dr.tara.wijesinghe@example.test', role: 'DISEASE_EXPERT', estateIds: ['EST-001', 'EST-002'], divisionIds: [] },
  REPORTING_USER: { id: 'USR-013', fullName: 'Maya Dissanayake', email: 'maya.dissanayake@example.test', role: 'REPORTING_USER', estateIds: ['EST-001', 'EST-002'], divisionIds: [] },
}

function signInAs(role: WebRole, source: Session['source'] = 'fixtures') {
  createBrowserSessionPersistence().save({ user: USERS[role], accessToken: null, source, signedInAt: '2026-10-21T09:00:00+05:30' })
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

const mainNav = () => screen.findByRole('navigation', { name: 'Main' }, { timeout: 5000 })
const sidebar = () => screen.getByRole('complementary', { name: 'Sidebar' })
const accountButton = (name: string, role: string) => screen.findByRole('button', { name: `Account menu for ${name}, ${role}` }, { timeout: 5000 })

describe('sidebar navigation', () => {
  it('lists the Administrator navigation in order with no visible section headings', async () => {
    signInAs('ADMINISTRATOR')
    await renderApp('/admin')
    const nav = await mainNav()
    const groups = within(nav).getAllByRole('list').map((list) => ({
      label: list.getAttribute('aria-label'),
      items: within(list).getAllByRole('link').map((link) => link.textContent?.trim()),
    }))
    expect(groups).toEqual([
      { label: 'Overview', items: ['Dashboard'] },
      { label: 'Identity & Access', items: ['Users', 'Roles & Permissions', 'Device Sessions'] },
      { label: 'Estate Management', items: ['Estates', 'Divisions'] },
      { label: 'Security', items: ['Security & Settings'] },
      { label: 'Account', items: ['My Profile'] },
    ])
    for (const heading of ['Overview', 'Identity & Access', 'Estate Management', 'Security', 'Account']) {
      expect(within(nav).queryByText(heading)).not.toBeInTheDocument()
    }
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
  })

  it.each([
    ['/admin/users/new', 'Users'],
    ['/admin/users/USR-003', 'Users'],
    ['/admin/estates/EST-001', 'Estates'],
    ['/admin/divisions/DIV-001', 'Divisions'],
    ['/admin/security?tab=policies', 'Security & Settings'],
  ])('highlights the parent item on %s', async (path, label) => {
    signInAs('ADMINISTRATOR')
    await renderApp(path)
    const nav = await mainNav()
    expect(within(nav).getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current')
  })

  it.each(['SUPERVISOR', 'DISEASE_EXPERT', 'REPORTING_USER'] as const)('never shows Administrator modules to %s', async (role) => {
    signInAs(role)
    await renderApp('/')
    const nav = await mainNav()
    for (const label of ['Users', 'Roles & Permissions', 'Device Sessions', 'Estates', 'Divisions', 'Security & Settings']) {
      expect(within(nav).queryByRole('link', { name: label })).not.toBeInTheDocument()
    }
    expect(within(nav).getByRole('link', { name: 'My Profile' })).toHaveAttribute('href', '/profile')
    for (const heading of ['Overview', 'Review', 'Fieldwork', 'Cases', 'Analytics', 'Reporting', 'Account']) {
      expect(within(nav).queryByText(heading, { exact: true })).not.toBeInTheDocument()
    }
  })

  it('collapses to icons with accessible names and tooltips, and remembers the choice', async () => {
    signInAs('ADMINISTRATOR')
    const user = userEvent.setup()
    await renderApp('/admin')
    await user.click(await screen.findByRole('button', { name: 'Collapse sidebar' }))
    const nav = screen.getByRole('navigation', { name: 'Main' })
    const users = within(nav).getByRole('link', { name: 'Users' })
    expect(users).not.toHaveTextContent('Users')
    expect(within(nav).queryByText('Identity & Access')).not.toBeInTheDocument()
    expect(nav.querySelector('hr')).toBeNull()
    await user.hover(users)
    expect(within(sidebar()).getByText('Users')).toBeInTheDocument()
    await user.unhover(users)
    expect(within(sidebar()).queryByText('Users')).not.toBeInTheDocument()
    fireEvent.focus(within(nav).getByRole('link', { name: 'Estates' }))
    expect(within(sidebar()).getByText('Estates')).toBeInTheDocument()
    expect(window.localStorage.getItem('tealeaf.sidebarCollapsed')).toBe('true')
    expect(screen.queryByText('Demonstration data · UI design only')).not.toBeInTheDocument()
  })
})

describe('sidebar account menu', () => {
  it('shows the signed-in employee and keeps the menu closed until opened', async () => {
    signInAs('DISEASE_EXPERT')
    await renderApp('/cases')
    const trigger = await accountButton('Dr Tara Wijesinghe', 'Disease expert')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(within(sidebar()).getByText('Dr Tara Wijesinghe')).toBeInTheDocument()
    expect(within(sidebar()).queryByText('Anika Perera')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'View Profile' })).not.toBeInTheDocument()
  })

  it('offers the account actions and marks Security Settings as not available', async () => {
    signInAs('ADMINISTRATOR')
    const user = userEvent.setup()
    await renderApp('/admin')
    const trigger = await accountButton('Anika Perera', 'Administrator')
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'View Profile' })).toHaveAttribute('href', '/profile')
    const security = screen.getByRole('button', { name: 'Security Settings (MFA)' })
    expect(security).toHaveAttribute('aria-disabled', 'true')
    expect(security).toHaveAccessibleDescription('Not available yet')
    await user.click(security)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Change Password' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeInTheDocument()
  })

  it('closes on Escape (returning focus) and on an outside click', async () => {
    signInAs('ADMINISTRATOR')
    const user = userEvent.setup()
    await renderApp('/admin')
    const trigger = await accountButton('Anika Perera', 'Administrator')
    await user.click(trigger)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('link', { name: 'View Profile' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    await user.click(trigger)
    await user.click(screen.getByRole('main'))
    expect(screen.queryByRole('link', { name: 'View Profile' })).not.toBeInTheDocument()
  })

  it('opens My Profile and closes the menu', async () => {
    signInAs('SUPERVISOR')
    const user = userEvent.setup()
    const router = await renderApp('/review')
    await user.click(await accountButton('Malini Fernando', 'Supervisor'))
    await user.click(screen.getByRole('link', { name: 'View Profile' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/profile'))
    expect(screen.queryByRole('link', { name: 'View Profile' })).not.toBeInTheDocument()
  })

  it('takes Change Password to the Security card on My Profile', async () => {
    signInAs('ADMINISTRATOR')
    const user = userEvent.setup()
    await renderApp('/admin')
    await user.click(await accountButton('Anika Perera', 'Administrator'))
    await user.click(screen.getByRole('link', { name: 'Change Password' }))
    const current = await screen.findByLabelText(/Current password/, {}, { timeout: 5000 })
    await waitFor(() => expect(current).toHaveFocus())
  })

  it('signs out through the session service', async () => {
    signInAs('REPORTING_USER')
    const user = userEvent.setup()
    const router = await renderApp('/analytics')
    await user.click(await accountButton('Maya Dissanayake', 'Reporting user'))
    await user.click(screen.getByRole('button', { name: 'Sign Out' }))
    expect(await screen.findByRole('heading', { name: 'Welcome Back' }, { timeout: 5000 })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(window.sessionStorage.getItem('tealeaf.session')).toBeNull()
  })
})

describe('sidebar data source', () => {
  it('shows the demonstration note in fixture mode', async () => {
    signInAs('ADMINISTRATOR')
    await renderApp('/admin')
    await mainNav()
    expect(within(sidebar()).getByText('Demonstration data · UI design only')).toBeInTheDocument()
  })

  it('hides the demonstration note in API mode', async () => {
    signInAs('ADMINISTRATOR', 'api')
    await renderApp('/profile', API_CONFIG)
    await mainNav()
    expect(within(sidebar()).getByText('Anika Perera')).toBeInTheDocument()
    expect(screen.queryByText('Demonstration data · UI design only')).not.toBeInTheDocument()
  })
})
