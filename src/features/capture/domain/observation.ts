/** Only fields already present in the shared fixture records. Evidence, coordinates
 * and revisions must not be inferred from GPS accuracy or review status. */
export interface CaptureObservation {
  id: string
  deviceObservationId: string
  capturedAt: string
  estate: { id: string; name: string; region: string }
  division: { id: string; name: string }
  fieldWorker: { id: string; fullName: string }
  suspectedDisease: { id: string; name: string }
  reviewStatus: 'submitted' | 'in_review' | 'flagged' | 'correction_requested' | 'referred' | 'verified'
  catalogVersion: number
  syncStatus: 'synced'
  gpsAccuracyM: number
  evidence?: CaptureEvidence
}

export interface CaptureEvidence {
  observationId: string; imageId: string; assetKey: string; mimeType: string; receivedAt: string
  latitude: number; longitude: number; syncReceipt?: string; idempotencyKey?: string; altText: string
  imageSource: { kind: 'synthetic_illustration' | 'licensed_photo'; attribution: string; license: string | null; sourceUrl: string | null }
  note?: string; revisedNote?: string; revisionId?: string; revisionSubmittedAt?: string
}
