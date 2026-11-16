import type { FixtureDatabase, FixtureObservationRevision } from './records'

type ReadDb = Readonly<FixtureDatabase>

/** "OBSR-005-2" for OBS-005 revision 2 (the existing revision identifier format, CAP-W06). */
export const revisionIdOf = (observationId: string, number: number) => `${observationId.replace('OBS-', 'OBSR-')}-${number}`

/**
 * Revision 1 of an observation that has never been corrected, built from the observation's
 * own capture record, evidence and review details. Those records are never changed, so this
 * is the same original submission every time it is read.
 */
function originalRevision(db: ReadDb, observationId: string): FixtureObservationRevision | null {
  const observation = db.observations.find((item) => item.id === observationId)
  if (!observation) return null
  const evidence = db.captureEvidence.find((item) => item.observationId === observationId)
  const detail = db.reviewObservationDetails.find((item) => item.observationId === observationId)
  return {
    id: revisionIdOf(observationId, 1),
    observationId,
    number: 1,
    submittedAt: evidence?.receivedAt ?? observation.capturedAt,
    submittedBy: observation.fieldWorkerId,
    correctionId: null,
    values: {
      divisionId: observation.divisionId,
      suspectedDiseaseId: observation.suspectedDiseaseId,
      latitude: evidence?.latitude ?? null,
      longitude: evidence?.longitude ?? null,
      gpsAccuracyM: observation.gpsAccuracyM,
      imageId: evidence?.imageId ?? null,
      symptoms: [...(detail?.symptoms ?? [])],
      note: detail?.fieldNote ?? evidence?.note ?? null,
    },
    provenance: 'derived',
  }
}

/** Every submitted revision of an observation, oldest first. There is always at least revision 1. */
export function revisionsOf(db: ReadDb, observationId: string): FixtureObservationRevision[] {
  const stored = db.observationRevisions.filter((item) => item.observationId === observationId).sort((a, b) => a.number - b.number)
  if (stored[0]?.number === 1) return stored
  const original = originalRevision(db, observationId)
  return original ? [original, ...stored] : stored
}

/** The newest submitted revision: the one a Supervisor reviews and decides on. */
export function latestRevisionOf(db: ReadDb, observationId: string): FixtureObservationRevision {
  const revisions = revisionsOf(db, observationId)
  const latest = revisions[revisions.length - 1]
  if (!latest) throw new Error(`Observation ${observationId} has no revisions`)
  return latest
}

/** A revision as screens show it (names resolved). Structurally the Capture `ObservationRevision`. */
export interface ProjectedRevision {
  id: string
  observationId: string
  number: number
  submittedAt: string
  submittedBy: { id: string; fullName: string }
  correctionId: string | null
  estate: string
  division: string
  gps: string
  suspectedDisease: string
  symptoms: string[]
  note: string | null
  photo: { imageId: string; altText: string } | null
}

export function projectRevision(db: ReadDb, revision: FixtureObservationRevision): ProjectedRevision {
  const v = revision.values
  const division = db.divisions.find((item) => item.id === v.divisionId)
  const estate = db.estates.find((item) => item.id === division?.estateId)
  const disease = db.diseases.find((item) => item.id === v.suspectedDiseaseId)
  const worker = db.users.find((item) => item.id === revision.submittedBy)
  return {
    id: revision.id,
    observationId: revision.observationId,
    number: revision.number,
    submittedAt: revision.submittedAt,
    submittedBy: { id: revision.submittedBy, fullName: worker?.fullName ?? revision.submittedBy },
    correctionId: revision.correctionId,
    estate: estate ? `${estate.name} (${estate.id})` : 'Not specified',
    division: division ? `${division.name} (${division.id})` : v.divisionId,
    gps: v.latitude !== null && v.longitude !== null ? `${v.latitude.toFixed(3)}, ${v.longitude.toFixed(3)} · ±${v.gpsAccuracyM} m` : `Coordinates not provided · ±${v.gpsAccuracyM} m`,
    suspectedDisease: disease ? `${disease.name} (${disease.id})` : v.suspectedDiseaseId,
    symptoms: [...v.symptoms],
    note: v.note,
    photo: v.imageId ? { imageId: v.imageId, altText: `Synthetic tea leaf evidence placeholder for ${revision.observationId}, revision ${revision.number}` } : null,
  }
}
