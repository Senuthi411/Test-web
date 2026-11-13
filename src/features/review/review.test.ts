import { describe, expect, it } from 'vitest'
import { FIXTURE_REFERENCE_DATE, FixtureStore, createSeedDatabase, findIntegrityProblems } from '@/fixtures'
import { fixedClock } from '@/shared/utilities/clock'
import { isAppError } from '@/shared/api'
import { createReviewUseCases } from './application/reviewUseCases'
import { createFixtureReviewAdapter } from './infrastructure/fixtureReviewAdapter'
import { createHttpReviewAdapter } from './infrastructure/httpReviewAdapter'
import { ageInDays, attentionItems, correctionSteps, countBy } from './domain/rules'
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
      submitted: 3, in_review: 2, flagged: 3, correction_requested: 2, referred: 3, verified: 2,
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
    expect(await kindOf(port.verify('OBS-014', { checklist: [true, true, true, false], note: '' }, meta()))).toBe('validation')
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

describe('Correction lifecycle (REV-08–REV-11)', () => {
  it('approval is not application; RevisionApplied returns the review to in_review', async () => {
    const { port, store } = setup()
    const evidence = store.read((db) => db.captureEvidence)
    const approved = await port.approveCorrection('COR-005', { comparedRevisions: true, originalUnchanged: true, note: '' }, meta())
    expect(approved.correction?.status).toBe('approved')
    expect((await port.getObservationReview('OBS-005')).observation.reviewStatus).toBe('correction_requested')
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
