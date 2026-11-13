import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { FixtureStore } from '@/fixtures'
import { createBrowserSessionPersistence } from '@/features/identity'
import type { WebRole } from '@/shared/types'
import { assembleContainer } from './composition/container'
import { createFixtureAdapterSet, fixtureClock } from './composition/fixtureAdapters'
import { AppProviders } from './providers/AppProviders'
import { createAppRoutes } from './routing/routes'

const USERS: Record<string, { fullName: string; role: WebRole; estateIds: string[] }> = {
  'USR-003': { fullName: 'Malini Fernando', role: 'SUPERVISOR', estateIds: ['EST-002'] },
  'USR-002': { fullName: 'Nimal Silva', role: 'SUPERVISOR', estateIds: ['EST-001'] },
  'USR-001': { fullName: 'Anika Perera', role: 'ADMINISTRATOR', estateIds: ['EST-001', 'EST-002', 'EST-003'] },
}

function renderReview(path: string, userId = 'USR-003') {
  const store = new FixtureStore({ latencyMs: 0 })
  const persistence = createBrowserSessionPersistence()
  const user = USERS[userId]
  persistence.save(
    { user: { id: userId, fullName: user.fullName, email: 'demo@example.test', role: user.role, estateIds: user.estateIds, divisionIds: [] }, source: 'fixtures', accessToken: null, signedInAt: '2026-10-21T09:00:00+05:30' },
    false,
  )
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

describe('REV-01 / REV-02', () => {
  it('shows the supervisor dashboard with Figma counts and attention items', async () => {
    renderReview('/review')
    expect(await screen.findByRole('heading', { name: 'Supervisor Dashboard' })).toBeInTheDocument()
    expect(screen.getByText(/Riverbend Tea Estate \(EST-002\) · 15 observations in your scope · Wed 21 Oct 2026/)).toBeInTheDocument()
    expect(screen.getByText('COR-005, COR-041')).toBeInTheDocument()
    expect(screen.getByText('REF-006, REF-023, REF-042')).toBeInTheDocument()
    expect(screen.getByText('QUA-002 released, pending ingest')).toBeInTheDocument()
    expect(screen.getByText('17 days')).toBeInTheDocument()
  })

  it('filters the queue by status tab and search, labelled as demo data', async () => {
    const { user } = renderReview('/review/queue')
    expect(await screen.findByText('15 observations in EST-002 · demo data')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /Flagged/ }))
    const table = screen.getByRole('table', { name: /Observations/ })
    expect(within(table).getAllByRole('link', { name: /^OBS-/ }).map((link) => link.textContent)).toEqual(['OBS-004', 'OBS-024', 'OBS-040'])
    await user.click(screen.getByRole('tab', { name: /All/ }))
    await user.type(screen.getByRole('searchbox', { name: 'Search observations' }), 'Ravindu')
    await waitFor(() => expect(within(table).queryByText('OBS-004')).not.toBeInTheDocument())
    expect(within(table).getByText('OBS-006')).toBeInTheDocument()
  })
})

describe('REV-03 / REV-04 decisions', () => {
  it('verifies OBS-014 only after the checklist is complete', async () => {
    const { user } = renderReview('/review/observations/OBS-014')
    expect(await screen.findByRole('heading', { name: 'Observation Review · OBS-014' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open evidence viewer' })).toHaveAttribute('href', '/observations/OBS-014/evidence')
    await user.click(screen.getByRole('link', { name: 'Verify observation' }))
    expect(await screen.findByRole('heading', { name: 'Verify Observation' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirm verification' }))
    expect(await screen.findByText('Confirm every checklist item before verifying')).toBeInTheDocument()
    for (const box of screen.getAllByRole('checkbox')) await user.click(box)
    await user.click(screen.getByRole('button', { name: 'Confirm verification' }))
    expect(await screen.findByText('OBS-014 verified')).toBeInTheDocument()
    expect(await screen.findByText(/version 2/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Verify observation' })).not.toBeInTheDocument()
  })

  it('keeps the form and shows no success when the decision fails', async () => {
    const { store, user } = renderReview('/review/observations/OBS-014/flag')
    await user.type(await screen.findByRole('textbox', { name: /Explanation/ }), 'Leaf is out of focus')
    store.failNext('unavailable')
    await user.click(screen.getByRole('button', { name: 'Flag observation' }))
    expect(await screen.findByText('The decision was not recorded')).toBeInTheDocument()
    expect(screen.queryByText('OBS-014 flagged')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Explanation/ })).toHaveValue('Leaf is out of focus')
  })

  it('requires a flag explanation', async () => {
    const { user } = renderReview('/review/observations/OBS-014/flag')
    await user.click(await screen.findByRole('button', { name: 'Flag observation' }))
    expect(await screen.findByText('Add a note explaining the flag before continuing')).toBeInTheDocument()
  })

  it('refers OBS-014 and shows REF-014 with a pending case link', async () => {
    const { user } = renderReview('/review/observations/OBS-014/refer')
    expect(await screen.findByText('CASE-011, CASE-023, CASE-047')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: /Referral note/ }), 'Confirm grey blight')
    await user.click(screen.getByRole('button', { name: 'Send referral' }))
    expect(await screen.findByText('Referral REF-014 sent')).toBeInTheDocument()
    const row = screen.getByRole('button', { name: 'REF-014' }).closest('tr')!
    expect(within(row).getByText('Pending case link')).toBeInTheDocument()
    expect(within(row).getByText('Not yet created')).toBeInTheDocument()
  })

  it('blocks decision routes for observations that are not in review', async () => {
    renderReview('/review/observations/OBS-015/verify')
    expect(await screen.findByText('No decision can be recorded')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm verification' })).not.toBeInTheDocument()
  })
})

describe('REV-07 – REV-11 corrections', () => {
  it('approves COR-005 without applying it, then simulates RevisionApplied', async () => {
    const { user } = renderReview('/review/corrections/COR-005')
    expect(await screen.findByRole('heading', { name: 'Correction COR-005' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Compare revisions' }))
    expect(await screen.findByRole('heading', { name: 'Original vs Revised' })).toBeInTheDocument()
    expect(screen.getByText('Updated synthetic symptom description')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Approve' }))
    await user.click(await screen.findByRole('checkbox', { name: 'I compared the original and revised data' }))
    await user.click(screen.getByRole('checkbox', { name: 'Original evidence is unchanged' }))
    await user.click(screen.getByRole('button', { name: 'Confirm approval' }))
    expect(await screen.findByText('Approved — waiting for RevisionApplied')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Simulate RevisionApplied event' }))
    expect(await screen.findByText('RevisionApplied (simulated)')).toBeInTheDocument()
  })

  it('requires a message to reject COR-041 and records the rejection', async () => {
    const { user } = renderReview('/review/corrections/COR-041/reject')
    await user.click(await screen.findByRole('button', { name: 'Confirm rejection' }))
    expect(await screen.findByText('A message is required when rejecting a correction')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: /Message to field worker/ }), 'Image still unclear')
    await user.click(screen.getByRole('button', { name: 'Confirm rejection' }))
    expect(await screen.findByText(/Rejected on 21 Oct 2026 by Malini Fernando\. Reason: Evidence still unclear/)).toBeInTheDocument()
  })

  it('lists the Riverbend corrections in the Open tab', async () => {
    renderReview('/review/corrections')
    expect(await screen.findByRole('link', { name: 'COR-005' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'COR-041' })).toBeInTheDocument()
  })
})

describe('REV-13 – REV-17', () => {
  it('scopes quarantine to the supervisor and blocks the missing REV-16 decision', async () => {
    const { user } = renderReview('/review/quarantine')
    expect(await screen.findByRole('link', { name: 'QUA-002' })).toBeInTheDocument()
    expect(screen.queryByText('QUA-001')).not.toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'QUA-002' }))
    expect(await screen.findByRole('heading', { name: 'Quarantine Record QUA-002' })).toBeInTheDocument()
    expect(screen.getAllByText('QDEC-002').length).toBeGreaterThan(0)
  })

  it('shows REV-16 as unavailable rather than inventing a decision form', async () => {
    renderReview('/review/quarantine/QUA-001/decide', 'USR-002')
    expect(await screen.findByText('Quarantine decisions are not available yet')).toBeInTheDocument()
  })

  it('lists 11 decisions in the history', async () => {
    renderReview('/review/history')
    expect(await screen.findByRole('tab', { name: /All\s*11/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'QDEC-002' })).toBeInTheDocument()
  })
})

describe('authorization and scope', () => {
  it('denies the Review module to an administrator', async () => {
    renderReview('/review/queue', 'USR-001')
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument()
  })

  it('does not reveal out-of-scope observations or corrections', async () => {
    renderReview('/review/observations/OBS-014', 'USR-002')
    expect(await screen.findByText('This record could not be found')).toBeInTheDocument()
  })

  it('does not reveal another estate correction by direct URL', async () => {
    renderReview('/review/corrections/COR-005', 'USR-002')
    expect(await screen.findByText('Correction unavailable')).toBeInTheDocument()
  })
})
