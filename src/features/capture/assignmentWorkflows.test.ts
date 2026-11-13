import { describe, expect, it } from 'vitest'
import { FixtureStore } from '@/fixtures'
import { createCaptureUseCases } from './index'
import { createFixtureCaptureAdapter } from './fixtures'
import { createHttpCaptureAdapter } from './http'
import type { HttpClient } from '@/shared/api'

const input = { estateId: 'EST-002', divisionId: 'DIV-005', fieldWorkerId: 'USR-009', title: 'Inspect East Hills', instructions: 'Photograph affected leaves.', priority: 'High' as const, dueDate: '2026-10-16', status: 'assigned' as const }
const edit = { ...input, reason: 'Task details clarified after site walk' }
function setup(actor: string | null = 'USR-003') {
  const store = new FixtureStore({ latencyMs: 0 })
  return { store, capture: createCaptureUseCases(createFixtureCaptureAdapter(store, () => actor)) }
}

describe('Approved Assignment PDF workflows', () => {
  it('accepts submitted work once without altering observation review, Identity or evidence', async () => {
    const { store, capture } = setup()
    const before = store.read((db) => ({ observations: db.observations, evidence: db.captureEvidence, users: db.users }))
    const saved = await capture.acceptAssignment('ASG-001', 1)
    expect(saved).toMatchObject({ status: 'completed', version: 2, observationIds: ['OBS-014'] })
    expect(saved.activity.at(-1)).toContain('Accepted and completed by Malini Fernando')
    expect(store.read((db) => ({ observations: db.observations, evidence: db.captureEvidence, users: db.users }))).toEqual(before)
    await expect(capture.acceptAssignment('ASG-001', 1)).rejects.toMatchObject({ kind: 'conflict' })
    await expect(capture.acceptAssignment('ASG-001', 2)).rejects.toMatchObject({ kind: 'conflict' })
  })

  it('edits approved fields, requires a reason and rejects stale updates atomically', async () => {
    const { capture } = setup()
    const created = await capture.createAssignment(input)
    await expect(capture.editAssignment(created.id, { ...edit, reason: ' ' }, 1)).rejects.toMatchObject({ kind: 'validation' })
    const saved = await capture.editAssignment(created.id, { ...edit, title: ' Clarified task ', priority: 'Low' }, 1)
    expect(saved).toMatchObject({ title: 'Clarified task', priority: 'Low', status: 'assigned', version: 2, createdBy: 'USR-003' })
    expect(saved.activity.at(-1)).toContain(edit.reason)
    await expect(capture.editAssignment(created.id, edit, 1)).rejects.toMatchObject({ kind: 'conflict' })
    expect((await capture.getWorkspace()).assignments.find((a) => a.id === created.id)).toEqual(saved)
  })

  it('records cancellation reason, preserves the record and prevents further lifecycle actions', async () => {
    const { capture } = setup()
    const created = await capture.createAssignment(input)
    await expect(capture.cancelAssignment(created.id, ' ', 1)).rejects.toMatchObject({ kind: 'validation' })
    const cancelled = await capture.cancelAssignment(created.id, 'Duplicate of a planned survey', 1)
    expect(cancelled).toMatchObject({ status: 'cancelled', version: 2, observationIds: [] })
    expect(cancelled.activity.at(-1)).toContain('Duplicate of a planned survey')
    await expect(capture.editAssignment(created.id, edit, 2)).rejects.toMatchObject({ kind: 'conflict' })
    await expect(capture.simulateAssignment(created.id, 'start', 2)).rejects.toMatchObject({ kind: 'conflict' })
    await expect(capture.cancelAssignment(created.id, 'Again', 2)).rejects.toMatchObject({ kind: 'conflict' })
  })

  it('does not allow cancellation or editing once fieldwork starts or evidence is submitted', async () => {
    const { capture } = setup()
    const created = await capture.createAssignment(input)
    const started = await capture.simulateAssignment(created.id, 'start', 1)
    await expect(capture.cancelAssignment(created.id, 'No', started.version)).rejects.toMatchObject({ kind: 'conflict' })
    await expect(capture.editAssignment(created.id, edit, started.version)).rejects.toMatchObject({ kind: 'conflict' })
    await expect(capture.acceptAssignment(created.id, started.version)).rejects.toMatchObject({ kind: 'conflict' })
    await expect(capture.cancelAssignment('ASG-001', 'No', 1)).rejects.toMatchObject({ kind: 'conflict' })
  })

  it('rechecks actor, estate, division and worker scope for mutations', async () => {
    for (const actor of [null, 'USR-001', 'USR-009', 'USR-002']) {
      const { capture } = setup(actor)
      const kind = actor === null ? 'unauthorized' : actor === 'USR-002' ? 'not_found' : 'forbidden'
      await expect(capture.editAssignment('ASG-001', edit, 1)).rejects.toMatchObject({ kind })
      await expect(capture.cancelAssignment('ASG-001', 'Reason', 1)).rejects.toMatchObject({ kind })
      await expect(capture.acceptAssignment('ASG-001', 1)).rejects.toMatchObject({ kind })
    }
    const { store, capture } = setup()
    const created = await capture.createAssignment(input)
    await expect(capture.editAssignment(created.id, { ...edit, estateId: 'EST-001' }, 1)).rejects.toMatchObject({ kind: 'forbidden' })
    await expect(capture.editAssignment(created.id, { ...edit, fieldWorkerId: 'USR-010' }, 1)).rejects.toMatchObject({ kind: 'validation' })
    store.write((db) => { db.users.find((u) => u.id === 'USR-009')!.divisionIds = [] })
    await expect(capture.editAssignment(created.id, edit, 1)).rejects.toMatchObject({ kind: 'validation' })
    expect((await capture.getWorkspace()).assignments.find((a) => a.id === created.id)?.version).toBe(1)
  })

  it('keeps all six summary records read-only and does not invent a reassignment result', async () => {
    const { store, capture } = setup()
    for (const id of ['ASG-002', 'ASG-003', 'ASG-004', 'ASG-005', 'ASG-006', 'ASG-007']) {
      await expect(capture.editAssignment(id, edit, 1)).rejects.toMatchObject({ kind: 'conflict' })
      await expect(capture.cancelAssignment(id, 'Reason', 1)).rejects.toMatchObject({ kind: 'conflict' })
      await expect(capture.acceptAssignment(id, 1)).rejects.toMatchObject({ kind: 'conflict' })
      await expect(capture.simulateAssignment(id, 'submit', 1)).rejects.toMatchObject({ kind: 'conflict' })
    }
    const created = await capture.createAssignment(input)
    store.write((db) => { db.users.find((u) => u.id === 'USR-010')!.divisionIds.push('DIV-005') })
    await expect(capture.editAssignment(created.id, { ...edit, fieldWorkerId: 'USR-010' }, 1)).rejects.toMatchObject({ kind: 'contract_pending' })
    expect((await capture.getWorkspace()).assignments.find((a) => a.id === created.id)).toEqual(created)
  })

  it('rejects broken submitted links before acceptance without mutating anything', async () => {
    const { store, capture } = setup()
    store.write((db) => { db.assignments[0].observationIds.push('OBS-001') })
    await expect(capture.acceptAssignment('ASG-001', 1)).rejects.toMatchObject({ kind: 'contract_mismatch' })
    expect((await capture.getWorkspace()).assignments[0]).toMatchObject({ status: 'submitted', version: 1 })
  })

  it('exposes the exact OBS-014 PDF provenance without fabricating a second revision or receipt ID', async () => {
    const { capture } = setup()
    expect((await capture.getObservation('OBS-014')).evidence).toMatchObject({ imageId: 'IMG-014', latitude: 7.106, longitude: 80.734, receivedAt: '2026-10-15T16:05:00+05:30' })
    expect((await capture.getObservation('OBS-014')).evidence).not.toHaveProperty('revisionId')
    expect((await capture.getObservation('OBS-014')).evidence).not.toHaveProperty('syncReceipt')
  })

  it('leaves production operations explicitly contract-pending without inventing endpoints', async () => {
    const adapter = createHttpCaptureAdapter({} as HttpClient)
    await expect(adapter.editAssignment('ASG-001', edit, 1)).rejects.toMatchObject({ kind: 'contract_pending' })
    await expect(adapter.cancelAssignment('ASG-001', 'Reason', 1)).rejects.toMatchObject({ kind: 'contract_pending' })
    await expect(adapter.acceptAssignment('ASG-001', 1)).rejects.toMatchObject({ kind: 'contract_pending' })
  })
})
