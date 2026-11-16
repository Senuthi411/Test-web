import { useState, type ReactNode } from 'react'
import { Badge, Button, DataTable, FilterSelect, Modal } from '@/shared/components'
import { changeSummary, revisionDifferences, type ObservationRevision } from '../domain/revision'
import { EvidenceImage } from './EvidenceImage'
import { dateTime } from './helpers'
import styles from './RevisionComparison.module.css'

export interface RevisionComparisonProps {
  /** Every revision of the observation, oldest first (at least two). */
  revisions: ObservationRevision[]
  /** The revision under review (the latest). Marked "Currently reviewing". */
  currentNumber: number
  /** Status shown beside each revision (e.g. the review outcome recorded on it). */
  statusOf?: (revision: ObservationRevision) => ReactNode
  /** Shown above the differences: the correction request that led to the compared revision. */
  requestFor?: (revision: ObservationRevision) => ReactNode
  /** Extra columns for the revision history table (e.g. the decisions made on each revision). */
  historyColumns?: Array<{ id: string; header: string; cell: (revision: ObservationRevision) => ReactNode }>
  /** Label of the revision under review ("Currently reviewing" in Review, "Latest" in Capture). */
  currentLabel?: string
  /** Revision compared with its predecessor first; defaults to the latest. */
  initialNumber?: number
}

/**
 * Previous revision on the left, compared revision on the right, modified fields highlighted.
 * Defaults to the latest revision against the one before it (V1↔V2, V2↔V3); any earlier
 * revision can be selected or inspected from the revision history.
 */
export function RevisionComparison({ revisions, currentNumber, statusOf, requestFor, historyColumns = [], currentLabel = 'Currently reviewing', initialNumber }: RevisionComparisonProps) {
  const latest = revisions[revisions.length - 1]
  const first = initialNumber && initialNumber > 1 && initialNumber <= latest.number ? initialNumber : latest.number
  const [pair, setPair] = useState(() => ({ left: first - 1, right: first }))
  const [enlarged, setEnlarged] = useState<ObservationRevision | null>(null)
  const byNumber = (number: number) => revisions.find((item) => item.number === number) ?? latest
  const left = byNumber(pair.left)
  const right = byNumber(pair.right)
  const rows = revisionDifferences(left, right)
  const changedCount = rows.filter((row) => row.changed).length
  const option = (revision: ObservationRevision) => ({ value: String(revision.number), label: `Version ${revision.number} · ${revision.id}` })
  const chooseRight = (value: string) => {
    const number = Number(value)
    setPair((current) => ({ right: number, left: current.left < number ? current.left : number - 1 }))
  }
  const inspect = (revision: ObservationRevision) => setPair(revision.number === 1 ? { left: 1, right: 2 } : { left: revision.number - 1, right: revision.number })

  const side = (revision: ObservationRevision, position: 'Previous' | 'Compared') => (
    <section className={`${styles.side} ${revision.number === currentNumber ? styles.current : ''}`} aria-label={`${position} revision: version ${revision.number}`}>
      <div className={styles.sideHeader}>
        <h3 className={styles.sideTitle}>Version {revision.number}</h3>
        <div className={styles.badges}>
          {revision.number === currentNumber && <Badge tone="teal">{currentLabel}</Badge>}
          {statusOf?.(revision)}
        </div>
      </div>
      <p className={styles.meta}>
        {revision.id} · submitted {dateTime(revision.submittedAt)} by {revision.submittedBy.fullName}
      </p>
      {revision.photo ? (
        <>
          <EvidenceImage label={`${revision.photo.imageId} · version ${revision.number}`} altText={revision.photo.altText} />
          <div>
            <Button variant="secondary" icon="expand" onClick={() => setEnlarged(revision)}>
              View larger photo
            </Button>
          </div>
        </>
      ) : (
        <div className={styles.noPhoto}>No photograph is specified for version {revision.number} in the demonstration fixtures.</div>
      )}
    </section>
  )

  return (
    <div className={styles.comparison}>
      <div className={styles.selectors}>
        <FilterSelect label="Previous revision" value={String(left.number)} onChange={(value) => setPair((current) => ({ ...current, left: Number(value) }))} options={revisions.filter((item) => item.number < right.number).map(option)} />
        <FilterSelect label="Compared revision" value={String(right.number)} onChange={chooseRight} options={revisions.filter((item) => item.number > 1).map(option)} />
        <Badge tone={changedCount ? 'warning' : 'neutral'}>{changedCount ? `${changedCount} field${changedCount === 1 ? '' : 's'} changed` : 'No field changes'}</Badge>
      </div>
      <div className={styles.pair}>
        {side(left, 'Previous')}
        {side(right, 'Compared')}
      </div>
      {requestFor?.(right)}
      <div className={styles.scroll} role="region" aria-label="Revision differences" tabIndex={0}>
        <table className={styles.table}>
          <caption className="tl-visually-hidden">
            Field differences between version {left.number} and version {right.number}
          </caption>
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Version {left.number}</th>
              <th scope="col">Version {right.number}</th>
              <th scope="col">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.field} className={row.changed ? styles.changed : undefined}>
                <th scope="row">{row.field}</th>
                <td>{row.before}</td>
                <td>{row.after}</td>
                <td>{row.changed ? <Badge tone="warning">Changed</Badge> : <Badge tone="neutral">No change</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className={styles.sectionTitle}>Revision history</h3>
      <DataTable<ObservationRevision>
        caption="Revision history"
        rows={[...revisions].reverse()}
        rowKey={(row) => row.id}
        columns={[
          { id: 'version', header: 'Version', cell: (row) => `Version ${row.number}` },
          { id: 'id', header: 'Revision ID', cell: (row) => row.id },
          { id: 'submitted', header: 'Submitted', cell: (row) => dateTime(row.submittedAt) },
          { id: 'changes', header: 'Changes', cell: (row) => changeSummary(revisions.find((item) => item.number === row.number - 1), row) },
          { id: 'status', header: 'Status', cell: (row) => <span className={styles.badges}>{row.number === currentNumber && <Badge tone="teal">{currentLabel}</Badge>}{statusOf?.(row)}</span> },
          ...historyColumns,
          {
            id: 'inspect',
            header: 'Compare',
            cell: (row) => {
              const shown = row.number === 1 ? pair.left === 1 && pair.right === 2 : pair.left === row.number - 1 && pair.right === row.number
              return (
                <Button variant="ghost" icon="eye" disabled={shown} onClick={() => inspect(row)} aria-label={`Inspect version ${row.number}`}>
                  {shown ? 'Shown above' : 'Inspect'}
                </Button>
              )
            },
          },
        ]}
      />
      <Modal open={enlarged !== null} title={enlarged ? `Version ${enlarged.number} photograph · ${enlarged.photo?.imageId ?? ''}` : 'Photograph'} size="large" onClose={() => setEnlarged(null)}>
        {enlarged?.photo && <EvidenceImage label={`${enlarged.photo.imageId} · version ${enlarged.number}`} altText={enlarged.photo.altText} />}
      </Modal>
    </div>
  )
}
