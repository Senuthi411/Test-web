import { z } from 'zod'
import { persistFixtureSlice, type FixtureDatabase, type FixtureStore } from '@/fixtures'

const FORMAT_VERSION = 1

type CasesSlice = Pick<FixtureDatabase, 'referrals' | 'cases' | 'diseases'> & {
  format: typeof FORMAT_VERSION
}

const recordSchema = z.object({ id: z.string() }).passthrough()
const casesSliceSchema = z.object({
  format: z.literal(FORMAT_VERSION),
  referrals: z.array(recordSchema.extend({ observationId: z.string() })),
  cases: z.array(recordSchema.extend({ observationId: z.string() })),
  diseases: z.array(recordSchema.extend({ name: z.string(), catalogVersion: z.number() })),
}) as unknown as z.ZodType<CasesSlice>

/**
 * Keeps fixture Cases & Disease Catalog changes in sessionStorage so recorded diagnoses
 * and published catalog updates survive a browser refresh during demo sessions.
 */
export function persistFixtureCasesState(store: FixtureStore, storage: Storage | null): void {
  persistFixtureSlice<CasesSlice>(store, storage, {
    key: 'tealeaf.fixtures.cases',
    schema: casesSliceSchema,
    select: (db) => ({
      format: FORMAT_VERSION,
      referrals: db.referrals,
      cases: db.cases,
      diseases: db.diseases,
    }),
    consistent: (db, saved) => {
      const knownObs = new Set(db.observations.map((item) => item.id))
      return (
        saved.referrals.every((item) => knownObs.has(item.observationId)) &&
        saved.cases.every((item) => knownObs.has(item.observationId))
      )
    },
    restore: (db, saved) => {
      db.referrals = saved.referrals
      db.cases = saved.cases
      db.diseases = saved.diseases
    },
  })
}
