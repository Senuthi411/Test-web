import { useEffect, type ComponentProps } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { EvidenceImage } from '@/features/capture'
import { Badge, Banner, Button, ButtonLink, Card, DataTable, PageHeader, Skeleton, Timeline, usePageBreadcrumbs } from '@/shared/components'
import { REVIEW_STATUS_LABEL, type ObservationReview, type ReviewRevision } from '../../domain/models'
import { allowedDecisions, canStartReview, type ObservationDecision } from '../../domain/rules'
import { OutcomeBadge, QueryBoundary, ReviewStatusBadge } from '../components/badges'
import { errorText, formatDate, formatDateTime, formatShortDate, reviewPaths } from '../components/format'
import { Fields, IdLink } from '../components/parts'
import { ReviewRevisionComparison, SimulateResubmission } from '../components/revisions'
import { useClaimObservation, useObservationReview } from '../services/queries'
import styles from '../components/review.module.css'

type ButtonLinkProps = ComponentProps<typeof ButtonLink>

/** Decision panel buttons, in the REV-03 order; only those the review status allows are shown. */
const DECISION_BUTTONS: Array<{ decision: ObservationDecision; label: string; route: Parameters<typeof reviewPaths.decision>[1]; icon: ButtonLinkProps['icon']; variant?: ButtonLinkProps['variant'] }> = [
  { decision: 'verify', label: 'Verify observation', route: 'verify', icon: 'check' },
  { decision: 'flag', label: 'Flag observation', route: 'flag', icon: 'flag', variant: 'destructiveOutline' },
  { decision: 'requestCorrection', label: 'Request correction', route: 'request-correction', icon: 'edit', variant: 'secondary' },
  { decision: 'refer', label: 'Refer to expert', route: 'refer', icon: 'send', variant: 'secondary' },
]

/** REV-03 Observation Review. */
export function ObservationReviewPage() {
  const { observationId = '' } = useParams()
  usePageBreadcrumbs([{ label: 'Review', to: reviewPaths.dashboard }, { label: 'Review Queue', to: reviewPaths.queue }, { label: observationId }])
  // Keyed so that moving to another observation starts a fresh claim.
  return <ClaimedReview key={observationId} observationId={observationId} />
}

/**
 * Opening an observation never changes its status. Submitted and Resubmitted move to In review
 * only when the Supervisor starts the review: the Start review button, or the queue's Start
 * review action (`?start=1`).
 */
function ClaimedReview({ observationId }: { observationId: string }) {
  const query = useObservationReview(observationId)
  const claim = useClaimObservation()
  const [params] = useSearchParams()
  const status = query.data?.observation.reviewStatus
  const needsClaim = status !== undefined && params.get('start') === '1' && canStartReview(status)
  const { mutate, isIdle } = claim
  useEffect(() => {
    if (needsClaim && isIdle) mutate(observationId)
  }, [needsClaim, isIdle, mutate, observationId])
  if (needsClaim && !claim.isError) {
    return (
      <Card aria-busy="true" aria-label="Claiming observation for review">
        <Skeleton height={260} />
      </Card>
    )
  }
  return (
    <QueryBoundary query={query} label="observation review">
      {(review) => <ReviewView review={review} claimError={claim.isError ? errorText(claim.error) : null} starting={claim.isPending} onStart={() => mutate(observationId)} />}
    </QueryBoundary>
  )
}

function ReviewView({ review, claimError, starting, onStart }: { review: ObservationReview; claimError: string | null; starting: boolean; onStart: () => void }) {
  const { observation: o, evidence } = review
  const decisions = allowedDecisions(o.reviewStatus)
  const buttons = DECISION_BUTTONS.filter((button) => decisions.includes(button.decision))
  // A corrected observation has more than one revision; decisions apply to the latest one.
  const current = review.revisions[review.revisions.length - 1]
  const corrected = review.revisions.length > 1
  const photo = corrected ? current.photo : null
  return (
    <div className={styles.page}>
      <PageHeader
        back={{ to: reviewPaths.queue, label: 'Back to queue' }}
        title={`Observation Review · ${o.id}`}
        subtitle={`${o.division.name} (${o.division.id}) · captured ${formatDate(o.capturedAt)} · ${review.reviewId} · version ${review.version}`}
        actions={
          <>
            {o.archivedAt && <Badge tone="neutral">Observation History · read-only</Badge>}
            <ButtonLink variant="secondary" icon="image" to={reviewPaths.evidence(o.id)}>
              Open evidence viewer
            </ButtonLink>
          </>
        }
      />
      {corrected && (
        <Card
          title="Revision comparison"
          action={
            <Badge tone="teal">
              Reviewing version {current.number} · {current.id}
            </Badge>
          }
        >
          <ReviewRevisionComparison review={review} />
        </Card>
      )}
      <div className={styles.reviewGrid}>
        <Card title={corrected ? `Evidence · version ${current.number}` : 'Evidence'}>
          {corrected && photo ? (
            <>
              <EvidenceImage label={`${photo.imageId} · version ${current.number}`} altText={photo.altText} />
              <div className={styles.chips}>
                <Badge tone="teal">Latest revision · {current.id}</Badge>
                <Badge tone="success">Earlier revisions preserved · immutable</Badge>
              </div>
              <p className={styles.caption}>Demonstration image · synthetic illustration, not field evidence.</p>
            </>
          ) : evidence ? (
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
                { label: 'Source', value: o.assignmentId ? <Link className={styles.idLink} to={`/assignments/${o.assignmentId}`}>Task {o.assignmentId}</Link> : 'Independent observation' },
                { label: 'Submission', value: corrected ? `Resubmission · version ${current.number} (${current.id})` : 'Original submission' },
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
          {claimError && (
            <Banner tone="error" title="This observation could not be claimed for review">
              {claimError}
            </Banner>
          )}
          {review.expertDecision && (
            <div className={styles.expertDecision} aria-label="Expert decision">
              <h3 className={styles.subheading}>Expert decision</h3>
              <Fields
                items={[
                  { label: 'Confirmed disease', value: review.expertDecision.disease },
                  { label: 'Expert', value: review.expertDecision.expert },
                  { label: 'Case', value: review.expertDecision.caseId ?? 'Not linked' },
                  { label: 'Decided', value: formatShortDate(review.expertDecision.decidedAt) },
                ]}
              />
              <p className={styles.note}>{review.expertDecision.statement}</p>
            </div>
          )}
          {canStartReview(o.reviewStatus) ? (
            <div className={styles.decisionButtons}>
              <p className={styles.note}>
                {REVIEW_STATUS_LABEL[o.reviewStatus]}
                {corrected ? ` · version ${current.number}` : ''}
              </p>
              <Button icon="eye" fullWidth loading={starting} onClick={onStart}>
                Start review
              </Button>
            </div>
          ) : buttons.length > 0 ? (
            <>
              <div className={styles.decisionButtons}>
                {buttons.map((button) => (
                  <ButtonLink key={button.decision} variant={button.variant} icon={button.icon} fullWidth to={reviewPaths.decision(o.id, button.route)}>
                    {button.label}
                  </ButtonLink>
                ))}
              </div>
              {corrected && <p className={styles.caption}>Decision applies to version {current.number} ({current.id}).</p>}
            </>
          ) : (
            <DecisionUnavailable review={review} />
          )}
        </Card>
      </div>
      <ObservationDecisions revisions={review.revisions} />
    </div>
  )
}

type DecisionRow = ReviewRevision['decisions'][number] & { revision: ReviewRevision }

/** Every review decision on this observation, newest first, with the revision it was made on and its comment. */
function ObservationDecisions({ revisions }: { revisions: ReviewRevision[] }) {
  const rows: DecisionRow[] = revisions.flatMap((revision) => revision.decisions.map((decision) => ({ ...decision, revision }))).reverse()
  if (rows.length === 0) return null
  return (
    <Card title="Decision history">
      <DataTable<DecisionRow>
        caption="Decisions on this observation"
        rows={rows}
        rowKey={(row) => row.id}
        columns={[
          { id: 'date', header: 'Date', cell: (row) => formatDateTime(row.decidedAt) },
          { id: 'revision', header: 'Revision', cell: (row) => `V${row.revision.number} · ${row.revision.id}` },
          { id: 'decision', header: 'Decision', cell: (row) => <OutcomeBadge outcome={row.outcome} /> },
          { id: 'by', header: 'Decided by', cell: (row) => row.decidedBy },
          { id: 'comment', header: 'Comment', cell: (row) => row.note ?? '—' },
        ]}
      />
    </Card>
  )
}

function DecisionUnavailable({ review }: { review: ObservationReview }) {
  const status = review.observation.reviewStatus
  const waiting = status === 'correction_requested' ? review.requests.find((item) => item.status === 'requested') : undefined
  return (
    <div className={styles.decisionButtons}>
      <p className={styles.note}>
        {status === 'verified' || status === 'flagged'
          ? `Final decision recorded: ${REVIEW_STATUS_LABEL[status]}.`
          : status === 'correction_requested'
            ? 'A correction has been requested. Waiting for the field worker to resubmit.'
            : 'Referred to a disease expert. Waiting for the expert decision.'}
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
      {waiting && <SimulateResubmission request={waiting} currentNote={review.fieldNote} observationId={review.observation.id} />}
      <ButtonLink variant="secondary" icon="history" fullWidth to={reviewPaths.history}>
        View decision history
      </ButtonLink>
    </div>
  )
}
