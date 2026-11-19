import { describe, expect, it } from 'vitest'
import { FIXTURE_REFERENCE_DATE, FixtureStore, findIntegrityProblems, type FixtureDatabase } from '@/fixtures'
import { isAppError } from '@/shared/api'
import { fixedClock } from '@/shared/utilities/clock'
import { createReviewUseCases } from './application/reviewUseCases'
import { createFixtureReviewAdapter } from './infrastructure/fixtureReviewAdapter'
import { REVIEW_STATUSES, type ReviewStatus } from './domain/models'
import {
  WORKFLOW_TRANSITIONS,
  allowedDecisions,
  canEndProcess,
  canRecordDiagnosis,
  canStartReview,
  canTransition,
  transitionTarget,
  type WorkflowAction,
} from './domain/rules'

const clock = fixedClock(FIXTURE_REFERENCE_DATE)
function setup(actor: string | null = 'USR-003') {
  const store = new FixtureStore({ latencyMs: 0 })
  const port = createReviewUseCases(createFixtureReviewAdapter(store, { clock, actorId: () => actor }))
  return { store, port }
}
type Port = ReturnType<typeof setup>['port']
const meta = (expectedVersion: number, idempotencyKey = crypto.randomUUID()) => ({ expectedVersion, idempotencyKey })
const kindOf = async (promise: Promise<unknown>) => {
  try {
    await promise
    return 'ok'
  } catch (error) {
    return isAppError(error) ? error.kind : 'other'
  }
}
const version = async (port: Port, id: string) => (await port.getObservationReview(id)).version
const statusOf = async (port: Port, id: string) => (await port.getObservationReview(id)).observation.reviewStatus
const FLAG = { reason: 'Image quality issue', category: 'Evidence', explanation: 'Blurred', notifyFieldWorker: true }
const CORRECTION = { items: ['Retake a clearer image'], message: 'Please retake the photograph' }
const REFERRAL = { expertId: 'USR-005', note: 'Please confirm' }
const DIAGNOSIS = { diseaseId: 'DIS-002', symptomsConfirmed: 'Grey patches', severity: 'High', clinicalFindings: 'Typical lesions', reasoning: 'Matches catalog', recommendedAction: 'Prune', followUpDescription: '', monitoringWindow: '', inspectionFocus: '', closeCase: false }
const ACTIONS: WorkflowAction[] = ['startReview', 'verify', 'flag', 'requestCorrection', 'refer', 'resubmit', 'startResubmittedReview', 'recordExpertDecision', 'endProcess']

/** The Supervisor's log entries for an observation, oldest first, as "from>to". */
const changes = async (port: Port, id: string) =>
  (await port.getWorkspace()).decisions.filter((d) => d.targetId === id).reverse().map((d) => [d.outcome, d.transition ? `${d.transition.from}>${d.transition.to}` : null] as const)

describe('Observation review lifecycle: the transition table', () => {
  it('lists exactly the lifecycle of the spec', () => {
    expect(WORKFLOW_TRANSITIONS).toEqual({
      submitted: { startReview: 'in_review' },
      in_review: { verify: 'verified', flag: 'flagged' },
      verified: { refer: 'referred', endProcess: 'history' },
      flagged: { requestCorrection: 'correction_requested', endProcess: 'history' },
      correction_requested: { resubmit: 'resubmitted' },
      resubmitted: { startResubmittedReview: 'in_review' },
      referred: { recordExpertDecision: 'decision' },
      decision: { endProcess: 'history' },
    })
  })

  it.each(REVIEW_STATUSES.flatMap((status) => ACTIONS.map((action) => [status, action] as const)))('%s + %s is allowed only when the table says so', (status, action) => {
    const target = WORKFLOW_TRANSITIONS[status][action] ?? null
    expect(transitionTarget(status, action)).toBe(target)
    expect(canTransition(status, action)).toBe(target !== null)
  })

  it('derives the buttons each status offers from the table', () => {
    const offered = (status: ReviewStatus) => ({ decisions: allowedDecisions(status), start: canStartReview(status), end: canEndProcess(status, null), expert: canRecordDiagnosis(status) })
    expect(offered('submitted')).toEqual({ decisions: [], start: true, end: false, expert: false })
    expect(offered('in_review')).toEqual({ decisions: ['verify', 'flag'], start: false, end: false, expert: false })
    expect(offered('verified')).toEqual({ decisions: ['refer'], start: false, end: true, expert: false })
    expect(offered('flagged')).toEqual({ decisions: ['requestCorrection'], start: false, end: true, expert: false })
    expect(offered('correction_requested')).toEqual({ decisions: [], start: false, end: false, expert: false })
    expect(offered('resubmitted')).toEqual({ decisions: [], start: true, end: false, expert: false })
    expect(offered('referred')).toEqual({ decisions: [], start: false, end: false, expert: true })
    expect(offered('decision')).toEqual({ decisions: [], start: false, end: true, expert: false })
    expect(canEndProcess('verified', '2026-10-21T10:00:00+05:30')).toBe(false)
  })
})

describe('Observation review lifecycle: every path', () => {
  it('Submitted → In Review → Verified → Referred → Decision → History', async () => {
    const { port, store } = setup()
    expect(await statusOf(port, 'OBS-022')).toBe('submitted')
    await port.claim('OBS-022')
    expect(await statusOf(port, 'OBS-022')).toBe('in_review')
    await port.verify('OBS-022', { note: 'Evidence is clear' }, meta(await version(port, 'OBS-022')))
    expect(await statusOf(port, 'OBS-022')).toBe('verified')
    const referred = await port.refer('OBS-022', REFERRAL, meta(await version(port, 'OBS-022')))
    expect(referred.referral).toMatchObject({ id: 'REF-022', caseStatus: null, diagnosis: null })
    // A referral alone is not a decision.
    expect(await statusOf(port, 'OBS-022')).toBe('referred')
    expect(await kindOf(port.endProcess('OBS-022', { reason: 'Too early' }, meta(await version(port, 'OBS-022'))))).toBe('conflict')
    // The expert's confirmation (fixture stand-in for the Cases event) is what produces Decision.
    await port.recordExpertDiagnosis('OBS-022', DIAGNOSIS, meta(await version(port, 'OBS-022')))
    expect(await statusOf(port, 'OBS-022')).toBe('decision')
    await port.endProcess('OBS-022', { reason: 'Expert decision acknowledged' }, meta(await version(port, 'OBS-022')))
    const ended = (await port.getWorkspace()).observations.find((o) => o.id === 'OBS-022')
    expect(ended).toMatchObject({ reviewStatus: 'decision', archivedAt: expect.any(String), processEndedAt: expect.any(String) })
    // The decision log holds the whole lifecycle with the previous and new status, in order.
    expect(await changes(port, 'OBS-022')).toEqual([
      ['review_started', 'submitted>in_review'], ['verified', 'in_review>verified'], ['referred', 'verified>referred'], ['expert_decision', 'referred>decision'], ['process_ended', 'decision>history'],
    ])
    expect(store.read((db) => findIntegrityProblems(db as FixtureDatabase)).join(' || ')).toBe('')
  })

  it('Submitted → In Review → Flagged → Correction Requested → Resubmitted → In Review → Verified → History, keeping the original revision', async () => {
    const { port, store } = setup()
    await port.claim('OBS-031')
    // The submitted evidence of revision 1 (its status label and decisions change as the review goes on; the evidence does not).
    const evidenceOf = ({ statusLabel, decisions, ...evidence }: Awaited<ReturnType<Port['getObservationReview']>>['revisions'][number]) => (void statusLabel, void decisions, evidence)
    const original = evidenceOf((await port.getObservationReview('OBS-031')).revisions[0])
    await port.flag('OBS-031', FLAG, meta(await version(port, 'OBS-031')))
    expect(await statusOf(port, 'OBS-031')).toBe('flagged')
    const requested = await port.requestCorrection('OBS-031', CORRECTION, meta(await version(port, 'OBS-031')))
    expect(await statusOf(port, 'OBS-031')).toBe('correction_requested')
    const correctionId = requested.correction!.id
    // The worker resubmits (fixture stand-in for the mobile event): a new append-only revision.
    await port.simulateResubmission(correctionId, { note: 'Clearer photograph', retakePhoto: true }, requested.correction!.version)
    const resubmitted = await port.getObservationReview('OBS-031')
    expect(resubmitted.observation.reviewStatus).toBe('resubmitted')
    expect(resubmitted.revisions.map((r) => r.number)).toEqual([1, 2])
    expect(evidenceOf(resubmitted.revisions[0])).toEqual(original)
    // Review starts only after the corrected revision is applied.
    expect((await port.getWorkspace()).corrections.find((c) => c.id === correctionId)?.status).toBe('resubmitted')
    await port.claim('OBS-031')
    expect((await port.getWorkspace()).corrections.find((c) => c.id === correctionId)?.status).toBe('applied')
    expect(await statusOf(port, 'OBS-031')).toBe('in_review')
    await port.verify('OBS-031', { note: 'Corrected evidence accepted' }, meta(await version(port, 'OBS-031')))
    await port.endProcess('OBS-031', { reason: 'Verified; no expert needed' }, meta(await version(port, 'OBS-031')))
    expect(await changes(port, 'OBS-031')).toEqual([
      ['review_started', 'submitted>in_review'], ['flagged', 'in_review>flagged'], ['correction_requested', 'flagged>correction_requested'],
      ['resubmitted', 'correction_requested>resubmitted'], ['review_started', 'resubmitted>in_review'], ['verified', 'in_review>verified'], ['process_ended', 'verified>history'],
    ])
    // History keeps every revision untouched and every decision.
    const history = await port.getObservationReview('OBS-031')
    expect(evidenceOf(history.revisions[0])).toEqual(original)
    expect(history.revisions).toHaveLength(2)
    expect(store.read((db) => findIntegrityProblems(db as FixtureDatabase))).toEqual([])
  })

  it('Flagged → History and Verified → History without any other step', async () => {
    const { port } = setup()
    await port.endProcess('OBS-004', { reason: 'Flag stands' }, meta(await version(port, 'OBS-004')))
    await port.endProcess('OBS-015', { reason: 'Verified, complete' }, meta(await version(port, 'OBS-015')))
    for (const id of ['OBS-004', 'OBS-015']) expect((await port.getWorkspace()).observations.find((o) => o.id === id)?.archivedAt).toEqual(expect.any(String))
    expect(await statusOf(port, 'OBS-004')).toBe('flagged')
    expect(await statusOf(port, 'OBS-015')).toBe('verified')
  })

  it('Decision → History keeps the expert decision, referral and earlier actions', async () => {
    const { port } = setup()
    const before = await port.getObservationReview('OBS-006')
    expect(before.observation.reviewStatus).toBe('decision')
    await port.endProcess('OBS-006', { reason: 'Acknowledged' }, meta(before.version))
    const after = await port.getObservationReview('OBS-006')
    expect(after.expertDecision).toEqual(before.expertDecision)
    expect(after.expertDiagnosis).toEqual(before.expertDiagnosis)
    expect(after.referralId).toBe('REF-006')
    expect(after.revisions[0].decisions.map((d) => d.outcome)).toEqual(['referred', 'process_ended'])
  })
})

describe('Observation review lifecycle: guards', () => {
  it('refuses invalid transitions', async () => {
    const { port } = setup()
    // Submitted cannot be verified, flagged, referred or ended; In Review cannot be referred, corrected or ended.
    for (const attempt of [port.verify('OBS-013', { note: '' }, meta(1)), port.flag('OBS-013', FLAG, meta(1)), port.refer('OBS-013', REFERRAL, meta(1)), port.endProcess('OBS-013', { reason: 'x' }, meta(1))]) expect(await kindOf(attempt)).toBe('conflict')
    for (const attempt of [port.refer('OBS-014', REFERRAL, meta(1)), port.requestCorrection('OBS-014', CORRECTION, meta(1)), port.endProcess('OBS-014', { reason: 'x' }, meta(1))]) expect(await kindOf(attempt)).toBe('conflict')
    // Correction Requested and Referred accept no Supervisor decision; the expert decision only arrives for Referred.
    expect(await kindOf(port.verify('OBS-041', { note: '' }, meta(await version(port, 'OBS-041'))))).toBe('conflict')
    expect(await kindOf(port.recordExpertDiagnosis('OBS-014', DIAGNOSIS, meta(1)))).toBe('conflict')
    expect(await kindOf(port.recordExpertDiagnosis('OBS-006', DIAGNOSIS, meta(await version(port, 'OBS-006'))))).toBe('conflict')
  })

  it('prevents duplicate verdicts, referrals and finalisation', async () => {
    const { port, store } = setup()
    const key = crypto.randomUUID()
    const first = await port.verify('OBS-014', { note: '' }, meta(1, key))
    const replay = await port.verify('OBS-014', { note: '' }, meta(1, key))
    expect(replay.decision.id).toBe(first.decision.id)
    expect(store.read((db) => db.reviewDecisions.filter((d) => d.targetId === 'OBS-014' && d.outcome === 'verified'))).toHaveLength(1)
    // Another verify or flag on the same review version is refused.
    expect(await kindOf(port.verify('OBS-014', { note: '' }, meta(2)))).toBe('conflict')
    expect(await kindOf(port.flag('OBS-014', FLAG, meta(2)))).toBe('conflict')
    await port.refer('OBS-014', REFERRAL, meta(2))
    expect(await kindOf(port.refer('OBS-014', REFERRAL, meta(3)))).toBe('conflict')
    expect(store.read((db) => db.referrals.filter((r) => r.observationId === 'OBS-014'))).toHaveLength(1)
    // End Process once only.
    await port.endProcess('OBS-015', { reason: 'Done' }, meta(await version(port, 'OBS-015')))
    expect(await kindOf(port.endProcess('OBS-015', { reason: 'Done again' }, meta(await version(port, 'OBS-015'))))).toBe('conflict')
    expect(store.read((db) => db.reviewDecisions.filter((d) => d.targetId === 'OBS-015' && d.outcome === 'process_ended'))).toHaveLength(1)
  })

  it('refuses every processing action after End Process', async () => {
    const { port } = setup()
    await port.endProcess('OBS-015', { reason: 'Done' }, meta(await version(port, 'OBS-015')))
    const v = await version(port, 'OBS-015')
    for (const attempt of [port.refer('OBS-015', REFERRAL, meta(v)), port.requestCorrection('OBS-015', CORRECTION, meta(v)), port.verify('OBS-015', { note: '' }, meta(v)), port.flag('OBS-015', FLAG, meta(v))]) expect(await kindOf(attempt)).toBe('conflict')
  })

  it('records the actor role and rejects stale versions and unauthorised actors', async () => {
    const { port } = setup()
    expect(await kindOf(port.verify('OBS-014', { note: '' }, meta(9)))).toBe('conflict')
    await port.verify('OBS-014', { note: '' }, meta(1))
    const entry = (await port.getWorkspace()).decisions.find((d) => d.targetId === 'OBS-014')
    expect(entry).toMatchObject({ actorRole: 'SUPERVISOR', transition: { from: 'in_review', to: 'verified' } })
    // A Supervisor of another estate cannot see or decide this observation; an expert cannot use the review module.
    expect(await kindOf(setup('USR-002').port.verify('OBS-014', { note: '' }, meta(1)))).toBe('not_found')
    expect(await kindOf(setup('USR-005').port.claim('OBS-013'))).toBe('forbidden')
    expect(await kindOf(setup(null).port.claim('OBS-013'))).toBe('unauthorized')
  })

  it('requires the reason for ending the process, the flag explanation and the correction instructions', async () => {
    const { port } = setup()
    expect(await kindOf(port.endProcess('OBS-015', { reason: '   ' }, meta(await version(port, 'OBS-015'))))).toBe('validation')
    expect(await kindOf(port.flag('OBS-014', { ...FLAG, explanation: ' ' }, meta(1)))).toBe('validation')
    expect(await kindOf(port.requestCorrection('OBS-004', { items: ['Other'], message: '  ' }, meta(await version(port, 'OBS-004'))))).toBe('validation')
  })
})
