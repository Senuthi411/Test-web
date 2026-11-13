import { describe, expect, it, vi } from 'vitest'
import { FixtureStore } from '@/fixtures'
import { createCaptureUseCases } from './index'
import { createFixtureCaptureAdapter } from './fixtures'
import { createHttpCaptureAdapter } from './http'
import type { HttpClient } from '@/shared/api'

function setup(actorId: string | null = 'USR-003') {
  const store = new FixtureStore({ latencyMs: 0 })
  const capture = createCaptureUseCases(createFixtureCaptureAdapter(store, () => actorId))
  return { store, capture }
}

describe('Capture observation foundation', () => {
  it('rejects unknown runtime simulation actions without submitting an in-progress task', async () => {
    const { store, capture } = setup()
    const created = await capture.createAssignment(assignmentInput)
    const started = await capture.simulateAssignment(created.id, 'start', created.version)
    const adapter = createFixtureCaptureAdapter(store, () => 'USR-003')
    await expect(adapter.simulateAssignment(created.id, 'accept' as 'submit', started.version)).rejects.toMatchObject({ kind: 'conflict' })
    expect((await capture.getWorkspace()).assignments.find((row) => row.id === created.id)).toEqual(started)
  })

  it('enforces Capture authorization on every fixture mutation', async () => {
    const { capture } = setup('USR-001')
    await expect(capture.createAssignment(assignmentInput)).rejects.toMatchObject({ kind: 'forbidden' })
    await expect(capture.simulateAssignment('ASG-001', 'start', 1)).rejects.toMatchObject({ kind: 'forbidden' })
    await expect(capture.resetAssignments()).rejects.toMatchObject({ kind: 'forbidden' })
    const signedOut = setup(null).capture
    await expect(signedOut.createAssignment(assignmentInput)).rejects.toMatchObject({ kind: 'unauthorized' })
    await expect(signedOut.resetAssignments()).rejects.toMatchObject({ kind: 'unauthorized' })
  })

  it('does not link unrelated evidence or expose assignments with inconsistent scope references', async () => {
    const { store, capture } = setup()
    const created = await capture.createAssignment(assignmentInput)
    const started = await capture.simulateAssignment(created.id, 'start', created.version)
    store.write((db) => { db.observations.find((row) => row.id === 'OBS-014')!.fieldWorkerId = 'USR-010' })
    await expect(capture.simulateAssignment(created.id, 'submit', started.version)).rejects.toMatchObject({ kind: 'contract_mismatch' })
    expect((await capture.getWorkspace()).assignments.find((row) => row.id === created.id)?.status).toBe('in_progress')
    store.write((db) => { db.assignments.find((row) => row.id === created.id)!.estateId = 'EST-001' })
    expect((await capture.getWorkspace()).assignments.some((row) => row.id === created.id)).toBe(false)
    await expect(capture.simulateAssignment(created.id, 'submit', started.version)).rejects.toMatchObject({ kind: 'not_found' })
  })

  it('exposes only approved evidence examples and scoped assignment rows', async () => {
    const { capture } = setup()
    const data = await capture.getWorkspace()
    expect(data.assignments).toHaveLength(7)
    expect(data.assignments[0]).toMatchObject({ id: 'ASG-001', status: 'submitted', observationIds: ['OBS-014'] })
    expect(data.observations.find((row) => row.id === 'OBS-014')?.capturedAt).toBe('2026-10-15T14:15:00+05:30')
    expect(data.observations.filter((row) => row.evidence).map((row) => row.id)).toEqual(['OBS-005', 'OBS-014'])
    expect((await capture.getObservation('OBS-005')).evidence).toMatchObject({ latitude: 6.98, longitude: 80.635, revisionId: 'OBSR-005-2' })
    expect((await setup('USR-002').capture.getWorkspace()).assignments).toEqual([])
  })

  const assignmentInput = { estateId: 'EST-002', divisionId: 'DIV-005', fieldWorkerId: 'USR-009', title: 'Inspect East Hills', instructions: 'Photograph affected leaves.', priority: 'High' as const, dueDate: '2026-10-16', status: 'assigned' as const }

  it('creates an assignment and simulates start/submission without changing Review or evidence', async () => {
    const { capture, store } = setup()
    const evidenceBefore = store.read((db) => db.captureEvidence)
    const observationsBefore = store.read((db) => db.observations)
    const created = await capture.createAssignment(assignmentInput)
    expect(created).toMatchObject({ id: 'ASG-008', status: 'assigned', version: 1 })
    const started = await capture.simulateAssignment(created.id, 'start', created.version)
    expect(started.status).toBe('in_progress')
    await expect(capture.simulateAssignment(created.id, 'submit', created.version)).rejects.toMatchObject({ kind: 'conflict' })
    const submitted = await capture.simulateAssignment(created.id, 'submit', started.version)
    expect(submitted).toMatchObject({ status: 'submitted', observationIds: ['OBS-014'] })
    await expect(capture.simulateAssignment(created.id, 'start', submitted.version)).rejects.toMatchObject({ kind: 'conflict' })
    expect(store.read((db) => db.observations)).toEqual(observationsBefore)
    expect(store.read((db) => db.captureEvidence)).toEqual(evidenceBefore)
  })

  it('rejects invalid fields, ineligible workers and cross-estate assignment requests', async () => {
    const { capture } = setup()
    await expect(capture.createAssignment({ ...assignmentInput, title: ' ', dueDate: '2026-02-30' })).rejects.toMatchObject({ kind: 'validation' })
    await expect(capture.createAssignment({ ...assignmentInput, fieldWorkerId: 'USR-010' })).rejects.toMatchObject({ kind: 'validation' })
    await expect(capture.createAssignment({ ...assignmentInput, estateId: 'EST-001', divisionId: 'DIV-001', fieldWorkerId: 'USR-007' })).rejects.toMatchObject({ kind: 'forbidden' })
    await expect(capture.createAssignment({ ...assignmentInput, estateId: 'EST-002', divisionId: 'DIV-001' })).rejects.toMatchObject({ kind: 'forbidden' })
    expect((await capture.getWorkspace()).assignments).toHaveLength(7)
  })

  it('saves a draft without a worker and resets Capture assignments without losing Identity changes', async () => {
    const { capture, store } = setup()
    await expect(capture.createAssignment({ ...assignmentInput, fieldWorkerId: null, status: 'draft' })).resolves.toMatchObject({ status: 'draft', fieldWorkerId: null })
    store.write((db) => { db.users[0].fullName = 'Preserved Identity edit' })
    await capture.resetAssignments()
    expect((await capture.getWorkspace()).assignments).toHaveLength(7)
    expect(store.read((db) => db.users[0].fullName)).toBe('Preserved Identity edit')
  })

  it('rechecks worker eligibility after Identity scope changes', async () => {
    const { capture, store } = setup()
    const created = await capture.createAssignment(assignmentInput)
    store.write((db) => { db.users.find((row) => row.id === 'USR-009')!.divisionIds = ['DIV-004'] })
    await expect(capture.simulateAssignment(created.id, 'start', created.version)).rejects.toMatchObject({ kind: 'forbidden' })
  })

  it('reads existing observation metadata and related records inside Supervisor scope', async () => {
    const { capture } = setup()
    const observation = await capture.getObservation(' OBS-005 ')
    expect(observation).toMatchObject({
      id: 'OBS-005', deviceObservationId: 'DEVOBS-0005',
      estate: { id: 'EST-002', name: 'Riverbend Tea Estate' },
      division: { id: 'DIV-005' }, fieldWorker: { id: 'USR-009' },
      capturedAt: '2026-10-06T13:15:00+05:30', gpsAccuracyM: 10,
    })
    expect(observation).not.toHaveProperty('latitude')
    expect(observation).not.toHaveProperty('imageUrl')
  })

  it.each(['OBS-001', 'OBS-999'])('does not disclose absent or out-of-scope %s', async (id) => {
    await expect(setup().capture.getObservation(id)).rejects.toMatchObject({ kind: 'not_found' })
  })

  it.each(['USR-001', 'USR-005', 'USR-007', 'USR-013', 'unknown'])('denies roles outside the existing Capture route policy: %s', async (id) => {
    await expect(setup(id).capture.getObservation('OBS-005')).rejects.toMatchObject({ kind: 'forbidden' })
  })

  it('requires authentication and a non-empty observation identifier', async () => {
    await expect(setup(null).capture.getObservation('OBS-005')).rejects.toMatchObject({ kind: 'unauthorized' })
    await expect(setup().capture.getObservation(' ')).rejects.toMatchObject({ kind: 'validation' })
  })

  it('rechecks active status and current scope after Identity changes', async () => {
    const { store, capture } = setup()
    await capture.getObservation('OBS-005')
    store.write((db) => { db.users.find((user) => user.id === 'USR-003')!.estateIds = ['EST-001'] })
    await expect(capture.getObservation('OBS-005')).rejects.toMatchObject({ kind: 'not_found' })
    await expect(capture.getObservation('OBS-001')).resolves.toMatchObject({ estate: { id: 'EST-001' } })
    store.write((db) => { db.users.find((user) => user.id === 'USR-003')!.status = 'inactive' })
    await expect(capture.getObservation('OBS-001')).rejects.toMatchObject({ kind: 'forbidden' })
  })

  it('supports injected errors and cancellation without changing fixtures', async () => {
    const { store, capture } = setup()
    store.failNext('offline')
    await expect(capture.getObservation('OBS-005')).rejects.toMatchObject({ kind: 'offline' })
    await expect(capture.getObservation('OBS-005', AbortSignal.abort())).rejects.toMatchObject({ kind: 'cancelled' })
    expect(store.read((db) => db.observations)).toHaveLength(48)
    await expect(capture.getObservation('OBS-005')).resolves.toMatchObject({ id: 'OBS-005' })
  })

  it('sends no HTTP request without an approved API contract', async () => {
    const request = vi.fn()
    const http = { request, get: request } as unknown as HttpClient
    await expect(createHttpCaptureAdapter(http).getObservation('OBS-005')).rejects.toMatchObject({ kind: 'contract_pending' })
    expect(request).not.toHaveBeenCalled()
  })
})
