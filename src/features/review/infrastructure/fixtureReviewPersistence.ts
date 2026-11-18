import { z } from 'zod'
import { persistFixtureSlice, syncDivisionStatus, type FixtureDatabase, type FixtureStore } from '@/fixtures'
import { REVIEW_STATUSES } from '../domain/models'

// Format 2 adds observation revisions; a format 1 slice is discarded and the seed is used.
const FORMAT_VERSION = 2

type ReviewSlice = Pick<FixtureDatabase, 'reviewRecords' | 'reviewDecisions' | 'corrections' | 'referrals' | 'reviewFollowUpObservationIds' | 'observationRevisions' | 'divisionQuarantines'> & {
  format: typeof FORMAT_VERSION
  /** Review status of every observation, by observation ID. */
  statuses: Record<string, FixtureDatabase['observations'][number]['reviewStatus']>
}

// Records are validated on their identifying fields; anything that does not match the
// current seed (unknown observation, wrong shape, older format) discards the whole slice.
const recordSchema = z.object({ id: z.string(), observationId: z.string() }).passthrough()
const reviewSliceSchema = z.object({
  format: z.literal(FORMAT_VERSION),
  statuses: z.record(z.string(), z.enum(REVIEW_STATUSES as [string, ...string[]])),
  reviewRecords: z.array(recordSchema.extend({ version: z.number() })),
  reviewDecisions: z.array(z.object({ id: z.string(), targetId: z.string() }).passthrough()),
  corrections: z.array(recordSchema),
  referrals: z.array(recordSchema),
  reviewFollowUpObservationIds: z.array(z.string()),
  observationRevisions: z.array(recordSchema.extend({ number: z.number() })),
  divisionQuarantines: z.array(recordSchema).optional(),
}) as unknown as z.ZodType<ReviewSlice>

/**
 * Keeps fixture Review state (review statuses, review records, decisions, corrections,
 * referrals, follow-ups and submitted observation revisions) in this tab's sessionStorage, so review decisions survive a
 * browser refresh like the signed-in session does. Restoring the demo state resets it too.
 */
export function persistFixtureReviewState(store: FixtureStore, storage: Storage | null): void {
  persistFixtureSlice<ReviewSlice>(store, storage, {
    key: 'tealeaf.fixtures.review',
    schema: reviewSliceSchema,
    select: (db) => ({
      format: FORMAT_VERSION,
      statuses: Object.fromEntries(db.observations.map((item) => [item.id, item.reviewStatus])),
      reviewRecords: db.reviewRecords,
      reviewDecisions: db.reviewDecisions,
      corrections: db.corrections,
      referrals: db.referrals,
      reviewFollowUpObservationIds: db.reviewFollowUpObservationIds,
      observationRevisions: db.observationRevisions,
      divisionQuarantines: db.divisionQuarantines ?? [],
    }),
    consistent: (db, saved) => {
      const known = new Set(db.observations.map((item) => item.id))
      return Object.keys(saved.statuses).every((id) => known.has(id)) &&
        [...saved.reviewRecords, ...saved.corrections, ...saved.referrals, ...saved.observationRevisions].every((item) => known.has(item.observationId))
    },
    restore: (db, saved) => {
      for (const observation of db.observations) {
        const status = saved.statuses[observation.id]
        if (status) observation.reviewStatus = status
      }
      db.reviewRecords = saved.reviewRecords
      db.reviewDecisions = saved.reviewDecisions
      db.corrections = saved.corrections
      db.referrals = saved.referrals
      db.reviewFollowUpObservationIds = saved.reviewFollowUpObservationIds
      db.observationRevisions = saved.observationRevisions
      db.divisionQuarantines = saved.divisionQuarantines ?? []
      // Restricted Operations is a property of the division record; it comes back with the quarantine records.
      syncDivisionStatus(db)
    },
  })
}
