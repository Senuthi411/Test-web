/**
 * Review records (Phase 5). Source: local export of the approved Figma "Review" file
 * (Review.pdf / Review.png, REV-01–REV-17). Rows marked 'figma' are shown verbatim;
 * 'derived' rows are implied by a Figma value (e.g. CASE-011/CASE-047 "Awaiting diagnosis"
 * on REV-12) but not shown row by row; 'fixture-assigned' values keep totals consistent.
 */
import type {
  FixtureCorrection,
  FixtureObservation,
  FixtureQuarantineItem,
  FixtureReferral,
  FixtureReviewDecision,
  FixtureReviewObservationDetail,
  FixtureReviewRecord,
} from '../records'
import { observations } from './observations'

const SUPERVISOR_BY_DIVISION_ESTATE: Record<string, string> = {
  'DIV-001': 'USR-002', 'DIV-002': 'USR-002', 'DIV-003': 'USR-002',
  'DIV-004': 'USR-003', 'DIV-005': 'USR-003', 'DIV-006': 'USR-003',
  'DIV-007': 'USR-004', 'DIV-008': 'USR-004', 'DIV-009': 'USR-004',
}

/** One review record per observation: REV-nnn for OBS-nnn (REV-03 "REV-014 · version 1"). */
export const reviewRecords: FixtureReviewRecord[] = observations.map((observation: FixtureObservation) => {
  const claimed = observation.reviewStatus !== 'submitted'
  return {
    id: observation.id.replace('OBS-', 'REV-'),
    observationId: observation.id,
    version: 1,
    claimedBy: claimed ? SUPERVISOR_BY_DIVISION_ESTATE[observation.divisionId] ?? null : null,
    // REV-03 shows OBS-014 "Claimed for review · Malini Fernando · 15 Oct" (its capture day).
    claimedAt: claimed ? observation.capturedAt.slice(0, 10) : null,
    provenance: observation.id === 'OBS-014' ? 'figma' : 'fixture-assigned',
  }
})

const d = (
  id: string, type: FixtureReviewDecision['type'], outcome: FixtureReviewDecision['outcome'], recordId: string, targetId: string,
  decidedAt: string, note: string | null, decidedBy = 'USR-003', estateId = 'EST-002', provenance: FixtureReviewDecision['provenance'] = 'figma',
): FixtureReviewDecision => ({ id, type, outcome, recordId, targetId, estateId, decidedBy, decidedAt, note, idempotencyKey: null, provenance })

/** REV-17 Decision History (11 rows, Malini Fernando), oldest first; plus two derived EST-001 referrals. */
export const reviewDecisions: FixtureReviewDecision[] = [
  d('DEC-001', 'flag', 'flagged', 'REV-040', 'OBS-040', '2026-10-03', null),
  d('DEC-002', 'correction', 'correction_requested', 'COR-041', 'OBS-041', '2026-10-04', 'Retake clearer image'),
  d('DEC-003', 'referral', 'referred', 'REF-042', 'OBS-042', '2026-10-05', null),
  d('DEC-004', 'referral', 'referred', 'REF-023', 'OBS-023', '2026-10-05', null),
  d('DEC-005', 'flag', 'flagged', 'REV-004', 'OBS-004', '2026-10-05', null),
  d('DEC-006', 'flag', 'flagged', 'REV-024', 'OBS-024', '2026-10-06', null),
  d('DEC-007', 'correction', 'correction_requested', 'COR-005', 'OBS-005', '2026-10-06', 'Retake clearer image'),
  d('DEC-008', 'referral', 'referred', 'REF-006', 'OBS-006', '2026-10-07T13:00:00+05:30', null),
  d('DEC-009', 'verification', 'verified', 'REV-032', 'OBS-032', '2026-10-14', null),
  d('DEC-010', 'verification', 'verified', 'REV-015', 'OBS-015', '2026-10-16', null),
  d('DEC-011', 'quarantine', 'released', 'QDEC-002', 'QUA-002', '2026-10-20T10:00:00+05:30', 'Synthetic supervisor decision'),
  d('DEC-012', 'referral', 'referred', 'REF-047', 'OBS-047', '2026-10-10', null, 'USR-002', 'EST-001', 'derived'),
  d('DEC-013', 'referral', 'referred', 'REF-011', 'OBS-011', '2026-10-12', null, 'USR-002', 'EST-001', 'derived'),
]

const CORRECTION_MESSAGE = 'Please retake a clearer image and confirm symptom details.'

/** REV-07/REV-08: COR-005 (resubmitted, revision OBSR-005-2) and COR-041 (requested). */
export const corrections: FixtureCorrection[] = [
  {
    id: 'COR-005', observationId: 'OBS-005', requestedBy: 'USR-003', requestedAt: '2026-10-06', requestedRevision: 2,
    items: ['Retake a clearer image', 'Confirm symptom details'], message: CORRECTION_MESSAGE, status: 'resubmitted', version: 1,
    revisionId: 'OBSR-005-2', approvedAt: null, approvedBy: null, appliedAt: null, rejection: null, provenance: 'figma',
  },
  {
    id: 'COR-041', observationId: 'OBS-041', requestedBy: 'USR-003', requestedAt: '2026-10-04', requestedRevision: 2,
    items: ['Retake a clearer image', 'Confirm symptom details'], message: CORRECTION_MESSAGE, status: 'requested', version: 1,
    revisionId: null, approvedAt: null, approvedBy: null, appliedAt: null, rejection: null, provenance: 'figma',
  },
]

/** REV-13 referrals (REF-006/023/042) and the CASE-011/CASE-047 awaiting-diagnosis cases on REV-12. */
export const referrals: FixtureReferral[] = [
  {
    id: 'REF-006', observationId: 'OBS-006', expertId: 'USR-005', referredBy: 'USR-003', referredAt: '2026-10-07T13:00:00+05:30', note: null,
    linkStatus: 'linked', caseId: 'CASE-006', caseCreatedAt: '2026-10-07T14:00:00+05:30', caseStatus: 'diagnosed',
    diagnosis: { id: 'DIAG-006', diseaseId: 'DIS-002', at: '2026-10-07T15:00:00+05:30', statement: 'Expert-reviewed demo diagnosis; not machine-generated' },
    provenance: 'figma',
  },
  {
    id: 'REF-023', observationId: 'OBS-023', expertId: 'USR-005', referredBy: 'USR-003', referredAt: '2026-10-05', note: null,
    linkStatus: 'linked', caseId: 'CASE-023', caseCreatedAt: '2026-10-05', caseStatus: 'awaiting_diagnosis', diagnosis: null, provenance: 'figma',
  },
  {
    id: 'REF-042', observationId: 'OBS-042', expertId: 'USR-005', referredBy: 'USR-003', referredAt: '2026-10-05', note: null,
    linkStatus: 'linked', caseId: 'CASE-042', caseCreatedAt: '2026-10-05', caseStatus: 'diagnosed',
    // REV-13 shows Grey blight confirmed; the diagnosis ID and time are not shown.
    diagnosis: { id: 'DIAG-042', diseaseId: 'DIS-002', at: '2026-10-05', statement: 'Expert-reviewed demo diagnosis; not machine-generated' },
    provenance: 'figma',
  },
  {
    id: 'REF-011', observationId: 'OBS-011', expertId: 'USR-005', referredBy: 'USR-002', referredAt: '2026-10-12', note: null,
    linkStatus: 'linked', caseId: 'CASE-011', caseCreatedAt: '2026-10-12', caseStatus: 'awaiting_diagnosis', diagnosis: null, provenance: 'derived',
  },
  {
    id: 'REF-047', observationId: 'OBS-047', expertId: 'USR-005', referredBy: 'USR-002', referredAt: '2026-10-10', note: null,
    linkStatus: 'linked', caseId: 'CASE-047', caseCreatedAt: '2026-10-10', caseStatus: 'awaiting_diagnosis', diagnosis: null, provenance: 'derived',
  },
]

/** REV-14 Quarantine Queue and REV-15 QUA-002 record. */
export const quarantineItems: FixtureQuarantineItem[] = [
  { id: 'QUA-001', deviceObservationId: 'QDEVOBS-001', estateId: 'EST-001', divisionId: 'DIV-001', capturedAt: '2026-10-10', quarantinedAt: '2026-10-10', reason: 'Offline scope proof requires supervisor review', state: 'pending_decision', ingestReceipt: null, decision: null, provenance: 'figma' },
  {
    id: 'QUA-002', deviceObservationId: 'QDEVOBS-002', estateId: 'EST-002', divisionId: 'DIV-004', capturedAt: '2026-10-11T08:00:00+05:30', quarantinedAt: '2026-10-11',
    reason: 'Demo offline scope mismatch', state: 'released_pending_ingest', ingestReceipt: null,
    decision: { id: 'QDEC-002', outcome: 'release', by: 'USR-003', at: '2026-10-20T10:00:00+05:30', reason: 'Synthetic supervisor decision' }, provenance: 'figma',
  },
  { id: 'QUA-003', deviceObservationId: 'QDEVOBS-003', estateId: 'EST-003', divisionId: 'DIV-007', capturedAt: '2026-10-12', quarantinedAt: '2026-10-12', reason: 'Demo offline scope mismatch', state: 'ingest_retry_required', ingestReceipt: null, decision: null, provenance: 'figma' },
  { id: 'QUA-004', deviceObservationId: 'QDEVOBS-004', estateId: 'EST-001', divisionId: 'DIV-001', capturedAt: '2026-10-13', quarantinedAt: '2026-10-13', reason: 'Demo offline scope mismatch', state: 'rejected', ingestReceipt: null, decision: null, provenance: 'figma' },
]

/** REV-03 Observation card for OBS-014. */
export const reviewObservationDetails: FixtureReviewObservationDetail[] = [
  { observationId: 'OBS-014', symptoms: ['Brown necrotic patches', 'Irregular leaf spots'], fieldNote: 'Synthetic field note for observation OBS-014; not a real diagnosis.', provenance: 'figma' },
]

/** REV-01 lists only OBS-024 as "flagged · follow-up needed" (ASG-005 is its follow-up task). */
export const reviewFollowUpObservationIds = ['OBS-024']
