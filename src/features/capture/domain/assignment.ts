export type AssignmentStatus = 'draft' | 'assigned' | 'in_progress' | 'submitted' | 'completed' | 'cancelled' | 'reassigned'
export const ASSIGNMENT_STATUS: Record<AssignmentStatus, string> = { draft: 'Draft', assigned: 'Assigned', in_progress: 'In progress', submitted: 'Submitted', completed: 'Completed', cancelled: 'Cancelled', reassigned: 'Reassigned' }
export interface Assignment {
  id: string; title: string; instructions: string | null; estateId: string; divisionId: string; fieldWorkerId: string | null
  createdBy: string; createdAt: string | null; dueDate: string; priority: 'Low' | 'Medium' | 'High'
  status: AssignmentStatus; observationIds: string[]; version: number; activity: string[]
}
export interface AssignmentInput {
  estateId: string; divisionId: string; fieldWorkerId: string | null; title: string; instructions: string
  priority: Assignment['priority']; dueDate: string; status: 'draft' | 'assigned'
}

export type AssignmentEdit = Omit<AssignmentInput, 'status'> & { reason: string }
/** ASG-10–15 explicitly define these records as read-only summaries. */
export const isAssignmentSummary = (id: string) => /^ASG-00[2-7]$/.test(id)
export const canEditAssignment = (a: Assignment) => !isAssignmentSummary(a.id) && a.status === 'assigned' && a.observationIds.length === 0

/** Only the two external-mobile simulations established by ASG-03–ASG-05.
 * Unknown actions must never be treated as submission. */
export function simulationTransition(assignment: Assignment, action: string): 'in_progress' | 'submitted' | null {
  if (isAssignmentSummary(assignment.id)) return null
  if (assignment.divisionId !== 'DIV-005' || assignment.fieldWorkerId !== 'USR-009') return null
  if (action === 'start' && assignment.status === 'assigned') return 'in_progress'
  if (action === 'submit' && assignment.status === 'in_progress') return 'submitted'
  return null
}

/** Structural form requirements only; no invented date window or length limits. */
export function assignmentErrors(input: AssignmentInput): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!['draft', 'assigned'].includes(input.status)) errors.status = 'Only draft or assigned tasks can be created'
  if (!input.estateId) errors.estateId = 'Select an estate'
  if (!input.divisionId) errors.divisionId = 'Select a division'
  if (!input.title.trim()) errors.title = 'Enter a title'
  if (!input.instructions.trim()) errors.instructions = 'Enter instructions'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) || Number.isNaN(Date.parse(input.dueDate)) || new Date(input.dueDate).toISOString().slice(0, 10) !== input.dueDate) errors.dueDate = 'Enter a valid due date'
  if (!['Low', 'Medium', 'High'].includes(input.priority)) errors.priority = 'Select a priority'
  if (input.status === 'assigned' && !input.fieldWorkerId) errors.fieldWorkerId = 'Select an eligible Field Worker'
  return errors
}
