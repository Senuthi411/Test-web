import { requirementErrors, type TaskRequirements } from './taskTemplates'

/**
 * Assignment statuses. The stored values are unchanged; `submitted` is shown as **Done**
 * (the Field Worker has delivered the required observation or evidence). Completed is set
 * only by the Supervisor after reviewing that submission.
 */
export type AssignmentStatus = 'draft' | 'assigned' | 'in_progress' | 'submitted' | 'completed' | 'cancelled' | 'reassigned'
export const ASSIGNMENT_STATUS: Record<AssignmentStatus, string> = { draft: 'Draft', assigned: 'Assigned', in_progress: 'In progress', submitted: 'Done', completed: 'Completed', cancelled: 'Cancelled', reassigned: 'Reassigned' }

/** Inspection: the worker inspects and submits an observation. Task: the worker performs work and submits completion evidence. */
export type AssignmentType = 'inspection' | 'task'
export const ASSIGNMENT_TYPE: Record<AssignmentType, string> = { inspection: 'Inspection', task: 'Task' }

/** What the Field Worker delivered for a Task assignment (from the mobile app). */
export interface TaskSubmission {
  submittedAt: string
  outcome: string
  responses: Array<{ label: string; value: string }>
  photoIds: string[]
  completionNotes: string | null
  /** Captured by the mobile app during fieldwork, when available. */
  gps: { latitude: number; longitude: number; accuracyM: number } | null
}

/** Quarantine-specific input of a Quarantine Assignment. Estate, division, disease, observation and case come from the quarantine record. */
export interface QuarantineAssignmentInput {
  quarantineId: string
  objective: string
  inspectionFocus: string
  monitoringWindow: string
  /** The Supervisor's explicit authorisation, required to assign it. */
  authorised: boolean
}

/** Quarantine part of a stored assignment. */
export interface QuarantineAssignment {
  quarantineId: string
  caseId: string | null
  observationId: string
  diseaseId: string | null
  diseaseName: string | null
  objective: string
  inspectionFocus: string
  monitoringWindow: string
  authorisedBy: string | null
  authorisedAt: string | null
}

export interface Assignment {
  id: string; title: string; instructions: string | null; estateId: string; divisionId: string; fieldWorkerId: string | null
  createdBy: string; createdAt: string | null; dueDate: string; priority: 'Low' | 'Medium' | 'High'
  status: AssignmentStatus; observationIds: string[]; version: number; activity: string[]
  /** When the Field Worker accepted the task in the mobile app; null until then. */
  acceptedAt: string | null
  /** Older records without a type are inspections (they request observations). */
  type?: AssignmentType
  /** Task category (template) the assignment was created from; null for a custom task or an older record. */
  templateId?: string | null
  requirements?: TaskRequirements | null
  /** Shared by the separate per-worker assignments created together for one task. */
  groupId?: string | null
  /** When the worker's submission was acknowledged (status Done). */
  submittedAt?: string | null
  submission?: TaskSubmission | null
  /** When the Supervisor completed the assignment. Archiving is calculated from this. */
  completedAt?: string | null
  /** Set when listed: when a Completed assignment moved to Assignment History (24 h after completion). */
  archivedAt?: string | null
  /** Set on a Quarantine Assignment: the division quarantine it works under. */
  quarantine?: QuarantineAssignment | null
}
export interface AssignmentInput {
  estateId: string; divisionId: string; fieldWorkerId: string | null; title: string; instructions: string
  priority: Assignment['priority']; dueDate: string; status: 'draft' | 'assigned'
  type?: AssignmentType
  templateId?: string | null
  requirements?: TaskRequirements | null
  /** Makes this a Quarantine Assignment for the named active division quarantine. */
  quarantine?: QuarantineAssignmentInput | null
}

/**
 * One assignment for one or more Field Workers of the same division. Each selected worker gets a
 * separate assignment record (own status, acceptance and submissions); nothing is shared.
 */
export type AssignmentBatchInput = Omit<AssignmentInput, 'fieldWorkerId'> & { fieldWorkerIds: string[] }

export const assignmentType = (a: Pick<Assignment, 'type'>): AssignmentType => a.type ?? 'inspection'
/** Display label of the assignment's type: a Quarantine Assignment is shown as such. */
export const assignmentTypeLabel = (a: Pick<Assignment, 'type' | 'quarantine'>): string => (a.quarantine ? 'Quarantine Assignment' : ASSIGNMENT_TYPE[assignmentType(a)])

/**
 * Edit of a Draft. `status` is the status after saving: the draft stays a draft or is assigned.
 * `reason` is kept for the activity history (optional for drafts).
 */
export type AssignmentEdit = AssignmentInput & { reason: string }
/** ASG-10–15 explicitly define these records as summaries (no lifecycle journey or evidence). */
export const isAssignmentSummary = (id: string) => /^ASG-00[2-7]$/.test(id)

/** The Field Worker has accepted the task: explicitly in the mobile app, or by starting work. */
export const isAcceptedByWorker = (a: Pick<Assignment, 'status' | 'acceptedAt'>) =>
  a.acceptedAt !== null || ['in_progress', 'submitted', 'completed'].includes(a.status)

/** Assigned and In progress assignments occupy the Field Worker; Done does not. */
export const ACTIVE_STATUSES: readonly AssignmentStatus[] = ['assigned', 'in_progress']

/** The worker's current active assignment, if any (a worker can hold only one). */
export function activeAssignmentOf<T extends Pick<Assignment, 'id' | 'status' | 'fieldWorkerId'>>(assignments: readonly T[], workerId: string | null, exceptId?: string): T | undefined {
  if (!workerId) return undefined
  return assignments.find((a) => a.fieldWorkerId === workerId && a.id !== exceptId && ACTIVE_STATUSES.includes(a.status))
}

export const busyMessage = (workerName: string, active: Pick<Assignment, 'id' | 'status' | 'title'>) =>
  `${workerName} already has an active assignment (${active.id} · ${ASSIGNMENT_STATUS[active.status]} · ${active.title}).`

const LOCKED: Record<Exclude<AssignmentStatus, 'draft' | 'assigned'>, string> = {
  in_progress: 'This assignment can no longer be modified because the Field Worker has started the fieldwork.',
  submitted: 'This assignment can no longer be modified because the Field Worker has submitted it.',
  completed: 'This assignment can no longer be modified because it is completed.',
  cancelled: 'This assignment can no longer be modified because it has been cancelled.',
  reassigned: 'This assignment can no longer be modified because it has been reassigned.',
}

/** Why the assignment cannot be edited, or null. Only a Draft is editable. */
export function editLock(a: Pick<Assignment, 'status' | 'acceptedAt' | 'observationIds'>): string | null {
  if (a.status === 'draft') return null
  if (a.status === 'assigned') return 'Only a Draft assignment can be edited.'
  return LOCKED[a.status]
}

/** Why the assignment cannot be cancelled, or null: a Draft, or Assigned and not yet accepted by the Field Worker. */
export function cancelLock(a: Pick<Assignment, 'status' | 'acceptedAt' | 'observationIds'>): string | null {
  if (a.status === 'draft') return null
  if (a.status === 'assigned') {
    if (isAcceptedByWorker(a)) return 'This assignment can no longer be modified because the Field Worker has accepted it.'
    if (a.observationIds.length) return 'This assignment can no longer be modified because evidence has been submitted for it.'
    return null
  }
  return LOCKED[a.status]
}
/** Kept for callers that ask whether an assignment is still changeable at all. */
export const assignmentLock = cancelLock
export const canEditAssignment = (a: Pick<Assignment, 'status' | 'acceptedAt' | 'observationIds'>) => editLock(a) === null
export const canCancelAssignment = (a: Pick<Assignment, 'status' | 'acceptedAt' | 'observationIds'>) => cancelLock(a) === null

/** Simulated mobile-app acceptance: any Assigned task the Field Worker has not yet accepted. */
export const canSimulateWorkerAcceptance = (a: Assignment) => a.status === 'assigned' && a.fieldWorkerId !== null && !isAcceptedByWorker(a)

/**
 * The two external-mobile simulations: the Field Worker starts the work, then submits it.
 * Approved summary records (ASG-002–ASG-007) have no lifecycle journey. Unknown actions are refused.
 */
export function simulationTransition(assignment: Assignment, action: string): 'in_progress' | 'submitted' | null {
  if (isAssignmentSummary(assignment.id) || !assignment.fieldWorkerId) return null
  if (action === 'start' && assignment.status === 'assigned') return 'in_progress'
  if (action === 'submit' && assignment.status === 'in_progress') return 'submitted'
  return null
}

/** Observation review outcomes that finish the review an Inspection needs before completion. */
export const FINAL_REVIEW_STATUSES = ['verified', 'flagged'] as const

/**
 * Why a Done assignment cannot be completed yet, or null. A Task needs the worker's submission;
 * an Inspection needs its observation(s), each with a final review outcome (not pending, not
 * waiting for correction, not referred to an expert).
 */
export function completionBlock(a: Pick<Assignment, 'status' | 'type' | 'submission' | 'observationIds'>, reviewStatusOf: (observationId: string) => string | undefined): string | null {
  if (a.status !== 'submitted') return 'Only a Done assignment can be completed.'
  if (assignmentType(a) === 'task') return a.submission ? null : 'No task submission has been received.'
  if (a.observationIds.length === 0) return 'No observation has been submitted for this inspection.'
  const pending = a.observationIds.filter((id) => !(FINAL_REVIEW_STATUSES as readonly string[]).includes(reviewStatusOf(id) ?? ''))
  return pending.length ? `Finish the observation review of ${pending.join(', ')} before completing this inspection.` : null
}

const DAY_MS = 86_400_000
/** A Completed assignment stays in the active list for 24 hours after `completedAt`, then moves to history. */
export function assignmentArchivedAt(a: Pick<Assignment, 'status' | 'completedAt'>, nowIso: string): string | null {
  if (a.status !== 'completed' || !a.completedAt) return null
  const archive = new Date(a.completedAt).getTime() + DAY_MS
  return new Date(nowIso).getTime() >= archive ? new Date(archive).toISOString() : null
}

/** Structural form requirements only; no invented date window or length limits. */
export function assignmentErrors(input: AssignmentInput): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!['draft', 'assigned'].includes(input.status)) errors.status = 'Only draft or assigned tasks can be created'
  if (input.type && !['inspection', 'task'].includes(input.type)) errors.type = 'Choose Inspection or Task'
  if (!input.estateId) errors.estateId = 'Select an estate'
  if (!input.divisionId) errors.divisionId = 'Select a division'
  if (!input.title.trim()) errors.title = 'Enter a title'
  if (!input.instructions.trim()) errors.instructions = 'Enter instructions'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) || Number.isNaN(Date.parse(input.dueDate)) || new Date(input.dueDate).toISOString().slice(0, 10) !== input.dueDate) errors.dueDate = 'Enter a valid due date'
  if (!['Low', 'Medium', 'High'].includes(input.priority)) errors.priority = 'Select a priority'
  if (input.status === 'assigned' && !input.fieldWorkerId) errors.fieldWorkerId = 'Select an eligible Field Worker'
  if (input.requirements) Object.assign(errors, requirementErrors(input.requirements))
  if (input.quarantine) Object.assign(errors, quarantineAssignmentErrors(input.quarantine, input.status))
  return errors
}

/** Quarantine Assignment fields: objective, inspection focus and monitoring window are required; assigning needs the Supervisor's authorisation. */
export function quarantineAssignmentErrors(input: QuarantineAssignmentInput, status: 'draft' | 'assigned'): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!input.quarantineId.trim()) errors.quarantineId = 'A Quarantine ID is required'
  if (!input.objective.trim()) errors.objective = 'Enter the assignment objective'
  if (!input.inspectionFocus.trim()) errors.inspectionFocus = 'Enter the inspection focus'
  if (!input.monitoringWindow.trim()) errors.monitoringWindow = 'Enter the monitoring window'
  if (status === 'assigned' && !input.authorised) errors.authorised = 'Authorise this Quarantine Assignment to assign it'
  return errors
}

export function batchErrors(input: AssignmentBatchInput): Record<string, string> {
  const errors = assignmentErrors({ ...input, fieldWorkerId: input.fieldWorkerIds[0] ?? null })
  delete errors.fieldWorkerId
  if (input.status === 'assigned' && input.fieldWorkerIds.length === 0) errors.fieldWorkerIds = 'Select at least one Field Worker'
  if (new Set(input.fieldWorkerIds).size !== input.fieldWorkerIds.length) errors.fieldWorkerIds = 'A Field Worker is selected more than once'
  return errors
}
