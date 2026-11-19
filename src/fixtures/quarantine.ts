import type { FixtureDatabase, FixtureDivisionQuarantine, FixtureReviewDecision } from './records'

/** The active quarantine of a division, if any. A division has at most one. */
export function activeQuarantineOf(db: Readonly<FixtureDatabase>, divisionId: string): FixtureDivisionQuarantine | undefined {
  return (db.divisionQuarantines ?? []).find((item) => item.divisionId === divisionId && (item.status ?? 'active') === 'active')
}

/** Division operational status derived from the quarantine records (the persisted source). */
export function syncDivisionStatus(db: FixtureDatabase): void {
  for (const division of db.divisions) division.operationalStatus = activeQuarantineOf(db, division.id) ? 'restricted' : 'normal'
}

const nextNumber = (ids: string[], prefix: string) => Math.max(0, ...ids.filter((id) => id.startsWith(prefix)).map((id) => Number(id.slice(prefix.length)) || 0)) + 1

/** Appends an entry to the quarantine record's history. */
export function logQuarantineEvent(quarantine: FixtureDivisionQuarantine, event: string, by: string, at: string, note: string | null = null): void {
  const history = (quarantine.history ??= [])
  history.push({ id: `QEV-${String(history.length + 1).padStart(3, '0')}`, event, at, by, note })
}

/** Records a quarantine action in the existing decision log (type "quarantine"), against the quarantine record and its division. */
export function recordQuarantineDecision(db: FixtureDatabase, quarantine: FixtureDivisionQuarantine, outcome: 'quarantined' | 'quarantine_assignment' | 'quarantine_released', by: string, at: string, note: string): FixtureReviewDecision {
  const decision: FixtureReviewDecision = {
    id: `DEC-${String(nextNumber(db.reviewDecisions.map((item) => item.id), 'DEC-')).padStart(3, '0')}`,
    type: 'quarantine', outcome, recordId: quarantine.id, targetId: quarantine.id, estateId: quarantine.estateId, decidedBy: by, decidedAt: at,
    note, idempotencyKey: null, details: { divisionId: quarantine.divisionId, observationId: quarantine.observationId }, provenance: 'fixture-assigned',
  }
  db.reviewDecisions.push(decision)
  return decision
}
