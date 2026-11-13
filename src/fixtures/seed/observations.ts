/**
 * The 48 synthetic observations (OBS-001 … OBS-048).
 *
 * The approved designs follow fixed patterns, which these rules reproduce:
 * - Division: OBS-n belongs to DIV-(((n − 1) mod 9) + 1). This gives 6 observations per
 *   Highland division and 5 per Riverbend and Mist Valley division, matching ID-09/ID-11.
 * - Suspected disease: cycles Blister → Grey → Brown → Algal by ((n − 1) mod 4),
 *   reproducing the AN-01 split for EST-001+EST-002 (8 / 9 / 8 / 8 of 33).
 * - Capture day: (n mod 19) + 1 October 2026 (REV-02 "Captured" column).
 * - Field worker: the worker holding that division's scope (ID-03 / ID-11).
 * - GPS accuracy: 5 + (n mod 18) metres, reproducing every "GPS ACCURACY" value on the
 *   ID-12 division variants (e.g. OBS-001 6 m, OBS-018 5 m, OBS-042 11 m).
 *
 * Review statuses for EST-001 and EST-002 are copied from REV-02 (Malini and Nimal
 * variants) and reconcile with AN-02/AN-03 totals. Mist Valley (EST-003) statuses are not
 * shown in any frame; they are fixture-assigned so ID-11's pending counts (4 / 1 / 2) hold
 * and OBS-018 is referred, as its expert-confirmed case CASE-018 (ID-12 Forest Edge) requires.
 */
import type { FixtureObservation, FixtureProvenance, FixtureReviewStatus } from '../records'

const DISEASE_CYCLE = ['DIS-001', 'DIS-002', 'DIS-003', 'DIS-004'] as const

const FIELD_WORKER_BY_DIVISION: Record<string, string> = {
  'DIV-001': 'USR-007',
  'DIV-002': 'USR-007',
  'DIV-003': 'USR-008',
  'DIV-004': 'USR-009',
  'DIV-005': 'USR-009',
  'DIV-006': 'USR-010',
  'DIV-007': 'USR-011',
  'DIV-008': 'USR-011',
  'DIV-009': 'USR-012',
}

const S: FixtureReviewStatus = 'submitted'
const R: FixtureReviewStatus = 'in_review'
const F: FixtureReviewStatus = 'flagged'
const C: FixtureReviewStatus = 'correction_requested'
const X: FixtureReviewStatus = 'referred'
const V: FixtureReviewStatus = 'verified'

/** Index 0 = OBS-001. */
const REVIEW_STATUS: readonly FixtureReviewStatus[] = [
  S, R, V, F, C, X, S, S, S, // 001–009
  S, X, F, S, R, V, S, V, X, // 010–018
  S, V, R, S, X, F, R, V, V, // 019–027
  F, R, X, S, V, R, S, C, V, // 028–036
  S, R, V, F, C, X, V, V, R, // 037–045
  S, X, F, //                   046–048
]

/** Known capture times (OBS-005: CAP-W01, OBS-014: ASG-05, OBS-023: CASE-04). */
const CAPTURE_TIME_OVERRIDES: Record<number, string> = {
  5: '13:15',
  14: '14:15',
  23: '09:12',
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0')
}

function captureTime(n: number): string {
  const override = CAPTURE_TIME_OVERRIDES[n]
  if (override) return override
  return `${pad(7 + (n % 9), 2)}:${pad((n * 13) % 60, 2)}`
}

function provenanceFor(divisionIndex: number): FixtureProvenance {
  return divisionIndex < 6 ? 'figma' : 'fixture-assigned'
}

export const observations: FixtureObservation[] = REVIEW_STATUS.map((reviewStatus, index) => {
  const n = index + 1
  const divisionIndex = (n - 1) % 9
  const divisionId = `DIV-${pad(divisionIndex + 1, 3)}`
  const day = (n % 19) + 1
  return {
    id: `OBS-${pad(n, 3)}`,
    deviceObservationId: `DEVOBS-${pad(n, 4)}`,
    divisionId,
    fieldWorkerId: FIELD_WORKER_BY_DIVISION[divisionId] ?? '',
    capturedAt: `2026-10-${pad(day, 2)}T${captureTime(n)}:00+05:30`,
    suspectedDiseaseId: DISEASE_CYCLE[(n - 1) % 4] ?? 'DIS-001',
    reviewStatus,
    catalogVersion: 2,
    syncStatus: 'synced',
    gpsAccuracyM: 5 + (n % 18),
    provenance: provenanceFor(divisionIndex),
  }
})
