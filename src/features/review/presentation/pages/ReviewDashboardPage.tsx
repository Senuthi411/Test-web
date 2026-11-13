import { Link, useNavigate } from 'react-router'
import { BarList, ButtonLink, Card, DataTable, EmptyState, KpiCard, PageHeader, usePageBreadcrumbs } from '@/shared/components'
import { Icon } from '@/shared/design-system'
import { REVIEW_STATUSES, REVIEW_STATUS_LABEL, type ReviewObservation, type ReviewStatus } from '../../domain/models'
import { ageInDays, attentionItems, countBy, isOpenCorrection, isPending } from '../../domain/rules'
import { QueryBoundary, ReviewStatusBadge } from '../components/badges'
import { formatDate, formatLongDate, formatShortDate, reviewPaths } from '../components/format'
import { IdLink } from '../components/parts'
import { useReviewWorkspace } from '../services/queries'
import { useReviewClock } from '../services/useReviewClock'
import styles from '../components/review.module.css'

/** REV-01 "Review status distribution" order and bar colours. */
const DISTRIBUTION: Array<[ReviewStatus, string]> = [
  ['submitted', '#4a86d1'],
  ['in_review', '#7e57c2'],
  ['verified', '#2e7d32'],
  ['flagged', '#e04f4f'],
  ['correction_requested', '#e2a62f'],
  ['referred', '#7cb342'],
]
const DIVISION_COLORS = ['#2e7d32', '#7cb342', '#4f9d69']

/** REV-01 Supervisor Dashboard. */
export function ReviewDashboardPage() {
  usePageBreadcrumbs([{ label: 'Review', to: reviewPaths.dashboard }, { label: 'Dashboard' }])
  const query = useReviewWorkspace()
  const now = useReviewClock()
  const navigate = useNavigate()

  return (
    <QueryBoundary query={query} label="supervisor dashboard">
      {(workspace) => {
        const observations = workspace.observations
        const status = countBy(observations, (item) => item.reviewStatus, REVIEW_STATUSES)
        const ids = (filter: (item: ReviewObservation) => boolean) => observations.filter(filter).map((item) => item.id).join(', ')
        const submitted = observations.filter((item) => item.reviewStatus === 'submitted').sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
        const openCorrections = workspace.corrections.filter((item) => isOpenCorrection(item.status))
        const attention = attentionItems(workspace)
        const estateLabel = workspace.estates.map((estate) => `${estate.name} (${estate.id})`).join(', ')
        return (
          <div className={styles.page}>
            <PageHeader
              title="Supervisor Dashboard"
              subtitle={`${estateLabel} · ${observations.length} observations in your scope · ${formatLongDate(now)}`}
              actions={
                <>
                  <ButtonLink variant="secondary" icon="download" to={reviewPaths.assignments}>
                    Fieldwork Assignments
                  </ButtonLink>
                  <ButtonLink icon="inbox" to={reviewPaths.queue}>
                    Open review queue
                  </ButtonLink>
                </>
              }
            />
            <div className={styles.kpiRow}>
              <Link className={styles.kpiLink} to={`${reviewPaths.queue}?status=submitted`}>
                <KpiCard label="Awaiting review" value={status.submitted} icon="inbox" tone="info" caption={submitted[0] ? `Submitted · oldest ${formatShortDate(submitted[0].capturedAt)}` : 'Submitted'} />
              </Link>
              <Link className={styles.kpiLink} to={`${reviewPaths.queue}?status=in_review`}>
                <KpiCard label="In review" value={status.in_review} icon="eye" tone="purple" caption={ids((item) => item.reviewStatus === 'in_review') || 'None'} />
              </Link>
              <Link className={styles.kpiLink} to={reviewPaths.corrections}>
                <KpiCard label="Open corrections" value={openCorrections.length} icon="edit" tone="warning" caption={openCorrections.map((item) => item.id).join(', ') || 'None'} />
              </Link>
              <Link className={styles.kpiLink} to={reviewPaths.referrals}>
                <KpiCard label="Active referrals" value={workspace.referrals.length} icon="send" tone="success" caption={workspace.referrals.map((item) => item.id).join(', ') || 'None'} />
              </Link>
              <Link className={styles.kpiLink} to={`${reviewPaths.queue}?status=verified`}>
                <KpiCard label="Verified" value={status.verified} icon="check" tone="success" caption={ids((item) => item.reviewStatus === 'verified') || 'None'} />
              </Link>
            </div>

            <div className={styles.row3}>
              <Card title="Review status distribution" className={styles.wideBars}>
                <BarList
                  label="Review status distribution"
                  max={Math.max(1, ...Object.values(status))}
                  items={DISTRIBUTION.map(([key, color]) => ({ id: key, label: REVIEW_STATUS_LABEL[key], value: status[key], color }))}
                />
              </Card>
              <Card title="Needs your attention">
                {attention.length === 0 ? (
                  <EmptyState title="Nothing needs your attention" message="Open corrections, follow-up flags and quarantine items appear here." icon="check" />
                ) : (
                  <ul className={styles.attention}>
                    {attention.map((item) => (
                      <li key={`${item.id}-${item.title}`}>
                        <Link className={styles.attentionLink} to={item.to}>
                          <span>
                            <span className={styles.attentionTitle}>{item.title}</span>
                            <span className={styles.attentionDetail}>{item.detail}</span>
                          </span>
                          <Icon name="right" size={16} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card title="Pending by division" className={styles.wideBars}>
                <BarList
                  label="Pending by division"
                  items={workspace.divisions.map((division, index) => ({
                    id: division.id,
                    label: `${division.name} (${division.id})`,
                    value: observations.filter((item) => item.division.id === division.id && isPending(item.reviewStatus)).length,
                    color: DIVISION_COLORS[index % DIVISION_COLORS.length],
                  }))}
                />
                <p className={styles.caption}>Pending = submitted or in review.</p>
              </Card>
            </div>

            <Card
              title="Oldest awaiting review"
              action={
                <Link className={styles.idLink} to={`${reviewPaths.queue}?status=submitted`}>
                  View queue
                </Link>
              }
            >
              <DataTable<ReviewObservation>
                caption="Oldest awaiting review"
                rows={submitted.slice(0, 3)}
                rowKey={(row) => row.id}
                onRowActivate={(row) => navigate(reviewPaths.observation(row.id))}
                empty={<EmptyState title="No observations awaiting review" icon="check" />}
                columns={[
                  { id: 'observation', header: 'Observation', cell: (row) => <IdLink to={reviewPaths.observation(row.id)}>{row.id}</IdLink> },
                  { id: 'division', header: 'Division', cell: (row) => row.division.name },
                  { id: 'disease', header: 'Suspected disease', cell: (row) => row.suspectedDisease.name },
                  { id: 'captured', header: 'Captured', cell: (row) => formatDate(row.capturedAt) },
                  { id: 'age', header: 'Age', cell: (row) => `${ageInDays(row.capturedAt, now.toISOString())} days` },
                  { id: 'status', header: 'Status', cell: (row) => <ReviewStatusBadge status={row.reviewStatus} /> },
                  {
                    id: 'action',
                    header: 'Action',
                    align: 'end',
                    cell: (row) => (
                      <Link className={styles.idLink} to={reviewPaths.observation(row.id)} aria-label={`Review ${row.id}`}>
                        Review →
                      </Link>
                    ),
                  },
                ]}
              />
            </Card>
          </div>
        )
      }}
    </QueryBoundary>
  )
}
