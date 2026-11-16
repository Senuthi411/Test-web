# Pending API contracts

The backend monorepo (`TeaLeaf-Field-Scout`) currently defines only:

- the base path `/api/v1/{identity|capture|review|cases|analytics}`,
- the error envelope `{ error: { code, message, correlationId, details? } }`,
- the headers `x-correlation-id` and `idempotency-key`.

There are **no OpenAPI definitions** (`packages/api-contracts/openapi/README.md`:
"awaiting source material"), token signing is undecided (**P1**) and the role model is
provisional (**P8**). The frontend therefore does **not** guess endpoints or payloads.
Every HTTP adapter operation without an approved contract calls
`contractPending('<operation>')`, which raises `AppError('contract_pending')` and sends no
request. In API mode the UI shows "Not yet available" for these operations; it never
substitutes fixture data.

## Implemented as pending (Phase 2)

| Operation | Adapter | Blocked by |
| --- | --- | --- |
| `identity.auth.signIn` | `features/identity/infrastructure/httpAuthAdapter.ts` | P1, Identity OpenAPI |
| `identity.auth.signOut` | same | P1, Identity OpenAPI |

## Implemented as pending (Phase 5 — Review)

`features/review/infrastructure/httpReviewAdapter.ts` sends no requests. Every operation
raises `contract_pending`; URLs and payloads are deliberately not guessed.

| Operation | Purpose | Notes |
| --- | --- | --- |
| `review.workspace.get` | Scoped observations, corrections, referrals, quarantine and decisions | May become several list endpoints |
| `review.observations.get` | REV-03 review record (review ID, version, evidence summary, history, eligible experts) | |
| `review.observations.verify` | REV-04 | needs `expectedVersion` + `Idempotency-Key` |
| `review.observations.flag` | REV-05 | same |
| `review.observations.requestCorrection` | REV-06 | same; returns the new correction |
| `review.observations.refer` | REV-12 | same; returns the referral in `pending_case_link` |
| `review.corrections.approve` | REV-10 | same; approval only, not application |
| `review.corrections.reject` | REV-11 | same |
| `review.corrections.revisionApplied.fixtureOnly` | Demo stand-in for the system RevisionApplied event | Never a client call in production |
| `review.exports.create` | Queue / correction / history export | Format not specified |
| `capture.observations.resubmitRevision.fixtureOnly` | Demo stand-in for the Field Worker's corrected resubmission from the Capture mobile app | Never a web call in production; the web only reads the resulting revision |

Not modelled because no approved design or rule exists: claiming an observation for
review, the REV-16 quarantine decision, quarantine ingest retry.

## Assignment workflow revision (missing backend support)

Implemented in the frontend with fixtures only; every item below needs a shared contract.

| Need | Owner | Detail |
| --- | --- | --- |
| Assignment type | Capture | `inspection` or `task` on every assignment (older records are treated as inspections) |
| Status labels | Capture | the stored values are unchanged; `submitted` is shown as **Done**. Completed is set only by the Supervisor's Complete assignment action |
| `capture.assignments.submitDraft` | Capture | Draft → Assigned; only a Draft is editable |
| One active assignment per worker | Capture | reject creating / submitting an assignment for a worker who has one in Assigned or In progress (Done does not count) |
| Task submission | Capture mobile app → Capture | outcome, task input responses, photo assets, completion notes, optional GPS, submitted-at; the assignment becomes Done when it is acknowledged |
| Inspection submission | Capture mobile app → Capture / Review | the worker's observation carries the assignment reference and enters the normal Review Queue as Submitted; the assignment becomes Done |
| Completion rule | Capture | Done → Completed only with a submission; for an inspection only when every linked observation has a final review outcome (Verified or Flagged) |
| `completedAt` | Capture | Assignment History is calculated as completedAt + 24 h; history is read-only |

## Observation review revision (missing backend support)

| Need | Owner | Detail |
| --- | --- | --- |
| Start review | Review | Submitted and Resubmitted move to In review only on an explicit Start review (never on read) |
| Decision state | Review / Cases | the expert decision (diagnosis) must reach Review; the frontend shows **Decision** for a referred observation with a diagnosed referral. No expert-decision endpoint is invented |
| Final outcomes | Review | Verified and Flagged are final (no further decision); a Decision is finalised by Verify or Flag |
| Verification | Review | no mandatory checklist; only the decision note (optional) is sent |
| Final decision time | Review | Observation History is calculated as the last final decision time + 24 h; history is read-only |

## Task templates and multi-worker assignment (missing backend support)

| Need | Owner | Detail |
| --- | --- | --- |
| Task template catalogue | Capture | the seven templates (Fertilizer Application, Tree Inspection, Disease Inspection, Pruning, Weed Removal, Drainage Maintenance, General Field Inspection) are frontend configuration in `features/capture/domain/taskTemplates.ts` until a catalogue endpoint exists |
| Task requirements on an assignment | Capture | checklist, required / optional input fields, photo requirement (level + minimum), GPS requirement, completion-notes requirement; stored with the assignment and shown to the Field Worker |
| `capture.assignments.createForWorkers` | Capture | one request for one division and 1..n Field Workers; creates one assignment per worker atomically (all or none), each with its own status, acceptance and submissions, linked by a group ID; rejects workers without scope on the division |
| Task-linked vs independent observations | Capture / Review | the observation (or review queue row) must say which assignment it was submitted for, if any |

## Starting the review of a resubmitted observation (missing backend support)

`review.observations.claim` must also accept a **Resubmitted** observation: Resubmitted → In review when
the Supervisor starts the review (never on read or list), recorded in the review history with the
revision number, returning the new review version. In fixture mode this is done by the fixture adapter.

## Observation revisions and resubmission (missing backend support)

The Supervisor frontend models one logical Observation ID with several immutable revisions
(`OBSR-005-1`, `OBSR-005-2`, …) and a `resubmitted` review status. None of this exists in
an approved contract yet; in fixture mode it is served by the fixture adapters only. The
backend needs to provide:

| Need | Owner | Detail |
| --- | --- | --- |
| Revision list per observation | Capture | ordered revisions with revision ID, number, submitted-at, submitted-by, the correction ID it answers, and the submitted values (division, suspected disease, GPS, symptoms, photograph asset, field note); revisions are append-only |
| Revision photographs | Capture | a presigned URL per revision photograph (the web shows the synthetic illustration today) |
| Corrected resubmission | Capture mobile app → Capture | creates revision n+1 from the latest revision; only after it is stored does Review receive an event that moves the observation to **Resubmitted** |
| `resubmitted` review status | Review | a Review Queue status distinct from `submitted`, with the same four decisions (verify, flag, request correction, refer) |
| Revision on every decision | Review | each decision records `revisionId` / `revisionNumber` of the revision reviewed; decision history returns them |
| Completing the answered correction | Review | a decision on a resubmitted revision completes its correction (the fixture marks it Applied); the Correction Queue approve / RevisionApplied path must agree with this rule |
| Requested revision number | Review | a new correction asks for latest revision + 1 |



Each will be added as a `contractPending` operation when its port is built, and replaced
by a real call once the backend publishes the contract.

| Area | Operations needed |
| --- | --- |
| Identity | token refresh; current user / profile; change password; users (list, get, create, update, deactivate); user scope (get, assign, with version for 409); roles and permissions; estates (list, get, create, update, status); divisions (list, get, create, update); device sessions (list, revoke, recovery) |
| Capture | observation detail; evidence image URL (presigned); capture metadata; GPS provenance; revision history and comparison; fieldwork assignments (list, get, create, edit, reassign, cancel) — edit and cancel must be rejected server-side unless the assignment is Draft, or Assigned and not yet accepted by the Field Worker, checked atomically with the version (409 on conflict); worker acceptance (mobile) |
| Review | review queue (filters, tabs); claim; verify; flag; request correction; correction queue / detail / approve / reject; refer to expert and referral status; quarantine queue / record / decide / retry ingest; decision history; review version for conflict detection |
| Cases | assigned cases; case detail; linked evidence; record and confirm diagnosis; disease catalog and detail; case history; pending case link |
| Analytics | dashboard; estate / division overview; observation statistics; disease distribution; suspected vs confirmed; review bottlenecks; reporting filters; data freshness; export (XLSX / PDF) |
| Shared | notifications; global search |

## Questions for the backend team

1. How are access tokens issued, refreshed and revoked (P1)? Cookie or bearer?
2. Are the role identifiers in `packages/shared-types/src/roles.ts` final (P8)?
3. Which operations accept `idempotency-key`, and how are optimistic-concurrency
   versions (409) exposed?
4. Are list endpoints paginated by page/size or cursor, and what are the filter names?
5. How are evidence images served (presigned URL lifetime, thumbnails)?
