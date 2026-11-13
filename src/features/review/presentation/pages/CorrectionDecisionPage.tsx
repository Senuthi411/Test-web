import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { newIdempotencyKey } from '@/shared/api'
import { Banner, Button, ButtonLink, Card, Checkbox, EmptyState, PageHeader, SelectField, TextAreaField, useToast } from '@/shared/components'
import { REJECTION_REASONS } from '../../domain/checklist'
import type { Correction } from '../../domain/models'
import { approveErrors, canApproveCorrection, canRejectCorrection, rejectErrors, type FieldErrors } from '../../domain/rules'
import { CorrectionStatusBadge } from '../components/badges'
import { errorText, formatDate, isConflict, reviewPaths } from '../components/format'
import { FieldError, Fields, NextSteps } from '../components/parts'
import { useReviewActions, useReviewWorkspace } from '../services/queries'
import { CorrectionBoundary } from './CorrectionDetailPage'
import styles from '../components/review.module.css'

export type CorrectionDecisionKind = 'approve' | 'reject'

/** REV-10 Approve Correction and REV-11 Reject Correction. */
export function CorrectionDecisionPage({ kind }: { kind: CorrectionDecisionKind }) {
  return (
    <CorrectionBoundary title={kind === 'approve' ? 'Approve Correction' : 'Reject Correction'}>
      {(correction) =>
        (kind === 'approve' ? canApproveCorrection(correction.status) : canRejectCorrection(correction.status)) ? (
          <Form key={`${correction.id}-${correction.version}`} kind={kind} correction={correction} />
        ) : (
          <div className={styles.page}>
            <PageHeader back={{ to: reviewPaths.correction(correction.id), label: 'Back to correction' }} title={kind === 'approve' ? 'Approve Correction' : 'Reject Correction'} subtitle={correction.id} />
            <EmptyState
              title={kind === 'approve' ? 'This correction cannot be approved' : 'This correction cannot be rejected'}
              message={
                <>
                  {correction.id} is <CorrectionStatusBadge status={correction.status} />.{' '}
                  {kind === 'approve' ? 'Only a resubmitted revision can be approved.' : 'Only requested or resubmitted corrections can be rejected.'}
                </>
              }
              icon="info"
              action={
                <ButtonLink variant="secondary" to={reviewPaths.correction(correction.id)}>
                  Back to correction
                </ButtonLink>
              }
            />
          </div>
        )
      }
    </CorrectionBoundary>
  )
}

function Form({ kind, correction: c }: { kind: CorrectionDecisionKind; correction: Correction }) {
  const navigate = useNavigate()
  const toast = useToast()
  const actions = useReviewActions()
  const workspace = useReviewWorkspace()
  const [idempotencyKey] = useState(newIdempotencyKey)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [failure, setFailure] = useState<unknown>(null)
  const [compared, setCompared] = useState(false)
  const [unchanged, setUnchanged] = useState(false)
  const [note, setNote] = useState('')
  const [reason, setReason] = useState<string>(REJECTION_REASONS[0])
  const [message, setMessage] = useState('')
  const [notify, setNotify] = useState(true)
  const o = c.observation
  const back = kind === 'approve' ? reviewPaths.compare(c.id) : reviewPaths.correction(c.id)
  const pending = actions.approve.isPending || actions.reject.isPending

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFailure(null)
    const found = kind === 'approve' ? approveErrors({ comparedRevisions: compared, originalUnchanged: unchanged, note }) : rejectErrors({ reason, message, notifyFieldWorker: notify })
    setErrors(found)
    if (Object.keys(found).length) return
    const meta = { expectedVersion: c.version, idempotencyKey }
    try {
      if (kind === 'approve') {
        await actions.approve.mutateAsync({ id: c.id, input: { comparedRevisions: compared, originalUnchanged: unchanged, note }, meta })
        toast.show({ tone: 'success', title: `${c.id} approved`, message: 'Approved, not applied. The review stays Correction requested until RevisionApplied.' })
      } else {
        await actions.reject.mutateAsync({ id: c.id, input: { reason, message, notifyFieldWorker: notify }, meta })
        toast.show({ tone: 'success', title: `${c.id} rejected`, message: 'The original observation and evidence are unchanged.' })
      }
      navigate(reviewPaths.correction(c.id))
    } catch (error) {
      setFailure(error)
    }
  }

  return (
    <form className={styles.page} onSubmit={submit} noValidate aria-label={kind === 'approve' ? 'Approve correction' : 'Reject correction'}>
      <PageHeader
        back={{ to: back, label: kind === 'approve' ? 'Back to comparison' : 'Back to correction' }}
        title={kind === 'approve' ? 'Approve Correction' : 'Reject Correction'}
        subtitle={kind === 'approve' ? `${c.id} · ${o.id} · revision ${c.requestedRevision}${c.revision ? ` (${c.revision.id})` : ''}` : `${c.id} · ${o.id} · ${o.division.name} (${o.division.id})`}
        actions={
          <>
            <ButtonLink variant="secondary" to={back}>
              Cancel
            </ButtonLink>
            <Button type="submit" variant={kind === 'approve' ? 'primary' : 'destructive'} icon={kind === 'approve' ? 'check' : 'x'} loading={pending}>
              {kind === 'approve' ? 'Confirm approval' : 'Confirm rejection'}
            </Button>
          </>
        }
      />
      {failure ? (
        isConflict(failure) ? (
          <Banner
            tone="warning"
            title="This correction changed"
            action={
              <Button variant="secondary" icon="refresh" onClick={() => void workspace.refetch()}>
                Refresh correction
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
      ) : null}
      <div className={styles.decisionGrid}>
        {kind === 'approve' ? (
          <Card title="What happens next">
            <NextSteps
              label="What happens next"
              steps={[
                { title: 'Approved', detail: 'You confirm this decision' },
                { title: 'Revision application', detail: `System applies revision ${c.requestedRevision}` },
                { title: 'RevisionApplied event', detail: 'Correction status becomes Applied' },
                { title: 'Review returns to in_review', detail: 'Only after RevisionApplied' },
              ]}
            />
            <div className={styles.evidenceMeta}>
              <Banner tone="warning">
                Approval is not application. After you approve, the correction is marked Approved and the review stays in correction_requested until RevisionApplied is received.
              </Banner>
            </div>
          </Card>
        ) : (
          <Card title="Correction summary">
            <Fields
              items={[
                { label: 'Correction', value: c.id },
                { label: 'Observation', value: o.id },
                { label: 'Requested', value: formatDate(c.requestedAt) },
                { label: 'Status', value: <CorrectionStatusBadge status={c.status} /> },
              ]}
            />
            <h3 className={styles.subheading}>Reason</h3>
            <p className={styles.reason}>{c.message}</p>
            <p className={styles.caption}>Rejecting leaves the original observation and evidence unchanged.</p>
          </Card>
        )}
        <div className={styles.stack}>
          <Card title={kind === 'approve' ? 'Approval' : 'Rejection'}>
            {kind === 'approve' ? (
              <div className={styles.form}>
                <fieldset className={styles.fieldset} aria-describedby={errors.confirmations ? 'confirm-error' : undefined}>
                  <legend>Confirm before approving</legend>
                  <Checkbox label="I compared the original and revised data" checked={compared} onChange={(event) => setCompared(event.target.checked)} />
                  <Checkbox label="Original evidence is unchanged" checked={unchanged} onChange={(event) => setUnchanged(event.target.checked)} />
                  <FieldError id="confirm-error" message={errors.confirmations} />
                </fieldset>
                <TextAreaField label="Approval note (optional)" placeholder="Add a note for the decision history" rows={4} value={note} onChange={(event) => setNote(event.target.value)} />
              </div>
            ) : (
              <div className={styles.form}>
                <SelectField label="Reason" required options={REJECTION_REASONS.map((value) => ({ value, label: value }))} value={reason} onChange={(event) => setReason(event.target.value)} error={errors.reason} />
                <TextAreaField label="Message to field worker" required placeholder="Explain what is still missing" rows={4} value={message} onChange={(event) => setMessage(event.target.value)} error={errors.message} />
                <Checkbox label={`Notify field worker (${o.fieldWorker.fullName})`} checked={notify} onChange={(event) => setNotify(event.target.checked)} />
              </div>
            )}
          </Card>
          <p className={styles.resulting}>
            Correction status becomes: {kind === 'approve' ? <><CorrectionStatusBadge status="approved" /> (not Applied)</> : <CorrectionStatusBadge status="rejected" />}
          </p>
        </div>
      </div>
    </form>
  )
}
