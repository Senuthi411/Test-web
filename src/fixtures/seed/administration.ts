/**
 * Administrative records: audit events, expert-confirmed cases and the ID-02 attention list.
 * Source: ID-02 Administrator Dashboard (14:8), ID-10 estate variants (197:2541, 16:865,
 * 197:3158), ID-12 division variants (197:509 … 197:2287).
 */
import type { FixtureAuditEvent, FixtureCase } from '../records'

/** ID-02 "Recent administrative activity", newest first. */
export const auditEvents: FixtureAuditEvent[] = [
  { id: 'AUD-004', at: '2026-10-20T09:40:00+05:30', kind: 'scope_updated', actorId: 'USR-001', userId: 'USR-005', scope: ['EST-001', 'EST-002'], estateIds: ['EST-001', 'EST-002'], provenance: 'figma' },
  { id: 'AUD-003', at: '2026-10-20T08:15:00+05:30', kind: 'device_session_revoked', actorId: 'USR-001', userId: 'USR-011', sessionId: 'DS-3012', reasonCode: 'DEVICE_SESSION_REVOKED', estateIds: ['EST-003'], provenance: 'figma' },
  { id: 'AUD-002', at: '2026-10-19T16:02:00+05:30', kind: 'division_reviewed', actorId: 'USR-001', divisionId: 'DIV-009', status: 'active', estateIds: ['EST-003'], provenance: 'figma' },
  { id: 'AUD-001', at: '2026-10-18T11:30:00+05:30', kind: 'user_invited', actorId: 'USR-001', userId: 'USR-013', estateIds: ['EST-001', 'EST-002'], provenance: 'figma' },
]

/**
 * Expert-confirmed cases counted on ID-10 and listed on ID-12: CASE-030 (Lower Slope),
 * CASE-006 and CASE-042 (West Terrace), CASE-018 (Forest Edge). Each case number matches
 * its referred observation.
 */
export const cases: FixtureCase[] = [
  { id: 'CASE-006', observationId: 'OBS-006', status: 'confirmed', provenance: 'figma' },
  { id: 'CASE-018', observationId: 'OBS-018', status: 'confirmed', provenance: 'figma' },
  { id: 'CASE-030', observationId: 'OBS-030', status: 'confirmed', provenance: 'figma' },
  { id: 'CASE-042', observationId: 'OBS-042', status: 'confirmed', provenance: 'figma' },
]

/** ID-02 "Users requiring attention", in the order shown. */
export const dashboardAttentionUserIds = ['USR-007', 'USR-011', 'USR-006', 'USR-004']
