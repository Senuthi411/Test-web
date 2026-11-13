import type { CaptureObservation } from '../domain/observation'
import type { Assignment, AssignmentInput, AssignmentEdit } from '../domain/assignment'

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
  editAssignment(id: string, input: AssignmentEdit, expectedVersion: number): Promise<Assignment>
  cancelAssignment(id: string, reason: string, expectedVersion: number): Promise<Assignment>
  acceptAssignment(id: string, expectedVersion: number): Promise<Assignment>
  simulateAssignment(id: string, action: 'start' | 'submit', expectedVersion: number): Promise<Assignment>
  resetAssignments(): Promise<void>
}
