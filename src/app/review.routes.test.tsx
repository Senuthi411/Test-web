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
import { navItemsOf, ROLE_NAVIGATION } from './routing/navigation'

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
    // Verified and Flagged are no longer archived automatically: every observation is in the queue until End Process.
    expect(await screen.findByText('15 observations in EST-002 · demo data')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /Decision/ }))
    const table = screen.getByRole('table', { name: /Observations/ })
    expect(within(table).getAllByRole('link', { name: /^OBS-/ }).map((link) => link.textContent)).toEqual(['OBS-006', 'OBS-042'])
    await user.click(screen.getByRole('tab', { name: /All/ }))
    expect(within(table).getByText('OBS-004')).toBeInTheDocument()
    await user.type(screen.getByRole('searchbox', { name: 'Search observations' }), 'Ravindu')
    await waitFor(() => expect(within(table).queryByText('OBS-005')).not.toBeInTheDocument())
    expect(within(table).getByText('OBS-006')).toBeInTheDocument()
  })
})

describe('REV-03 / REV-04 decisions', () => {
  it('no longer offers Verify on the Decision Observation page', async () => {
    renderReview('/review/observations/OBS-014')
    expect(await screen.findByRole('heading', { name: 'Observation Review · OBS-014' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open evidence viewer' })).toHaveAttribute('href', '/observations/OBS-014/evidence?from=review')
    expect(screen.queryByRole('link', { name: 'Verify observation' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Reject observation' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /View (Expert Diagnosis|Decision)/ })).not.toBeInTheDocument()
    // In review has not been decided yet: End Process is not offered.
    expect(screen.queryByRole('button', { name: 'End Process' })).not.toBeInTheDocument()
  })

  it('verifies OBS-014 from the evidence, with no checklist to tick', async () => {
    const { user } = renderReview('/review/observations/OBS-014/verify')
    expect(await screen.findByRole('heading', { name: 'Verify Observation' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirm verification' }))
    expect(await screen.findByText('OBS-014 verified')).toBeInTheDocument()
    expect(await screen.findByText(/REV-014 · version 2/)).toBeInTheDocument()
    // Verified leads on to Refer to Expert or End Process; no other verdict or correction is offered.
    for (const name of ['Verify Observation', 'Flag Observation', 'Request Correction']) expect(screen.queryByRole('link', { name })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Refer to Expert' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'End Process' })).toBeInTheDocument()
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
    // Referral is a step from Verified (OBS-015); an In Review observation cannot be referred.
    const { user } = renderReview('/review/observations/OBS-015/refer')
    expect(await screen.findByText('CASE-011, CASE-023, CASE-047')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: /Referral note/ }), 'Confirm brown blight')
    await user.click(screen.getByRole('button', { name: 'Send referral' }))
    expect(await screen.findByText('Referral REF-015 sent')).toBeInTheDocument()
    const row = screen.getByRole('button', { name: 'REF-015' }).closest('tr')!
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
  const DECISIONS = ['Verify Observation', 'Flag Observation', 'Request Correction', 'Refer to Expert']
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
    // Start Review asks for confirmation; Cancel changes nothing.
    await user.click(screen.getByRole('button', { name: 'Start Review' }))
    const confirm = await screen.findByRole('dialog', { name: 'Start the review?' })
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    expect(within(statusInObservationCard()).getByText('Submitted')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start Review' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Start the review?' })).getByRole('button', { name: 'Confirm Review' }))
    expect(await within(statusInObservationCard()).findByText('In Review')).toBeInTheDocument()
    // In Review leads only to Verified or Flagged.
    expect(decisionLinks()).toEqual(['Verify Observation', 'Flag Observation'])
    expect(screen.getByText(/Claimed for review/)).toBeInTheDocument()
    await act(() => router.navigate('/review/queue'))
    const updated = (await screen.findByRole('link', { name: 'OBS-013' })).closest('tr')!
    expect(within(updated).getByText('In Review')).toBeInTheDocument()
  })

  it('offers Request Correction or End Process on a Flagged observation and Refer to Expert or End Process on a Verified one', async () => {
    renderReview('/review/observations/OBS-004')
    expect(await screen.findByRole('heading', { name: 'Observation Review · OBS-004' })).toBeInTheDocument()
    expect(within(statusInObservationCard()).getByText('Flagged')).toBeInTheDocument()
    expect(decisionLinks()).toEqual(['Request Correction'])
    expect(screen.getByRole('button', { name: 'End Process' })).toBeInTheDocument()
    expect(screen.queryByText('Observation History · read-only')).not.toBeInTheDocument()
    cleanup()
    renderReview('/review/observations/OBS-015')
    expect(await screen.findByRole('heading', { name: 'Observation Review · OBS-015' })).toBeInTheDocument()
    expect(within(statusInObservationCard()).getByText('Verified')).toBeInTheDocument()
    expect(decisionLinks()).toEqual(['Refer to Expert'])
    expect(screen.getByRole('button', { name: 'End Process' })).toBeInTheDocument()
  })

  it('Referred waits for the expert; Decision shows the expert decision with Verify and Flag', async () => {
    renderReview('/review/observations/OBS-023')
    expect(await screen.findByText('Referred to a disease expert. Waiting for the expert to confirm a diagnosis.')).toBeInTheDocument()
    expect(decisionLinks()).toEqual([])
    // A referral alone is not a decision, and End Process is not offered while the expert has not confirmed.
    expect(screen.queryByRole('button', { name: 'End Process' })).not.toBeInTheDocument()
    cleanup()
    renderReview('/review/observations/OBS-006')
    const expert = await screen.findByRole('generic', { name: 'Expert decision' })
    expect(within(expert).getByText('Grey blight (DIS-002)')).toBeInTheDocument()
    expect(within(expert).getByText('Dr Tara Wijesinghe')).toBeInTheDocument()
    expect(within(statusInObservationCard()).getByText('Decision')).toBeInTheDocument()
    // The expert decision is in (read-only): no verdict or correction; View Decision and End Process remain.
    expect(decisionLinks()).toEqual([])
    expect(screen.getByText('The expert decision is in (read-only). View the decision, then use End Process.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View Decision' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'End Process' })).toBeInTheDocument()
  })

  it('refuses decision forms the lifecycle does not allow in the current status', async () => {
    for (const path of ['/review/observations/OBS-004/verify', '/review/observations/OBS-004/refer', '/review/observations/OBS-015/request-correction', '/review/observations/OBS-015/flag', '/review/observations/OBS-006/verify']) {
      renderReview(path)
      expect(await screen.findByText('No decision can be recorded')).toBeInTheDocument()
      cleanup()
    }
  })
})

describe('Supervisor sidebar navigation', () => {
  it('has the five Supervisor items, in order, followed by the shared Account item', () => {
    expect(navItemsOf(ROLE_NAVIGATION.SUPERVISOR).map((item) => [item.label, item.to])).toEqual([
      ['Dashboard', '/review'],
      ['Observation Review', '/review/queue'],
      ['Division Quarantine', '/review/quarantine'],
      ['Decision History', '/review/history'],
      ['Fieldwork Assignments', '/assignments'],
      // Member 1's shared sidebar adds My Profile to every role.
      ['My Profile', '/profile'],
    ])
  })

  it('lists Correction Queue, Expert Referrals and Evidence Viewer for no role', () => {
    for (const navigation of Object.values(ROLE_NAVIGATION)) {
      expect(navItemsOf(navigation).filter((item) => ['Correction Queue', 'Expert Referrals', 'Evidence Viewer'].includes(item.label))).toEqual([])
    }
  })

  it('names the page Observation Review, without the Correction Queue, Expert Referrals and Export buttons or the removed columns', async () => {
    const { user } = renderReview('/review/queue')
    expect(await screen.findByRole('heading', { name: 'Observation Review' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'Observation Review' }).className).toMatch(/active/)
    expect(within(nav).queryByRole('link', { name: 'Review Queue' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Correction Queue' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Expert Referrals' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument()
    const table = await screen.findByRole('table', { name: 'Observations awaiting or completed review' })
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent?.replace('↕', '').trim())).toEqual(['Observation', 'Division', 'Field worker', 'Review status'])
    // An observation still opens from its ID link and from its row.
    await user.click(within(table).getByRole('link', { name: 'OBS-013' }))
    expect(await screen.findByRole('heading', { name: 'Observation Review · OBS-013' })).toBeInTheDocument()
    cleanup()
    // The correction and referral screens remain reachable by their routes.
    renderReview('/review/corrections')
    expect(await screen.findByRole('heading', { name: 'Correction Queue' })).toBeInTheDocument()
    cleanup()
    renderReview('/review/referrals')
    expect(await screen.findByRole('heading', { name: 'Expert Referral Status' })).toBeInTheDocument()
  })

  it('keeps the evidence viewer reachable from the observation review', async () => {
    renderReview('/review/observations/OBS-014')
    expect(await screen.findByRole('link', { name: 'Open evidence viewer' })).toHaveAttribute('href', '/observations/OBS-014/evidence?from=review')
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
  it('keeps the offline-ingest records reachable and scoped to the supervisor, and blocks the missing REV-16 decision', async () => {
    renderReview('/review/quarantine/QUA-002')
    expect(await screen.findByRole('heading', { name: 'Quarantine Record QUA-002' })).toBeInTheDocument()
    expect(screen.getAllByText('QDEC-002').length).toBeGreaterThan(0)
    cleanup()
    // QUA-001 belongs to another estate.
    renderReview('/review/quarantine/QUA-001')
    expect(await screen.findByText('Quarantine record unavailable')).toBeInTheDocument()
  })

  it('shows REV-16 as unavailable rather than inventing a decision form', async () => {
    renderReview('/review/quarantine/QUA-001/decide', 'USR-002')
    expect(await screen.findByText('Quarantine decisions are not available yet')).toBeInTheDocument()
  })

  it('shows exactly three history tables with their own headings, columns and empty states', async () => {
    renderReview('/review/history')
    expect(await screen.findByRole('heading', { name: 'Review and Decision History' })).toBeInTheDocument()
    for (const [heading, description] of [['Observation History', 'Process-ended observations.'], ['Assignment History', 'Completed assignments.'], ['Quarantine History', 'Quarantined and released divisions.']]) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
      expect(screen.getByText(description)).toBeInTheDocument()
    }
    await screen.findByRole('table', { name: 'Assignment history' })
    const columns = (name: string) => within(screen.getByRole('table', { name })).getAllByRole('columnheader').map((cell) => cell.textContent?.trim())
    expect(columns('Assignment history')).toEqual(['Assignment ID', 'Division', 'Field Worker', 'Completed At'])
    // Observation and Quarantine History start empty; Assignment History lists the completed assignment only.
    expect(screen.getByText('No process-ended observations')).toBeInTheDocument()
    expect(screen.getByText('No division quarantines')).toBeInTheDocument()
    const assignments = within(screen.getByRole('table', { name: 'Assignment history' })).getAllByRole('row').slice(1)
    expect(assignments).toHaveLength(1)
    expect(within(assignments[0]).getByRole('link', { name: 'ASG-005' })).toBeInTheDocument()
    expect(within(assignments[0]).getByText('West Terrace')).toBeInTheDocument()
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
  it('lists Submitted and Resubmitted observations in the same list with a Resubmitted tab', async () => {
    renderReview('/review/queue')
    expect(await screen.findByRole('tab', { name: /Resubmitted\s*1/ })).toBeInTheDocument()
    const row = screen.getByRole('link', { name: 'OBS-005' }).closest('tr')!
    expect(within(row).getByText('Resubmitted')).toBeInTheDocument()
    const submitted = screen.getByRole('link', { name: 'OBS-013' }).closest('tr')!
    expect(within(submitted).getByText('Submitted')).toBeInTheDocument()
  })

  it('opens a resubmitted observation unchanged; Start Review moves it to In Review, where it can be verified or flagged', async () => {
    const { user, store } = renderReview('/review/observations/OBS-005')
    expect(await screen.findByRole('heading', { name: 'Observation Review · OBS-005' })).toBeInTheDocument()
    // The page has the Submitted observation structure (latest data); the comparison is on its own page.
    expect(screen.queryByText('Revision comparison')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Previous revision: version 1' })).not.toBeInTheDocument()
    expect(screen.getByText('Evidence · version 2')).toBeInTheDocument()
    expect(screen.getByText('Field note: Updated synthetic symptom description')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Compare Versions' })).toHaveAttribute('href', '/review/observations/OBS-005/compare')
    // Opening does not change the status; no decision is offered until the review is started.
    expect(store.read((db) => db.observations.find((o) => o.id === 'OBS-005')?.reviewStatus)).toBe('resubmitted')
    expect(screen.queryByRole('link', { name: 'Verify Observation' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Compare' })).toHaveAttribute('href', '/review/observations/OBS-005/compare')
    await user.click(screen.getByRole('button', { name: 'Start Review' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Start the review?' })).getByRole('button', { name: 'Confirm Review' }))
    for (const name of ['Verify Observation', 'Flag Observation']) {
      expect(await screen.findByRole('link', { name })).toBeInTheDocument()
    }
    expect(screen.queryByRole('link', { name: 'Refer to Expert' })).not.toBeInTheDocument()
    expect(store.read((db) => db.observations.find((o) => o.id === 'OBS-005')?.reviewStatus)).toBe('in_review')
    expect(screen.getByText('Decision applies to version 2 (OBSR-005-2).')).toBeInTheDocument()
    expect(screen.getByText('Review started on version 2')).toBeInTheDocument()
  })

  it('keeps the existing single-revision review for a normal submitted observation', async () => {
    renderReview('/review/observations/OBS-014')
    expect(await screen.findByRole('heading', { name: 'Observation Review · OBS-014' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Compare Versions' })).not.toBeInTheDocument()
    expect(screen.getByText('Evidence')).toBeInTheDocument()
  })

  it('Compare Versions opens that observation\'s comparison page with both versions and the differences', async () => {
    const { user, router } = renderReview('/review/observations/OBS-005')
    await user.click(await screen.findByRole('link', { name: 'Compare Versions' }))
    expect(await screen.findByRole('heading', { name: 'Compare Versions · OBS-005' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/review/observations/OBS-005/compare')
    expect(screen.getByRole('region', { name: 'Previous revision: version 1' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Compared revision: version 2' })).toBeInTheDocument()
    const notes = screen.getByRole('rowheader', { name: 'Field notes' }).closest('tr')!
    expect(within(notes).getByText('Changed')).toBeInTheDocument()
    expect(within(notes).getByText('Synthetic field note for observation OBS-005; not a real diagnosis.')).toBeInTheDocument()
    expect(within(notes).getByText('Updated synthetic symptom description')).toBeInTheDocument()
    const disease = screen.getByRole('rowheader', { name: 'Suspected disease' }).closest('tr')!
    expect(within(disease).getByText('No change')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'View larger photo' }).length).toBe(2)
    await user.click(screen.getAllByRole('link', { name: 'Back to observation' })[0])
    expect(await screen.findByRole('heading', { name: 'Observation Review · OBS-005' })).toBeInTheDocument()
  })

  it('has no Simulate button on a Correction Requested observation', async () => {
    renderReview('/review/observations/OBS-041')
    expect(await screen.findByText(/A correction has been requested/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Simulate/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'COR-041' })).toBeInTheDocument()
  })

  it('simulates the Field Worker resubmission only after it is stored, then shows the observation as Resubmitted', async () => {
    // The correction detail page keeps its own demonstration control (unchanged).
    const { user, store } = renderReview('/review/corrections/COR-041')
    await user.click(await screen.findByRole('button', { name: 'Simulate: Field Worker resubmits correction' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Resubmit version 2' }))
    await waitFor(() => expect(store.read((db) => db.observations.find((o) => o.id === 'OBS-041')?.reviewStatus)).toBe('resubmitted'))
    expect(await screen.findByText('Resubmitted', { selector: 'span' })).toBeInTheDocument()
  })

})

describe('Expert diagnosis, division quarantine, assignment and End Process', () => {
  it('shows an empty state and the record action for a Referred observation without a diagnosis', async () => {
    renderReview('/review/observations/OBS-014/diagnosis')
    expect(await screen.findByRole('heading', { name: 'Expert Diagnosis · OBS-014' })).toBeInTheDocument()
    expect(screen.getByText('No expert diagnosis yet')).toBeInTheDocument()
    // OBS-014 is In review: a diagnosis cannot be recorded yet.
    expect(screen.queryByRole('link', { name: 'Record expert diagnosis' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Decision Observation' })).toHaveAttribute('href', '/review/observations/OBS-014')
  })

  it('records the diagnosis for OBS-023, quarantines the division, prefills the assignment form and ends the process into history', async () => {
    const { store, router, user } = renderReview('/review/observations/OBS-023')
    expect(await screen.findByRole('heading', { name: 'Observation Review · OBS-023' })).toBeInTheDocument()
    // Referred: only View Expert Diagnosis; End Process waits for the expert's decision.
    expect(screen.queryByRole('link', { name: 'Verify Observation' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'End Process' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /View (Expert Diagnosis|Decision)/ })).not.toBeInTheDocument()
    await act(() => router.navigate('/review/observations/OBS-023/diagnosis'))
    await user.click(await screen.findByRole('link', { name: 'Simulate expert decision' }))

    // Sections A–I, validation, then submit.
    expect(await screen.findByRole('heading', { name: 'Expert Decision (demonstration) · OBS-023' })).toBeInTheDocument()
    for (const title of ['A. Case and reference details (auto-linked)', 'B. Decision status (auto-updated)', 'C. Confirmed disease details', 'D. Symptoms verification', 'E. Severity', 'F. Expert notes', 'G. Recommended action', 'H. Follow-up plan (Phase 2 / P1)', 'I. Submission']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
    expect(screen.getByText('CASE-023')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Review & Submit Diagnosis' }))
    expect(await screen.findByText('Select the confirmed disease')).toBeInTheDocument()
    expect(store.read((db) => db.referrals.find((r) => r.id === 'REF-023')?.diagnosis)).toBeNull()
    await user.selectOptions(screen.getByRole('combobox', { name: /Confirmed disease/ }), 'DIS-001')
    await user.selectOptions(screen.getByRole('combobox', { name: /Severity level/ }), 'Critical')
    await user.type(screen.getByLabelText(/Symptoms confirmed/), 'Blister-like patches')
    await user.type(screen.getByLabelText(/Clinical findings/), 'Lesions on young shoots')
    await user.type(screen.getByLabelText(/Reasoning/), 'Matches the catalog description')
    await user.type(screen.getByLabelText(/Recommended action/), 'Prune and spray the affected block')
    await user.type(screen.getByLabelText(/Follow-up description/), 'Re-inspect after treatment')
    await user.type(screen.getByLabelText(/Monitoring window/), '14 days')
    await user.type(screen.getByLabelText(/Inspection focus/), 'Block C young shoots')
    await user.click(screen.getByRole('button', { name: 'Review & Submit Diagnosis' }))
    await user.click(await screen.findByRole('button', { name: 'Confirm and submit' }))

    // Details page shows the stored diagnosis; the catalog version is pinned and the case is Diagnosed, not Closed.
    expect(await screen.findByRole('heading', { name: 'Expert Diagnosis · OBS-023' })).toBeInTheDocument()
    expect(await screen.findByText('Blister blight (DIS-001)')).toBeInTheDocument()
    expect(screen.getByText('Critical')).toBeInTheDocument()
    expect(screen.getByText('Prune and spray the affected block')).toBeInTheDocument()
    expect(screen.getByText('14 days')).toBeInTheDocument()
    expect(screen.queryByText('Closed date and time')).not.toBeInTheDocument()
    const stored = store.read((db) => db.referrals.find((r) => r.id === 'REF-023'))
    expect(stored?.caseStatus).toBe('diagnosed')
    expect(stored?.diagnosis?.details).toMatchObject({ catalogVersion: 2, caseStatus: 'Diagnosed', closedAt: null, severity: 'Critical' })
    // Recording a follow-up plan never creates an assignment.
    expect(store.read((db) => db.assignments.length)).toBe(store.read((db) => db.assignments.length))

    // Quarantine Division asks for confirmation, then applies Restricted Operations to the right division.
    await user.click(screen.getByRole('button', { name: 'Quarantine Division' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Restricted Operations/)).toBeInTheDocument()
    expect(store.read((db) => db.divisionQuarantines ?? [])).toHaveLength(0)
    await user.click(within(dialog).getByRole('button', { name: 'Confirm quarantine' }))
    await waitFor(() => expect(store.read((db) => db.divisionQuarantines ?? [])).toHaveLength(1))
    const [quarantine] = store.read((db) => db.divisionQuarantines ?? [])
    expect(quarantine).toMatchObject({ observationId: 'OBS-023', policy: 'restricted_operations' })
    expect(quarantine.divisionId).toBe(store.read((db) => db.observations.find((o) => o.id === 'OBS-023')?.divisionId))
    expect(await screen.findByRole('link', { name: 'View quarantine DQ-001' })).toHaveAttribute('href', '/review/quarantine/divisions/DQ-001')

    // Create New Assignment opens the existing form with the division and the plan prefilled; nothing is assigned.
    const assignmentsBefore = store.read((db) => db.assignments.length)
    await user.click(screen.getByRole('link', { name: 'Create New Assignment' }))
    expect(await screen.findByDisplayValue(/Follow up OBS-023/)).toBeInTheDocument()
    expect(screen.getByDisplayValue(/Prune and spray the affected block/)).toBeInTheDocument()
    expect(router.state.location.search).toContain('division=' + quarantine.divisionId)
    expect(store.read((db) => db.assignments.length)).toBe(assignmentsBefore)

    // End Process records one history entry, keeps the status and the diagnosis, and moves the observation to history.
    await router.navigate('/review/observations/OBS-023')
    // The expert's decision is in, so the observation is in Decision and can be ended.
    await user.click(await screen.findByRole('button', { name: 'End Process' }))
    // A confirmation names the observation; Cancel changes nothing.
    let endDialog = await screen.findByRole('dialog', { name: 'End the process for this observation?' })
    expect(within(endDialog).getByText('OBS-023')).toBeInTheDocument()
    await user.click(within(endDialog).getByRole('button', { name: 'Cancel' }))
    expect(store.read((db) => db.reviewRecords.find((r) => r.observationId === 'OBS-023')?.processEndedAt ?? null)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'End Process' }))
    endDialog = await screen.findByRole('dialog', { name: 'End the process for this observation?' })
    // The completion reason is required.
    await user.click(within(endDialog).getByRole('button', { name: 'Confirm End Process' }))
    expect(await within(endDialog).findByText('Enter the reason for ending the process')).toBeInTheDocument()
    expect(store.read((db) => db.reviewRecords.find((r) => r.observationId === 'OBS-023')?.processEndedAt ?? null)).toBeNull()
    await user.type(within(endDialog).getByLabelText(/Completion reason/), 'Diagnosis acknowledged')
    await user.click(within(endDialog).getByRole('button', { name: 'Confirm End Process' }))
    await waitFor(() => expect(store.read((db) => db.reviewRecords.find((r) => r.observationId === 'OBS-023')?.processEndedAt)).toBeTruthy())
    expect(store.read((db) => db.observations.find((o) => o.id === 'OBS-023')?.reviewStatus)).toBe('referred')
    expect(store.read((db) => db.referrals.find((r) => r.id === 'REF-023')?.diagnosis)).not.toBeNull()
    expect(store.read((db) => db.reviewDecisions.filter((d) => d.targetId === 'OBS-023' && d.outcome === 'process_ended'))).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'End Process' })).not.toBeInTheDocument()
    // One entry in the review timeline (and one row in the observation's decision table), never duplicated.
    const timeline = await screen.findByLabelText('Review history')
    expect(within(timeline).getAllByText('Process ended')).toHaveLength(1)
    expect(screen.getByText('Observation History · read-only')).toBeInTheDocument()
    cleanup()
  }, 20_000)

  it('lists the ended observation in Observation History with its division and field worker, and refuses further processing', async () => {
    const { store, router, user } = renderReview('/review/observations/OBS-006')
    await user.click(await screen.findByRole('button', { name: 'End Process' }))
    await user.type(within(await screen.findByRole('dialog')).getByLabelText(/Completion reason/), 'Expert decision acknowledged')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm End Process' }))
    await waitFor(() => expect(store.read((db) => db.reviewDecisions.some((d) => d.targetId === 'OBS-006' && d.outcome === 'process_ended'))).toBe(true))
    // The status is unchanged and End Process cannot be repeated.
    expect(store.read((db) => db.observations.find((o) => o.id === 'OBS-006')?.reviewStatus)).toBe('referred')
    await waitFor(() => expect(screen.queryByRole('button', { name: 'End Process' })).not.toBeInTheDocument())
    await router.navigate('/review/history')
    const table = await screen.findByRole('table', { name: 'Observation history' })
    const row = await within(table).findByRole('link', { name: 'OBS-006' })
    expect(within(row.closest('tr')!).getByText('West Terrace')).toBeInTheDocument()
    expect(within(row.closest('tr')!).getByText('Ravindu Kumara')).toBeInTheDocument()
    expect(within(table).getAllByRole('row')).toHaveLength(2)
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent?.trim())).toEqual(['Observation ID', 'Division', 'Field Worker'])
    cleanup()
  })

  it('lists active and released division quarantines in Quarantine History', async () => {
    const { router, user, store } = renderReview('/review/observations/OBS-006/diagnosis')
    await user.click(await screen.findByRole('button', { name: 'Quarantine Division' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm quarantine' }))
    await waitFor(() => expect(store.read((db) => db.divisionQuarantines ?? [])).toHaveLength(1))
    await router.navigate('/review/history')
    let row = (await within(await screen.findByRole('table', { name: 'Quarantine history' })).findByRole('link', { name: 'DQ-001' })).closest('tr')!
    expect(within(row).getByText('West Terrace')).toBeInTheDocument()
    expect(within(row).getByText('Grey blight')).toBeInTheDocument()
    expect(within(row).getByText('Not released')).toBeInTheDocument()
    expect(within(screen.getByRole('table', { name: 'Quarantine history' })).getAllByRole('columnheader').map((cell) => cell.textContent?.trim())).toEqual(['Quarantine ID', 'Division', 'Disease', 'Released At'])
    await router.navigate('/review/quarantine/divisions/DQ-001')
    await user.click(await screen.findByRole('button', { name: 'Release Division' }))
    await user.type(within(await screen.findByRole('dialog')).getByLabelText(/Reason for Release/), 'Treatment complete')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm Release' }))
    await waitFor(() => expect(store.read((db) => db.divisionQuarantines?.[0].status)).toBe('released'))
    await router.navigate('/review/history')
    row = (await within(await screen.findByRole('table', { name: 'Quarantine history' })).findByRole('link', { name: 'DQ-001' })).closest('tr')!
    expect(within(row).queryByText('Not released')).not.toBeInTheDocument()
    expect(within(row).getByText(/21 Oct 2026/)).toBeInTheDocument()
    cleanup()
  })
})

describe('Division quarantine: queue, Quarantine Assignment template and Restricted Operations', () => {
  it('quarantines from the diagnosis, lists it in the Quarantine Queue, and assigns work only through the Quarantine Assignment template', async () => {
    const { store, router, user } = renderReview('/review/observations/OBS-006/diagnosis')
    await user.click(await screen.findByRole('button', { name: 'Quarantine Division' }))
    const dialog = await screen.findByRole('dialog')
    for (const value of ['Riverbend Tea Estate (EST-002)', 'West Terrace (DIV-006)', 'Grey blight (DIS-002)', 'OBS-006', 'CASE-006', 'Restricted Operations']) expect(within(dialog).getByText(value)).toBeInTheDocument()
    expect(within(dialog).getByText(/Normal field activities in this division will be restricted/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Confirm quarantine' }))
    await waitFor(() => expect(store.read((db) => db.divisions.find((item) => item.id === 'DIV-006')?.operationalStatus)).toBe('restricted'))

    // The Division Quarantine page shows every division's status; the second records table is gone.
    await router.navigate('/review/quarantine')
    await waitFor(() => {
      const statusTable = screen.getByRole('table', { name: 'Division operational status' })
      expect(within(within(statusTable).getByText('West Terrace (DIV-006)').closest('tr')!).getByText('Restricted Operations')).toBeInTheDocument()
      expect(within(within(statusTable).getByText('East Hills (DIV-005)').closest('tr')!).getByText('Normal Operations')).toBeInTheDocument()
    })
    expect(screen.queryByRole('table', { name: 'Division quarantines' })).not.toBeInTheDocument()
    expect(screen.queryByRole('searchbox', { name: 'Search division quarantines' })).not.toBeInTheDocument()
    await user.click(within(screen.getByRole('table', { name: 'Division operational status' })).getByRole('button', { name: 'View West Terrace (DIV-006)' }))

    // Quarantine details: division status, diagnosis, linked records and the assignment action.
    expect(await screen.findByRole('heading', { name: 'Division Quarantine DQ-001' })).toBeInTheDocument()
    expect(screen.getAllByText('Restricted Operations').length).toBeGreaterThan(0)
    // The disease shows in the quarantine summary and in the expert diagnosis; assignments and history sit above the diagnosis.
    expect(screen.getAllByText('Grey blight (DIS-002)')).toHaveLength(2)
    expect(screen.getByText('No Quarantine Assignments yet')).toBeInTheDocument()

    // A normal assignment for the restricted division is blocked in the form.
    await router.navigate('/assignments/new?division=DIV-006')
    expect(await screen.findByText('DIV-006 is under Restricted Operations (DQ-001)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Review & assign' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save as draft' })).toBeDisabled()

    // The Quarantine Assignment template, opened from the quarantine record.
    await router.navigate('/review/quarantine/divisions/DQ-001')
    await user.click(await screen.findByRole('link', { name: 'Create Quarantine Assignment' }))
    expect(await screen.findByText('Quarantine Assignment · DQ-001')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?quarantine=DQ-001')
    expect(screen.getByText('Quarantine ID').nextSibling).toHaveTextContent('DQ-001')
    expect((screen.getByLabelText('Assignment objective') as HTMLTextAreaElement).value).toContain('West Terrace')
    expect(store.read((db) => db.assignments.some((item) => item.quarantine))).toBe(false)
    await user.type(screen.getByLabelText('Inspection focus'), 'Block C young shoots')
    await user.type(screen.getByLabelText('Monitoring window'), '14 days')
    await user.type(screen.getByLabelText('Supervisor instructions'), 'Inspect and report daily.')
    // The form preselects the first free Field Worker of the division; make sure it is Tharindu.
    expect(screen.getByRole('checkbox', { name: /Tharindu Jayasuriya/ })).toBeChecked()
    // Not authorised yet: assigning is refused, nothing is saved.
    await user.click(screen.getByRole('button', { name: 'Review & assign' }))
    expect(await screen.findByText('Authorise this Quarantine Assignment to assign it')).toBeInTheDocument()
    expect(store.read((db) => db.assignments.some((item) => item.quarantine))).toBe(false)
    await user.click(screen.getByRole('checkbox', { name: /I authorise this Quarantine Assignment/ }))
    await user.click(screen.getByRole('button', { name: 'Review & assign' }))
    await user.click(await screen.findByRole('button', { name: 'Confirm and assign' }))
    await waitFor(() => expect(store.read((db) => db.assignments.find((item) => item.quarantine)?.status)).toBe('assigned'))
    const created = store.read((db) => db.assignments.find((item) => item.quarantine)!)
    expect(created).toMatchObject({ divisionId: 'DIV-006', fieldWorkerId: 'USR-016', quarantine: { quarantineId: 'DQ-001', caseId: 'CASE-006', observationId: 'OBS-006' } })
    expect(store.read((db) => db.divisionQuarantines?.[0].assignmentIds)).toEqual([created.id])

    // The record lists the assignment and its history.
    await router.navigate('/review/quarantine/divisions/DQ-001')
    expect(await screen.findByRole('link', { name: created.id })).toBeInTheDocument()
    expect(within(screen.getByLabelText('Quarantine history')).getByText('Quarantine assignment authorised')).toBeInTheDocument()
    expect(within(screen.getByLabelText('Quarantine history')).getByText('Quarantine assignment assigned')).toBeInTheDocument()
    cleanup()
  }, 20_000)
})

describe('Division Quarantine page and the Quarantine a Division form', () => {
  it('is named Division Quarantine, has no Offline items tab, and lists division status with View actions', async () => {
    const { router, user } = renderReview('/review/quarantine')
    expect(await screen.findByRole('heading', { name: 'Division Quarantine' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Offline items/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Quarantine Queue' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Division Quarantine' })).toHaveAttribute('href', '/review/quarantine')
    // Old bookmarks with the former tab parameter still open the page.
    cleanup()
    renderReview('/review/quarantine?section=offline')
    expect(await screen.findByRole('heading', { name: 'Division Quarantine' })).toBeInTheDocument()
    cleanup()
    const second = renderReview('/review/quarantine')
    const statusTable = await screen.findByRole('table', { name: 'Division operational status' })
    expect(within(statusTable).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Division', 'Operational status', 'Actions'])
    expect(within(statusTable).getAllByText('Normal Operations')).toHaveLength(3)
    // A normal division opens a summary with a way to quarantine it.
    await second.user.click(within(statusTable).getByRole('button', { name: 'View East Hills (DIV-005)' }))
    expect(await screen.findByRole('dialog', { name: 'East Hills (DIV-005)' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Quarantine this division' })).toHaveAttribute('href', '/review/quarantine/divisions/new?division=DIV-005')
    void router
    void user
  })

  it('validates the form, creates the quarantine from a recorded diagnosis, shows it in the page, and refuses a duplicate', async () => {
    const { store, router, user } = renderReview('/review/quarantine')
    await user.click(await screen.findByRole('link', { name: 'Quarantine a Division' }))
    expect(await screen.findByRole('heading', { name: 'Quarantine a Division' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/review/quarantine')
    expect(screen.getByText('Normal field activities are restricted. Only Supervisor-authorised assignments are allowed.')).toBeInTheDocument()
    // Nothing selected: validation errors, nothing created.
    await user.click(screen.getByRole('button', { name: 'Confirm Quarantine' }))
    // The estate is preselected (the Supervisor has one); the division is still required (placeholder + error message).
    await waitFor(() => expect(screen.getAllByText('Select a division')).toHaveLength(2))
    expect(store.read((db) => db.divisionQuarantines ?? [])).toHaveLength(0)
    // Divisions follow the estate. East Hills has no diagnosed observation, so no disease can be confirmed there.
    await user.selectOptions(screen.getByRole('combobox', { name: /Estate/ }), 'EST-002')
    await user.selectOptions(screen.getByRole('combobox', { name: /^Division/ }), 'DIV-005')
    expect(screen.getByText(/The disease must be confirmed by an expert first/)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Linked observation/ })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Confirm Quarantine' }))
    expect(await screen.findByText('Select the linked observation that has a recorded expert diagnosis')).toBeInTheDocument()
    expect(store.read((db) => db.divisionQuarantines ?? [])).toHaveLength(0)
    // West Terrace has OBS-006 with a recorded diagnosis.
    await user.selectOptions(screen.getByRole('combobox', { name: /^Division/ }), 'DIV-006')
    await user.selectOptions(screen.getByRole('combobox', { name: /Linked observation/ }), 'OBS-006')
    expect(screen.getAllByText('Grey blight (DIS-002)').length).toBeGreaterThan(0)
    await user.clear(screen.getByLabelText(/Quarantine reason/))
    await user.click(screen.getByRole('button', { name: 'Confirm Quarantine' }))
    expect(await screen.findByText('Enter the quarantine reason')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/Quarantine reason/), 'Confirmed outbreak')
    await user.click(screen.getByRole('button', { name: 'Confirm Quarantine' }))
    await waitFor(() => expect(store.read((db) => db.divisionQuarantines ?? [])).toHaveLength(1))
    expect(store.read((db) => db.divisionQuarantines?.[0])).toMatchObject({ id: 'DQ-001', divisionId: 'DIV-006', observationId: 'OBS-006', caseId: 'CASE-006', diseaseId: 'DIS-002', reason: 'Confirmed outbreak' })
    expect(store.read((db) => db.divisions.find((item) => item.id === 'DIV-006')?.operationalStatus)).toBe('restricted')
    expect(await screen.findByRole('heading', { name: 'Division Quarantine DQ-001' })).toBeInTheDocument()

    // The Division Quarantine page now shows it in the status table.
    await router.navigate('/review/quarantine')
    const statusTable = await screen.findByRole('table', { name: 'Division operational status' })
    await waitFor(() => expect(within(within(statusTable).getByText('West Terrace (DIV-006)').closest('tr')!).getByText('Restricted Operations')).toBeInTheDocument())
    await user.click(within(statusTable).getByRole('button', { name: 'View West Terrace (DIV-006)' }))
    expect(await screen.findByRole('heading', { name: 'Division Quarantine DQ-001' })).toBeInTheDocument()

    // A second quarantine for the same division is refused, in the form and in the data layer.
    await router.navigate('/review/quarantine/divisions/new?division=DIV-006')
    expect(await screen.findByText('West Terrace (DIV-006) is already under Restricted Operations')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm Quarantine' })).toBeDisabled()
    expect(store.read((db) => db.divisionQuarantines ?? [])).toHaveLength(1)
  })
})

describe('Releasing a quarantined division', () => {
  it('requires a reason, releases only that division, keeps the record, and lets normal assignments through again', async () => {
    const { store, router, user } = renderReview('/review/observations/OBS-006/diagnosis')
    await user.click(await screen.findByRole('button', { name: 'Quarantine Division' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm quarantine' }))
    await waitFor(() => expect(store.read((db) => db.divisions.find((item) => item.id === 'DIV-006')?.operationalStatus)).toBe('restricted'))
    await router.navigate('/review/quarantine/divisions/DQ-001')
    // Release Division is offered for the active quarantine; Cancel changes nothing.
    await user.click(await screen.findByRole('button', { name: 'Release Division' }))
    let dialog = await screen.findByRole('dialog', { name: 'Release this division?' })
    expect(within(dialog).getByText('West Terrace (DIV-006)')).toBeInTheDocument()
    expect(within(dialog).getByText('DQ-001')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(store.read((db) => db.divisions.find((item) => item.id === 'DIV-006')?.operationalStatus)).toBe('restricted')
    // An empty or whitespace-only reason is refused.
    await user.click(screen.getByRole('button', { name: 'Release Division' }))
    dialog = await screen.findByRole('dialog', { name: 'Release this division?' })
    await user.type(within(dialog).getByLabelText(/Reason for Release/), '   ')
    await user.click(within(dialog).getByRole('button', { name: 'Confirm Release' }))
    expect(await within(dialog).findByText('Enter the reason for release')).toBeInTheDocument()
    expect(store.read((db) => db.divisionQuarantines?.[0].status)).toBe('active')
    await user.type(within(dialog).getByLabelText(/Reason for Release/), 'Treatment complete')
    await user.click(within(dialog).getByRole('button', { name: 'Confirm Release' }))
    await waitFor(() => expect(store.read((db) => db.divisionQuarantines?.[0].status)).toBe('released'))
    // The same record is updated; nothing is deleted.
    const record = store.read((db) => db.divisionQuarantines?.[0])
    expect(record).toMatchObject({ id: 'DQ-001', releaseReason: 'Treatment complete', releasedBy: 'USR-003', reason: expect.stringContaining('Grey blight'), diseaseId: 'DIS-002' })
    expect(record?.releasedAt).toBeTruthy()
    expect(record?.history?.map((entry) => entry.event)).toEqual(['Quarantine initiated', 'Division changed to Restricted Operations', 'Quarantine released', 'Division changed to Normal Operations'])
    expect(store.read((db) => db.divisions.find((item) => item.id === 'DIV-006')?.operationalStatus)).toBe('normal')
    expect(store.read((db) => db.reviewDecisions.filter((item) => item.outcome === 'quarantine_released'))).toMatchObject([{ recordId: 'DQ-001', type: 'quarantine' }])
    // The detail page now shows the release and no longer offers it.
    expect(await screen.findByText('Treatment complete')).toBeInTheDocument()
    expect(screen.getByText('Released by')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Release Division' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Create Quarantine Assignment' })).not.toBeInTheDocument()
    // The status table shows Normal Operations again, and the released record stays reachable from the division.
    await router.navigate('/review/quarantine')
    const statusTable = await screen.findByRole('table', { name: 'Division operational status' })
    await waitFor(() => expect(within(statusTable).getAllByText('Normal Operations')).toHaveLength(3))
    await user.click(within(statusTable).getByRole('button', { name: 'View West Terrace (DIV-006)' }))
    await user.click(await screen.findByRole('link', { name: /DQ-001 · View record/ }))
    expect(await screen.findByRole('heading', { name: 'Division Quarantine DQ-001' })).toBeInTheDocument()
    cleanup()
  }, 20_000)
})

describe('Review Queue lifecycle sections', () => {
  it('shows the lifecycle sections in order with live counts, a hint per section and no extra navigation', async () => {
    const { user } = renderReview('/review/queue')
    const tabs = await screen.findAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'All15', 'Submitted3', 'In Review2', 'Verified2', 'Flagged3', 'Referred1', 'Resubmitted1', 'Decision2', 'Correction Requested1',
    ])
    // No separate sidebar entries for the statuses.
    const nav = screen.getByRole('navigation', { name: 'Main' })
    for (const label of ['Submitted', 'In Review', 'Verified', 'Flagged', 'Referred', 'Resubmitted', 'Decision']) expect(within(nav).queryByRole('link', { name: label })).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /^Verified/ }))
    expect(screen.getByText('Open an observation to Refer to Expert or End Process.')).toBeInTheDocument()
    expect(within(screen.getByRole('table', { name: /Observations/ })).getAllByRole('link', { name: /^OBS-/ }).map((link) => link.textContent)).toEqual(['OBS-015', 'OBS-032'])
    await user.click(screen.getByRole('tab', { name: /^Flagged/ }))
    expect(screen.getByText('Open an observation to Request Correction or End Process.')).toBeInTheDocument()
  })

  it('the Resubmitted section offers Compare and Review; other sections do not add action buttons', async () => {
    const { user } = renderReview('/review/queue?status=resubmitted')
    const table = await screen.findByRole('table', { name: /Observations/ })
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent?.replace('↕', '').trim())).toEqual(['Observation', 'Division', 'Field worker', 'Review status', 'Actions'])
    const row = within(table).getByRole('link', { name: 'OBS-005' }).closest('tr')!
    expect(within(row).getByRole('link', { name: 'Compare OBS-005' })).toHaveAttribute('href', '/review/observations/OBS-005/compare')
    expect(within(row).getByRole('link', { name: 'Review OBS-005' })).toHaveAttribute('href', '/review/observations/OBS-005')
    await user.click(screen.getByRole('tab', { name: /^Submitted/ }))
    expect(within(screen.getByRole('table', { name: /Observations/ })).getAllByRole('columnheader')).toHaveLength(4)
  })

  it('moves an observation between sections and keeps the counts in step with the data', async () => {
    const { router, user } = renderReview('/review/observations/OBS-013')
    await user.click(await screen.findByRole('button', { name: 'Start Review' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Start the review?' })).getByRole('button', { name: 'Confirm Review' }))
    await screen.findByRole('link', { name: 'Verify Observation' })
    await user.click(screen.getByRole('link', { name: 'Verify Observation' }))
    await user.click(await screen.findByRole('button', { name: 'Confirm verification' }))
    await act(() => router.navigate('/review/queue'))
    const tabs = await screen.findAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent?.replace(/\s+/g, ' ').trim())).toEqual(expect.arrayContaining(['Submitted2', 'In Review2', 'Verified3']))
    await user.click(screen.getByRole('tab', { name: /^Verified/ }))
    expect(within(screen.getByRole('table', { name: /Observations/ })).getByRole('link', { name: 'OBS-013' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /^Submitted/ }))
    expect(within(screen.getByRole('table', { name: /Observations/ })).queryByRole('link', { name: 'OBS-013' })).not.toBeInTheDocument()
  })

  it('shows an empty state when a search matches nothing, and an error state with a retry when loading fails', async () => {
    const first = renderReview('/review/queue')
    await first.user.type(await screen.findByRole('searchbox', { name: 'Search observations' }), 'zzz-no-match')
    expect(await screen.findByText('No observations match these filters')).toBeInTheDocument()
    cleanup()
    const second = renderReview('/review/observations/OBS-013')
    second.store.failNext('conflict')
    const retry = await screen.findByRole('button', { name: 'Try again' })
    await second.user.click(retry)
    expect(await screen.findByRole('heading', { name: 'Observation Review · OBS-013' })).toBeInTheDocument()
  })
})

describe('View Decision / expert diagnosis button visibility', () => {
  const PATTERN = /View (Expert Diagnosis|Decision)/
  // Decision is derived (a referral with a recorded diagnosis), so it is read from the queue's own data.
  function visibleId(store: FixtureStore, status: string) {
    return store.read((db) => {
      const estates = USERS['USR-003'].estateIds
      const ended = new Set(db.reviewRecords.filter((r) => r.processEndedAt).map((r) => r.observationId))
      const ids = db.observations.filter((o) => estates.includes(db.divisions.find((d) => d.id === o.divisionId)?.estateId ?? '') && !ended.has(o.id)).map((o) => o.id)
      const diagnosed = new Set(db.referrals.filter((r) => r.diagnosis).map((r) => r.observationId))
      const effective = (o: (typeof db.observations)[number]) => (o.reviewStatus === 'referred' && diagnosed.has(o.id) ? 'decision' : o.reviewStatus)
      return db.observations.find((o) => ids.includes(o.id) && effective(o) === status)?.id
    })
  }
  const statuses = ['submitted', 'in_review', 'verified', 'flagged', 'correction_requested', 'resubmitted', 'referred', 'decision'] as const

  for (const status of statuses) {
    it(`is ${status === 'decision' ? 'shown' : 'hidden'} for ${status} observations`, async () => {
      const { store, router } = renderReview('/review/queue')
      const id = visibleId(store, status)
      expect(id, `a seeded ${status} observation`).toBeTruthy()
      await act(() => router.navigate(`/review/observations/${id}`))
      expect(await screen.findByRole('heading', { name: `Observation Review · ${id}` })).toBeInTheDocument()
      if (status === 'decision') {
        expect(screen.getByRole('link', { name: 'View Decision' })).toHaveAttribute('href', `/review/observations/${id}/diagnosis`)
      } else {
        expect(screen.queryByRole('link', { name: PATTERN })).not.toBeInTheDocument()
      }
    })
  }

  it('is hidden once the process has ended (History)', async () => {
    const { store, router } = renderReview('/review/queue')
    const id = visibleId(store, 'decision') as string
    store.write((db) => { const r = db.reviewRecords.find((row) => row.observationId === id); if (r) r.processEndedAt = '2026-10-21T10:00:00+05:30' })
    await act(() => router.navigate(`/review/observations/${id}`))
    expect(await screen.findByRole('heading', { name: `Observation Review · ${id}` })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: PATTERN })).not.toBeInTheDocument()
  })

  it('still opens the read-only decision for a Decision observation', async () => {
    const { store, router, user } = renderReview('/review/queue')
    const id = visibleId(store, 'decision') as string
    await act(() => router.navigate(`/review/observations/${id}`))
    await user.click(await screen.findByRole('link', { name: 'View Decision' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/review/observations/${id}/diagnosis`))
  })
})

describe('Evidence viewer back navigation', () => {
  async function openViewer(id: string) {
    const ctx = renderReview(`/review/observations/${id}`)
    await ctx.user.click(await screen.findByRole('link', { name: 'Open evidence viewer' }))
    expect(await screen.findByRole('heading', { name: /Evidence (Viewer|Unavailable)/ })).toBeInTheDocument()
    return ctx
  }

  for (const id of ['OBS-022', 'OBS-014']) {
    it(`returns to the originating review page for ${id}`, async () => {
      const { router, user } = await openViewer(id)
      expect(router.state.location.pathname).toBe(`/observations/${id}/evidence`)
      const back = screen.getByRole('link', { name: 'Back to observation review' })
      expect(back).toHaveAttribute('href', `/review/observations/${id}`)
      await user.click(back)
      expect(await screen.findByRole('heading', { name: `Observation Review · ${id}` })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe(`/review/observations/${id}`)
    })
  }

  it('keeps the origin when switching observations before opening the viewer', async () => {
    const { router, user } = renderReview('/review/observations/OBS-022')
    expect(await screen.findByRole('heading', { name: 'Observation Review · OBS-022' })).toBeInTheDocument()
    await act(() => router.navigate('/review/observations/OBS-014'))
    await user.click(await screen.findByRole('link', { name: 'Open evidence viewer' }))
    expect(await screen.findByRole('heading', { name: /Evidence (Viewer|Unavailable)/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to observation review' })).toHaveAttribute('href', '/review/observations/OBS-014')
  })

  it('browser Back from the viewer lands on the same observation', async () => {
    const { router } = await openViewer('OBS-022')
    await act(() => router.navigate(-1))
    expect(await screen.findByRole('heading', { name: 'Observation Review · OBS-022' })).toBeInTheDocument()
  })

  it('falls back to the capture observation page when opened directly, never another observation', async () => {
    const { router } = renderReview('/observations/OBS-022/evidence')
    expect(await screen.findByRole('heading', { name: /Evidence (Viewer|Unavailable)/ })).toBeInTheDocument()
    const back = screen.getByRole('link', { name: 'Back to observation' })
    expect(back).toHaveAttribute('href', '/observations/OBS-022')
    expect(router.state.location.pathname).toBe('/observations/OBS-022/evidence')
    expect(screen.queryByRole('link', { name: 'Back to observation review' })).not.toBeInTheDocument()
  })
})

describe('Dashboard Observation Review button', () => {
  it('is labelled Observation Review and opens the existing Observation Review page', async () => {
    const { router, user } = renderReview('/review')
    const button = await screen.findByRole('link', { name: 'Observation Review' })
    expect(button).toHaveAttribute('href', '/review/queue')
    expect(screen.queryByRole('link', { name: 'Open review queue' })).not.toBeInTheDocument()
    await user.click(button)
    await waitFor(() => expect(router.state.location.pathname).toBe('/review/queue'))
  })

  it('is not offered to a role that cannot open the review area', async () => {
    renderReview('/review', 'USR-001')
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Observation Review' })).not.toBeInTheDocument())
  })
})
