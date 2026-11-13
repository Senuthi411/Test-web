import { AppError } from '@/shared/api'
import type { CaptureReadPort } from './ports'
import { assignmentErrors } from '../domain/assignment'

export function createCaptureUseCases(port: CaptureReadPort): CaptureReadPort {
  return {
    ...port,
    createAssignment(input) {
      const errors = assignmentErrors(input)
      const details = Object.entries(errors).map(([path, message]) => ({ path, message }))
      if (details.length) return Promise.reject(new AppError('validation', details[0].message, { details }))
      return port.createAssignment({ ...input, title: input.title.trim(), instructions: input.instructions.trim() })
    },
    getObservation(observationId, signal) {
      if (!observationId.trim()) {
        return Promise.reject(new AppError('validation', 'An observation ID is required.'))
      }
      return port.getObservation(observationId.trim(), signal)
    },
  }
}
