import { useState } from 'react'
import { RevisionComparison } from '@/features/capture'
import { Badge, Banner, Button, Checkbox, Modal, TextAreaField, useToast } from '@/shared/components'
import type { ObservationReview, ReviewRevision, RevisionRequest } from '../../domain/models'
import { resubmissionErrors } from '../../domain/rules'
import { CorrectionStatusBadge, OutcomeBadge } from './badges'
import { errorText, formatDate, formatDateTime, reviewPaths } from './format'
import { IdLink } from './parts'
import { useReviewActions } from '../services/queries'
import styles from './review.module.css'

/** The correction request that the revision answers (requested on the revision before it). */
function RequestPanel({ request }: { request: RevisionRequest }) {
  return (
    <section className={styles.revisionRequest} aria-label={`Correction request ${request.correctionId}`}>
      <div className={styles.revisionRequestHeader}>
        <strong>
          Correction requested on version {request.onRevision} · <IdLink to={reviewPaths.correction(request.correctionId)}>{request.correctionId}</IdLink>
        </strong>
        <CorrectionStatusBadge status={request.status} />
      </div>
      <p className={styles.caption}>
        {request.requestedBy} · {formatDate(request.requestedAt)} · asked for: {request.items.join(', ')}
      </p>
      <p className={styles.note}>“{request.message}”</p>
    </section>
  )
}

/**
 * REV-03 revision comparison for a corrected observation: previous revision on the left,
 * latest on the right, the correction request between them and the full revision history
 * with the review decisions recorded on each revision.
 */
export function ReviewRevisionComparison({ review, initialNumber }: { review: ObservationReview; initialNumber?: number }) {
  const revisions = review.revisions
  const current = revisions[revisions.length - 1]
  const statusOf = (revision: ReviewRevision | { number: number }) => {
    const row = revisions.find((item) => item.number === revision.number)
    return row ? <Badge tone={row.number === current.number ? 'teal' : 'neutral'}>{row.statusLabel}</Badge> : null
  }
  return (
    <RevisionComparison
      // A newly resubmitted revision restarts the comparison on latest-vs-previous.
      key={current.id}
      revisions={revisions}
      currentNumber={current.number}
      initialNumber={initialNumber}
      statusOf={statusOf}
      requestFor={(revision) => {
        const request = review.requests.find((item) => item.requestedRevision === revision.number)
        return request ? <RequestPanel request={request} /> : null
      }}
      historyColumns={[
        {
          id: 'decisions',
          header: 'Decisions on this revision',
          cell: (revision) => {
            const row = revisions.find((item) => item.number === revision.number)
            if (!row || row.decisions.length === 0) return '—'
            return (
              <span className={styles.chipsInline}>
                {row.decisions.map((decision) => (
                  <span key={decision.id} title={`${decision.id} · ${decision.decidedBy} · ${formatDateTime(decision.decidedAt)}`}>
                    <OutcomeBadge outcome={decision.outcome} />
                  </span>
                ))}
              </span>
            )
          },
        },
      ]}
    />
  )
}

/**
 * Fixture-only stand-in for the Capture mobile app: the Field Worker corrects and resubmits.
 * The new revision is stored and the observation becomes Resubmitted only after the write succeeds.
 */
export function SimulateResubmission({ request, currentNote, observationId }: { request: RevisionRequest; currentNote: string | null; observationId: string }) {
  const actions = useReviewActions()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [retakePhoto, setRetakePhoto] = useState(true)
  const [noteError, setNoteError] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const pending = actions.resubmit.isPending
  const start = () => {
    setNote(currentNote ? `${currentNote} (corrected)` : 'Corrected field note')
    setRetakePhoto(request.items.includes('Retake a clearer image'))
    setNoteError(null)
    setFailure(null)
    setOpen(true)
  }
  const submit = () => {
    const errors = resubmissionErrors({ note, retakePhoto })
    if (errors.note) return setNoteError(errors.note)
    actions.resubmit.mutate(
      { id: request.correctionId, input: { note, retakePhoto }, version: request.version },
      {
        onSuccess: (correction) => {
          setOpen(false)
          toast.show({ tone: 'success', title: `${observationId} resubmitted`, message: `Version ${correction.revision?.number ?? request.requestedRevision} (${correction.revision?.id ?? 'new revision'}) is waiting for review.` })
        },
        onError: (error) => setFailure(errorText(error)),
      },
    )
  }
  return (
    <>
      <Button variant="secondary" icon="refresh" fullWidth onClick={start}>
        Simulate: Field Worker resubmits correction
      </Button>
      <Modal
        open={open}
        title={`Simulate resubmission of ${observationId}`}
        description={`Demonstration only. In production the Field Worker corrects the observation in the Capture mobile app. This stores version ${request.requestedRevision}; earlier revisions are kept unchanged.`}
        dismissible={!pending}
        onClose={() => setOpen(false)}
        size="medium"
        footer={
          <>
            <Button variant="secondary" disabled={pending} onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button loading={pending} onClick={submit}>
              Resubmit version {request.requestedRevision}
            </Button>
          </>
        }
      >
        <TextAreaField label="Corrected field note" value={note} error={noteError ?? undefined} onChange={(event) => setNote(event.target.value)} />
        <Checkbox label="Attach a retaken photograph" description="The previous photograph stays with the earlier revision." checked={retakePhoto} onChange={(event) => setRetakePhoto(event.target.checked)} />
        {failure && <Banner tone="error">{failure} Nothing was resubmitted.</Banner>}
      </Modal>
    </>
  )
}
