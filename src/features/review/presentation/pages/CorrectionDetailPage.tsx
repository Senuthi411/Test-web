import { useState, type ReactNode } from "react";
import { useParams } from "react-router";
import {
  Badge,
  Banner,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  usePageBreadcrumbs,
  useToast,
} from "@/shared/components";
import { Icon } from "@/shared/design-system";
import { CORRECTION_STATUS_LABEL, type Correction } from "../../domain/models";
import {
  canApplyRevision,
  canApproveCorrection,
  canRejectCorrection,
  correctionSteps,
} from "../../domain/rules";
import { QueryBoundary } from "../components/badges";
import {
  errorText,
  formatDate,
  formatDateTime,
  reviewPaths,
} from "../components/format";
import { Fields } from "../components/parts";
import { useReviewActions, useReviewWorkspace } from "../services/queries";
import { useReviewServices } from "../services/reviewServices";
import styles from "../components/review.module.css";

/** Loads one correction from the scoped workspace; unknown and out-of-scope IDs look the same. */
export function CorrectionBoundary({
  title,
  children,
}: {
  title: string;
  children: (correction: Correction) => ReactNode;
}) {
  const { correctionId = "" } = useParams();
  usePageBreadcrumbs([
    { label: "Review", to: reviewPaths.dashboard },
    { label: "Correction Queue", to: reviewPaths.corrections },
    { label: correctionId, to: reviewPaths.correction(correctionId) },
    { label: title },
  ]);
  const query = useReviewWorkspace();
  return (
    <QueryBoundary query={query} label={title}>
      {(workspace) => {
        const correction = workspace.corrections.find(
          (item) => item.id === correctionId,
        );
        if (!correction) {
          return (
            <EmptyState
              title="Correction unavailable"
              message={`${correctionId} does not exist or is outside your estate scope.`}
              icon="info"
              action={
                <ButtonLink variant="secondary" to={reviewPaths.corrections}>
                  Back to correction queue
                </ButtonLink>
              }
            />
          );
        }
        return children(correction);
      }}
    </QueryBoundary>
  );
}

/** REV-08 Correction Detail (COR-005 resubmitted, COR-041 requested / rejected). */
export function CorrectionDetailPage() {
  return (
    <CorrectionBoundary title="Correction Detail">
      {(correction) => <Detail correction={correction} />}
    </CorrectionBoundary>
  );
}

function Detail({ correction: c }: { correction: Correction }) {
  const { demo } = useReviewServices();
  const toast = useToast();
  const actions = useReviewActions();
  const [notice, setNotice] = useState(true);
  const [applyError, setApplyError] = useState<unknown>(null);
  const o = c.observation;

  async function applyRevision() {
    setApplyError(null);
    try {
      await actions.applyRevision.mutateAsync({ id: c.id, version: c.version });
      toast.show({
        tone: "success",
        title: "RevisionApplied (simulated)",
        message: `${o.id} returned to In review. Demonstration event only.`,
      });
    } catch (error) {
      setApplyError(error);
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader
        back={{
          to: reviewPaths.corrections,
          label: "Back to correction queue",
        }}
        title={`Correction ${c.id}`}
        subtitle={`${o.id} · ${o.division.name} (${o.division.id}) · ${CORRECTION_STATUS_LABEL[c.status]}`}
        actions={
          <>
            {c.revision && (
              <ButtonLink
                variant="secondary"
                icon="columns"
                to={reviewPaths.compare(c.id)}
              >
                Compare revisions
              </ButtonLink>
            )}
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
            {c.status === "rejected" && (
              <ButtonLink
                variant="secondary"
                icon="history"
                to={reviewPaths.history}
              >
                View decision history
              </ButtonLink>
            )}
          </>
        }
      />
      <Card>
        <ol className={styles.stepper} aria-label="Correction progress">
          {correctionSteps(c).map((step, index) => (
            <li
              key={step.id}
              className={
                step.state === "done"
                  ? styles.stepDone
                  : step.state === "current"
                    ? styles.stepCurrent
                    : step.state === "rejected"
                      ? styles.stepRejected
                      : styles.stepTodo
              }
              aria-current={step.state === "current" ? "step" : undefined}
            >
              <span className={styles.stepCircle} aria-hidden="true">
                {step.state === "done" ? (
                  <Icon name="check" size={16} />
                ) : step.state === "rejected" ? (
                  <Icon name="x" size={16} />
                ) : (
                  index + 1
                )}
              </span>
              <span className={styles.stepLabel}>{step.label}</span>
              <span className={styles.stepDetail}>
                {step.detail
                  ? `${step.state === "rejected" && c.rejection ? `${formatDate(step.detail)} · ${c.rejection.by.fullName}` : formatDate(step.detail)}${step.state === "current" ? " · current" : ""}`
                  : "Not yet"}
              </span>
            </li>
          ))}
        </ol>
      </Card>
      <div className={styles.split}>
        <Card title="Request">
          <Fields
            items={[
              { label: "Correction ID", value: c.id },
              { label: "Observation", value: o.id },
              {
                label: "Requested by",
                value: `${c.requestedBy.fullName} (${c.requestedBy.id})`,
              },
              { label: "Requested", value: formatDate(c.requestedAt) },
              { label: "Requested revision", value: c.requestedRevision },
              {
                label: "Applied revision",
                value: c.appliedRevision ?? "None yet",
              },
            ]}
          />
          <h3 className={styles.subheading}>Reason</h3>
          <p className={styles.reason}>{c.message}</p>
          {c.items.length > 0 && (
            <div className={styles.chips} aria-label="Requested corrections">
              {c.items.map((item) => (
                <Badge key={item} tone="neutral">
                  {item}
                </Badge>
              ))}
            </div>
          )}
        </Card>
        <Card title="Field worker response">
          {c.status === "rejected" && c.rejection ? (
            <p className={styles.note}>
              Rejected on {formatDate(c.rejection.at)} by{" "}
              {c.rejection.by.fullName}. Reason: {c.rejection.reason}. The field
              worker ({o.fieldWorker.fullName}) was notified. The original
              observation and evidence remain unchanged.
            </p>
          ) : c.revision ? (
            <>
              <Fields
                items={[
                  { label: "Revision", value: c.revision.id },
                  {
                    label: "Status",
                    value:
                      c.status === "applied" ? (
                        <Badge tone="success">Applied</Badge>
                      ) : (
                        <Badge tone="purple">Pending application</Badge>
                      ),
                  },
                  {
                    label: "Submitted",
                    value: formatDateTime(c.revision.submittedAt),
                  },
                  {
                    label: "Original evidence",
                    value: <Badge tone="success">Unchanged</Badge>,
                  },
                ]}
              />
              <div className={styles.tableScroll}>
                <table className={styles.changeTable}>
                  <caption className="tl-visually-hidden">
                    Fields changed in {c.revision.id}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Field</th>
                      <th scope="col">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.revision.changes.map((change) => (
                      <tr key={change.field}>
                        <th scope="row">{change.field}</th>
                        <td>{change.after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {c.status === "resubmitted" && notice && (
                <div className={styles.evidenceMeta}>
                  <Banner tone="warning" onDismiss={() => setNotice(false)}>
                    Approving records your decision only. The revision is
                    applied separately.
                  </Banner>
                </div>
              )}
              {c.status === "approved" && (
                <div className={styles.evidenceMeta}>
                  <Banner
                    tone="info"
                    title="Approved — waiting for RevisionApplied"
                    action={
                      demo && canApplyRevision(c.status) ? (
                        <Button
                          variant="secondary"
                          onClick={() => void applyRevision()}
                          loading={actions.applyRevision.isPending}
                        >
                          Simulate RevisionApplied event
                        </Button>
                      ) : undefined
                    }
                  >
                    The review stays Correction requested until the system
                    reports RevisionApplied.
                    {demo
                      ? " In demonstration mode you can simulate that event; nothing is sent anywhere."
                      : ""}
                  </Banner>
                </div>
              )}
              {applyError ? (
                <div className={styles.evidenceMeta}>
                  <Banner
                    tone="error"
                    title="RevisionApplied was not simulated"
                  >
                    {errorText(applyError)}
                  </Banner>
                </div>
              ) : null}
            </>
          ) : (
            <p className={styles.note}>
              No revision submitted yet. The field worker has not responded to
              this correction request.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
