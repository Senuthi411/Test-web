import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { EvidenceImage } from '@/features/capture'
import { newIdempotencyKey } from '@/shared/api'
import {
  Badge,
  Banner,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  EmptyState,
  PageHeader,
  SelectField,
  TextAreaField,
  usePageBreadcrumbs,
  useToast,
} from '@/shared/components'
import { FLAG_CATEGORIES, FLAG_REASONS, VERIFICATION_CHECKLIST } from '../../domain/checklist'
import { CORRECTION_ITEMS, type ObservationReview, type ReviewStatus } from '../../domain/models'
import {
  RESULTING_STATUS,
  canDecide,
  correctionRequestErrors,
  flagErrors,
  referralErrors,
  verifyErrors,
  type FieldErrors,
} from '../../domain/rules'
import { QueryBoundary, ReviewStatusBadge } from '../components/badges'
import { errorText, formatDate, isConflict, reviewPaths } from '../components/format'
import { FieldError, Fields, NextSteps } from '../components/parts'
import { useObservationReview, useReviewActions } from '../services/queries'
import styles from '../components/review.module.css'

export type ObservationDecisionKind = 'verify' | 'flag' | 'request-correction' | 'refer'

const TITLES: Record<ObservationDecisionKind, string> = {
  verify: 'Verify Observation',
  flag: 'Flag Observation',
  'request-correction': 'Request Correction',
  refer: 'Refer to Expert',
}

/** REV-04 Verify, REV-05 Flag, REV-06 Request Correction, REV-12 Refer to Expert. */
export function ObservationDecisionPage({ kind }: { kind: ObservationDecisionKind }) {
  const { observationId = '' } = useParams()
  usePageBreadcrumbs([{ label: 'Review', to: reviewPaths.dashboard }, { label: observationId, to: reviewPaths.observation(observationId) }, { label: TITLES[kind] }])
  const query = useObservationReview(observationId)
  return (
    <QueryBoundary query={query} label={TITLES[kind]}>
      {(review) =>
        canDecide(review.observation.reviewStatus) ? (
          <DecisionForm key={`${review.observation.id}-${review.version}`} kind={kind} review={review} onRefresh={() => void query.refetch()} />
        ) : (
          <div className={styles.page}>
            <PageHeader back={{ to: reviewPaths.observation(review.observation.id), label: 'Back to review' }} title={TITLES[kind]} subtitle={review.observation.id} />
            <EmptyState
              title="No decision can be recorded"
              message={
                <>
                  {review.observation.id} is <ReviewStatusBadge status={review.observation.reviewStatus} />. Decisions are available only for observations that are In review.
                </>
              }
              icon="info"
              action={
                <ButtonLink variant="secondary" to={reviewPaths.observation(review.observation.id)}>
                  Back to review
                </ButtonLink>
              }
            />
          </div>
        )
      }
    </QueryBoundary>
  )
}

function DecisionForm({ kind, review, onRefresh }: { kind: ObservationDecisionKind; review: ObservationReview; onRefresh: () => void }) {
  const o = review.observation
  const navigate = useNavigate()
  const toast = useToast()
  const actions = useReviewActions()
  // One key per form instance: a retried submission can never record a second decision.
  const [idempotencyKey] = useState(newIdempotencyKey)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [failure, setFailure] = useState<unknown>(null)
  const [notice, setNotice] = useState(true)

  const [checklist, setChecklist] = useState<boolean[]>(() => VERIFICATION_CHECKLIST.map(() => false))
  const [note, setNote] = useState('')
  const [reason, setReason] = useState<string>(FLAG_REASONS[0])
  const [category, setCategory] = useState<string>(FLAG_CATEGORIES[0])
  const [explanation, setExplanation] = useState('')
  const [notify, setNotify] = useState(true)
  const [items, setItems] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [expertId, setExpertId] = useState(review.experts.length === 1 ? review.experts[0].id : '')

  const meta = { expectedVersion: review.version, idempotencyKey }
  const pending = actions.verify.isPending || actions.flag.isPending || actions.requestCorrection.isPending || actions.refer.isPending
  const expert = review.experts.find((item) => item.id === expertId)
  const back = reviewPaths.observation(o.id)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFailure(null)
    const found =
      kind === 'verify'
        ? verifyErrors({ checklist, note }, VERIFICATION_CHECKLIST.length)
        : kind === 'flag'
          ? flagErrors({ reason, category, explanation, notifyFieldWorker: notify })
          : kind === 'request-correction'
            ? correctionRequestErrors({ items, message })
            : referralErrors({ expertId, note })
    setErrors(found)
    if (Object.keys(found).length) return
    try {
      if (kind === 'verify') {
        await actions.verify.mutateAsync({ id: o.id, input: { checklist, note }, meta })
        toast.show({ tone: 'success', title: `${o.id} verified`, message: 'The decision was added to the decision history.' })
        navigate(back)
      } else if (kind === 'flag') {
        await actions.flag.mutateAsync({ id: o.id, input: { reason, category, explanation, notifyFieldWorker: notify }, meta })
        toast.show({ tone: 'success', title: `${o.id} flagged`, message: 'The original evidence is unchanged.' })
        navigate(back)
      } else if (kind === 'request-correction') {
        const result = await actions.requestCorrection.mutateAsync({ id: o.id, input: { items, message }, meta })
        toast.show({ tone: 'success', title: `Correction ${result.correction?.id ?? ''} requested`, message: 'Status: requested. The field worker submits the revision.' })
        navigate(result.correction ? reviewPaths.correction(result.correction.id) : back)
      } else {
        const result = await actions.refer.mutateAsync({ id: o.id, input: { expertId, note }, meta })
        navigate(`${reviewPaths.referrals}?sent=${encodeURIComponent(result.referral?.id ?? '')}`)
      }
    } catch (error) {
      setFailure(error)
    }
  }

  const resulting: ReviewStatus =
    kind === 'verify' ? RESULTING_STATUS.verify : kind === 'flag' ? RESULTING_STATUS.flag : kind === 'request-correction' ? RESULTING_STATUS.requestCorrection : RESULTING_STATUS.refer
  const subtitle =
    kind === 'verify'
      ? `${o.id} · ${o.division.name} (${o.division.id})`
      : kind === 'refer'
        ? `${o.id} · ${o.suspectedDisease.name} suspected · ${o.division.name} (${o.division.id})`
        : `${o.id} · ${o.division.name} (${o.division.id}) · ${o.fieldWorker.fullName}`
  const confirmLabel = kind === 'verify' ? 'Confirm verification' : kind === 'flag' ? 'Flag observation' : kind === 'request-correction' ? 'Send correction request' : 'Send referral'

  const failureBanner = failure ? (
    isConflict(failure) ? (
      <Banner
        tone="warning"
        title="This record changed"
        action={
          <Button variant="secondary" icon="refresh" onClick={onRefresh}>
            Refresh record
          </Button>
        }
      >
        {errorText(failure)} No decision was recorded.
      </Banner>
    ) : (
      <Banner tone="error" title="The decision was not recorded">
        {errorText(failure)} Your entries are kept; you can try again.
      </Banner>
    )
  ) : null

  const resultingLine = (
    <p className={styles.resulting}>
      Resulting status: <ReviewStatusBadge status={resulting} />
      {kind === 'refer' && <Badge tone="warning">Pending case link</Badge>}
    </p>
  )

  let summary: ReactNode
  let form: ReactNode
  if (kind === 'verify' || kind === 'flag') {
    summary = (
      <Card title="Evidence summary">
        {review.evidence ? (
          <EvidenceImage label={`${review.evidence.imageId} · original.jpg`} altText={review.evidence.altText} />
        ) : (
          <div className={styles.unavailable}>
            <p>Evidence image details are not included in the demonstration fixtures for {o.id}.</p>
          </div>
        )}
        <div className={styles.evidenceMeta}>
          <Fields
            items={
              kind === 'verify'
                ? [
                    { label: 'Observation', value: o.id },
                    { label: 'Suspected disease', value: o.suspectedDisease.name },
                    { label: 'GPS accuracy', value: `±${o.gpsAccuracyM} m` },
                    { label: 'Review version', value: review.version },
                  ]
                : [
                    { label: 'Observation', value: o.id },
                    { label: 'Captured', value: formatDate(o.capturedAt) },
                    { label: 'Suspected disease', value: o.suspectedDisease.name },
                    { label: 'Current status', value: <ReviewStatusBadge status={o.reviewStatus} /> },
                  ]
            }
          />
          
        </div>
      </Card>
    )
  }

  if (kind === 'verify') {
    form = (
      <Card title="Verification checklist">
        <div className={styles.form}>
          {notice && (
            <Banner tone="info" onDismiss={() => setNotice(false)}>
              Verified means the observation record is accepted. It is not an expert diagnosis.
            </Banner>
          )}
          <fieldset className={styles.fieldset} aria-describedby={errors.checklist ? 'checklist-error' : undefined}>
            <legend>Confirm each item</legend>
            {VERIFICATION_CHECKLIST.map((item, index) => (
              <Checkbox
                key={item.id}
                label={item.label(o.gpsAccuracyM)}
                description={'hint' in item ? item.hint : undefined}
                checked={checklist[index]}
                onChange={(event) => setChecklist((list) => list.map((value, position) => (position === index ? event.target.checked : value)))}
              />
            ))}
            <FieldError id="checklist-error" message={errors.checklist} />
          </fieldset>
          <TextAreaField label="Verification note (optional)" placeholder="Add a short note for the decision history" rows={4} value={note} onChange={(event) => setNote(event.target.value)} />
          {resultingLine}
        </div>
      </Card>
    )
  } else if (kind === 'flag') {
    form = (
      <Card title="Flag details">
        <div className={styles.form}>
          {notice && (
            <Banner tone="info" onDismiss={() => setNotice(false)}>
              Flagging marks a concern for follow up. It does not delete or change the original evidence.
            </Banner>
          )}
          <SelectField label="Reason" required options={FLAG_REASONS.map((value) => ({ value, label: value }))} value={reason} onChange={(event) => setReason(event.target.value)} error={errors.reason} />
          <SelectField label="Concern category" options={FLAG_CATEGORIES.map((value) => ({ value, label: value }))} value={category} onChange={(event) => setCategory(event.target.value)} />
          <Fields items={[{ label: 'Review version', value: review.version }]} />
          <TextAreaField label="Explanation" required placeholder="Explain what needs follow up" rows={4} value={explanation} onChange={(event) => setExplanation(event.target.value)} error={errors.explanation} />
          <Checkbox label={`Notify field worker (${o.fieldWorker.fullName})`} checked={notify} onChange={(event) => setNotify(event.target.checked)} />
          {resultingLine}
        </div>
      </Card>
    )
  } else if (kind === 'request-correction') {
    summary = (
      <Card title="What happens next">
        <NextSteps
          label="What happens next"
          steps={[
            { title: 'Request sent', detail: 'Status: requested' },
            { title: `Field worker submits revision ${review.nextRevisionNumber}`, detail: 'Status: resubmitted' },
            { title: 'You approve or reject', detail: 'Approval is not application' },
            { title: 'RevisionApplied', detail: 'Only then does review return to in_review' },
          ]}
        />
        <div className={styles.evidenceMeta}>
          <Fields
            items={[
              { label: 'Requested revision number', value: review.nextRevisionNumber },
              { label: 'Requested by', value: 'You (recorded on submission)' },
            ]}
          />
        </div>
        <p className={styles.caption}>The original image stays preserved. The field worker submits a new revision; the original is never overwritten.</p>
      </Card>
    )
    form = (
      <Card title="Correction request">
        <div className={styles.form}>
          <fieldset className={styles.fieldset} aria-describedby={errors.items ? 'items-error' : undefined}>
            <legend>What should the field worker correct?</legend>
            {CORRECTION_ITEMS.map((item) => (
              <Checkbox
                key={item}
                label={item}
                checked={items.includes(item)}
                onChange={(event) => setItems((list) => (event.target.checked ? [...list, item] : list.filter((value) => value !== item)))}
              />
            ))}
            <FieldError id="items-error" message={errors.items} />
          </fieldset>
          <TextAreaField
            label="Message to field worker"
            required
            placeholder="Please retake a clearer image and confirm symptom details."
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            error={errors.message}
          />
          {resultingLine}
        </div>
      </Card>
    )
  } else {
    summary = (
      <Card title="After sending">
        <NextSteps
          label="After sending"
          steps={[
            { title: 'Referral sent', detail: 'Status: referred' },
            { title: 'Case created and linked', detail: 'Referral becomes linked' },
            { title: 'Expert diagnosis', detail: 'Confirmed disease recorded' },
          ]}
        />
        <h3 className={styles.subheading}>Evidence shared with the expert</h3>
        <ul className={styles.note}>
          <li>Original image{review.evidence ? ` (${review.evidence.imageId})` : ''}</li>
          <li>GPS provenance and capture metadata</li>
          <li>Field note and suspected disease</li>
        </ul>
        <p className={styles.caption}>Referral creates a case for the expert. If the case link is delayed, the referral shows pending case link until it is reconciled.</p>
      </Card>
    )
    form = (
      <Card title="Referral details">
        <div className={styles.form}>
          {review.experts.length === 0 ? (
            <Banner tone="warning" title="No disease expert covers this estate">
              A referral cannot be sent until an active Disease Expert is assigned to {o.estate.id}.
            </Banner>
          ) : (
            <SelectField
              label="Disease expert"
              required
              placeholder="Select a disease expert"
              options={review.experts.map((item) => ({ value: item.id, label: `${item.fullName} · ${item.estateIds.join(', ')}` }))}
              value={expertId}
              onChange={(event) => setExpertId(event.target.value)}
              error={errors.expertId}
            />
          )}
          {expert && (
            <Fields
              items={[
                { label: 'Selected expert', value: `${expert.fullName} · ${expert.id} · Disease expert` },
                { label: 'Estates in scope', value: expert.estateIds.join(', ') },
                { label: 'Awaiting diagnosis', value: expert.awaitingCaseIds.join(', ') || 'None' },
              ]}
            />
          )}
          <TextAreaField label="Referral note" required placeholder="Describe why expert confirmation is needed" rows={4} value={note} onChange={(event) => setNote(event.target.value)} error={errors.note} />
          {resultingLine}
        </div>
      </Card>
    )
  }

  return (
    <form className={styles.page} onSubmit={submit} noValidate aria-label={TITLES[kind]}>
      <PageHeader
        back={{ to: back, label: 'Back to review' }}
        title={TITLES[kind]}
        subtitle={subtitle}
        actions={
          <>
            <ButtonLink variant="secondary" to={back}>
              Cancel
            </ButtonLink>
            <Button type="submit" variant={kind === 'flag' ? 'destructive' : 'primary'} icon={kind === 'refer' ? 'send' : kind === 'flag' ? 'flag' : 'check'} loading={pending} disabled={kind === 'refer' && review.experts.length === 0}>
              {confirmLabel}
            </Button>
          </>
        }
      />
      {failureBanner}
      <div className={styles.decisionGrid}>
        {summary}
        <div className={styles.stack}>
          {form}
        </div>
      </div>
    </form>
  )
}
