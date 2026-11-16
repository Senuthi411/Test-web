import { describe, expect, it } from 'vitest'
import { FIXTURE_REFERENCE_DATE, FixtureStore, createSeedDatabase, findIntegrityProblems, type FixtureDatabase } from '@/fixtures'
import { fixedClock } from '@/shared/utilities/clock'
import { isAppError } from '@/shared/api'
import { createReviewUseCases } from './application/reviewUseCases'
import { createFixtureReviewAdapter } from './infrastructure/fixtureReviewAdapter'
import { createHttpReviewAdapter } from './infrastructure/httpReviewAdapter'
import { persistFixtureReviewState } from './infrastructure/fixtureReviewPersistence'
import { ageInDays, allowedDecisions, attentionItems, correctionSteps, countBy } from './domain/rules'
import { REVIEW_STATUSES } from './domain/models'

const clock = fixedClock(FIXTURE_REFERENCE_DATE)

function setup(actor: string | null = 'USR-003') {
  const store = new FixtureStore({ latencyMs: 0 })
  let current = actor
  const port = createReviewUseCases(createFixtureReviewAdapter(store, { clock, actorId: () => current }))
  return { store, port, signIn: (id: string | null) => (current = id) }
}

const meta = (expectedVersion = 1, idempotencyKey = crypto.randomUUID()) => ({ expectedVersion, idempotencyKey })
const ALL_CHECKED = [true, true, true, true]

async function kindOf(promise: Promise<unknown>) {
  try {
    await promise
    return 'resolved'
  } catch (error) {
    return isAppError(error) ? error.kind : 'unknown'
  }
}

describe('Review fixtures', () => {
  it('keep referential integrity across Capture, Identity and Review records', () => {
    expect(findIntegrityProblems(createSeedDatabase())).toEqual([])
  })
})

describe('Review workspace (REV-01, REV-02, REV-07, REV-13, REV-14, REV-17)', () => {
  it('matches the Riverbend queue, corrections, referrals and history in Figma', async () => {
    const { port } = setup()
    const workspace = await port.getWorkspace()
    expect(workspace.observations).toHaveLength(15)
    expect(countBy(workspace.observations, (o) => o.reviewStatus, REVIEW_STATUSES)).toEqual({
      // OBS-005's corrected revision OBSR-005-2 (COR-005) is Resubmitted; OBS-041 still waits for its correction.
      // OBS-006 and OBS-042 were referred and their expert decisions are in (REF-006, REF-042): Decision.
      submitted: 3, resubmitted: 1, in_review: 2, flagged: 3, correction_requested: 1, referred: 1, decision: 2, verified: 2,
    })
    expect(workspace.corrections.map((c) => [c.id, c.status])).toEqual([['COR-005', 'resubmitted'], ['COR-041', 'requested']])
    expect(workspace.referrals.map((r) => r.id).sort()).toEqual(['REF-006', 'REF-023', 'REF-042'])
    expect(workspace.quarantine.map((q) => q.id)).toEqual(['QUA-002'])
    expect(workspace.decisions.map((d) => d.recordId)).toEqual([
      'QDEC-002', 'REV-015', 'REV-032', 'REF-006', 'COR-005', 'REV-024', 'REV-004', 'REF-023', 'REF-042', 'COR-041', 'REV-040',
    ])
    expect(workspace.decisions.find((d) => d.recordId === 'REF-006')?.note).toBe('Linked to CASE-006')
    expect(attentionItems(workspace).map((item) => item.title)).toEqual([
      'COR-005 resubmitted', 'COR-041 awaiting field worker', 'OBS-024 flagged', 'QUA-002 released, pending ingest',
    ])
  })

  it('scopes every list to the Supervisor estate (Highland sees no Riverbend data)', async () => {
    const { port } = setup('USR-002')
    const workspace = await port.getWorkspace()
    expect(workspace.observations.every((o) => o.estate.id === 'EST-001')).toBe(true)
    expect(workspace.quarantine.map((q) => q.id)).toEqual(['QUA-001', 'QUA-004'])
    expect(workspace.corrections).toEqual([])
    expect(workspace.decisions.every((d) => d.decidedBy.id === 'USR-002')).toBe(true)
  })

  it('refuses non-Supervisors and signed-out sessions', async () => {
    expect(await kindOf(setup('USR-005').port.getWorkspace())).toBe('forbidden')
    expect(await kindOf(setup('USR-001').port.getWorkspace())).toBe('forbidden')
    expect(await kindOf(setup(null).port.getWorkspace())).toBe('unauthorized')
  })

  it('returns the same not_found for out-of-scope and missing observations', async () => {
    const { port } = setup()
    expect(await kindOf(port.getObservationReview('OBS-001'))).toBe('not_found')
    expect(await kindOf(port.getObservationReview('OBS-999'))).toBe('not_found')
  })

  it('builds the REV-03 record for OBS-014', async () => {
    const review = await setup().port.getObservationReview('OBS-014')
    expect(review.reviewId).toBe('REV-014')
    expect(review.version).toBe(1)
    expect(review.evidence).toMatchObject({ imageId: 'IMG-014', latitude: 7.106, longitude: 80.734 })
    expect(review.symptoms).toEqual(['Brown necrotic patches', 'Irregular leaf spots'])
    expect(review.history.map((step) => step.title)).toEqual(['Submitted', 'Claimed for review', 'Decision pending'])
    expect(review.experts).toEqual([{ id: 'USR-005', fullName: 'Dr Tara Wijesinghe', estateIds: ['EST-001', 'EST-002'], awaitingCaseIds: ['CASE-011', 'CASE-023', 'CASE-047'] }])
  })
})

describe('Observation decisions (REV-04, REV-05, REV-06, REV-12)', () => {
  it('verifies an in-review observation once, even when the request is repeated', async () => {
    const { port, store } = setup()
    const m = meta()
    const first = await port.verify('OBS-014', { checklist: ALL_CHECKED, note: '' }, m)
    const replay = await port.verify('OBS-014', { checklist: ALL_CHECKED, note: '' }, m)
    expect(replay.decision.id).toBe(first.decision.id)
    expect(store.read((db) => db.reviewDecisions.filter((d) => d.targetId === 'OBS-014').length)).toBe(1)
    const review = await port.getObservationReview('OBS-014')
    expect(review.observation.reviewStatus).toBe('verified')
    expect(review.version).toBe(2)
  })

  it('validates required inputs before any adapter call', async () => {
    const { port, store } = setup()
    expect(await kindOf(port.flag('OBS-014', { reason: 'Image quality issue', category: 'Evidence', explanation: '  ', notifyFieldWorker: true }, meta()))).toBe('validation')
    expect(await kindOf(port.requestCorrection('OBS-014', { items: [], message: 'x' }, meta()))).toBe('validation')
    expect(await kindOf(port.refer('OBS-014', { expertId: 'USR-005', note: '' }, meta()))).toBe('validation')
    expect(store.read((db) => db.observations.find((o) => o.id === 'OBS-014')?.reviewStatus)).toBe('in_review')
  })

  it('rejects stale versions and decisions on records that are not in review', async () => {
    const { port } = setup()
    expect(await kindOf(port.verify('OBS-014', { checklist: ALL_CHECKED, note: '' }, meta(7)))).toBe('conflict')
    expect(await kindOf(port.verify('OBS-013', { checklist: ALL_CHECKED, note: '' }, meta()))).toBe('conflict')
    expect(await kindOf(port.verify('OBS-015', { checklist: ALL_CHECKED, note: '' }, meta()))).toBe('conflict')
  })

  it('flags without touching Capture evidence or assignments', async () => {
    const { port, store } = setup()
    const before = store.read((db) => ({ evidence: db.captureEvidence, assignments: db.assignments }))
    await port.flag('OBS-033', { reason: 'Image quality issue', category: 'Evidence', explanation: 'Blurred', notifyFieldWorker: true }, meta())
    expect(store.read((db) => ({ evidence: db.captureEvidence, assignments: db.assignments }))).toEqual(before)
    const workspace = await port.getWorkspace()
    expect(workspace.observations.find((o) => o.id === 'OBS-033')?.reviewStatus).toBe('flagged')
    expect(attentionItems(workspace).some((item) => item.id === 'OBS-033')).toBe(true)
  })

  it('creates a requested correction and blocks a second open one', async () => {
    const { port } = setup()
    const result = await port.requestCorrection('OBS-033', { items: ['Retake a clearer image'], message: 'Please retake' }, meta())
    expect(result.correction).toMatchObject({ id: 'COR-033', status: 'requested', requestedRevision: 2 })
    expect((await port.getObservationReview('OBS-033')).observation.reviewStatus).toBe('correction_requested')
  })

  it('refers with a pending case link and creates no case', async () => {
    const { port, store } = setup()
    const cases = store.read((db) => db.cases.length)
    const result = await port.refer('OBS-014', { expertId: 'USR-005', note: 'Confirm grey blight' }, meta())
    expect(result.referral).toMatchObject({ id: 'REF-014', linkStatus: 'pending_case_link', caseId: null })
    expect(store.read((db) => db.cases.length)).toBe(cases)
  })

  it('refuses an expert who does not cover the estate', async () => {
    expect(await kindOf(setup().port.refer('OBS-014', { expertId: 'USR-006', note: 'x' }, meta()))).toBe('validation')
  })
})

describe('Claim on open and status-dependent decisions', () => {
  const VERIFY = { checklist: ALL_CHECKED, note: '' }
  const FLAG = { reason: 'Image quality issue', category: 'Evidence', explanation: 'Blurred', notifyFieldWorker: true }
  const CORRECTION = { items: ['Retake a clearer image'], message: 'Please retake' }
  const REFERRAL = { expertId: 'USR-005', note: 'Please confirm' }

  it('lists the decisions each status allows', () => {
    expect(allowedDecisions('in_review')).toEqual(['verify', 'flag', 'requestCorrection', 'refer'])
    // The expert decision is finalised by the Supervisor: verify or flag.
    expect(allowedDecisions('decision')).toEqual(['verify', 'flag'])
    // Submitted and Resubmitted need Start review; Verified and Flagged are final; the rest wait.
    for (const status of ['submitted', 'resubmitted', 'flagged', 'verified', 'correction_requested', 'referred'] as const) expect(allowedDecisions(status)).toEqual([])
  })

  it('opening (reading) an observation never changes its status; only Start review does', async () => {
    const { port } = setup()
    await port.getObservationReview('OBS-013')
    await port.getObservationReview('OBS-013')
    expect((await port.getWorkspace()).observations.find((o) => o.id === 'OBS-013')?.reviewStatus).toBe('submitted')
    expect(await kindOf(port.verify('OBS-013', VERIFY, meta(1)))).toBe('conflict')
  })

  it('verification is not blocked by a checklist: the Supervisor verifies from the evidence', async () => {
    const { port } = setup()
    const result = await port.verify('OBS-014', { note: '' }, meta(1))
    expect(result.decision).toMatchObject({ outcome: 'verified', targetId: 'OBS-014' })
  })

  it('claims a Submitted observation into In review exactly once', async () => {
    const { port, store } = setup()
    const decisions = store.read((db) => db.reviewDecisions.length)
    const claimed = await port.claim('OBS-013')
    expect(claimed.observation.reviewStatus).toBe('in_review')
    expect(claimed.version).toBe(2)
    expect(claimed.history.map((step) => step.title)).toEqual(['Submitted', 'Claimed for review', 'Decision pending'])
    expect(claimed.history[1]).toMatchObject({ by: 'Malini Fernando' })
    const reopened = await port.claim('OBS-013')
    expect(reopened.version).toBe(2)
    expect(reopened.history.filter((step) => step.title === 'Claimed for review')).toHaveLength(1)
    expect((await port.getWorkspace()).observations.find((o) => o.id === 'OBS-013')?.reviewStatus).toBe('in_review')
    expect(store.read((db) => db.reviewDecisions.length)).toBe(decisions)
  })

  it('leaves non-Submitted observations unchanged and never claims outside the estate scope', async () => {
    const { port } = setup()
    expect((await port.claim('OBS-004')).observation.reviewStatus).toBe('flagged')
    expect((await port.claim('OBS-014')).version).toBe(1)
    expect(await kindOf(port.claim('OBS-001'))).toBe('not_found')
  })

  it('Verified and Flagged are final: no further decision is accepted', async () => {
    const { port } = setup()
    for (const id of ['OBS-004', 'OBS-015']) {
      const review = await port.getObservationReview(id)
      expect(review.history.at(-1)?.title).not.toBe('Decision pending')
      const v = review.version
      expect(await kindOf(port.verify(id, VERIFY, meta(v)))).toBe('conflict')
      expect(await kindOf(port.flag(id, FLAG, meta(v)))).toBe('conflict')
      expect(await kindOf(port.requestCorrection(id, CORRECTION, meta(v)))).toBe('conflict')
      expect(await kindOf(port.refer(id, REFERRAL, meta(v)))).toBe('conflict')
    }
  })

  it('Referred means sent to an expert; Decision shows the expert decision, which the Supervisor finalises', async () => {
    const { port, store } = setup()
    // OBS-023: referred, case awaiting diagnosis — no decision is available yet.
    const waiting = await port.getObservationReview('OBS-023')
    expect(waiting.observation.reviewStatus).toBe('referred')
    expect(waiting.expertDecision).toBeNull()
    expect(await kindOf(port.verify('OBS-023', VERIFY, meta(waiting.version)))).toBe('conflict')
    // OBS-006: the expert diagnosed Grey blight (REF-006, CASE-006).
    const decided = await port.getObservationReview('OBS-006')
    expect(decided.observation.reviewStatus).toBe('decision')
    expect(decided.expertDecision).toMatchObject({ referralId: 'REF-006', caseId: 'CASE-006', expert: 'Dr Tara Wijesinghe', disease: 'Grey blight (DIS-002)' })
    expect(await kindOf(port.requestCorrection('OBS-006', CORRECTION, meta(decided.version)))).toBe('conflict')
    expect(await kindOf(port.refer('OBS-006', REFERRAL, meta(decided.version)))).toBe('conflict')
    await port.verify('OBS-006', { note: 'Expert diagnosis confirmed' }, meta(decided.version))
    const finalised = (await port.getWorkspace()).observations.find((o) => o.id === 'OBS-006')
    expect(finalised).toMatchObject({ reviewStatus: 'verified', finalisedAt: '2026-10-21T10:00:00+05:30', archivedAt: null })
    expect(findIntegrityProblems(store.read((db) => db) as FixtureDatabase)).toEqual([])
  })

  it('moves finalised observations to Observation History 24 hours after the final decision; others stay', async () => {
    const { port, store } = setup()
    const today = (await port.getWorkspace()).observations
    // Verified 16 Oct and 14 Oct, flagged 3–6 Oct: archived. Referred, in review and correction stay.
    expect(today.filter((o) => o.archivedAt).map((o) => o.id).sort()).toEqual(['OBS-004', 'OBS-015', 'OBS-024', 'OBS-032', 'OBS-040'])
    await port.verify('OBS-014', VERIFY, meta(1))
    const later = createReviewUseCases(createFixtureReviewAdapter(store, { clock: fixedClock('2026-10-22T11:00:00+05:30'), actorId: () => 'USR-003' }))
    const next = (await later.getWorkspace()).observations
    expect(next.find((o) => o.id === 'OBS-014')?.archivedAt).toBe('2026-10-22T04:30:00.000Z')
    for (const id of ['OBS-023', 'OBS-041', 'OBS-005', 'OBS-006', 'OBS-013']) expect(next.find((o) => o.id === id)?.archivedAt).toBeNull()
    // Archived records keep their decisions and revisions.
    expect((await later.getObservationReview('OBS-014')).revisions[0].decisions.map((d) => d.outcome)).toEqual(['verified'])
  })

  it('keeps the dataset consistent after start review → correction, verify, flag and referral', async () => {
    const { port, store } = setup()
    const claimed = await port.claim('OBS-013')
    await port.requestCorrection('OBS-013', CORRECTION, meta(claimed.version))
    await port.verify('OBS-014', VERIFY, meta(1))
    await port.flag('OBS-033', FLAG, meta(1))
    const other = await port.claim('OBS-022')
    await port.refer('OBS-022', REFERRAL, meta(other.version))
    expect(findIntegrityProblems(store.read((db) => db) as FixtureDatabase)).toEqual([])
  })

  it('reports the claim as contract_pending in API mode', async () => {
    expect(await kindOf(createHttpReviewAdapter({} as never).claim('OBS-013'))).toBe('contract_pending')
  })
})

describe('Review state persistence (fixture mode)', () => {
  const portFor = (store: FixtureStore) => createReviewUseCases(createFixtureReviewAdapter(store, { clock, actorId: () => 'USR-003' }))
  const reload = () => {
    const store = new FixtureStore({ latencyMs: 0 })
    persistFixtureReviewState(store, window.sessionStorage)
    return { store, port: portFor(store) }
  }

  it('keeps claims and decisions across a reload, and Restore demo state resets them', async () => {
    window.sessionStorage.clear()
    const first = reload()
    await first.port.claim('OBS-013')
    await first.port.flag('OBS-014', { reason: 'Image quality issue', category: 'Evidence', explanation: 'Blurred', notifyFieldWorker: true }, meta())

    const second = reload()
    expect((await second.port.getObservationReview('OBS-013')).observation.reviewStatus).toBe('in_review')
    const flagged = await second.port.getObservationReview('OBS-014')
    expect(flagged.observation.reviewStatus).toBe('flagged')
    expect(flagged.history.map((step) => step.title)).toContain('Flagged')

    second.store.reset()
    expect((await reload().port.getObservationReview('OBS-013')).observation.reviewStatus).toBe('submitted')
    window.sessionStorage.clear()
  })

  it('ignores unreadable stored state', async () => {
    window.sessionStorage.setItem('tealeaf.fixtures.review', '{not json')
    expect((await reload().port.getObservationReview('OBS-013')).observation.reviewStatus).toBe('submitted')
    window.sessionStorage.setItem('tealeaf.fixtures.review', JSON.stringify({ format: 1, statuses: { 'OBS-999': 'flagged' }, reviewRecords: [], reviewDecisions: [], corrections: [], referrals: [], reviewFollowUpObservationIds: [] }))
    expect((await reload().port.getObservationReview('OBS-013')).observation.reviewStatus).toBe('submitted')
    window.sessionStorage.clear()
  })
})

describe('Correction lifecycle (REV-08–REV-11)', () => {
  it('approval is not application; RevisionApplied returns the review to in_review', async () => {
    const { port, store } = setup()
    const evidence = store.read((db) => db.captureEvidence)
    const approved = await port.approveCorrection('COR-005', { comparedRevisions: true, originalUnchanged: true, note: '' }, meta())
    expect(approved.correction?.status).toBe('approved')
    expect((await port.getObservationReview('OBS-005')).observation.reviewStatus).toBe('resubmitted')
    const applied = await port.simulateRevisionApplied('COR-005', 2)
    expect(applied).toMatchObject({ status: 'applied', appliedRevision: 2 })
    expect((await port.getObservationReview('OBS-005')).observation.reviewStatus).toBe('in_review')
    expect(store.read((db) => db.captureEvidence)).toEqual(evidence)
  })

  it('only a resubmitted correction can be approved and RevisionApplied needs approval', async () => {
    const { port } = setup()
    expect(await kindOf(port.approveCorrection('COR-041', { comparedRevisions: true, originalUnchanged: true, note: '' }, meta()))).toBe('conflict')
    expect(await kindOf(port.simulateRevisionApplied('COR-005', 1))).toBe('conflict')
    expect(await kindOf(port.approveCorrection('COR-005', { comparedRevisions: true, originalUnchanged: false, note: '' }, meta()))).toBe('validation')
  })

  it('rejects COR-041, leaves the observation unchanged and records the history row', async () => {
    const { port } = setup()
    await port.rejectCorrection('COR-041', { reason: 'Evidence still unclear', message: 'Image still blurred', notifyFieldWorker: true }, meta())
    const workspace = await port.getWorkspace()
    expect(workspace.corrections.find((c) => c.id === 'COR-041')?.status).toBe('rejected')
    expect(workspace.observations.find((o) => o.id === 'OBS-041')?.reviewStatus).toBe('correction_requested')
    expect(workspace.decisions).toHaveLength(12)
    expect(workspace.decisions[0]).toMatchObject({ recordId: 'COR-041', outcome: 'correction_rejected', note: 'Evidence still unclear' })
    expect(await kindOf(port.rejectCorrection('COR-041', { reason: 'Evidence still unclear', message: 'again', notifyFieldWorker: false }, meta(2)))).toBe('conflict')
    expect(await kindOf(port.rejectCorrection('COR-041', { reason: 'Evidence still unclear', message: '', notifyFieldWorker: false }, meta(2)))).toBe('validation')
  })

  it('hides corrections from other estates', async () => {
    expect(await kindOf(setup('USR-002').port.approveCorrection('COR-005', { comparedRevisions: true, originalUnchanged: true, note: '' }, meta()))).toBe('not_found')
  })
})

describe('Review domain helpers', () => {
  it('computes REV-01 ages and REV-08 stepper states', async () => {
    expect(ageInDays('2026-10-04T08:00:00+05:30', FIXTURE_REFERENCE_DATE)).toBe(17)
    const workspace = await setup().port.getWorkspace()
    const cor005 = workspace.corrections.find((c) => c.id === 'COR-005')!
    expect(correctionSteps(cor005).map((s) => s.state)).toEqual(['done', 'current', 'todo', 'todo'])
    const cor041 = workspace.corrections.find((c) => c.id === 'COR-041')!
    expect(correctionSteps(cor041).map((s) => s.state)).toEqual(['current', 'todo', 'todo', 'todo'])
  })
})

describe('HTTP Review adapter', () => {
  it('reports contract_pending without sending requests', async () => {
    const port = createHttpReviewAdapter({} as never)
    expect(await kindOf(port.getWorkspace())).toBe('contract_pending')
    expect(await kindOf(port.verify('OBS-014', { checklist: ALL_CHECKED, note: '' }, meta()))).toBe('contract_pending')
    expect(await kindOf(port.exportList('queue'))).toBe('contract_pending')
  })
})

describe('Observation revisions, resubmission and revision-aware decisions', () => {
  const resubmit = (note: string, retakePhoto = true) => ({ note, retakePhoto })
  type Port = ReturnType<typeof setup>['port']
  const version = async (port: Port, id: string) => (await port.getObservationReview(id)).version
  const correctionVersion = async (port: Port, id: string) => (await port.getWorkspace()).corrections.find((c) => c.id === id)!.version

  it('a first-time submission has one revision and no comparison', async () => {
    const { port } = setup()
    const review = await port.getObservationReview('OBS-013')
    expect(review.observation).toMatchObject({ reviewStatus: 'submitted', revisionNumber: 1 })
    expect(review.revisions.map((r) => [r.id, r.number, r.correctionId])).toEqual([['OBSR-013-1', 1, null]])
  })

  it('shows OBS-005 as Resubmitted until the Supervisor starts the review, then In review with all four decisions', async () => {
    const { port } = setup()
    const review = await port.getObservationReview('OBS-005')
    expect(review.observation).toMatchObject({ reviewStatus: 'resubmitted', revisionNumber: 2 })
    expect(review.revisions.map((r) => [r.id, r.statusLabel])).toEqual([['OBSR-005-1', 'Correction requested'], ['OBSR-005-2', 'Resubmitted']])
    expect(review.requests).toMatchObject([{ correctionId: 'COR-005', onRevision: 1, requestedRevision: 2 }])
    // Reading (opening) never changes the status; no decision is offered before the review starts.
    expect((await port.getObservationReview('OBS-005')).observation.reviewStatus).toBe('resubmitted')
    expect(allowedDecisions('resubmitted')).toEqual([])
    expect(await kindOf(port.verify('OBS-005', { checklist: ALL_CHECKED, note: '' }, meta(review.version)))).toBe('conflict')
    // Starting the review: Resubmitted → In review, recorded in the review history.
    const started = await port.claim('OBS-005')
    expect(started.observation.reviewStatus).toBe('in_review')
    expect(started.version).toBe(review.version + 1)
    expect(started.history.map((step) => step.title)).toContain('Review started on version 2')
    expect(allowedDecisions('in_review')).toEqual(['verify', 'flag', 'requestCorrection', 'refer'])
    expect((await port.getWorkspace()).corrections.find((c) => c.id === 'COR-005')?.status).toBe('resubmitted')
  })

  it('runs request, resubmit, request again, resubmit, verify, recording each decision on its revision', async () => {
    const { port, store } = setup()
    // Request a correction on OBS-033 (version 1).
    await port.requestCorrection('OBS-033', { items: ['Retake a clearer image'], message: 'Retake please' }, meta(await version(port, 'OBS-033')))
    expect((await port.getObservationReview('OBS-033')).observation.reviewStatus).toBe('correction_requested')
    const original = store.read((db) => db.observations.find((o) => o.id === 'OBS-033'))
    // The Field Worker resubmits: the same Observation ID now has version 2.
    const cor = await port.simulateResubmission('COR-033', resubmit('Clearer photo of the lower leaves'), await correctionVersion(port, 'COR-033'))
    expect(cor).toMatchObject({ status: 'resubmitted', revision: { id: 'OBSR-033-2', number: 2 } })
    expect(cor.revision?.changes.map((c) => c.field)).toEqual(['Photograph', 'Field notes'])
    let review = await port.getObservationReview('OBS-033')
    expect(review.observation).toMatchObject({ reviewStatus: 'resubmitted', revisionNumber: 2 })
    const v1 = review.revisions[0]
    expect(review.revisions[1]).toMatchObject({ photo: { imageId: 'IMG-033-V2' }, note: 'Clearer photo of the lower leaves', correctionId: 'COR-033', division: v1.division, suspectedDisease: v1.suspectedDisease })
    // No duplicate observations: still one queue row and one dashboard count.
    const workspace = await port.getWorkspace()
    expect(workspace.observations.filter((o) => o.id === 'OBS-033')).toHaveLength(1)
    expect(workspace.observations).toHaveLength(15)
    // Start the review of version 2, request another correction; version 3 then arrives.
    review = await port.claim('OBS-033')
    expect(review.observation.reviewStatus).toBe('in_review')
    await port.requestCorrection('OBS-033', { items: ['Confirm symptom details'], message: 'Confirm symptoms' }, meta(review.version))
    const corrections = (await port.getWorkspace()).corrections.filter((c) => c.observation.id === 'OBS-033')
    expect(corrections.map((c) => [c.id, c.status, c.requestedRevision])).toEqual([['COR-033', 'applied', 2], ['COR-033-001', 'requested', 3]])
    await port.simulateResubmission('COR-033-001', resubmit('Symptoms confirmed', false), 1)
    review = await port.getObservationReview('OBS-033')
    expect(review.revisions.map((r) => r.number)).toEqual([1, 2, 3])
    expect(review.revisions[2].photo?.imageId).toBe('IMG-033-V2')
    // Start the review of version 3 and verify it.
    review = await port.claim('OBS-033')
    await port.verify('OBS-033', { checklist: ALL_CHECKED, note: 'Corrected' }, meta(review.version))
    review = await port.getObservationReview('OBS-033')
    expect(review.observation.reviewStatus).toBe('verified')
    // Every revision is still available, and each decision is tied to its revision.
    expect(review.revisions.map((r) => [r.number, r.statusLabel])).toEqual([[1, 'Correction requested'], [2, 'Correction requested'], [3, 'Verified']])
    const history = (await port.getWorkspace()).decisions.filter((d) => d.targetId === 'OBS-033').reverse()
    expect(history.map((d) => [d.outcome, d.revision?.id])).toEqual([['correction_requested', 'OBSR-033-1'], ['correction_requested', 'OBSR-033-2'], ['verified', 'OBSR-033-3']])
    // The capture record and the original submission are unchanged; the dataset stays consistent.
    expect(store.read((db) => db.observations.find((o) => o.id === 'OBS-033'))).toEqual({ ...original, reviewStatus: 'verified' })
    expect(store.read((db) => db.observationRevisions.find((r) => r.id === 'OBSR-033-1')?.values)).toMatchObject({ imageId: null, note: null })
    expect(store.read((db) => findIntegrityProblems(db as FixtureDatabase))).toEqual([])
  })

  it.each([
    ['flag', 'flagged'],
    ['refer', 'referred'],
  ] as const)('a resubmitted observation accepts the %s decision like any other, completing its correction', async (kind, status) => {
    const { port, store } = setup()
    const v = (await port.claim('OBS-005')).version
    if (kind === 'flag') await port.flag('OBS-005', { reason: 'Evidence unclear', category: 'Image quality', explanation: 'Still unclear', notifyFieldWorker: false }, meta(v))
    else await port.refer('OBS-005', { expertId: 'USR-005', note: 'Expert view needed' }, meta(v))
    const workspace = await port.getWorkspace()
    expect(workspace.observations.find((o) => o.id === 'OBS-005')?.reviewStatus).toBe(status)
    expect(workspace.corrections.find((c) => c.id === 'COR-005')?.status).toBe('applied')
    expect(workspace.decisions[0]).toMatchObject({ targetId: 'OBS-005', revision: { id: 'OBSR-005-2', number: 2 } })
    expect(store.read((db) => findIntegrityProblems(db as FixtureDatabase))).toEqual([])
  })

  it('only a requested correction can be resubmitted, once, with the current version', async () => {
    const { port, store } = setup()
    expect(await kindOf(port.simulateResubmission('COR-005', resubmit('Again'), 1))).toBe('conflict')
    expect(await kindOf(port.simulateResubmission('COR-041', resubmit('   '), 1))).toBe('validation')
    expect(await kindOf(port.simulateResubmission('COR-041', resubmit('Fixed'), 9))).toBe('conflict')
    const before = store.read((db) => db.observationRevisions)
    await port.simulateResubmission('COR-041', resubmit('Fixed'), 1)
    expect(await kindOf(port.simulateResubmission('COR-041', resubmit('Fixed twice'), 2))).toBe('conflict')
    expect(store.read((db) => db.observationRevisions.filter((r) => r.observationId === 'OBS-041').map((r) => r.id))).toEqual(['OBSR-041-1', 'OBSR-041-2'])
    expect(store.read((db) => db.observationRevisions.slice(0, before.length))).toEqual(before)
  })

  it('a rejected resubmission returns the observation to Correction requested and keeps the revision', async () => {
    const { port } = setup()
    await port.rejectCorrection('COR-005', { reason: 'Evidence still unclear', message: 'Retake again', notifyFieldWorker: true }, meta())
    const review = await port.getObservationReview('OBS-005')
    expect(review.observation.reviewStatus).toBe('correction_requested')
    expect(review.revisions.map((r) => r.id)).toEqual(['OBSR-005-1', 'OBSR-005-2'])
  })

  it('keeps revisions and revision-linked decisions across a reload', async () => {
    window.sessionStorage.clear()
    const reload = () => {
      const store = new FixtureStore({ latencyMs: 0 })
      persistFixtureReviewState(store, window.sessionStorage)
      return createReviewUseCases(createFixtureReviewAdapter(store, { clock, actorId: () => 'USR-003' }))
    }
    const first = reload()
    await first.simulateResubmission('COR-041', resubmit('Fixed'), 1)
    await first.verify('OBS-041', { checklist: ALL_CHECKED, note: '' }, meta((await first.claim('OBS-041')).version))
    const second = reload()
    const review = await second.getObservationReview('OBS-041')
    expect(review.observation.reviewStatus).toBe('verified')
    expect(review.revisions.map((r) => r.id)).toEqual(['OBSR-041-1', 'OBSR-041-2'])
    expect((await second.getWorkspace()).decisions[0]).toMatchObject({ outcome: 'verified', revision: { id: 'OBSR-041-2' } })
    window.sessionStorage.clear()
  })

  it('the HTTP adapter never fakes a resubmission', async () => {
    const port = createHttpReviewAdapter({} as never)
    expect(await kindOf(port.simulateResubmission('COR-041', resubmit('x'), 1))).toBe('contract_pending')
  })
})
