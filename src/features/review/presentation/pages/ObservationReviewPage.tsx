import { useState } from 'react'
import { useParams } from 'react-router'
import { EvidenceImage } from '@/features/capture'
import { Badge, Banner, ButtonLink, Card, PageHeader, Timeline, usePageBreadcrumbs } from '@/shared/components'
import type { ObservationReview } from '../../domain/models'
import { canDecide } from '../../domain/rules'
import { QueryBoundary, ReviewStatusBadge } from '../components/badges'
import { formatDate, formatShortDate, reviewPaths } from '../components/format'
import { Fields, IdLink } from '../components/parts'
import { useObservationReview } from '../services/queries'
import styles from '../components/review.module.css'

/** REV-03 Observation Review. */
export function ObservationReviewPage() {
  const { observationId = '' } = useParams()
  usePageBreadcrumbs([{ label: 'Review', to: reviewPaths.dashboard }, { label: 'Review Queue', to: reviewPaths.queue }, { label: observationId }])
  const query = useObservationReview(observationId)
  return (
    <QueryBoundary query={query} label="observation review">
      {(review) => <ReviewView review={review} />}
    </QueryBoundary>
  )
}

function ReviewView({ review }: { review: ObservationReview }) {
  const { observation: o, evidence } = review
  const [hypothesisNotice, setHypothesisNotice] = useState(true)
  const decidable = canDecide(o.reviewStatus)
  return (
    <div className={styles.page}>
      <PageHeader
        back={{ to: reviewPaths.queue, label: 'Back to queue' }}
        title={`Observation Review · ${o.id}`}
        subtitle={`${o.division.name} (${o.division.id}) · captured ${formatDate(o.capturedAt)} · ${review.reviewId} · version ${review.version}`}
        actions={
          <ButtonLink variant="secondary" icon="image" to={reviewPaths.evidence(o.id)}>
            Open evidence viewer
          </ButtonLink>
        }
      />
      <div className={styles.reviewGrid}>
        <Card title="Evidence">
          {evidence ? (
            <>
              <EvidenceImage label={`${evidence.imageId} · original.jpg`} altText={evidence.altText} />
              <div className={styles.chips}>
                <Badge tone="success">Original preserved · immutable</Badge>
              </div>
              <p className={styles.caption}>
                {evidence.imageSource.kind === 'licensed_photo'
                  ? `Demonstration photo, not field evidence · ${evidence.imageSource.attribution}${evidence.imageSource.license ? ` (${evidence.imageSource.license})` : ''}`
                  : `Demonstration image · ${evidence.imageSource.attribution}`}
              </p>
              <div className={styles.evidenceMeta}>
                <Fields
                  items={[
                    { label: 'GPS', value: `${evidence.latitude.toFixed(3)}, ${evidence.longitude.toFixed(3)}` },
                    { label: 'Accuracy', value: `±${o.gpsAccuracyM} m` },
                    { label: 'Received', value: `${formatShortDate(evidence.receivedAt)} · ${evidence.receivedAt.slice(11, 16)}` },
                    { label: 'Mobile sync', value: <Badge tone="info">Synced</Badge> },
                  ]}
                />
              </div>
            </>
          ) : (
            <>
              <div className={styles.unavailable}>
                <p>Evidence image details are not included in the demonstration fixtures for {o.id}. Nothing is shown in their place.</p>
              </div>
              <div className={styles.evidenceMeta}>
                <Fields
                  items={[
                    { label: 'Accuracy', value: `±${o.gpsAccuracyM} m` },
                    { label: 'Mobile sync', value: <Badge tone="info">Synced</Badge> },
                  ]}
                />
              </div>
            </>
          )}
        </Card>

        <div className={styles.stack}>
          <Card title="Observation">
            <Fields
              items={[
                { label: 'Observation', value: o.id },
                { label: 'Field worker', value: o.fieldWorker.fullName },
                { label: 'Division', value: `${o.division.name} (${o.division.id})` },
                { label: 'Catalog version', value: o.catalogVersion },
                { label: 'Suspected disease', value: `${o.suspectedDisease.name} (${o.suspectedDisease.id})` },
                { label: 'Review status', value: <ReviewStatusBadge status={o.reviewStatus} /> },
              ]}
            />
            {review.symptoms.length > 0 && (
              <div className={styles.chips} aria-label="Symptoms">
                {review.symptoms.map((symptom) => (
                  <Badge key={symptom} tone="neutral">
                    {symptom}
                  </Badge>
                ))}
              </div>
            )}
            <p className={styles.note}>{review.fieldNote ? `Field note: ${review.fieldNote}` : 'Field note: not provided in the demonstration fixtures.'}</p>
          </Card>
          <Card title="Review history">
            <Timeline
              label="Review history"
              items={review.history.map((step) => ({
                id: step.id,
                title: step.title,
                state: step.state,
                detail: [step.by, step.at ? (step.id === 'submitted' ? formatDate(step.at) : formatShortDate(step.at)) : null, step.detail].filter(Boolean).join(' · '),
              }))}
            />
          </Card>
        </div>

        <Card title="Decision">
          {hypothesisNotice && (
            <Banner tone="info" onDismiss={() => setHypothesisNotice(false)}>
              Suspected disease is a field hypothesis. Only an expert can confirm a diagnosis.
            </Banner>
          )}
          {decidable ? (
            <>
              <div className={styles.decisionButtons}>
                <ButtonLink icon="check" fullWidth to={reviewPaths.decision(o.id, 'verify')}>
                  Verify observation
                </ButtonLink>
                <ButtonLink variant="destructiveOutline" icon="flag" fullWidth to={reviewPaths.decision(o.id, 'flag')}>
                  Flag observation
                </ButtonLink>
                <ButtonLink variant="secondary" icon="edit" fullWidth to={reviewPaths.decision(o.id, 'request-correction')}>
                  Request correction
                </ButtonLink>
                <ButtonLink variant="secondary" icon="send" fullWidth to={reviewPaths.decision(o.id, 'refer')}>
                  Refer to expert
                </ButtonLink>
              </div>
              <p className={styles.caption}>Review version {review.version}. If another reviewer changes this record you will be asked to refresh before deciding.</p>
            </>
          ) : (
            <DecisionUnavailable review={review} />
          )}
        </Card>
      </div>
    </div>
  )
}

function DecisionUnavailable({ review }: { review: ObservationReview }) {
  const status = review.observation.reviewStatus
  return (
    <div className={styles.decisionButtons}>
      <p className={styles.note}>
        {status === 'submitted'
          ? 'This observation has not been claimed for review. The approved designs do not include a claim action, so decisions are available only for observations that are In review.'
          : 'A decision has already been recorded. This observation is read-only here.'}
      </p>
      {review.correctionId && status === 'correction_requested' && (
        <p className={styles.note}>
          Correction: <IdLink to={reviewPaths.correction(review.correctionId)}>{review.correctionId}</IdLink>
        </p>
      )}
      {review.referralId && (
        <p className={styles.note}>
          Referral: <IdLink to={reviewPaths.referrals}>{review.referralId}</IdLink>
        </p>
      )}
      <ButtonLink variant="secondary" icon="history" fullWidth to={reviewPaths.history}>
        View decision history
      </ButtonLink>
    </div>
  )
}
