import { z } from 'zod'
import { persistFixtureSlice, type FixtureAssignment, type FixtureDatabase, type FixtureStore } from '@/fixtures'
import { SIMULATED_DEVICE_PREFIX } from './fixtureCaptureAdapter'
import { ASSIGNMENT_STATUS } from '../domain/assignment'

// Format 2 adds the observations simulated as mobile submissions of Inspection assignments.
const FORMAT_VERSION = 2

interface AssignmentSlice {
  format: typeof FORMAT_VERSION
  assignments: FixtureAssignment[]
  submitted: {
    observations: FixtureDatabase['observations']
    evidence: FixtureDatabase['captureEvidence']
    details: FixtureDatabase['reviewObservationDetails']
  }
}

const assignmentSchema = z.object({
  id: z.string(),
  title: z.string(),
  estateId: z.string(),
  divisionId: z.string(),
  fieldWorkerId: z.string().nullable(),
  createdBy: z.string(),
  status: z.enum(Object.keys(ASSIGNMENT_STATUS) as [string, ...string[]]),
  observationIds: z.array(z.string()),
  version: z.number(),
  activity: z.array(z.string()),
  acceptedAt: z.string().nullable(),
}).passthrough()
const assignmentSliceSchema = z.object({
  format: z.literal(FORMAT_VERSION),
  assignments: z.array(assignmentSchema),
  submitted: z.object({
    observations: z.array(z.object({ id: z.string(), deviceObservationId: z.string(), divisionId: z.string(), fieldWorkerId: z.string() }).passthrough()),
    evidence: z.array(z.object({ observationId: z.string() }).passthrough()),
    details: z.array(z.object({ observationId: z.string() }).passthrough()),
  }),
}) as unknown as z.ZodType<AssignmentSlice>

const simulated = (db: Readonly<FixtureDatabase>) => new Set(db.observations.filter((item) => item.deviceObservationId.startsWith(SIMULATED_DEVICE_PREFIX)).map((item) => item.id))

/**
 * Keeps fixture Fieldwork Assignments (including edits, cancellations and simulated worker
 * acceptance, with their activity history) in this tab's sessionStorage, so they survive a
 * browser refresh. "Restore demo state" resets them as before.
 */
export function persistFixtureCaptureState(store: FixtureStore, storage: Storage | null): void {
  persistFixtureSlice<AssignmentSlice>(store, storage, {
    key: 'tealeaf.fixtures.assignments',
    schema: assignmentSliceSchema,
    select: (db) => {
      const ids = simulated(db)
      return {
        format: FORMAT_VERSION,
        assignments: db.assignments,
        submitted: {
          observations: db.observations.filter((item) => ids.has(item.id)),
          evidence: db.captureEvidence.filter((item) => ids.has(item.observationId)),
          details: db.reviewObservationDetails.filter((item) => ids.has(item.observationId)),
        },
      }
    },
    consistent: (db, saved) => saved.submitted.observations.every((item) => item.deviceObservationId.startsWith(SIMULATED_DEVICE_PREFIX) && db.divisions.some((division) => division.id === item.divisionId) && !db.observations.some((existing) => existing.id === item.id)) && saved.assignments.every((item) => {
      const division = db.divisions.find((row) => row.id === item.divisionId)
      return division?.estateId === item.estateId &&
        db.users.some((user) => user.id === item.createdBy) &&
        (item.fieldWorkerId === null || db.users.some((user) => user.id === item.fieldWorkerId)) &&
        item.observationIds.every((id) => db.observations.some((observation) => observation.id === id) || saved.submitted.observations.some((observation) => observation.id === id))
    }),
    restore: (db, saved) => {
      db.observations.push(...saved.submitted.observations)
      db.captureEvidence.push(...saved.submitted.evidence)
      db.reviewObservationDetails.push(...saved.submitted.details)
      db.assignments = saved.assignments
    },
  })
}
