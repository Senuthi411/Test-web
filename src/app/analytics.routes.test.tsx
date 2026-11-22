import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FixtureStore, createSeedDatabase } from '@/fixtures'
import { createBrowserSessionPersistence } from '@/features/identity'
import type { WebRole } from '@/shared/types'
import { assembleContainer } from './composition/container'
import { createFixtureAdapterSet, fixtureClock } from './composition/fixtureAdapters'
import { AppProviders } from './providers/AppProviders'
import { createAppRoutes } from './routing/routes'

const USERS: Record<string, { fullName: string; role: WebRole; estateIds: string[] }> = {
  'USR-013': { fullName: 'Maya Dissanayake', role: 'REPORTING_USER', estateIds: ['EST-001', 'EST-002'] },
  'USR-003': { fullName: 'Malini Fernando', role: 'SUPERVISOR', estateIds: ['EST-002'] },
}

function renderAnalytics(path: string, userId = 'USR-013') {
  const store = new FixtureStore({ latencyMs: 0 })
  const persistence = createBrowserSessionPersistence()
  const user = USERS[userId]
  persistence.save({
    user: { id: userId, fullName: user.fullName, email: 'demo@example.test', role: user.role, estateIds: user.estateIds, divisionIds: [] },
    source: 'fixtures',
    accessToken: null,
    signedInAt: '2026-10-21T09:00:00+05:30',
  })
  const adapters = createFixtureAdapterSet(() => persistence.load()?.user.id ?? null, store)
  const container = assembleContainer({ dataSource: 'fixtures', apiBaseUrl: '', apiTimeoutMs: 15000 }, adapters, fixtureClock, persistence)
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] })
  render(
    <AppProviders container={container}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { store, router, user: userEvent.setup() }
}

afterEach(() => vi.restoreAllMocks())

/** Waits until the screen heading is shown and the snapshot has loaded (Export becomes available). */
async function ready(title: string) {
  expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled())
}

const SCREENS: Array<[string, string]> = [
  ['/analytics', 'Analytics Dashboard'],
  ['/analytics/estates', 'Estate Overview'],
  ['/analytics/divisions', 'Division Overview'],
  ['/analytics/observations', 'Observation Statistics'],
  ['/analytics/diseases', 'Disease Distribution'],
  ['/analytics/suspected-vs-confirmed', 'Suspected vs Confirmed Disease Trends'],
  ['/analytics/bottlenecks', 'Review Bottlenecks'],
  ['/analytics/filters', 'Reporting Filters'],
  ['/analytics/freshness', 'Data Freshness Information'],
]

describe('AN-01 – AN-09 routes', () => {
  it.each(SCREENS)('%s renders %s inside the shared shell with demo data in scope', async (path, title) => {
    renderAnalytics(path)
    await ready(title)
    expect(screen.queryByText(/not available yet|ScreenPending/i)).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/Mist Valley|EST-003/)
  })

  it('AN-01 shows the scoped KPI values and links the confirmed card to /analytics/suspected-vs-confirmed', async () => {
    renderAnalytics('/analytics')
    await ready('Analytics Dashboard')
    const kpis = screen.getByRole('region', { name: 'Key performance indicators' })
    expect(within(kpis).getByRole('region', { name: 'Total observations' })).toHaveTextContent('33')
    const seed = createSeedDatabase()
    const permitted = new Set(seed.divisions.filter(d => USERS['USR-013'].estateIds.includes(d.estateId)).map(d => d.id))
    const pending = seed.observations.filter(o => permitted.has(o.divisionId) && ['submitted', 'resubmitted', 'in_review'].includes(o.reviewStatus)).length
    expect(within(kpis).getByRole('region', { name: 'Awaiting review' })).toHaveTextContent(String(pending))
    const confirmed = within(kpis).getByRole('region', { name: 'Confirmed diagnoses' })
    expect(confirmed).toHaveTextContent('2')
    expect(confirmed).toHaveTextContent('From 6 expert referrals')
    expect(confirmed.closest('a')).toHaveAttribute('href', '/analytics/suspected-vs-confirmed')
  })

  it('AN-06 lists the two expert diagnoses and the three awaiting cases', async () => {
    renderAnalytics('/analytics/suspected-vs-confirmed')
    await ready('Suspected vs Confirmed Disease Trends')
    const table = await screen.findByRole('table', { name: 'Confirmed expert diagnoses' })
    expect(within(table).getAllByRole('button').map((item) => item.textContent)).toEqual(['DIAG-042', 'DIAG-006'])
    // IDs are separate unbreakable spans, so match the combined text of the value.
    expect(screen.getAllByText((_, element) => element?.textContent === 'CASE-011 · CASE-023 · CASE-047').length).toBeGreaterThan(0)
  })

  it('URL filters drive the report and survive navigation between AN screens', async () => {
    const { user, router } = renderAnalytics('/analytics/estates?estate=EST-002')
    await ready('Estate Overview')
    expect(screen.getByText(/Filtered report · Riverbend Tea Estate/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Riverbend Tea Estate (EST-002)' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Division Overview' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/analytics/divisions')
    expect(router.state.location.search).toContain('estate=EST-002')
  })

  it('forged out-of-scope filters show a scope warning instead of data', async () => {
    renderAnalytics('/analytics?estate=EST-003')
    expect(await screen.findByText(/outside your reporting scope/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled()
  })

  it('AN-07 opens the read-only observation detail with the keyboard', async () => {
    const { user } = renderAnalytics('/analytics/bottlenecks')
    const table = await screen.findByRole('table', { name: 'Longest-waiting observations' })
    within(table).getByRole('button', { name: 'OBS-019' }).focus()
    await user.keyboard('{Enter}')
    const dialog = await screen.findByRole('dialog', { name: 'OBS-019' })
    expect(within(dialog).getByText('Read-only analytics snapshot. Evidence and review actions remain in their owning workspaces.')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('exports the page-specific CSV from the Export dialog', async () => {
    const created: Blob[] = []
    const createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob)
      return 'blob:analytics'
    })
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { user } = renderAnalytics('/analytics/bottlenecks')
    await ready('Review Bottlenecks')
    await user.click(screen.getByRole('button', { name: 'Export' }))
    const dialog = await screen.findByRole('dialog', { name: 'Export report' })
    expect(within(dialog).getByText('File: tealeaf-review-bottlenecks-2026-10-21.csv')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /Download CSV/ }))
    expect(click).toHaveBeenCalledOnce()
    const text = await created[0].text()
    expect(text.split('\r\n')[1]).toMatch(/^"OBS-019","EST-001","Highland Tea Estate","DIV-001","North Ridge","Submitted","2026-10-01",20,"yes"/)
    expect(text).not.toMatch(/EST-003/)
    expect(await screen.findByText('Report downloaded as CSV.')).toBeInTheDocument()
  })
})

describe('analytics authorization', () => {
  it('denies the Analytics module to a supervisor', async () => {
    renderAnalytics('/analytics', 'USR-003')
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument()
  })

  it('still lets the supervisor open the Review dashboard', async () => {
    renderAnalytics('/review', 'USR-003')
    expect(await screen.findByRole('heading', { name: 'Supervisor Dashboard' })).toBeInTheDocument()
  })
})
