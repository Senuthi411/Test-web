import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
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
import { ROLE_NAVIGATION } from './routing/navigation'

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
    // Five finalised observations (verified or flagged more than 24 hours ago) are in Observation History.
    expect(await screen.findByText('10 observations in EST-002 · 5 in Observation History · demo data')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /Decision/ }))
    const table = screen.getByRole('table', { name: /Observations/ })
    expect(within(table).getAllByRole('link', { name: /^OBS-/ }).map((link) => link.textContent)).toEqual(['OBS-006', 'OBS-042'])
    await user.click(screen.getByRole('tab', { name: /All/ }))
    expect(within(table).queryByText('OBS-004')).not.toBeInTheDocument()
    await user.type(screen.getByRole('searchbox', { name: 'Search observations' }), 'Ravindu')
    await waitFor(() => expect(within(table).queryByText('OBS-005')).not.toBeInTheDocument())
    expect(within(table).getByText('OBS-006')).toBeInTheDocument()
  })
})

describe('REV-03 / REV-04 decisions', () => {
  it('verifies OBS-014 from the evidence, with no checklist to tick', async () => {
    const { user } = renderReview('/review/observations/OBS-014')
    expect(await screen.findByRole('heading', { name: 'Observation Review · OBS-014' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open evidence viewer' })).toHaveAttribute('href', '/observations/OBS-014/evidence')
    await user.click(screen.getByRole('link', { name: 'Verify observation' }))
    expect(await screen.findByRole('heading', { name: 'Verify Observation' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirm verification' }))
    expect(await screen.findByText('OBS-014 verified')).toBeInTheDocument()
    expect(await screen.findByText(/REV-014 · version 2/)).toBeInTheDocument()
    // Verified is final: no further decision is offered.
    for (const name of ['Verify observation', 'Flag observation', 'Request correction', 'Refer to expert']) expect(screen.queryByRole('link', { name })).not.toBeInTheDocument()
    expect(screen.getByText('Final decision recorded: Verified.')).toBeInTheDocument()
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

describe('REV-02 / REV-03 claim on open and status-dependent decisions', () => {
  const DECISIONS = ['Verify observation', 'Flag observation', 'Request correction', 'Refer to expert']
  const decisionLinks = () => DECISIONS.filter((name) => screen.queryByRole('link', { name }))
  const statusInObservationCard = () => screen.getByText('Review status').parentElement!

  it('opening a Submitted observation does not change it; Start review moves it to In review', async () => {
    const { router, user } = renderReview('/review/queue?status=submitted')
    const row = (await screen.findByRole('link', { name: 'OBS-013' })).closest('tr')!
    expect(within(row).getByText('Submitted')).toBeInTheDocument()
    await user.click(within(row).getByRole('link', { name: 'OBS-013' }))
    expect(await screen.findByRole('heading', { name: 'Observation Review · OBS-013' })).toBeInTheDocument()
    expect(within(statusInObservationCard()).getByText('Submitted')).toBeInTheDocument()
    expect(decisionLinks()).toEqual([])
    await user.click(screen.getByRole('button', { name: 'Start review' }))
    expect(await within(statusInObservationCard()).findByText('In review')).toBeInTheDocument()
    expect(decisionLinks()).toEqual(DECISIONS)
    expect(screen.getByText(/Claimed for review/)).toBeInTheDocument()
    await act(() => router.navigate('/review/queue'))
    const updated = (await screen.findByRole('link', { name: 'OBS-013' })).closest('tr')!
    expect(within(updated).getByText('In review')).toBeInTheDocument()
  })

  it('offers no decision on a final (Flagged or Verified) observation, shown as archived history', async () => {
    renderReview('/review/observations/OBS-004')
    expect(await screen.findByRole('heading', { name: 'Observation Review · OBS-004' })).toBeInTheDocument()
    expect(within(statusInObservationCard()).getByText('Flagged')).toBeInTheDocument()
    expect(decisionLinks()).toEqual([])
    expect(screen.getByText('Observation History · read-only')).toBeInTheDocument()
    cleanup()
    renderReview('/review/observations/OBS-015')
    expect(await screen.findByText('Final decision recorded: Verified.')).toBeInTheDocument()
    expect(decisionLinks()).toEqual([])
  })

  it('Referred waits for the expert; Decision shows the expert decision with Verify and Flag', async () => {
    renderReview('/review/observations/OBS-023')
    expect(await screen.findByText('Referred to a disease expert. Waiting for the expert decision.')).toBeInTheDocument()
    expect(decisionLinks()).toEqual([])
    cleanup()
    renderReview('/review/observations/OBS-006')
    const expert = await screen.findByRole('generic', { name: 'Expert decision' })
    expect(within(expert).getByText('Grey blight (DIS-002)')).toBeInTheDocument()
    expect(within(expert).getByText('Dr Tara Wijesinghe')).toBeInTheDocument()
    expect(within(statusInObservationCard()).getByText('Decision')).toBeInTheDocument()
    expect(decisionLinks()).toEqual(['Verify observation', 'Flag observation'])
  })

  it('refuses decision forms on a final observation', async () => {
    renderReview('/review/observations/OBS-004/request-correction')
    expect(await screen.findByText('No decision can be recorded')).toBeInTheDocument()
    cleanup()
    renderReview('/review/observations/OBS-004/verify')
    expect(await screen.findByText('No decision can be recorded')).toBeInTheDocument()
  })
})

describe('Supervisor sidebar navigation', () => {
  it('has exactly the five Supervisor items, in order', () => {
    expect(ROLE_NAVIGATION.SUPERVISOR.items.map((item) => [item.label, item.to])).toEqual([
      ['Dashboard', '/review'],
      ['Review Queue', '/review/queue'],
      ['Quarantine Queue', '/review/quarantine'],
      ['Decision History', '/review/history'],
      ['Fieldwork Assignments', '/assignments'],
    ])
  })

  it('lists Correction Queue, Expert Referrals and Evidence Viewer for no role', () => {
    for (const navigation of Object.values(ROLE_NAVIGATION)) {
      expect(navigation.items.filter((item) => ['Correction Queue', 'Expert Referrals', 'Evidence Viewer'].includes(item.label))).toEqual([])
    }
  })

  it('opens the Correction Queue and Expert Referrals from the Review Queue, highlighting Review Queue', async () => {
    const { user } = renderReview('/review/queue')
    await user.click(await screen.findByRole('link', { name: 'Correction Queue' }))
    expect(await screen.findByRole('heading', { name: 'Correction Queue' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'Review Queue' }).className).toMatch(/active/)
    expect(within(nav).queryByRole('link', { name: 'Correction Queue' })).not.toBeInTheDocument()
    cleanup()
    const second = renderReview('/review/queue')
    await second.user.click(await screen.findByRole('link', { name: 'Expert Referrals' }))
    expect(await screen.findByRole('heading', { name: 'Expert Referral Status' })).toBeInTheDocument()
  })

  it('keeps the evidence viewer reachable from the observation review', async () => {
    renderReview('/review/observations/OBS-014')
    expect(await screen.findByRole('link', { name: 'Open evidence viewer' })).toHaveAttribute('href', '/observations/OBS-014/evidence')
  })
})

describe('REV-07 – REV-11 corrections', () => {
  it('approves COR-005 without applying it, then simulates RevisionApplied', async () => {
    const { user } = renderReview('/review/corrections/COR-005')
    expect(await screen.findByRole('heading', { name: 'Correction COR-005' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Compare revisions' }))
    expect(await screen.findByRole('heading', { name: 'Original vs Revised' })).toBeInTheDocument()
    expect((await screen.findAllByText('Updated synthetic symptom description')).length).toBeGreaterThan(0)
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

describe('Resubmitted observations in the Review Queue', () => {
  it('lists Submitted and Resubmitted observations in the same queue with a Resubmitted tab and revision column', async () => {
    renderReview('/review/queue')
    expect(await screen.findByRole('tab', { name: /Resubmitted\s*1/ })).toBeInTheDocument()
    const row = screen.getByRole('link', { name: 'OBS-005' }).closest('tr')!
    expect(within(row).getByText('Resubmitted')).toBeInTheDocument()
    expect(within(row).getByText('V2 · resubmission')).toBeInTheDocument()
    const submitted = screen.getByRole('link', { name: 'OBS-013' }).closest('tr')!
    expect(within(submitted).getByText('Submitted')).toBeInTheDocument()
    expect(within(submitted).getByText('V1')).toBeInTheDocument()
  })

  it('opens a resubmitted observation unchanged; Start review moves it to In review with the same four decisions', async () => {
    const { user, store } = renderReview('/review/observations/OBS-005')
    expect(await screen.findByRole('heading', { name: 'Observation Review · OBS-005' })).toBeInTheDocument()
    expect(screen.getByText('Reviewing version 2 · OBSR-005-2')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Previous revision: version 1' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Compared revision: version 2' })).toBeInTheDocument()
    const notes = screen.getByRole('rowheader', { name: 'Field notes' }).closest('tr')!
    expect(within(notes).getByText('Changed')).toBeInTheDocument()
    const disease = screen.getByRole('rowheader', { name: 'Suspected disease' }).closest('tr')!
    expect(within(disease).getByText('No change')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Correction request COR-005' })).toHaveTextContent('Correction requested on version 1')
    // Opening does not change the status; no decision is offered until the review is started.
    expect(store.read((db) => db.observations.find((o) => o.id === 'OBS-005')?.reviewStatus)).toBe('resubmitted')
    expect(screen.queryByRole('link', { name: 'Verify observation' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start review' }))
    for (const name of ['Verify observation', 'Flag observation', 'Request correction', 'Refer to expert']) {
      expect(await screen.findByRole('link', { name })).toBeInTheDocument()
    }
    expect(store.read((db) => db.observations.find((o) => o.id === 'OBS-005')?.reviewStatus)).toBe('in_review')
    expect(screen.getByText('Decision applies to version 2 (OBSR-005-2).')).toBeInTheDocument()
    expect(screen.getByText('Review started on version 2')).toBeInTheDocument()
  })

  it('keeps the existing single-revision review for a normal submitted observation', async () => {
    renderReview('/review/observations/OBS-014')
    expect(await screen.findByRole('heading', { name: 'Observation Review · OBS-014' })).toBeInTheDocument()
    expect(screen.queryByText('Revision comparison')).not.toBeInTheDocument()
    expect(screen.getByText('Evidence')).toBeInTheDocument()
  })

  it('simulates the Field Worker resubmission only after it is stored, then shows the observation as Resubmitted', async () => {
    const { user, store } = renderReview('/review/observations/OBS-041')
    await user.click(await screen.findByRole('button', { name: 'Simulate: Field Worker resubmits correction' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Resubmit version 2' }))
    expect(await screen.findByText('Reviewing version 2 · OBSR-041-2')).toBeInTheDocument()
    expect(store.read((db) => db.observations.find((o) => o.id === 'OBS-041')?.reviewStatus)).toBe('resubmitted')
    expect(screen.getAllByText('Resubmitted').length).toBeGreaterThan(0)
  })

  it('shows the revision of each decision in the existing Decision History', async () => {
    renderReview('/review/history')
    expect(await screen.findByRole('columnheader', { name: 'Revision' })).toBeInTheDocument()
    const row = screen.getByRole('link', { name: 'COR-005' }).closest('tr')!
    expect(within(row).getByText('V1 · OBSR-005-1')).toBeInTheDocument()
  })
})
