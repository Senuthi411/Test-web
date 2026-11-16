import type { CaptureObservation } from '../domain/observation'
import type { Assignment, AssignmentBatchInput, AssignmentInput, AssignmentEdit } from '../domain/assignment'

export interface CaptureWorkspace {
  actor: { id: string; fullName: string }
  estates: Array<{ id: string; name: string }>
  divisions: Array<{ id: string; name: string; estateId: string; status: 'active' | 'inactive' }>
  workers: Array<{ id: string; fullName: string; divisionIds: string[] }>
  observations: CaptureObservation[]
  assignments: Assignment[]
}

/** Data contract inside the frontend; this does not define a backend endpoint. */
export interface CaptureReadPort {
  getObservation(observationId: string, signal?: AbortSignal): Promise<CaptureObservation>
  getWorkspace(signal?: AbortSignal): Promise<CaptureWorkspace>
  createAssignment(input: AssignmentInput): Promise<Assignment>
  /** Creates one assignment per selected Field Worker, all or none, linked by a shared group ID. */
  createAssignments(input: AssignmentBatchInput): Promise<Assignment[]>
  editAssignment(id: string, input: AssignmentEdit, expectedVersion: number): Promise<Assignment>
  cancelAssignment(id: string, reason: string, expectedVersion: number): Promise<Assignment>
  /** Submits a Draft (Draft → Assigned) to its Field Worker. */
  submitAssignment(id: string, expectedVersion: number): Promise<Assignment>
  /** Complete assignment: Done → Completed after the Supervisor reviewed the submission. */
  acceptAssignment(id: string, expectedVersion: number): Promise<Assignment>
  /** Fixture-only stand-ins for mobile-app events: the Field Worker accepting, starting or submitting the task. */
  simulateAssignment(id: string, action: 'accept' | 'start' | 'submit', expectedVersion: number): Promise<Assignment>
  resetAssignments(): Promise<void>
}
