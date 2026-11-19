/**
 * One submitted revision of a logical observation. Revisions are never changed: a
 * correction adds a new revision (OBSR-005-2) to the same Observation ID and the earlier
 * revisions stay available for reference.
 */
export interface ObservationRevision {
  id: string
  observationId: string
  number: number
  submittedAt: string
  submittedBy: { id: string; fullName: string }
  /** The correction request this revision answers; null for the original submission. */
  correctionId: string | null
  estate: string
  division: string
  gps: string
  suspectedDisease: string
  symptoms: string[]
  note: string | null
  photo: { imageId: string; altText: string } | null
}

export interface RevisionDifference {
  field: string
  before: string
  after: string
  changed: boolean
}

const symptomsText = (symptoms: string[]) => (symptoms.length ? symptoms.join(', ') : 'Not specified')

/** Field-by-field comparison of two revisions, in the order the review screens list them. */
export function revisionDifferences(before: ObservationRevision, after: ObservationRevision): RevisionDifference[] {
  const rows: Array<[string, string, string]> = [
    ['Tea estate', before.estate, after.estate],
    ['Division', before.division, after.division],
    ['GPS location', before.gps, after.gps],
    ['Suspected disease', before.suspectedDisease, after.suspectedDisease],
    ['Symptoms', symptomsText(before.symptoms), symptomsText(after.symptoms)],
    ['Photograph', before.photo?.imageId ?? 'Not specified', after.photo?.imageId ?? 'Not specified'],
    ['Field notes', before.note ?? 'Not provided', after.note ?? 'Not provided'],
  ]
  return rows.map(([field, a, b]) => ({ field, before: a, after: b, changed: a !== b }))
}

/** "Notes updated", "Photograph and field notes updated", or "No field changes". */
export function changeSummary(before: ObservationRevision | undefined, after: ObservationRevision): string {
  if (!before) return 'Original submission'
  const changed = revisionDifferences(before, after).filter((row) => row.changed).map((row) => row.field.toLowerCase())
  if (changed.length === 0) return 'No field changes'
  const text = changed.length === 1 ? changed[0] : `${changed.slice(0, -1).join(', ')} and ${changed[changed.length - 1]}`
  return `${text[0].toUpperCase()}${text.slice(1)} updated`
}
