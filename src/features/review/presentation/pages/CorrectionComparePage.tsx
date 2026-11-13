import { EvidenceImage } from "@/features/capture";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
} from "@/shared/components";
import type { Correction } from "../../domain/models";
import { canApproveCorrection, canRejectCorrection } from "../../domain/rules";
import { reviewPaths } from "../components/format";
import { CorrectionBoundary } from "./CorrectionDetailPage";
import styles from "../components/review.module.css";

/** REV-09 Original vs Revised. Revision 1 stays effective; revision 2 is shown as pending. */
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
  const imageId = c.evidenceImageId ?? "Not provided";
  const pending = c.status !== "applied";
  const rows = [
    ...c.revision.changes.map((change) => ({
      field: change.field,
      before: change.before,
      after: change.after,
      changed: change.before !== change.after,
    })),
    {
      field: "Original image",
      before: imageId,
      after: `${imageId} (unchanged)`,
      changed: false,
    },
    {
      field: "Suspected disease",
      before: c.observation.suspectedDisease.name,
      after: c.observation.suspectedDisease.name,
      changed: false,
    },
  ];
  return (
    <div className={styles.page}>
      <PageHeader
        back={back}
        title="Original vs Revised"
        subtitle={`${c.id} · ${c.observation.id} · revision 1 compared with ${pending ? "pending " : ""}revision ${c.revision.number}`}
        actions={
          <>
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
      <div className={styles.compareGrid}>
        <Card
          title="Revision 1"
          action={
            <Badge tone="success">{pending ? "Effective" : "Superseded"}</Badge>
          }
        >
          {c.evidenceImageId ? (
            <EvidenceImage
              label={`${c.evidenceImageId} · original.jpg`}
              altText={`Original evidence ${c.evidenceImageId}`}
            />
          ) : (
            <p className={styles.note}>Image not provided.</p>
          )}
        </Card>
        <Card
          title={`Revision ${c.revision.number}`}
          action={
            <Badge tone={pending ? "purple" : "success"}>
              {pending ? "Pending application" : "Applied"}
            </Badge>
          }
        >
          {c.evidenceImageId ? (
            <EvidenceImage
              label={`${c.evidenceImageId} · unchanged original`}
              altText={`Unchanged original evidence ${c.evidenceImageId}`}
            />
          ) : (
            <p className={styles.note}>Image not provided.</p>
          )}
        </Card>
      </div>
      <Card title="Differences">
        <div className={styles.tableScroll} role="region" aria-label="Revision comparison scroll area" tabIndex={0}>
          <table className={styles.changeTable}>
            <caption className="tl-visually-hidden">
              Field differences between revision 1 and revision{" "}
              {c.revision.number}
            </caption>
            <thead>
              <tr>
                <th scope="col">Field</th>
                <th scope="col">Revision 1</th>
                <th scope="col">Revision {c.revision.number}</th>
                <th scope="col">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.field}>
                  <th scope="row">{row.field}</th>
                  <td>{row.before}</td>
                  <td>{row.after}</td>
                  <td>
                    {row.changed ? (
                      <Badge tone="warning">Changed</Badge>
                    ) : (
                      <Badge tone="neutral">No change</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
