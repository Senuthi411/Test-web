import { ButtonLink, Card, EmptyState, PageHeader } from "@/shared/components";
import type { Correction } from "../../domain/models";
import { canApproveCorrection, canRejectCorrection } from "../../domain/rules";
import { QueryBoundary } from "../components/badges";
import { reviewPaths } from "../components/format";
import { ReviewRevisionComparison } from "../components/revisions";
import { useObservationReview } from "../services/queries";
import { CorrectionBoundary } from "./CorrectionDetailPage";
import styles from "../components/review.module.css";

/**
 * REV-09 Original vs Revised. Uses the same side-by-side revision comparison as the
 * Observation Review, opened on the revision that answers this correction.
 */
export function CorrectionComparePage() {
  return (
    <CorrectionBoundary title="Compare Revision">
      {(correction) => <Compare correction={correction} />}
    </CorrectionBoundary>
  );
}

function Compare({ correction: c }: { correction: Correction }) {
  const back = {
    to: reviewPaths.correction(c.id),
    label: "Back to correction",
  };
  const query = useObservationReview(c.observation.id);
  if (!c.revision) {
    return (
      <div className={styles.page}>
        <PageHeader
          back={back}
          title="Original vs Revised"
          subtitle={`${c.id} · ${c.observation.id}`}
        />
        <EmptyState
          title="No revision to compare"
          message="The field worker has not submitted a revision for this correction."
          icon="info"
        />
      </div>
    );
  }
  const revision = c.revision;
  return (
    <div className={styles.page}>
      <PageHeader
        back={back}
        title="Original vs Revised"
        subtitle={`${c.id} · ${c.observation.id} · version ${revision.number - 1} compared with version ${revision.number} (${revision.id})`}
        actions={
          <>
            <ButtonLink
              variant="secondary"
              icon="eye"
              to={reviewPaths.observation(c.observation.id)}
            >
              Open observation review
            </ButtonLink>
            {canRejectCorrection(c.status) && (
              <ButtonLink
                variant="destructiveOutline"
                icon="x"
                to={reviewPaths.reject(c.id)}
              >
                Reject
              </ButtonLink>
            )}
            {canApproveCorrection(c.status) && (
              <ButtonLink icon="check" to={reviewPaths.approve(c.id)}>
                Approve
              </ButtonLink>
            )}
          </>
        }
      />
      <QueryBoundary query={query} label="revision comparison">
        {(review) => (
          <Card title="Revisions">
            <ReviewRevisionComparison
              review={review}
              initialNumber={revision.number}
            />
          </Card>
        )}
      </QueryBoundary>
    </div>
  );
}
