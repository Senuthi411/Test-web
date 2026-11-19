import type { FixtureAssignment, FixtureCaptureEvidence, FixtureImageSource, FixtureObservationRevision } from '../records'

/**
 * No licensed tea-leaf photographs are available to the project, so both evidence records
 * use the synthetic leaf illustration from the approved designs (CAP-W01 / REV-03).
 */
const SYNTHETIC_LEAF: FixtureImageSource = {
  kind: 'synthetic_illustration',
  attribution: 'Synthetic leaf illustration from the approved TeaLeaf designs; not a photograph',
  license: null,
  sourceUrl: null,
}

/** Approved CAP-W01–07 OBS-005 and local CAP-W01/03 OBS-014 PDF variants. */
export const captureEvidence: FixtureCaptureEvidence[] = [{
  observationId: 'OBS-005', imageId: 'IMG-005', assetKey: 'demo/observations/OBS-005/original.jpg',
  mimeType: 'image/jpeg', receivedAt: '2026-10-06T15:05:00+05:30', latitude: 6.980, longitude: 80.635,
  syncReceipt: 'SYNC-005', idempotencyKey: 'demo-OBS-005-v1',
  altText: 'Synthetic tea leaf evidence placeholder for OBS-005', imageSource: SYNTHETIC_LEAF,
  note: 'Synthetic field note for observation OBS-005; not a real diagnosis.',
  revisedNote: 'Updated synthetic symptom description', revisionId: 'OBSR-005-2', revisionSubmittedAt: '2026-10-20T09:00:00+05:30',
}, {
  observationId: 'OBS-014', imageId: 'IMG-014', assetKey: 'demo/observations/OBS-014/original.jpg',
  mimeType: 'image/jpeg', receivedAt: '2026-10-15T16:05:00+05:30', latitude: 7.106, longitude: 80.734,
  altText: 'Synthetic tea leaf evidence placeholder for OBS-014', imageSource: SYNTHETIC_LEAF,
  // The PDF specifies one original. No receipt identifier, notes or revision 2 is provided.
}]

/**
 * OBS-005 revisions (CAP-W06/CAP-W07, REV-09): the original submission and OBSR-005-2, the
 * Field Worker's answer to COR-005. Only the notes changed; the original image is reused.
 */
export const observationRevisions: FixtureObservationRevision[] = [{
  id: 'OBSR-005-1', observationId: 'OBS-005', number: 1, submittedAt: '2026-10-06T15:05:00+05:30', submittedBy: 'USR-009', correctionId: null,
  values: { divisionId: 'DIV-005', suspectedDiseaseId: 'DIS-001', latitude: 6.98, longitude: 80.635, gpsAccuracyM: 10, imageId: 'IMG-005', symptoms: ['Raised blister-like patches', 'Yellowing or chlorosis'], note: 'Synthetic field note for observation OBS-005; not a real diagnosis.' },
  provenance: 'figma',
}, {
  id: 'OBSR-005-2', observationId: 'OBS-005', number: 2, submittedAt: '2026-10-20T09:00:00+05:30', submittedBy: 'USR-009', correctionId: 'COR-005',
  values: { divisionId: 'DIV-005', suspectedDiseaseId: 'DIS-001', latitude: 6.98, longitude: 80.635, gpsAccuracyM: 10, imageId: 'IMG-005', symptoms: ['Raised blister-like patches', 'Yellowing or chlorosis'], note: 'Updated synthetic symptom description' },
  provenance: 'figma',
}]

export const assignmentInstructions = 'Inspect the reported leaf discolouration in East Hills block C. Photograph affected leaves from three angles and submit one observation per distinct area. Record location at division level only.'

/** ASG-01 visible rows. Summary records deliberately contain no invented histories. */
export const assignments: FixtureAssignment[] = [
  ['ASG-001', 'Inspect East Hills block C for suspected blight', 'DIV-005', 'USR-009', 'High', '2026-10-16', 'submitted', ['OBS-014']],
  ['ASG-002', 'Re-photograph flagged West Terrace area', 'DIV-006', 'USR-010', 'High', '2026-10-24', 'assigned', []],
  ['ASG-003', 'Survey East Hills terrace 3', 'DIV-005', 'USR-009', 'Medium', '2026-10-25', 'in_progress', []],
  ['ASG-004', 'Walk Riverbank lower boundary', 'DIV-004', null, 'Low', '2026-10-30', 'draft', []],
  ['ASG-005', 'Follow-up photos for flagged OBS-024', 'DIV-006', 'USR-010', 'Medium', '2026-10-14', 'completed', ['OBS-024']],
  ['ASG-006', 'Survey Riverbank block A', 'DIV-004', 'USR-009', 'Medium', '2026-10-20', 'reassigned', []],
  ['ASG-007', 'Boundary check West Terrace', 'DIV-006', 'USR-010', 'Low', '2026-10-22', 'cancelled', []],
].map((row) => {
  const [id, title, divisionId, fieldWorkerId, priority, dueDate, status, observationIds] = row as [string, string, string, string | null, FixtureAssignment['priority'], string, FixtureAssignment['status'], string[]]
  // Acceptance is recorded only where the design shows the worker starting the task (ASG-001: 15 Oct 13:40).
  // All approved records request observations (inspections). ASG-001 is Done (OBS-014 received);
  // ASG-005 was completed on 14 Oct, so it is already in Assignment History on 21 Oct.
  return { id, title, divisionId, fieldWorkerId, priority, dueDate, status, observationIds, estateId: 'EST-002', createdBy: 'USR-003', version: 1,
    type: 'inspection' as const,
    submittedAt: id === 'ASG-001' ? '2026-10-15T16:05:00+05:30' : null,
    completedAt: id === 'ASG-005' ? '2026-10-14T17:00:00+05:30' : null,
    acceptedAt: id === 'ASG-001' ? '2026-10-15T13:40:00+05:30' : null,
    instructions: id === 'ASG-001' ? assignmentInstructions : null, createdAt: id === 'ASG-001' ? '2026-10-12' : null,
    activity: id === 'ASG-001' ? ['12 Oct 2026 · Assigned to Hiruni Nadeesha (USR-009)', '15 Oct 2026 13:40 · Task started in mobile app (simulated)', '15 Oct 2026 16:05 · OBS-014 received from mobile app (simulated)'] : [],
  }
})
