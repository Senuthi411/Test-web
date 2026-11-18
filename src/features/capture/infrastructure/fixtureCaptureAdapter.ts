import type { FixtureStore, FixtureDatabase, FixtureDivisionQuarantine, FixtureObservation, FixtureAssignment, FixtureUser } from '@/fixtures'
import { FIXTURE_REFERENCE_DATE, activeQuarantineOf, captureAssignmentSeeds as seedAssignments, logQuarantineEvent, projectRevision, recordQuarantineDecision, revisionsOf } from '@/fixtures'
import { AppError } from '@/shared/api'
import { fixedClock, type Clock } from '@/shared/utilities/clock'
import type { CaptureReadPort } from '../application/ports'
import {
  activeAssignmentOf, assignmentArchivedAt, assignmentErrors, assignmentType, batchErrors, busyMessage, canSimulateWorkerAcceptance, cancelLock, completionBlock,
  editLock, isAssignmentSummary, simulationTransition, type Assignment,
} from '../domain/assignment'

/** "2026-10-21T10:00:00+05:30" for the clock's instant, in Sri Lanka time. */
function localIso(date: Date): string {
  const local = new Date(date.getTime() + 5.5 * 3600 * 1000)
  return `${local.toISOString().slice(0, 19)}+05:30`
}
const dayLabel = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo' }).format(new Date(iso))

/** Simulated mobile submissions are marked by their device observation ID, so they can be persisted. */
export const SIMULATED_DEVICE_PREFIX = 'SIMOBS-'

/**
 * Fixture Capture adapter. Uses the existing /observations route's Supervisor role restriction
 * and reads the current user's stored scope on every request, not caller-supplied estate IDs.
 * It enforces the assignment rules on every write: only a Draft is editable; a Field Worker
 * holds at most one active (Assigned or In progress) assignment; Done is completed only after
 * the submission (and, for an Inspection, its observation review) is finished.
 */
export function createFixtureCaptureAdapter(store: FixtureStore, actorId: () => string | null, clock: Clock = fixedClock(FIXTURE_REFERENCE_DATE)): CaptureReadPort {
  const now = () => localIso(clock.now())
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
      revisions: revisionsOf(db, observation.id).map((revision) => projectRevision(db, revision)),
    }
  }
  const projectAssignment = (item: FixtureAssignment): Assignment => ({ ...item, type: assignmentType(item), archivedAt: assignmentArchivedAt(item, now()) })
  const scopedRecord = (db: FixtureDatabase, id: string) => {
    const actor = actorOf(db)
    const item = db.assignments.find((row) => row.id === id && actor.estateIds.includes(row.estateId) && db.divisions.some((division) => division.id === row.divisionId && division.estateId === row.estateId))
    if (!item) throw new AppError('not_found', 'Assignment unavailable in your scope.')
    return { actor, item }
  }
  const currentVersion = (item: FixtureAssignment, version: number) => {
    if (item.version !== version) throw new AppError('conflict', 'This assignment changed. Reload before continuing.')
  }
  /**
   * The lock rule is checked against the stored record inside the same write as the version
   * check, so a Field Worker accepting (or starting) the task while the Supervisor has the form
   * open always wins, and the stale change is rejected.
   */
  const lockedRecord = (db: FixtureDatabase, id: string, version: number, lockOf: typeof editLock) => {
    const { actor, item } = scopedRecord(db, id)
    const lock = lockOf(item)
    if (lock) throw new AppError('conflict', `${lock} No changes were saved.`)
    currentVersion(item, version)
    return { actor, item }
  }
  /** A worker eligible for the division, active, and not holding another active assignment. */
  const assignableWorker = (db: Readonly<FixtureDatabase>, workerId: string, divisionId: string, exceptId?: string): FixtureUser => {
    const worker = db.users.find((user) => user.id === workerId)
    if (!worker || worker.role !== 'FIELD_WORKER' || worker.status !== 'active' || !worker.divisionIds.includes(divisionId)) throw new AppError('validation', `${workerId} is not eligible for ${divisionId}.`)
    const active = activeAssignmentOf(db.assignments, workerId, exceptId)
    if (active) throw new AppError('validation', `${busyMessage(worker.fullName, active)} No assignment was created or changed.`)
    return worker
  }
  const scopeCheck = (db: Readonly<FixtureDatabase>, actor: FixtureUser, estateId: string, divisionId: string) => {
    const division = db.divisions.find((item) => item.id === divisionId)
    const estate = db.estates.find((item) => item.id === estateId)
    if (!division || !estate || !actor.estateIds.includes(estate.id) || division.estateId !== estate.id || division.status !== 'active' || estate.status !== 'active') throw new AppError('forbidden', 'Select an active estate and division within your scope.')
    return division
  }
  /**
   * Restricted Operations rule, enforced on every assignment write (not only in the form).
   * Normal Operations: a normal assignment is unchanged; a Quarantine Assignment is refused.
   * Restricted Operations: a normal assignment is refused; a Quarantine Assignment must reference the
   * division's active Quarantine ID and, to be assigned, carry the Supervisor's authorisation.
   */
  const operationsCheck = (db: Readonly<FixtureDatabase>, division: { id: string; name: string }, quarantineId: string | null, status: 'draft' | 'assigned', authorised: boolean): FixtureDivisionQuarantine | null => {
    const active = activeQuarantineOf(db, division.id)
    if (!active) {
      if (quarantineId) throw new AppError('validation', `${division.id} ${division.name} is not under Restricted Operations, so a Quarantine Assignment cannot be created for it. No assignment was created or changed.`)
      return null
    }
    if (!quarantineId) throw new AppError('forbidden', `${division.id} ${division.name} is under Restricted Operations (${active.id}). Normal field assignments are blocked; only a Supervisor-authorised Quarantine Assignment is allowed. No assignment was created or changed.`)
    if (quarantineId !== active.id) throw new AppError('validation', `${quarantineId} is not the active quarantine of ${division.id} (${active.id}). No assignment was created or changed.`)
    if (status === 'assigned' && !authorised) throw new AppError('forbidden', 'Supervisor authorisation is required to assign a Quarantine Assignment. No assignment was created or changed.')
    return active
  }
  /** The stored quarantine part: linked fields come from the quarantine record, never from the caller. */
  const quarantinePart = (db: Readonly<FixtureDatabase>, active: FixtureDivisionQuarantine, input: { objective: string; inspectionFocus: string; monitoringWindow: string }, authorisedBy: string | null) => ({
    quarantineId: active.id, caseId: active.caseId, observationId: active.observationId, diseaseId: active.diseaseId ?? null,
    diseaseName: (active.diseaseId ? db.diseases.find((row) => row.id === active.diseaseId)?.name : undefined) ?? null,
    objective: input.objective.trim(), inspectionFocus: input.inspectionFocus.trim(), monitoringWindow: input.monitoringWindow.trim(),
    authorisedBy, authorisedAt: authorisedBy ? now() : null,
  })
  /** Links a Quarantine Assignment to its quarantine record and records the history entries. */
  const trackQuarantineAssignment = (db: FixtureDatabase, active: FixtureDivisionQuarantine, item: FixtureAssignment, actor: FixtureUser, event: 'created' | 'assigned') => {
    const at = now()
    const list = (active.assignmentIds ??= [])
    if (!list.includes(item.id)) list.push(item.id)
    if (event === 'created') logQuarantineEvent(active, 'Quarantine assignment created', actor.id, at, `${item.id} · ${item.title}`)
    else {
      logQuarantineEvent(active, 'Quarantine assignment authorised', actor.id, at, `${item.id} authorised by ${actor.fullName}`)
      logQuarantineEvent(active, 'Quarantine assignment assigned', actor.id, at, `${item.id} assigned to ${item.fieldWorkerId ?? 'a Field Worker'}`)
      recordQuarantineDecision(db, active, 'quarantine_assignment', actor.id, at, `${item.id} authorised and assigned under ${active.id} (${item.divisionId})`)
    }
  }
  const nextAssignmentNumber = (db: Readonly<FixtureDatabase>) => Math.max(0, ...db.assignments.map((item) => Number(item.id.replace('ASG-', '')))) + 1

  /** Simulated mobile submission of an Inspection: a new, normal observation linked to the assignment. */
  const submitInspectionObservation = (db: FixtureDatabase, item: FixtureAssignment, worker: FixtureUser) => {
    const number = Math.max(0, ...db.observations.map((row) => Number(row.id.replace('OBS-', '')) || 0)) + 1
    const id = `OBS-${String(number).padStart(3, '0')}`
    const at = now()
    db.observations.push({
      id, deviceObservationId: `${SIMULATED_DEVICE_PREFIX}${String(number).padStart(4, '0')}`, divisionId: item.divisionId, fieldWorkerId: worker.id,
      capturedAt: at, suspectedDiseaseId: 'DIS-001', reviewStatus: 'submitted', catalogVersion: 2, syncStatus: 'synced', gpsAccuracyM: 8, provenance: 'fixture-assigned',
    })
    db.captureEvidence.push({
      observationId: id, imageId: `IMG-${String(number).padStart(3, '0')}`, assetKey: `demo/observations/${id}/original.jpg`, mimeType: 'image/jpeg', receivedAt: at,
      latitude: 6.981, longitude: 80.636, altText: `Synthetic tea leaf evidence placeholder for ${id}`,
      imageSource: { kind: 'synthetic_illustration', attribution: 'Synthetic leaf illustration from the approved TeaLeaf designs; not a photograph', license: null, sourceUrl: null },
      note: `Inspection observation for ${item.id} submitted from the mobile app (simulated).`,
    })
    db.reviewObservationDetails.push({ observationId: id, symptoms: ['Irregular leaf spots'], fieldNote: `Inspection observation for ${item.id} submitted from the mobile app (simulated).`, provenance: 'fixture-assigned' })
    db.reviewRecords.push({ id: id.replace('OBS-', 'REV-'), observationId: id, version: 1, claimedBy: null, claimedAt: null, provenance: 'fixture-assigned' })
    return id
  }

  return {
    editAssignment(id, input, expectedVersion) {
      return store.run(() => store.write((db) => {
        const { actor, item } = lockedRecord(db, id, expectedVersion, editLock)
        if (input.status !== 'assigned' && input.status !== 'draft') throw new AppError('validation', 'A draft can stay a draft or be assigned.')
        const problems = assignmentErrors(input)
        if (Object.keys(problems).length) throw new AppError('validation', Object.values(problems)[0])
        const division = scopeCheck(db, actor, input.estateId, input.divisionId)
        // Assigning from the edit page is the Supervisor's explicit authorisation of a Quarantine Assignment.
        const active = operationsCheck(db, division, input.quarantine?.quarantineId ?? item.quarantine?.quarantineId ?? null, input.status, true)
        let worker: FixtureUser | undefined
        if (input.fieldWorkerId) {
          worker = input.status === 'assigned' ? assignableWorker(db, input.fieldWorkerId, division.id, item.id) : db.users.find((row) => row.id === input.fieldWorkerId)
          if (!worker || worker.role !== 'FIELD_WORKER' || !worker.divisionIds.includes(division.id)) throw new AppError('validation', 'The selected Field Worker is not eligible for this division.')
        }
        Object.assign(item, { estateId: input.estateId, divisionId: input.divisionId, fieldWorkerId: input.fieldWorkerId, title: input.title.trim(), instructions: input.instructions.trim(), priority: input.priority, dueDate: input.dueDate, status: input.status })
        if (input.requirements !== undefined) item.requirements = input.requirements ? structuredClone(input.requirements) : null
        if (input.templateId !== undefined) item.templateId = input.templateId
        if (input.type) item.type = input.type
        if (active) item.quarantine = quarantinePart(db, active, input.quarantine ?? item.quarantine ?? { objective: '', inspectionFocus: '', monitoringWindow: '' }, input.status === 'assigned' ? actor.id : item.quarantine?.authorisedBy ?? null)
        const reason = input.reason.trim() ? ` Reason: ${input.reason.trim()}` : ''
        item.activity.push(input.status === 'assigned'
          ? `${dayLabel(now())} · Draft assigned to ${worker!.fullName} (${worker!.id}) by ${actor.fullName}${reason ? `.${reason}` : ''}`
          : `${dayLabel(now())} · Draft details changed by ${actor.fullName}.${reason}`)
        item.version += 1
        if (active && input.status === 'assigned') trackQuarantineAssignment(db, active, item, actor, 'assigned')
        return projectAssignment(item)
      }))
    },
    submitAssignment(id, expectedVersion) {
      return store.run(() => store.write((db) => {
        const { actor, item } = lockedRecord(db, id, expectedVersion, editLock)
        if (item.status !== 'draft') throw new AppError('conflict', 'Only a Draft can be submitted.')
        if (!item.fieldWorkerId) throw new AppError('validation', 'Choose a Field Worker (Edit) before submitting this draft.')
        if (!item.instructions?.trim()) throw new AppError('validation', 'Enter instructions (Edit) before submitting this draft.')
        const division = db.divisions.find((row) => row.id === item.divisionId)!
        // Submitting is the Supervisor's explicit authorisation. A normal draft cannot be submitted for a division under Restricted Operations.
        const active = operationsCheck(db, division, item.quarantine?.quarantineId ?? null, 'assigned', true)
        const worker = assignableWorker(db, item.fieldWorkerId, item.divisionId, item.id)
        if (active && item.quarantine) Object.assign(item.quarantine, { authorisedBy: actor.id, authorisedAt: now() })
        item.status = 'assigned'
        item.activity.push(`${dayLabel(now())} · Draft submitted and assigned to ${worker.fullName} (${worker.id}) by ${actor.fullName}`)
        item.version += 1
        if (active) trackQuarantineAssignment(db, active, item, actor, 'assigned')
        return projectAssignment(item)
      }))
    },
    cancelAssignment(id, reason, expectedVersion) {
      return store.run(() => store.write((db) => {
        const { actor, item } = lockedRecord(db, id, expectedVersion, cancelLock)
        if (!reason.trim()) throw new AppError('validation', 'Enter a cancellation reason.')
        const wasDraft = item.status === 'draft'
        // Soft cancellation: the record and its activity history are kept.
        item.status = 'cancelled'
        item.activity.push(`${dayLabel(now())} · ${wasDraft ? 'Draft cancelled' : 'Cancelled'} by ${actor.fullName}. Reason: ${reason.trim()}`)
        item.version += 1
        return projectAssignment(item)
      }))
    },
    /** Complete assignment (Done → Completed) after the Supervisor reviewed the submission. */
    acceptAssignment(id, expectedVersion) {
      return store.run(() => store.write((db) => {
        const { actor, item } = scopedRecord(db, id)
        currentVersion(item, expectedVersion)
        if (isAssignmentSummary(item.id)) throw new AppError('conflict', 'This approved summary record has no submitted fieldwork to complete.')
        if (item.status === 'submitted' && assignmentType(item) === 'inspection' && item.observationIds.some((observationId) => !db.observations.some((observation) => observation.id === observationId && observation.divisionId === item.divisionId && observation.fieldWorkerId === item.fieldWorkerId))) {
          throw new AppError('contract_mismatch', 'The submitted observation links are unavailable or inconsistent. No assignment was changed.')
        }
        const block = completionBlock(item, (observationId) => db.observations.find((row) => row.id === observationId)?.reviewStatus)
        if (block) throw new AppError('conflict', block)
        item.status = 'completed'
        item.completedAt = now()
        item.activity.push(`${dayLabel(item.completedAt)} · Accepted and completed by ${actor.fullName} (${actor.id})`)
        item.version += 1
        return projectAssignment(item)
      }))
    },
    getWorkspace(signal) {
      return store.run(() => store.read((db) => {
        const actor = actorOf(db)
        const estates = db.estates.filter((estate) => actor.estateIds.includes(estate.id))
        const divisions = db.divisions.filter((division) => actor.estateIds.includes(division.estateId))
        const ids = new Set(divisions.map((division) => division.id))
        const quarantines = (db.divisionQuarantines ?? []).filter((item) => (item.status ?? 'active') === 'active' && ids.has(item.divisionId)).map((item) => {
          const diagnosis = db.referrals.find((row) => row.observationId === item.observationId)?.diagnosis
          const disease = item.diseaseId ? db.diseases.find((row) => row.id === item.diseaseId) : undefined
          return { id: item.id, estateId: item.estateId, divisionId: item.divisionId, observationId: item.observationId, caseId: item.caseId,
            disease: item.diseaseId ? { id: item.diseaseId, name: disease?.name ?? item.diseaseId } : null, severity: item.severity ?? null,
            recommendedAction: diagnosis?.details?.recommendedAction ?? '', followUpDescription: diagnosis?.details?.followUpDescription ?? '',
            monitoringWindow: diagnosis?.details?.monitoringWindow ?? '', inspectionFocus: diagnosis?.details?.inspectionFocus ?? '' }
        })
        return { actor: { id: actor.id, fullName: actor.fullName }, estates, divisions, quarantines,
          workers: db.users.filter((user) => user.role === 'FIELD_WORKER' && user.status === 'active' && user.divisionIds.some((id) => ids.has(id))).map((user) => ({ id: user.id, fullName: user.fullName, divisionIds: user.divisionIds.filter((id) => ids.has(id)) })),
          observations: db.observations.filter((item) => ids.has(item.divisionId)).map((item) => project(db, item)),
          assignments: db.assignments.filter((item) => actor.estateIds.includes(item.estateId) && divisions.some((division) => division.id === item.divisionId && division.estateId === item.estateId)).map(projectAssignment),
        }
      }), signal)
    },
    createAssignment(input) {
      return store.run(() => store.write((db) => {
        const actor = actorOf(db)
        const division = scopeCheck(db, actor, input.estateId, input.divisionId)
        const active = operationsCheck(db, division, input.quarantine?.quarantineId ?? null, input.status, input.quarantine?.authorised ?? false)
        if (input.fieldWorkerId) {
          if (input.status === 'assigned') assignableWorker(db, input.fieldWorkerId, division.id)
          else if (!db.users.find((user) => user.id === input.fieldWorkerId)?.divisionIds.includes(division.id)) throw new AppError('validation', 'The selected Field Worker is not eligible for this division.')
        }
        const id = `ASG-${String(nextAssignmentNumber(db)).padStart(3, '0')}`
        const { quarantine: quarantineInput, ...plain } = input
        const item: FixtureAssignment = { ...plain, quarantine: active && quarantineInput ? quarantinePart(db, active, quarantineInput, input.status === 'assigned' ? actor.id : null) : null, type: input.type ?? 'inspection', templateId: input.templateId ?? null, requirements: input.requirements ?? null, groupId: null, id, createdBy: actor.id, createdAt: now().slice(0, 10), observationIds: [], version: 1, acceptedAt: null, submittedAt: null, submission: null, completedAt: null, activity: [`${dayLabel(now())} · ${input.status === 'draft' ? 'Draft created' : 'Assigned'} by ${actor.fullName}`] }
        db.assignments.push(item)
        if (active) {
          trackQuarantineAssignment(db, active, item, actor, 'created')
          if (item.status === 'assigned') trackQuarantineAssignment(db, active, item, actor, 'assigned')
        }
        return projectAssignment(item)
      }))
    },
    createAssignments(input) {
      return store.run(() => store.write((db) => {
        const actor = actorOf(db)
        const problems = batchErrors(input)
        if (Object.keys(problems).length) throw new AppError('validation', Object.values(problems)[0])
        const division = scopeCheck(db, actor, input.estateId, input.divisionId)
        const active = operationsCheck(db, division, input.quarantine?.quarantineId ?? null, input.status, input.quarantine?.authorised ?? false)
        // Every worker is checked before anything is written: all assignments are created, or none.
        const workers = input.fieldWorkerIds.map((id) => db.users.find((user) => user.id === id))
        const ineligible = input.fieldWorkerIds.filter((_id, index) => { const w = workers[index]; return !w || w.status !== 'active' || w.role !== 'FIELD_WORKER' || !w.divisionIds.includes(division.id) })
        if (ineligible.length) throw new AppError('validation', `${ineligible.join(', ')} ${ineligible.length === 1 ? 'is' : 'are'} not eligible for ${division.id} ${division.name}. No assignments were created.`)
        if (input.status === 'assigned') {
          const busy = input.fieldWorkerIds.map((id, index) => ({ worker: workers[index]!, active: activeAssignmentOf(db.assignments, id) })).filter((row) => row.active)
          if (busy.length) throw new AppError('validation', `${busy.map((row) => busyMessage(row.worker.fullName, row.active!)).join(' ')} No assignments were created.`)
        }
        const first = nextAssignmentNumber(db)
        const slots = input.fieldWorkerIds.length ? input.fieldWorkerIds : [null]
        const ids = slots.map((_, index) => `ASG-${String(first + index).padStart(3, '0')}`)
        const groupId = ids.length > 1 ? `GRP-${ids[0]}` : null
        const { fieldWorkerIds: _ignored, quarantine: quarantineInput, ...base } = input
        void _ignored
        const created: FixtureAssignment[] = slots.map((fieldWorkerId, index) => ({
          ...base, fieldWorkerId, id: ids[index], quarantine: active && quarantineInput ? quarantinePart(db, active, quarantineInput, input.status === 'assigned' ? actor.id : null) : null, type: input.type ?? 'inspection', templateId: input.templateId ?? null, requirements: input.requirements ? structuredClone(input.requirements) : null, groupId,
          createdBy: actor.id, createdAt: now().slice(0, 10), observationIds: [], version: 1, acceptedAt: null, submittedAt: null, submission: null, completedAt: null,
          activity: [`${dayLabel(now())} · ${input.status === 'draft' ? 'Draft created' : `Assigned to ${workers[index]?.fullName ?? ''}`} by ${actor.fullName}${groupId ? ` (one of ${ids.length} assignments created together)` : ''}`],
        }))
        db.assignments.push(...created)
        if (active) {
          for (const item of created) {
            trackQuarantineAssignment(db, active, item, actor, 'created')
            if (item.status === 'assigned') trackQuarantineAssignment(db, active, item, actor, 'assigned')
          }
        }
        return created.map(projectAssignment)
      }))
    },
    simulateAssignment(id, action, expectedVersion) {
      return store.run(() => store.write((db) => {
        const actor = actorOf(db)
        const item = db.assignments.find((row) => row.id === id && actor.estateIds.includes(row.estateId))
        if (!item) throw new AppError('not_found', 'Assignment unavailable in your scope.')
        if (item.version !== expectedVersion) throw new AppError('conflict', 'This assignment changed. Reload before continuing.')
        const worker = db.users.find((user) => user.id === item.fieldWorkerId)
        const division = db.divisions.find((row) => row.id === item.divisionId)
        const workerInScope = () => {
          if (!worker || worker.role !== 'FIELD_WORKER' || worker.status !== 'active' || !worker.divisionIds.includes(item.divisionId) || division?.status !== 'active' || division.estateId !== item.estateId) throw new AppError('forbidden', 'The current worker scope or division no longer permits this simulation.')
        }
        if (action === 'accept') {
          // The Field Worker accepts the task in the mobile app. Cancelled, draft or already
          // accepted tasks cannot be accepted. The status stays Assigned until work starts.
          if (!canSimulateWorkerAcceptance(projectAssignment(item))) throw new AppError('conflict', 'This task cannot be accepted by the Field Worker in its current status.')
          workerInScope()
          item.acceptedAt = now()
          item.activity.push(`${dayLabel(now())} · Task accepted by ${worker!.fullName} in mobile app (simulated)`)
          item.version += 1
          return projectAssignment(item)
        }
        const nextStatus = simulationTransition(projectAssignment(item), action)
        if (!nextStatus) throw new AppError('conflict', 'This prototype action is not available for this assignment.')
        workerInScope()
        if (action === 'start') {
          // Starting work implies the Field Worker accepted the task.
          if (!item.acceptedAt) item.acceptedAt = now()
          item.activity.push(`${dayLabel(now())} · Task started in mobile app (simulated)`)
        } else if (assignmentType(item) === 'inspection') {
          // The worker's observation enters the normal Review Queue as Submitted; the assignment is Done.
          const observationId = submitInspectionObservation(db, item, worker!)
          item.observationIds = [...item.observationIds, observationId]
          item.activity.push(`${dayLabel(now())} · ${observationId} received from mobile app (simulated)`)
        } else {
          const fields = item.requirements?.fields ?? []
          const photos = item.requirements && item.requirements.photos.level !== 'not_required' ? item.requirements.photos.minimum : 1
          item.submission = {
            submittedAt: now(), outcome: 'Completed as instructed',
            responses: fields.map((field) => ({ label: field.label, value: `Demo value for ${field.label.toLowerCase()}` })),
            photoIds: Array.from({ length: photos }, (_, index) => `IMG-${item.id}-${index + 1}`),
            completionNotes: item.requirements?.completionNotes === 'not_required' ? null : 'Work completed as instructed (simulated mobile submission).',
            gps: { latitude: 6.981, longitude: 80.636, accuracyM: 9 },
          }
          item.activity.push(`${dayLabel(now())} · Task evidence received from mobile app (simulated)`)
        }
        item.status = nextStatus
        if (nextStatus === 'submitted') item.submittedAt = now()
        item.version += 1
        return projectAssignment(item)
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
