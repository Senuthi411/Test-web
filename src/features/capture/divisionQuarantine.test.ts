import { describe, expect, it } from 'vitest'
import { FIXTURE_REFERENCE_DATE, FixtureStore, findIntegrityProblems } from '@/fixtures'
import { fixedClock } from '@/shared/utilities/clock'
import { createFixtureReviewAdapter, persistFixtureReviewState } from '@/features/review/fixtures'
import { createCaptureUseCases } from './index'
import { createFixtureCaptureAdapter } from './fixtures'
import { quarantineAssignmentErrors, type AssignmentBatchInput } from './domain/assignment'

// OBS-006 (West Terrace, DIV-006) is Referred with an expert diagnosis (REF-006 / CASE-006).
// USR-016 (Tharindu) is a free Field Worker of DIV-006 and DIV-005.
const meta = () => ({ expectedVersion: 0, idempotencyKey: crypto.randomUUID() })
const normal: AssignmentBatchInput = { estateId: 'EST-002', divisionId: 'DIV-006', fieldWorkerIds: ['USR-016'], title: 'Inspect West Terrace', instructions: 'Photograph affected leaves.', priority: 'High', dueDate: '2026-10-28', status: 'assigned', type: 'inspection' }
const quarantineInput = (quarantineId: string, authorised = true) => ({ quarantineId, objective: 'Contain and monitor the outbreak', inspectionFocus: 'Block C young shoots', monitoringWindow: '14 days', authorised })

function setup(store = new FixtureStore({ latencyMs: 0 })) {
  const clock = fixedClock(FIXTURE_REFERENCE_DATE)
  return {
    store,
    capture: createCaptureUseCases(createFixtureCaptureAdapter(store, () => 'USR-003', clock)),
    review: createFixtureReviewAdapter(store, { clock, actorId: () => 'USR-003' }),
  }
}
const quarantineOf = (store: FixtureStore, divisionId: string) => store.read((db) => (db.divisionQuarantines ?? []).filter((item) => item.divisionId === divisionId))
const statusOf = (store: FixtureStore, divisionId: string) => store.read((db) => db.divisions.find((item) => item.id === divisionId)?.operationalStatus)

describe('Division quarantine', () => {
  it('sets the division to Restricted Operations and creates one quarantine record from the diagnosis', async () => {
    const { store, review, capture } = setup()
    expect(statusOf(store, 'DIV-006')).toBeUndefined()
    const reviewed = await review.quarantineDivision('OBS-006', { reason: 'Confirmed Grey blight' }, meta())
    expect(statusOf(store, 'DIV-006')).toBe('restricted')
    expect(statusOf(store, 'DIV-005')).toBe('normal')
    const [record] = quarantineOf(store, 'DIV-006')
    expect(record).toMatchObject({ id: 'DQ-001', estateId: 'EST-002', divisionId: 'DIV-006', observationId: 'OBS-006', caseId: 'CASE-006', diseaseId: 'DIS-002', reason: 'Confirmed Grey blight', policy: 'restricted_operations', status: 'active', assignmentIds: [] })
    expect(record.history?.map((entry) => entry.event)).toEqual(['Quarantine initiated', 'Division changed to Restricted Operations'])
    expect(reviewed.divisionQuarantine).toMatchObject({ id: 'DQ-001', operationalStatus: 'restricted', status: 'Active' })
    // The queue data and the Capture workspace both read the same division status.
    const workspace = await review.getWorkspace()
    expect(workspace.divisionQuarantines.map((item) => item.id)).toEqual(['DQ-001'])
    expect(workspace.divisions.find((item) => item.id === 'DIV-006')?.operationalStatus).toBe('restricted')
    expect((await capture.getWorkspace()).quarantines.map((item) => item.id)).toEqual(['DQ-001'])
    // History: one decision-log entry against the quarantine record.
    expect(workspace.decisions.filter((item) => item.type === 'quarantine' && item.outcome === 'quarantined')).toMatchObject([{ recordId: 'DQ-001', divisionId: 'DIV-006' }])
  })

  it('never creates a second active quarantine for the same division', async () => {
    const { store, review } = setup()
    await review.quarantineDivision('OBS-006', { reason: 'First' }, meta())
    await review.quarantineDivision('OBS-006', { reason: 'Second' }, meta())
    expect(quarantineOf(store, 'DIV-006')).toHaveLength(1)
    expect(quarantineOf(store, 'DIV-006')[0].reason).toBe('First')
  })

  it('needs a recorded expert diagnosis and a reason', async () => {
    const { store, review } = setup()
    await expect(review.quarantineDivision('OBS-023', { reason: 'No diagnosis yet' }, meta())).rejects.toMatchObject({ kind: 'conflict' })
    expect(quarantineOf(store, 'DIV-005')).toHaveLength(0)
    const guarded = createFixtureReviewAdapter(store, { clock: fixedClock(FIXTURE_REFERENCE_DATE), actorId: () => 'USR-003' })
    await expect(guarded.quarantineDivision('OBS-006', { reason: '  ' }, meta())).rejects.toMatchObject({ kind: 'validation' })
    expect(statusOf(store, 'DIV-006')).toBeUndefined()
  })

  it('keeps division status after a browser refresh (restored from the quarantine records)', async () => {
    const saved = new Map<string, string>()
    const storage = { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => void saved.set(key, value) } as unknown as Storage
    const first = setup()
    persistFixtureReviewState(first.store, storage)
    await first.review.quarantineDivision('OBS-006', { reason: 'Persisted' }, meta())
    const second = new FixtureStore({ latencyMs: 0 })
    persistFixtureReviewState(second, storage)
    expect(statusOf(second, 'DIV-006')).toBe('restricted')
    expect(quarantineOf(second, 'DIV-006')).toMatchObject([{ id: 'DQ-001', reason: 'Persisted' }])
  })
})

describe('Restricted Operations in the assignment workflow', () => {
  it('leaves normal assignments unchanged while the division is operating normally', async () => {
    const { capture } = setup()
    const [created] = await capture.createAssignments({ ...normal, divisionId: 'DIV-005' })
    expect(created).toMatchObject({ divisionId: 'DIV-005', status: 'assigned', quarantine: null })
    await expect(capture.createAssignments({ ...normal, divisionId: 'DIV-005', fieldWorkerIds: ['USR-015'], quarantine: quarantineInput('DQ-001') })).rejects.toMatchObject({ kind: 'validation' })
  })

  it('blocks normal assignment creation and submission for a restricted division, in the data layer', async () => {
    const { store, review, capture } = setup()
    // A normal draft that existed before the quarantine.
    const [draft] = await capture.createAssignments({ ...normal, status: 'draft' })
    await review.quarantineDivision('OBS-006', { reason: 'Outbreak' }, meta())
    await expect(capture.createAssignments(normal)).rejects.toMatchObject({ kind: 'forbidden' })
    await expect(capture.createAssignments({ ...normal, status: 'draft', fieldWorkerIds: [] })).rejects.toMatchObject({ kind: 'forbidden' })
    await expect(capture.createAssignment({ ...normal, fieldWorkerId: 'USR-016' })).rejects.toMatchObject({ kind: 'forbidden' })
    // Submitting the normal draft that predates the quarantine is blocked too; it is neither deleted nor cancelled.
    await expect(capture.submitAssignment(draft.id, draft.version)).rejects.toMatchObject({ kind: 'forbidden' })
    expect((await capture.getWorkspace()).assignments.find((item) => item.id === draft.id)).toMatchObject({ status: 'draft' })
    // Other divisions and earlier assignments are not affected.
    expect((await capture.getWorkspace()).assignments.find((item) => item.id === 'ASG-002')).toMatchObject({ divisionId: 'DIV-006', status: 'assigned' })
    await expect(capture.createAssignments({ ...normal, divisionId: 'DIV-005' })).resolves.toHaveLength(1)
    expect(quarantineOf(store, 'DIV-006')[0].assignmentIds).toEqual([])
  })

  it('creates a Quarantine Assignment only for the active Quarantine ID, with the Supervisor authorisation, and links it', async () => {
    const { store, review, capture } = setup()
    await review.quarantineDivision('OBS-006', { reason: 'Outbreak' }, meta())
    // Tampered or missing references are refused.
    await expect(capture.createAssignments({ ...normal, quarantine: quarantineInput('DQ-999') })).rejects.toMatchObject({ kind: 'validation' })
    await expect(capture.createAssignments({ ...normal, quarantine: quarantineInput('DQ-001', false) })).rejects.toMatchObject({ kind: 'validation' })
    expect(store.read((db) => db.assignments.filter((item) => item.divisionId === 'DIV-006' && item.title === normal.title))).toHaveLength(0)
    // A draft needs no authorisation; assigning does.
    const [created] = await capture.createAssignments({ ...normal, quarantine: quarantineInput('DQ-001') })
    expect(created).toMatchObject({ status: 'assigned', quarantine: { quarantineId: 'DQ-001', caseId: 'CASE-006', observationId: 'OBS-006', diseaseName: 'Grey blight', authorisedBy: 'USR-003' } })
    const [record] = quarantineOf(store, 'DIV-006')
    expect(record.assignmentIds).toEqual([created.id])
    expect(record.history?.map((entry) => entry.event)).toEqual([
      'Quarantine initiated', 'Division changed to Restricted Operations', 'Quarantine assignment created', 'Quarantine assignment authorised', 'Quarantine assignment assigned',
    ])
    const workspace = await review.getWorkspace()
    expect(workspace.divisionQuarantines[0].assignments).toMatchObject([{ id: created.id, status: 'assigned' }])
    expect(workspace.decisions.filter((item) => item.outcome === 'quarantine_assignment')).toMatchObject([{ recordId: 'DQ-001', divisionId: 'DIV-006' }])
    expect(findIntegrityProblems(store.read((db) => db))).toEqual([])
  })

  it('saves a Quarantine Assignment draft without authorisation, then submits it as an explicit Supervisor action', async () => {
    const { store, review, capture } = setup()
    await review.quarantineDivision('OBS-006', { reason: 'Outbreak' }, meta())
    const [draft] = await capture.createAssignments({ ...normal, status: 'draft', fieldWorkerIds: ['USR-016'], quarantine: quarantineInput('DQ-001', false) })
    expect(draft).toMatchObject({ status: 'draft', quarantine: { authorisedBy: null } })
    expect(quarantineOf(store, 'DIV-006')[0].history?.map((entry) => entry.event)).toContain('Quarantine assignment created')
    expect(quarantineOf(store, 'DIV-006')[0].history?.map((entry) => entry.event)).not.toContain('Quarantine assignment assigned')
    const submitted = await capture.submitAssignment(draft.id, draft.version)
    expect(submitted).toMatchObject({ status: 'assigned', quarantine: { authorisedBy: 'USR-003' } })
    expect(quarantineOf(store, 'DIV-006')[0].history?.map((entry) => entry.event)).toContain('Quarantine assignment assigned')
  })

  it('validates the quarantine-specific fields', () => {
    expect(quarantineAssignmentErrors({ quarantineId: 'DQ-001', objective: '', inspectionFocus: ' ', monitoringWindow: '', authorised: false }, 'assigned')).toEqual({
      objective: 'Enter the assignment objective', inspectionFocus: 'Enter the inspection focus', monitoringWindow: 'Enter the monitoring window', authorised: 'Authorise this Quarantine Assignment to assign it',
    })
    expect(quarantineAssignmentErrors(quarantineInput('DQ-001', false), 'draft')).toEqual({})
  })
})
