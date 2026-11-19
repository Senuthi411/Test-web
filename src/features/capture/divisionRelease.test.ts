import { describe, expect, it } from 'vitest'
import { FIXTURE_REFERENCE_DATE, FixtureStore, findIntegrityProblems } from '@/fixtures'
import { fixedClock } from '@/shared/utilities/clock'
import { createFixtureReviewAdapter } from '@/features/review/fixtures'
import { createReviewUseCases } from '@/features/review'
import { createCaptureUseCases } from './index'
import { createFixtureCaptureAdapter } from './fixtures'
import type { AssignmentBatchInput } from './domain/assignment'

const meta = () => ({ expectedVersion: 0, idempotencyKey: crypto.randomUUID() })
const normal: AssignmentBatchInput = { estateId: 'EST-002', divisionId: 'DIV-006', fieldWorkerIds: ['USR-016'], title: 'Inspect West Terrace', instructions: 'Photograph affected leaves.', priority: 'High', dueDate: '2026-10-28', status: 'assigned', type: 'inspection' }

function setup() {
  const store = new FixtureStore({ latencyMs: 0 })
  const clock = fixedClock(FIXTURE_REFERENCE_DATE)
  const review = createFixtureReviewAdapter(store, { clock, actorId: () => 'USR-003' })
  return { store, review, guarded: createReviewUseCases(review), capture: createCaptureUseCases(createFixtureCaptureAdapter(store, () => 'USR-003', clock)) }
}

describe('Releasing a division quarantine', () => {
  it('updates the same record, returns the division to Normal Operations and unblocks normal assignments', async () => {
    const { store, review, guarded, capture } = setup()
    await review.quarantineDivision('OBS-006', { reason: 'Outbreak' }, meta())
    await expect(capture.createAssignments(normal)).rejects.toMatchObject({ kind: 'forbidden' })
    const before = store.read((db) => db.assignments.length)
    const released = await guarded.releaseDivisionQuarantine('DQ-001', { reason: '  Treatment complete  ' }, meta())
    expect(released).toMatchObject({ id: 'DQ-001', status: 'Released', operationalStatus: 'normal', release: { reason: 'Treatment complete', by: 'Malini Fernando' }, reason: 'Outbreak' })
    expect(store.read((db) => db.divisionQuarantines)).toHaveLength(1)
    expect(store.read((db) => db.divisions.find((item) => item.id === 'DIV-006')?.operationalStatus)).toBe('normal')
    // Nothing is assigned or created by the release; a normal assignment is allowed again, but only on request.
    expect(store.read((db) => db.assignments.length)).toBe(before)
    await expect(capture.createAssignments(normal)).resolves.toHaveLength(1)
    expect((await capture.getWorkspace()).quarantines).toEqual([])
    expect(findIntegrityProblems(store.read((db) => db))).toEqual([])
  })

  it('refuses an empty reason, a repeated release, an unknown quarantine, and a release by a supervisor outside the estate', async () => {
    const { store, review, guarded } = setup()
    await review.quarantineDivision('OBS-006', { reason: 'Outbreak' }, meta())
    await expect(guarded.releaseDivisionQuarantine('DQ-001', { reason: '   ' }, meta())).rejects.toMatchObject({ kind: 'validation' })
    expect(store.read((db) => db.divisionQuarantines?.[0].status)).toBe('active')
    await expect(guarded.releaseDivisionQuarantine('DQ-999', { reason: 'x' }, meta())).rejects.toMatchObject({ kind: 'not_found' })
    const other = createFixtureReviewAdapter(store, { clock: fixedClock(FIXTURE_REFERENCE_DATE), actorId: () => 'USR-002' })
    await expect(other.releaseDivisionQuarantine('DQ-001', { reason: 'x' }, meta())).rejects.toMatchObject({ kind: 'not_found' })
    await guarded.releaseDivisionQuarantine('DQ-001', { reason: 'Done' }, meta())
    await expect(guarded.releaseDivisionQuarantine('DQ-001', { reason: 'Again' }, meta())).rejects.toMatchObject({ kind: 'conflict' })
    expect(store.read((db) => db.divisionQuarantines?.[0].releaseReason)).toBe('Done')
  })

  it('releases only the selected division and allows a new quarantine afterwards', async () => {
    const { store, review } = setup()
    await review.quarantineDivision('OBS-006', { reason: 'West Terrace' }, meta())
    // A second division with its own quarantine record is not touched by the first release.
    store.write((db) => {
      db.divisionQuarantines!.push({ id: 'DQ-009', divisionId: 'DIV-005', estateId: 'EST-002', observationId: 'OBS-014', caseId: null, policy: 'restricted_operations', quarantinedBy: 'USR-003', quarantinedAt: '2026-10-21T10:00:00+05:30', status: 'active', reason: 'East Hills', assignmentIds: [], history: [] })
      db.divisions.find((item) => item.id === 'DIV-005')!.operationalStatus = 'restricted'
    })
    await review.releaseDivisionQuarantine('DQ-001', { reason: 'Done' }, meta())
    expect(store.read((db) => db.divisions.map((item) => [item.id, item.operationalStatus]).filter(([id]) => id === 'DIV-005' || id === 'DIV-006'))).toEqual([['DIV-005', 'restricted'], ['DIV-006', 'normal']])
    await review.quarantineDivision('OBS-006', { reason: 'Second outbreak' }, meta())
    expect(store.read((db) => db.divisionQuarantines?.filter((item) => item.divisionId === 'DIV-006').map((item) => [item.id, item.status]))).toEqual([['DQ-001', 'released'], ['DQ-010', 'active']])
  })
})
