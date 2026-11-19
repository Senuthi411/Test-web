import { describe, expect, it } from 'vitest'
import { FIXTURE_REFERENCE_DATE, FixtureStore, findIntegrityProblems, type FixtureDatabase } from '@/fixtures'
import { fixedClock } from '@/shared/utilities/clock'
import type { HttpClient } from '@/shared/api'
import { createFixtureReviewAdapter } from '@/features/review/fixtures'
import { createCaptureUseCases } from './index'
import { createFixtureCaptureAdapter, persistFixtureCaptureState } from './fixtures'
import type { CaptureReadPort } from './application/ports'
import { cancelLock, completionBlock, editLock, type AssignmentEdit, type AssignmentInput } from './domain/assignment'
import { TASK_TEMPLATES, requirementErrors, templateById } from './domain/taskTemplates'
import { createHttpCaptureAdapter } from './http'

// USR-009 (Hiruni) holds ASG-003 In progress and USR-010 (Ravindu) holds ASG-002 Assigned, so the
// tests assign to the available DIV-005 workers USR-014 (Kasun), USR-015 (Nethmi), USR-016 (Tharindu).
const input: AssignmentInput = { estateId: 'EST-002', divisionId: 'DIV-005', fieldWorkerId: 'USR-014', title: 'Inspect East Hills', instructions: 'Photograph affected leaves.', priority: 'High', dueDate: '2026-10-28', status: 'assigned', type: 'inspection' }
const fert = templateById('TPL-FERT')!
const taskInput: AssignmentInput = { ...input, title: 'Fertilizer Application', type: 'task', templateId: fert.id, requirements: fert.requirements }
const edit: AssignmentEdit = { ...input, status: 'draft', reason: '' }
const meta = (expectedVersion: number) => ({ expectedVersion, idempotencyKey: crypto.randomUUID() })

function setup(actor: string | null = 'USR-003', store = new FixtureStore({ latencyMs: 0 }), now = FIXTURE_REFERENCE_DATE) {
  const clock = fixedClock(now)
  return {
    store,
    capture: createCaptureUseCases(createFixtureCaptureAdapter(store, () => actor, clock)),
    review: createFixtureReviewAdapter(store, { clock, actorId: () => actor }),
  }
}
const find = async (capture: CaptureReadPort, id: string) => (await capture.getWorkspace()).assignments.find((a) => a.id === id)!

describe('Assignment status rules', () => {
  it('maps every status to the edit and cancel rules (only a Draft is editable)', () => {
    const base = { observationIds: [] as string[], acceptedAt: null as string | null }
    expect(editLock({ ...base, status: 'draft' })).toBeNull()
    expect(editLock({ ...base, status: 'assigned' })).toBe('Only a Draft assignment can be edited.')
    expect(cancelLock({ ...base, status: 'assigned' })).toBeNull()
    expect(cancelLock({ ...base, status: 'assigned', acceptedAt: '2026-10-21' })).toContain('accepted')
    for (const status of ['in_progress', 'submitted', 'completed', 'cancelled', 'reassigned'] as const) {
      expect(editLock({ ...base, status })).not.toBeNull()
      expect(cancelLock({ ...base, status })).not.toBeNull()
    }
  })

  it('completion needs a Done assignment with a submission, and a final observation review for an inspection', () => {
    const status = (map: Record<string, string>) => (id: string) => map[id]
    expect(completionBlock({ status: 'in_progress', observationIds: [] }, status({}))).toContain('Only a Done')
    expect(completionBlock({ status: 'submitted', type: 'task', submission: null, observationIds: [] }, status({}))).toContain('No task submission')
    for (const pending of ['submitted', 'in_review', 'resubmitted', 'correction_requested', 'referred']) {
      expect(completionBlock({ status: 'submitted', type: 'inspection', observationIds: ['OBS-1'] }, status({ 'OBS-1': pending }))).toContain('OBS-1')
    }
    expect(completionBlock({ status: 'submitted', type: 'inspection', observationIds: ['OBS-1'] }, status({ 'OBS-1': 'verified' }))).toBeNull()
  })
})

describe('Draft, Assigned and locked assignments', () => {
  it('a Draft can be edited, then submitted to its worker; once Assigned it can be cancelled but not edited', async () => {
    const { capture } = setup()
    const draft = await find(capture, 'ASG-004')
    const saved = await capture.editAssignment('ASG-004', { ...edit, divisionId: 'DIV-004', fieldWorkerId: null, title: 'Walk Riverbank lower boundary (north)', instructions: 'Photograph the north boundary.' }, draft.version)
    expect(saved).toMatchObject({ status: 'draft', title: 'Walk Riverbank lower boundary (north)', version: 2 })
    await expect(capture.submitAssignment('ASG-004', 2)).rejects.toMatchObject({ kind: 'validation', message: expect.stringContaining('Field Worker') })
    await capture.editAssignment('ASG-004', { ...edit, divisionId: 'DIV-004', fieldWorkerId: 'USR-014', instructions: 'Photograph the north boundary.' }, 2)
    const submitted = await capture.submitAssignment('ASG-004', 3)
    expect(submitted).toMatchObject({ status: 'assigned', fieldWorkerId: 'USR-014', version: 4 })
    expect(submitted.activity.at(-1)).toContain('Draft submitted and assigned to Kasun Perera')
    await expect(capture.editAssignment('ASG-004', { ...edit, divisionId: 'DIV-004', fieldWorkerId: 'USR-014' }, 4)).rejects.toMatchObject({ kind: 'conflict', message: expect.stringContaining('Only a Draft') })
    await expect(capture.cancelAssignment('ASG-004', ' ', 4)).rejects.toMatchObject({ kind: 'validation' })
    const cancelled = await capture.cancelAssignment('ASG-004', 'Merged into another survey', 4)
    expect(cancelled).toMatchObject({ status: 'cancelled', version: 5 })
    expect(cancelled.activity.at(-1)).toContain('Reason: Merged into another survey')
    await expect(capture.submitAssignment('ASG-004', 5)).rejects.toMatchObject({ kind: 'conflict' })
  })

  it('accepted, started and terminal assignments cannot be edited or cancelled; a race with acceptance is rejected', async () => {
    const { capture } = setup()
    const created = await capture.createAssignment(input)
    await capture.simulateAssignment(created.id, 'accept', 1)
    // The Supervisor's stale cancel (version 1) after the worker accepted (version 2) is rejected.
    await expect(capture.cancelAssignment(created.id, 'Late', 1)).rejects.toMatchObject({ kind: 'conflict', message: expect.stringContaining('accepted') })
    await expect(capture.cancelAssignment(created.id, 'Late', 2)).rejects.toMatchObject({ kind: 'conflict' })
    for (const id of ['ASG-001', 'ASG-003', 'ASG-005', 'ASG-006', 'ASG-007']) {
      await expect(capture.editAssignment(id, edit, 1)).rejects.toMatchObject({ kind: 'conflict' })
      await expect(capture.cancelAssignment(id, 'Reason', 1)).rejects.toMatchObject({ kind: 'conflict' })
    }
    for (const id of ['ASG-002', 'ASG-003', 'ASG-004', 'ASG-005', 'ASG-006', 'ASG-007']) {
      await expect(capture.acceptAssignment(id, 1)).rejects.toMatchObject({ kind: 'conflict' })
      await expect(capture.simulateAssignment(id, 'submit', 1)).rejects.toMatchObject({ kind: 'conflict' })
    }
  })

  it('rechecks actor, estate, division and worker scope for mutations', async () => {
    for (const actor of [null, 'USR-001', 'USR-009', 'USR-002']) {
      const { capture } = setup(actor)
      const kind = actor === null ? 'unauthorized' : actor === 'USR-002' ? 'not_found' : 'forbidden'
      await expect(capture.editAssignment('ASG-004', edit, 1)).rejects.toMatchObject({ kind })
      await expect(capture.cancelAssignment('ASG-004', 'Reason', 1)).rejects.toMatchObject({ kind })
      await expect(capture.acceptAssignment('ASG-001', 1)).rejects.toMatchObject({ kind })
    }
    const { store, capture } = setup()
    const created = await capture.createAssignment({ ...input, status: 'draft' })
    await expect(capture.editAssignment(created.id, { ...edit, estateId: 'EST-001' }, 1)).rejects.toMatchObject({ kind: 'forbidden' })
    await expect(capture.editAssignment(created.id, { ...edit, fieldWorkerId: 'USR-010' }, 1)).rejects.toMatchObject({ kind: 'validation' })
    store.write((db) => { db.users.find((u) => u.id === 'USR-014')!.divisionIds = [] })
    await expect(capture.editAssignment(created.id, edit, 1)).rejects.toMatchObject({ kind: 'validation' })
    expect((await find(capture, created.id)).version).toBe(1)
  })
})

describe('One active assignment per Field Worker', () => {
  it('rejects a new assignment for a worker with an Assigned or In progress assignment, for Task and Inspection alike', async () => {
    const { capture } = setup()
    const before = (await capture.getWorkspace()).assignments.length
    // Hiruni (USR-009): ASG-003 In progress. Ravindu (USR-010): ASG-002 Assigned.
    await expect(capture.createAssignment({ ...input, fieldWorkerId: 'USR-009' })).rejects.toMatchObject({ kind: 'validation', message: expect.stringContaining('ASG-003 · In progress') })
    await expect(capture.createAssignment({ ...taskInput, divisionId: 'DIV-006', fieldWorkerId: 'USR-010' })).rejects.toMatchObject({ kind: 'validation', message: expect.stringContaining('ASG-002 · Assigned') })
    await expect(capture.createAssignments({ ...input, fieldWorkerIds: ['USR-014', 'USR-009'] })).rejects.toMatchObject({ kind: 'validation' })
    expect((await capture.getWorkspace()).assignments).toHaveLength(before)
  })

  it('a worker is free again once the assignment is Done; a draft for a busy worker cannot be submitted', async () => {
    const { capture } = setup()
    const first = await capture.createAssignment(taskInput)
    await expect(capture.createAssignment(input)).rejects.toMatchObject({ kind: 'validation' })
    await capture.simulateAssignment(first.id, 'start', 1)
    await expect(capture.createAssignment(input)).rejects.toMatchObject({ kind: 'validation' })
    await capture.simulateAssignment(first.id, 'submit', 2)
    expect((await find(capture, first.id)).status).toBe('submitted')
    // Done is not active: Kasun can receive the next assignment.
    const next = await capture.createAssignment(input)
    const draft = await capture.createAssignment({ ...input, status: 'draft' })
    await expect(capture.submitAssignment(draft.id, 1)).rejects.toMatchObject({ kind: 'validation', message: expect.stringContaining(next.id) })
  })
})

describe('Task lifecycle and Assignment History', () => {
  it('Assigned → In progress → Done (task evidence) → Completed, then Assignment History after 24 hours, read-only', async () => {
    const { store, capture } = setup()
    const created = await capture.createAssignment({ ...taskInput, fieldWorkerId: 'USR-015' })
    expect(created).toMatchObject({ type: 'task', templateId: 'TPL-FERT', status: 'assigned', submission: null })
    await expect(capture.acceptAssignment(created.id, 1)).rejects.toMatchObject({ kind: 'conflict', message: expect.stringContaining('Only a Done') })
    await capture.simulateAssignment(created.id, 'start', 1)
    const done = await capture.simulateAssignment(created.id, 'submit', 2)
    expect(done).toMatchObject({ status: 'submitted', submittedAt: '2026-10-21T10:00:00+05:30' })
    expect(done.submission?.responses.map((r) => r.label)).toEqual(['Fertilizer product', 'Quantity applied (kg)', 'Area covered (ha)'])
    expect(done.submission).toMatchObject({ photoIds: [`IMG-${created.id}-1`], gps: { accuracyM: 9 } })
    const completed = await capture.acceptAssignment(created.id, 3)
    expect(completed).toMatchObject({ status: 'completed', completedAt: '2026-10-21T10:00:00+05:30', archivedAt: null })
    // Still in the active list today; ASG-005 (completed 14 Oct) is already in history.
    const today = await capture.getWorkspace()
    expect(today.assignments.find((a) => a.id === created.id)?.archivedAt).toBeNull()
    expect(today.assignments.find((a) => a.id === 'ASG-005')?.archivedAt).toBe('2026-10-15T11:30:00.000Z')
    // 25 hours later (same data), the completed assignment has moved to Assignment History.
    const later = setup('USR-003', store, '2026-10-22T11:00:00+05:30')
    const archived = await find(later.capture, created.id)
    expect(archived.archivedAt).toBe('2026-10-22T04:30:00.000Z')
    expect(archived.submission).toEqual(done.submission)
    // History is read-only: no edit, cancel, completion or simulation is accepted.
    await expect(later.capture.editAssignment(created.id, edit, archived.version)).rejects.toMatchObject({ kind: 'conflict' })
    await expect(later.capture.cancelAssignment(created.id, 'x', archived.version)).rejects.toMatchObject({ kind: 'conflict' })
    await expect(later.capture.acceptAssignment(created.id, archived.version)).rejects.toMatchObject({ kind: 'conflict' })
    await expect(later.capture.simulateAssignment(created.id, 'submit', archived.version)).rejects.toMatchObject({ kind: 'conflict' })
  })
})

describe('Inspection assignments and observation review', () => {
  it('the submitted observation enters the normal Review Queue; completion waits for its final review and never changes it', async () => {
    const { store, capture, review } = setup()
    const created = await capture.createAssignment({ ...input, fieldWorkerId: 'USR-016' })
    await capture.simulateAssignment(created.id, 'start', 1)
    const done = await capture.simulateAssignment(created.id, 'submit', 2)
    expect(done).toMatchObject({ status: 'submitted', observationIds: ['OBS-049'] })
    const queued = (await review.getWorkspace()).observations.find((o) => o.id === 'OBS-049')
    expect(queued).toMatchObject({ reviewStatus: 'submitted', assignmentId: created.id, revisionNumber: 1, fieldWorker: { id: 'USR-016' } })
    await expect(capture.acceptAssignment(created.id, 3)).rejects.toMatchObject({ kind: 'conflict', message: expect.stringContaining('OBS-049') })
    // Referred is not a final review: the inspection still cannot be completed.
    const started = await review.claim('OBS-049')
    // The lifecycle: In Review → Verified → Referred (Verified alone would already be a final outcome for completion).
    await review.verify('OBS-049', { note: '' }, meta(started.version))
    await review.refer('OBS-049', { expertId: 'USR-005', note: 'Confirm' }, meta(started.version + 1))
    await expect(capture.acceptAssignment(created.id, 3)).rejects.toMatchObject({ kind: 'conflict' })
    expect(store.read((db) => findIntegrityProblems(db as FixtureDatabase))).toEqual([])
  })

  it('completes an inspection after its observation is verified, leaving the observation status unchanged', async () => {
    const { capture, review } = setup()
    // ASG-001 (Done) delivered OBS-014, which is still In review.
    await expect(capture.acceptAssignment('ASG-001', 1)).rejects.toMatchObject({ kind: 'conflict', message: expect.stringContaining('OBS-014') })
    await review.verify('OBS-014', { note: '' }, meta((await review.getObservationReview('OBS-014')).version))
    const completed = await capture.acceptAssignment('ASG-001', 1)
    expect(completed).toMatchObject({ status: 'completed', completedAt: '2026-10-21T10:00:00+05:30' })
    expect(completed.activity.at(-1)).toContain('Accepted and completed by Malini Fernando')
    expect((await review.getObservationReview('OBS-014')).observation.reviewStatus).toBe('verified')
    await expect(capture.acceptAssignment('ASG-001', 2)).rejects.toMatchObject({ kind: 'conflict' })
  })

  it('rejects broken submitted links before completion without changing anything', async () => {
    const { store, capture } = setup()
    store.write((db) => { db.assignments[0].observationIds.push('OBS-001') })
    await expect(capture.acceptAssignment('ASG-001', 1)).rejects.toMatchObject({ kind: 'contract_mismatch' })
    expect(await find(capture, 'ASG-001')).toMatchObject({ status: 'submitted', version: 1 })
  })
})

describe('Task categories and multiple Field Workers', () => {
  const batch = { estateId: 'EST-002', divisionId: 'DIV-005', title: 'Fertilizer Application', instructions: 'Apply the scheduled fertilizer.', priority: 'Medium' as const, dueDate: '2026-10-30', status: 'assigned' as const, type: 'task' as const }

  it('offers the five task categories with valid task inputs and photo requirements (no checklist, no GPS input)', () => {
    expect(TASK_TEMPLATES.map((t) => t.name)).toEqual(['Fertilizer Application', 'Pruning', 'Weed Removal', 'Drainage Maintenance', 'General Field Work'])
    for (const template of TASK_TEMPLATES) {
      expect(requirementErrors(template.requirements)).toEqual({})
      expect(Object.keys(template.requirements).sort()).toEqual(['completionNotes', 'fields', 'photos'])
    }
  })

  it('creates one separate assignment per selected worker of the division, linked by a group ID', async () => {
    const { capture } = setup()
    const created = await capture.createAssignments({ ...batch, fieldWorkerIds: ['USR-014', 'USR-015', 'USR-016'], templateId: fert.id, requirements: fert.requirements })
    expect(created.map((a) => [a.id, a.fieldWorkerId, a.type])).toEqual([['ASG-008', 'USR-014', 'task'], ['ASG-009', 'USR-015', 'task'], ['ASG-010', 'USR-016', 'task']])
    expect(new Set(created.map((a) => a.groupId))).toEqual(new Set(['GRP-ASG-008']))
    await capture.simulateAssignment('ASG-009', 'accept', 1)
    expect((await find(capture, 'ASG-010')).acceptedAt).toBeNull()
  })

  it('rejects workers outside the division, duplicates and empty selections, creating nothing', async () => {
    const { capture } = setup()
    const before = (await capture.getWorkspace()).assignments.length
    await expect(capture.createAssignments({ ...batch, fieldWorkerIds: ['USR-014', 'USR-010'] })).rejects.toMatchObject({ kind: 'validation', message: expect.stringContaining('USR-010') })
    await expect(capture.createAssignments({ ...batch, fieldWorkerIds: ['USR-014', 'USR-014'] })).rejects.toMatchObject({ kind: 'validation' })
    await expect(capture.createAssignments({ ...batch, fieldWorkerIds: [] })).rejects.toMatchObject({ kind: 'validation', message: 'Select at least one Field Worker' })
    expect((await capture.getWorkspace()).assignments).toHaveLength(before)
  })

  it('validates configured task inputs and photo requirements', async () => {
    const { capture } = setup()
    const requirements = { fields: [{ label: 'Blocked sections', required: true }], photos: { level: 'required' as const, minimum: 2 }, completionNotes: 'not_required' as const }
    const [task] = await capture.createAssignments({ ...batch, title: 'Custom drain check', fieldWorkerIds: ['USR-014'], templateId: null, requirements })
    expect(task.requirements).toEqual(requirements)
    await expect(capture.createAssignments({ ...batch, fieldWorkerIds: ['USR-015'], requirements: { ...requirements, fields: [{ label: 'A', required: true }, { label: 'a', required: false }] } })).rejects.toMatchObject({ kind: 'validation' })
    await expect(capture.createAssignments({ ...batch, fieldWorkerIds: ['USR-015'], requirements: { ...requirements, photos: { level: 'required', minimum: 0 } } })).rejects.toMatchObject({ kind: 'validation' })
  })
})

describe('Persistence and contracts', () => {
  it('keeps assignments and simulated observation submissions across a reload', async () => {
    window.sessionStorage.clear()
    const reload = () => {
      const store = new FixtureStore({ latencyMs: 0 })
      persistFixtureCaptureState(store, window.sessionStorage)
      return setup('USR-003', store).capture
    }
    const first = reload()
    const created = await first.createAssignment(input)
    await first.simulateAssignment(created.id, 'start', 1)
    await first.simulateAssignment(created.id, 'submit', 2)
    await first.cancelAssignment('ASG-002', 'Persisted cancellation', 1)
    const second = reload()
    expect(await find(second, created.id)).toMatchObject({ status: 'submitted', observationIds: ['OBS-049'] })
    expect((await second.getObservation('OBS-049')).fieldWorker.id).toBe('USR-014')
    expect(await find(second, 'ASG-002')).toMatchObject({ status: 'cancelled' })
    window.sessionStorage.clear()
  })

  it('exposes the exact OBS-014 PDF provenance without fabricating a second revision or receipt ID', async () => {
    const { capture } = setup()
    expect((await capture.getObservation('OBS-014')).evidence).toMatchObject({ imageId: 'IMG-014', latitude: 7.106, longitude: 80.734, receivedAt: '2026-10-15T16:05:00+05:30' })
    expect((await capture.getObservation('OBS-014')).evidence).not.toHaveProperty('revisionId')
    expect((await capture.getObservation('OBS-014')).evidence).not.toHaveProperty('syncReceipt')
  })

  it('leaves production operations explicitly contract-pending without inventing endpoints', async () => {
    const adapter = createHttpCaptureAdapter({} as HttpClient)
    await expect(adapter.editAssignment('ASG-004', edit, 1)).rejects.toMatchObject({ kind: 'contract_pending' })
    await expect(adapter.cancelAssignment('ASG-004', 'Reason', 1)).rejects.toMatchObject({ kind: 'contract_pending' })
    await expect(adapter.submitAssignment('ASG-004', 1)).rejects.toMatchObject({ kind: 'contract_pending' })
    await expect(adapter.acceptAssignment('ASG-001', 1)).rejects.toMatchObject({ kind: 'contract_pending' })
    await expect(adapter.createAssignments({ ...input, fieldWorkerIds: ['USR-014'] })).rejects.toMatchObject({ kind: 'contract_pending' })
  })
})
