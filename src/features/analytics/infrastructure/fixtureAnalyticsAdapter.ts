import { FIXTURE_REFERENCE_DATE, type FixtureReviewStatus, type FixtureStore } from '@/fixtures'
import { AppError } from '@/shared/api'
import type { AnalyticsPort } from '../application/ports'
import {
  DISEASE_IDS,
  DISEASES,
  type AnalyticsSnapshot,
  type DatasetFreshness,
  type Disease,
  type Observation,
  type RefreshSchedule,
  type ReviewStatus,
} from '../domain/models'

export interface FixtureAnalyticsOptions {
  actorId: () => string | null
}

/**
 * Explicit mapping from the shared fixture review statuses to the AN screen labels.
 * `Record<FixtureReviewStatus, …>` makes TypeScript fail if a status is added to the
 * shared store without an analytics mapping. The explicit resubmitted key also supports
 * the latest team contract while this working copy still uses the older shared union.
 */
export const STATUS_MAP: Readonly<Record<FixtureReviewStatus | 'resubmitted', ReviewStatus>> = {
  submitted: 'Submitted',
  resubmitted: 'Resubmitted',
  in_review: 'In review',
  verified: 'Verified',
  flagged: 'Flagged',
  correction_requested: 'Correction requested',
  referred: 'Referred',
}

const DISEASE_BY_ID: ReadonlyMap<string, Disease> = new Map(DISEASES.map((name) => [DISEASE_IDS[name], name]))

/**
 * AN-09 freshness metadata (Figma values). The shared fixture store has no analytics
 * pipeline records, so this fixture-only metadata lives with the analytics fixture adapter.
 */
export const FIXTURE_DATASETS: readonly DatasetFreshness[] = [
  { name: 'Observation statistics', updatedAt: '2026-10-21T10:00:00+05:30', frequency: 'Daily', delayed: false },
  { name: 'Review decisions', updatedAt: '2026-10-21T10:00:00+05:30', frequency: 'Daily', delayed: false },
  { name: 'Disease distribution', updatedAt: '2026-10-21T10:00:00+05:30', frequency: 'Daily', delayed: false },
  { name: 'Expert diagnoses', updatedAt: '2026-10-19T06:00:00+05:30', frequency: 'Daily', delayed: true },
]
export const FIXTURE_REFRESH_SCHEDULE: RefreshSchedule = { frequency: 'Daily', localTime: '10:00', timezone: 'UTC+05:30' }
export const FIXTURE_CHECKED_AT = '2026-10-21T20:00:00+05:30'

function diseaseName(id: string): Disease {
  const name = DISEASE_BY_ID.get(id)
  if (!name) throw new AppError('contract_mismatch', `Unknown disease ${id} in analytics data.`)
  return name
}

function requireUniqueIds(records: readonly { id: string }[], label: string): void {
  const seen = new Set<string>()
  for (const record of records) {
    if (!record.id || seen.has(record.id)) throw new AppError('contract_mismatch', `Invalid or duplicate ${label} identifier in analytics data.`)
    seen.add(record.id)
  }
}
function requireDate(value: string, label: string): void {
  const date = typeof value === 'string' ? /^(\d{4}-\d{2}-\d{2})(?:T|$)/.exec(value)?.[1] : undefined
  if (!date || !Number.isFinite(Date.parse(value)) || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) {
    throw new AppError('contract_mismatch', `Invalid ${label} date in analytics data.`)
  }
}

/**
 * Fixture Analytics adapter on the shared FixtureStore (read-only). It requires an active
 * Reporting User session and limits every record to that user's stored estate scope.
 * Suspected disease comes from the observation; confirmed disease and date come only from
 * an expert diagnosis on the linked referral, so the two counts stay separate.
 */
export function createFixtureAnalyticsAdapter(store: FixtureStore, options: FixtureAnalyticsOptions): AnalyticsPort {
  return {
    readSnapshot(signal) {
      return store.run(
        () =>
          store.read((db): AnalyticsSnapshot => {
            const actorId = options.actorId()
            if (!actorId) throw new AppError('unauthorized', 'Sign in to view analytics.')
            const actor = db.users.find((user) => user.id === actorId)
            if (!actor || actor.status !== 'active' || actor.role !== 'REPORTING_USER') {
              throw new AppError('forbidden', 'Only Reporting Users can view analytics.')
            }

            const estates = db.estates.filter((estate) => actor.estateIds.includes(estate.id)).map(({ id, name }) => ({ id, name }))
            const divisions = db.divisions
              .filter((division) => actor.estateIds.includes(division.estateId))
              .filter((division) => actor.divisionIds.length === 0 || actor.divisionIds.includes(division.id))
              .map(({ id, name, estateId }) => ({ id, name, estateId }))
            const divisionIds = new Set(divisions.map((division) => division.id))
            const scoped = db.observations.filter((observation) => divisionIds.has(observation.divisionId))
            const observationIds = new Set(scoped.map((observation) => observation.id))
            const referrals = db.referrals.filter((referral) => observationIds.has(referral.observationId))
            const pendingCorrections = new Set(
              db.corrections
                .filter((correction) => correction.status === 'resubmitted' && observationIds.has(correction.observationId))
                .map((correction) => correction.observationId),
            )

            requireUniqueIds(estates, 'estate')
            requireUniqueIds(divisions, 'division')
            requireUniqueIds(scoped, 'observation')
            requireUniqueIds(referrals, 'referral')
            requireUniqueIds(referrals.flatMap((referral) => referral.diagnosis ? [referral.diagnosis] : []), 'diagnosis')

            const observations = scoped.map((observation): Observation => {
              requireDate(observation.capturedAt, 'capture')
              if (!Object.hasOwn(STATUS_MAP, observation.reviewStatus)) throw new AppError('contract_mismatch', 'Unknown review status in analytics data.')
              const referral = referrals.find((item) => item.observationId === observation.id)
              const row: Observation = {
                id: observation.id,
                divisionId: observation.divisionId,
                capturedAt: observation.capturedAt,
                status: STATUS_MAP[observation.reviewStatus],
                suspectedDisease: diseaseName(observation.suspectedDiseaseId),
              }
              if (referral?.diagnosis && referral.caseId) {
                requireDate(referral.diagnosis.at, 'diagnosis')
                row.diagnosis = {
                  id: referral.diagnosis.id,
                  caseId: referral.caseId,
                  disease: diseaseName(referral.diagnosis.diseaseId),
                  confirmedAt: referral.diagnosis.at,
                }
              } else if (referral?.caseStatus === 'awaiting_diagnosis' && referral.caseId) {
                row.awaitingCaseId = referral.caseId
              }
              if (pendingCorrections.has(observation.id)) row.correctionApprovalPending = true
              return row
            })

            const awaitingDiagnosisCases: string[] = []
            for (const referral of referrals) {
              if (referral.caseStatus === 'awaiting_diagnosis' && referral.caseId) awaitingDiagnosisCases.push(referral.caseId)
            }

            return {
              id: `fixture-analytics-${FIXTURE_REFERENCE_DATE.slice(0, 10)}`,
              asOf: FIXTURE_REFERENCE_DATE,
              checkedAt: FIXTURE_CHECKED_AT,
              demo: true,
              estates,
              divisions,
              observations,
              datasets: FIXTURE_DATASETS.map((dataset) => ({ ...dataset })),
              refreshSchedule: { ...FIXTURE_REFRESH_SCHEDULE },
              pendingCorrectionApprovals: pendingCorrections.size,
              awaitingDiagnosisCases,
              unlinkedReferrals: referrals.filter((referral) => referral.linkStatus === 'pending_case_link').map((referral) => referral.id),
            }
          }),
        signal,
      )
    },
  }
}
