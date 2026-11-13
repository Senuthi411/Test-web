import { describe, expect, it } from 'vitest'
import { FixtureStore, findIntegrityProblems, type FixtureDatabase } from '@/fixtures'
import { createBrowserSessionPersistence } from '@/features/identity'
import { REVIEW_STATUSES } from '@/features/review'
import { assembleContainer } from './composition/container'
import { createFixtureAdapterSet, fixtureClock } from './composition/fixtureAdapters'

/**
 * One shared demonstration dataset: a Review action must be visible to Capture and to the
 * Identity statistics immediately, never change Capture assignments or evidence, and keep
 * the dataset valid against the integrity and state-machine checks.
 */
function setup() {
  const store = new FixtureStore({ latencyMs: 0 })
  let actor = 'USR-003'
  const adapters = createFixtureAdapterSet(() => actor, store)
  const container = assembleContainer({ dataSource: 'fixtures', apiBaseUrl: '', apiTimeoutMs: 15000 }, adapters, fixtureClock, createBrowserSessionPersistence())
  const integrity = () => findIntegrityProblems(store.read((db) => db) as FixtureDatabase)
  return { store, container, as: (id: string) => (actor = id), integrity }
}

const meta = (expectedVersion = 1) => ({ expectedVersion, idempotencyKey: crypto.randomUUID() })

describe('unified demonstration dataset', () => {
  it('uses the same identifiers and counts in Identity, Capture and Review', async () => {
    const { container, as, integrity } = setup()
    expect(integrity()).toEqual([])
    const review = await container.review.port.getWorkspace()
    const capture = await container.capture.getWorkspace()
    expect(review.observations.map((o) => o.id)).toEqual(capture.observations.map((o) => o.id))
    for (const observation of review.observations) {
      expect(capture.observations.find((o) => o.id === observation.id)?.reviewStatus).toBe(observation.reviewStatus)
    }
    as('USR-001')
    const divisions = await container.identity.admin.listDivisions()
    for (const division of review.divisions) {
      const pending = review.observations.filter((o) => o.division.id === division.id && (o.reviewStatus === 'submitted' || o.reviewStatus === 'in_review')).length
      expect(divisions.find((d) => d.id === division.id)?.pendingReviewCount).toBe(pending)
    }
    const estate = await container.identity.admin.getEstate('EST-002')
    expect(estate.stats.observations).toBe(review.observations.length)
    expect(estate.stats.correctionsRequested).toBe(review.observations.filter((o) => o.reviewStatus === 'correction_requested').length)
  })

  it('propagates review decisions to Capture and Identity without touching assignments or evidence', async () => {
    const { store, container, as, integrity } = setup()
    const untouched = store.read((db) => ({ assignments: db.assignments, evidence: db.captureEvidence }))
    as('USR-001')
    const before = (await container.identity.admin.listDivisions()).find((d) => d.id === 'DIV-005')!
    as('USR-003')

    await container.review.port.verify('OBS-014', { checklist: [true, true, true, true], note: '' }, meta())
    await container.review.port.approveCorrection('COR-005', { comparedRevisions: true, originalUnchanged: true, note: '' }, meta())
    await container.review.port.simulateRevisionApplied('COR-005', 2)
    await container.review.port.rejectCorrection('COR-041', { reason: 'Evidence still unclear', message: 'Still unclear', notifyFieldWorker: true }, meta())
    await container.review.port.refer('OBS-033', { expertId: 'USR-005', note: 'Confirm' }, meta())

    expect((await container.capture.getObservation('OBS-014')).reviewStatus).toBe('verified')
    expect((await container.capture.getObservation('OBS-005')).reviewStatus).toBe('in_review')
    expect((await container.capture.getObservation('OBS-033')).reviewStatus).toBe('referred')

    as('USR-001')
    const after = (await container.identity.admin.listDivisions()).find((d) => d.id === 'DIV-005')!
    // OBS-014 left "in review" (−1); OBS-005 returned to it via RevisionApplied (+1).
    expect(after.pendingReviewCount).toBe(before.pendingReviewCount)
    expect(after.verifiedCount).toBe(before.verifiedCount + 1)

    expect(store.read((db) => ({ assignments: db.assignments, evidence: db.captureEvidence }))).toEqual(untouched)
    expect(integrity()).toEqual([])
  })

  it('derives every dashboard KPI from records (no fixed totals)', async () => {
    const { store, container } = setup()
    store.write((db) => {
      db.observations.find((o) => o.id === 'OBS-013')!.reviewStatus = 'in_review'
    })
    const workspace = await container.review.port.getWorkspace()
    const counts = Object.fromEntries(REVIEW_STATUSES.map((s) => [s, workspace.observations.filter((o) => o.reviewStatus === s).length]))
    expect(counts).toMatchObject({ submitted: 2, in_review: 3 })
  })

  it('flags workflow states that the approved transitions cannot produce', () => {
    const { store, integrity } = setup()
    store.write((db) => {
      db.observations.find((o) => o.id === 'OBS-015')!.reviewStatus = 'flagged'
    })
    expect(integrity()).toContain('OBS-015 is flagged but its decisions lead to verified')
  })

  it('requires image source attribution and keeps demonstration images distinct from field evidence', async () => {
    const { container, store, integrity } = setup()
    const review = await container.review.port.getObservationReview('OBS-014')
    expect(review.evidence?.imageSource).toMatchObject({ kind: 'synthetic_illustration', license: null })
    store.write((db) => {
      db.captureEvidence[0].imageSource = { kind: 'licensed_photo', attribution: 'Example', license: null, sourceUrl: null }
    })
    expect(integrity()).toContain('Licensed photo for OBS-005 lacks licence or source')
  })
})
