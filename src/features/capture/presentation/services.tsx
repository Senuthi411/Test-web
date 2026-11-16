import { createContext, useContext } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CaptureReadPort } from '../application/ports'
import type { AssignmentBatchInput, AssignmentInput, AssignmentEdit } from '../domain/assignment'

export const CaptureContext = createContext<CaptureReadPort | null>(null)
export function useCapture() {
  const service = useContext(CaptureContext)
  if (!service) throw new Error('Capture services are unavailable')
  return service
}
export function useWorkspace() {
  const service = useCapture()
  return useQuery({ queryKey: ['capture', 'workspace'], queryFn: ({ signal }) => service.getWorkspace(signal) })
}
export function useObservation(id: string) {
  const service = useCapture()
  return useQuery({ queryKey: ['capture', 'observation', id], queryFn: ({ signal }) => service.getObservation(id, signal) })
}
export function useAssignmentActions() {
  const service = useCapture()
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: ['capture'] })
  return {
    create: useMutation({ mutationFn: (input: AssignmentInput) => service.createAssignment(input), onSuccess: refresh }),
    createForWorkers: useMutation({ mutationFn: (input: AssignmentBatchInput) => service.createAssignments(input), onSuccess: refresh }),
    // A rejected edit or cancel (e.g. the worker accepted meanwhile) also refreshes, so the screen shows the latest status.
    edit: useMutation({ mutationFn: (input: { id: string; values: AssignmentEdit; version: number }) => service.editAssignment(input.id, input.values, input.version), onSuccess: refresh, onError: refresh }),
    cancel: useMutation({ mutationFn: (input: { id: string; reason: string; version: number }) => service.cancelAssignment(input.id, input.reason, input.version), onSuccess: refresh, onError: refresh }),
    submit: useMutation({ mutationFn: (input: { id: string; version: number }) => service.submitAssignment(input.id, input.version), onSuccess: refresh, onError: refresh }),
    // Completing an assignment refreshes Review too: the queue shows the same observations.
    accept: useMutation({ mutationFn: (input: { id: string; version: number }) => service.acceptAssignment(input.id, input.version), onSuccess: () => client.invalidateQueries() }),
    // A simulated inspection submission adds an observation to the Review Queue, so all data refreshes.
    simulate: useMutation({ mutationFn: (input: { id: string; action: 'accept' | 'start' | 'submit'; version: number }) => service.simulateAssignment(input.id, input.action, input.version), onSuccess: () => client.invalidateQueries() }),
    reset: useMutation({ mutationFn: () => service.resetAssignments(), onSuccess: refresh }),
  }
}
