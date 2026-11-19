import { useParams } from 'react-router'
import { Badge, ButtonLink, Card, EmptyState, PageHeader, usePageBreadcrumbs } from '@/shared/components'
import { QueryBoundary } from '../components/badges'
import { reviewPaths } from '../components/format'
import { ReviewRevisionComparison } from '../components/revisions'
import { useObservationReview } from '../services/queries'
import styles from '../components/review.module.css'

/** Version comparison for one observation: previous version, latest version and their differences. */
export function ObservationComparePage() {
  const { observationId = '' } = useParams()
  usePageBreadcrumbs([
    { label: 'Review', to: reviewPaths.dashboard },
    { label: 'Observation Review', to: reviewPaths.queue },
    { label: observationId, to: reviewPaths.observation(observationId) },
    { label: 'Compare Versions' },
  ])
  const query = useObservationReview(observationId)
  return (
    <QueryBoundary query={query} label="version comparison">
      {(review) => {
        const current = review.revisions[review.revisions.length - 1]
        const back = { to: reviewPaths.observation(observationId), label: 'Back to observation' }
        if (review.revisions.length < 2) {
          return (
            <div className={styles.page}>
              <PageHeader back={back} title={`Compare Versions · ${observationId}`} />
              <EmptyState title="No previous version" message="This observation has only its original submission." icon="info" />
            </div>
          )
        }
        return (
          <div className={styles.page}>
            <PageHeader back={back} title={`Compare Versions · ${observationId}`} subtitle={`Version ${current.number - 1} compared with version ${current.number} (${current.id})`} />
            <Card
              title="Versions"
              action={
                <Badge tone="teal">
                  Latest version {current.number} · {current.id}
                </Badge>
              }
            >
              <ReviewRevisionComparison review={review} />
            </Card>
            <div>
              <ButtonLink variant="secondary" to={reviewPaths.observation(observationId)}>
                Back to observation
              </ButtonLink>
            </div>
          </div>
        )
      }}
    </QueryBoundary>
  )
}
