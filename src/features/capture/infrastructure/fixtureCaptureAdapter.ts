import type { FixtureStore, FixtureDatabase, FixtureObservation } from '@/fixtures'
import { captureAssignmentSeeds as seedAssignments } from '@/fixtures'
import { AppError } from '@/shared/api'
import type { CaptureReadPort } from '../application/ports'
import { assignmentErrors, canEditAssignment, isAssignmentSummary, simulationTransition } from '../domain/assignment'

/** Uses the existing /observations route's Supervisor role restriction. Reads the
 * current user's stored scope on every request, not caller-supplied estate IDs. */
export function createFixtureCaptureAdapter(store: FixtureStore, actorId: () => string | null): CaptureReadPort {
  const actorOf = (db: Readonly<FixtureDatabase>) => {
    const id = actorId()
    if (!id) throw new AppError('unauthorized', 'Sign in to view observation data.')
    const actor = db.users.find((user) => user.id === id)
    if (!actor || actor.status !== 'active' || actor.role !== 'SUPERVISOR') throw new AppError('forbidden', 'This account cannot access Capture Web.')
    return actor
  }
  const project = (db: Readonly<FixtureDatabase>, observation: FixtureObservation) => {
    const division = db.divisions.find((item) => item.id === observation.divisionId)!
    const estate = db.estates.find((item) => item.id === division.estateId)!
    const worker = db.users.find((item) => item.id === observation.fieldWorkerId)!
    const disease = db.diseases.find((item) => item.id === observation.suspectedDiseaseId)!
    if (!worker || !disease) throw new AppError('contract_mismatch', 'The observation has incomplete related records.')
    return { id: observation.id, deviceObservationId: observation.deviceObservationId, capturedAt: observation.capturedAt,
      estate: { id: estate.id, name: estate.name, region: estate.region }, division: { id: division.id, name: division.name },
      fieldWorker: { id: worker.id, fullName: worker.fullName }, suspectedDisease: { id: disease.id, name: disease.name },
      reviewStatus: observation.reviewStatus, catalogVersion: observation.catalogVersion, syncStatus: observation.syncStatus,
      gpsAccuracyM: observation.gpsAccuracyM, evidence: db.captureEvidence.find((item) => item.observationId === observation.id),
    }
  }
  const editableRecord = (db: FixtureDatabase, id: string, version: number) => {
    const actor = actorOf(db)
    const item = db.assignments.find((row) => row.id === id && actor.estateIds.includes(row.estateId) && db.divisions.some((division) => division.id === row.divisionId && division.estateId === row.estateId))
    if (!item) throw new AppError('not_found', 'Assignment unavailable in your scope.')
    if (item.version !== version) throw new AppError('conflict', 'This assignment changed. Reload before continuing.')
    if (isAssignmentSummary(item.id)) throw new AppError('conflict', 'This approved summary record is read-only.')
    return { actor, item }
  }
  return {
    editAssignment(id, input, expectedVersion) {
      return store.run(() => store.write((db) => {
        const { actor, item } = editableRecord(db, id, expectedVersion)
        if (!canEditAssignment(item)) throw new AppError('conflict', 'Only assigned tasks without submitted evidence can be edited in this prototype.')
        if (!input.reason.trim()) throw new AppError('validation', 'Enter a reason for change.')
        const problems = assignmentErrors({ ...input, status: 'assigned' })
        if (Object.keys(problems).length) throw new AppError('validation', Object.values(problems)[0])
        const division = db.divisions.find((row) => row.id === input.divisionId)
        const estate = db.estates.find((row) => row.id === input.estateId)
        const worker = db.users.find((row) => row.id === input.fieldWorkerId)
        if (!estate || estate.status !== 'active' || !actor.estateIds.includes(estate.id) || !division || division.status !== 'active' || division.estateId !== estate.id) throw new AppError('forbidden', 'Select an active estate and division within your scope.')
        if (!worker || worker.role !== 'FIELD_WORKER' || worker.status !== 'active' || !worker.divisionIds.includes(division.id)) throw new AppError('validation', 'The selected Field Worker is not eligible for this division.')
        if (input.fieldWorkerId !== item.fieldWorkerId) throw new AppError('contract_pending', 'The replacement assignment and reassignment transition are not specified. No changes were saved.')
        Object.assign(item, { estateId: input.estateId, divisionId: input.divisionId, fieldWorkerId: input.fieldWorkerId, title: input.title.trim(), instructions: input.instructions.trim(), priority: input.priority, dueDate: input.dueDate })
        item.activity.push(`21 Oct 2026 · Task details changed by ${actor.fullName}. Reason: ${input.reason.trim()}`)
        item.version += 1
        return item
      }))
    },
    cancelAssignment(id, reason, expectedVersion) {
      return store.run(() => store.write((db) => {
        const { actor, item } = editableRecord(db, id, expectedVersion)
        if (!canEditAssignment(item)) throw new AppError('conflict', 'Only assigned tasks before fieldwork starts can be cancelled in this prototype.')
        if (!reason.trim()) throw new AppError('validation', 'Enter a cancellation reason.')
        item.status = 'cancelled'
        item.activity.push(`21 Oct 2026 · Cancelled by ${actor.fullName}. Reason: ${reason.trim()}`)
        item.version += 1
        return item
      }))
    },
    acceptAssignment(id, expectedVersion) {
      return store.run(() => store.write((db) => {
        const { actor, item } = editableRecord(db, id, expectedVersion)
        if (item.status !== 'submitted') throw new AppError('conflict', 'Only submitted fieldwork can be accepted.')
        if (!item.observationIds.length || item.observationIds.some((observationId) => !db.observations.some((observation) => observation.id === observationId && observation.divisionId === item.divisionId && observation.fieldWorkerId === item.fieldWorkerId))) throw new AppError('contract_mismatch', 'The submitted observation links are unavailable or inconsistent. No assignment was changed.')
        item.status = 'completed'
        item.activity.push(`21 Oct 2026 · Accepted and completed by ${actor.fullName} (${actor.id})`)
        item.version += 1
        return item
      }))
    },
    getWorkspace(signal) {
      return store.run(() => store.read((db) => {
        const actor = actorOf(db)
        const estates = db.estates.filter((estate) => actor.estateIds.includes(estate.id))
        const divisions = db.divisions.filter((division) => actor.estateIds.includes(division.estateId))
        const ids = new Set(divisions.map((division) => division.id))
        return { actor: { id: actor.id, fullName: actor.fullName }, estates, divisions,
          workers: db.users.filter((user) => user.role === 'FIELD_WORKER' && user.status === 'active' && user.divisionIds.some((id) => ids.has(id))).map((user) => ({ id: user.id, fullName: user.fullName, divisionIds: user.divisionIds.filter((id) => ids.has(id)) })),
          observations: db.observations.filter((item) => ids.has(item.divisionId)).map((item) => project(db, item)),
          assignments: db.assignments.filter((item) => actor.estateIds.includes(item.estateId) && divisions.some((division) => division.id === item.divisionId && division.estateId === item.estateId)),
        }
      }), signal)
    },
    createAssignment(input) {
      return store.run(() => store.write((db) => {
        const actor = actorOf(db)
        const division = db.divisions.find((item) => item.id === input.divisionId)
        const estate = db.estates.find((item) => item.id === input.estateId)
        if (!division || !estate || !actor.estateIds.includes(estate.id) || division.estateId !== estate.id || division.status !== 'active' || estate.status !== 'active') throw new AppError('forbidden', 'Select an active estate and division within your scope.')
        const worker = db.users.find((item) => item.id === input.fieldWorkerId)
        if (input.fieldWorkerId && (!worker || worker.status !== 'active' || worker.role !== 'FIELD_WORKER' || !worker.divisionIds.includes(division.id))) throw new AppError('validation', 'The selected Field Worker is not eligible for this division.')
        const next = Math.max(0, ...db.assignments.map((item) => Number(item.id.replace('ASG-', '')))) + 1
        const id = `ASG-${String(next).padStart(3, '0')}`
        const item = { ...input, id, createdBy: actor.id, createdAt: '2026-10-21', observationIds: [], version: 1, activity: [`21 Oct 2026 · ${input.status === 'draft' ? 'Draft created' : 'Assigned'} by ${actor.fullName}`] }
        db.assignments.push(item)
        return item
      }))
    },
    simulateAssignment(id, action, expectedVersion) {
      return store.run(() => store.write((db) => {
        const actor = actorOf(db)
        const item = db.assignments.find((row) => row.id === id && actor.estateIds.includes(row.estateId))
        if (!item) throw new AppError('not_found', 'Assignment unavailable in your scope.')
        if (item.version !== expectedVersion) throw new AppError('conflict', 'This assignment changed. Reload before continuing.')
        const nextStatus = simulationTransition(item, action)
        if (!nextStatus) throw new AppError('conflict', 'This prototype action is not available for this assignment.')
        const worker = db.users.find((user) => user.id === item.fieldWorkerId)
        const division = db.divisions.find((row) => row.id === item.divisionId)
        if (!worker || worker.role !== 'FIELD_WORKER' || worker.status !== 'active' || !worker.divisionIds.includes(item.divisionId) || division?.status !== 'active' || division.estateId !== item.estateId) throw new AppError('forbidden', 'The current worker scope or division no longer permits this simulation.')
        if (action === 'submit' && !db.observations.some((observation) => observation.id === 'OBS-014' && observation.divisionId === item.divisionId && observation.fieldWorkerId === item.fieldWorkerId)) throw new AppError('contract_mismatch', 'The approved submission fixture is unavailable for this assignment.')
        item.status = nextStatus
        if (action === 'submit') item.observationIds = ['OBS-014']
        item.activity.push(action === 'start' ? '21 Oct 2026 · Task started in mobile app (simulated)' : '21 Oct 2026 · OBS-014 received from mobile app (simulated)')
        item.version += 1
        return item
      }))
    },
    resetAssignments() {
      return store.run(() => store.write((db) => {
        const actor = actorOf(db)
        db.assignments = [...db.assignments.filter((row) => !actor.estateIds.includes(row.estateId)), ...structuredClone(seedAssignments.filter((row) => actor.estateIds.includes(row.estateId)))]
      }))
    },
    getObservation(observationId, signal) {
      return store.run(() => store.read((db) => {
        const id = actorId()
        if (!id) throw new AppError('unauthorized', 'Sign in to view observation data.')
        const actor = db.users.find((user) => user.id === id)
        if (!actor || actor.status !== 'active' || actor.role !== 'SUPERVISOR') {
          throw new AppError('forbidden', 'This account cannot access Capture Web.')
        }
        const observation = db.observations.find((item) => item.id === observationId)
        const division = db.divisions.find((item) => item.id === observation?.divisionId)
        const estate = db.estates.find((item) => item.id === division?.estateId)
        // Use the same response for absent and out-of-scope records: neither leaks data.
        if (!observation || !division || !estate || !actor.estateIds.includes(estate.id)) {
          throw new AppError('not_found', 'This observation is unavailable in your estate scope.')
        }
        return project(db, observation)
      }), signal)
    },
  }
}
