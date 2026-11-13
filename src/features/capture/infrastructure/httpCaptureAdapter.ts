import { contractPending, type HttpClient } from '@/shared/api'
import type { CaptureReadPort } from '../application/ports'

export function createHttpCaptureAdapter(http: HttpClient): CaptureReadPort {
  void http
  return {
    async getWorkspace() { return contractPending('capture.workspace.get') },
    async createAssignment() { return contractPending('capture.assignments.create') },
    async editAssignment() { return contractPending('capture.assignments.edit') },
    async cancelAssignment() { return contractPending('capture.assignments.cancel') },
    async acceptAssignment() { return contractPending('capture.assignments.accept') },
    async simulateAssignment() { return contractPending('capture.assignments.simulation.fixtureOnly') },
    async resetAssignments() { return contractPending('capture.assignments.reset.fixtureOnly') },
    async getObservation() {
      return contractPending('capture.observations.get')
    },
  }
}
