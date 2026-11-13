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

Not modelled because no approved design or rule exists: claiming an observation for
review, the REV-16 quarantine decision, quarantine ingest retry.

## Required by later phases

Each will be added as a `contractPending` operation when its port is built, and replaced
by a real call once the backend publishes the contract.

| Area | Operations needed |
| --- | --- |
| Identity | token refresh; current user / profile; change password; users (list, get, create, update, deactivate); user scope (get, assign, with version for 409); roles and permissions; estates (list, get, create, update, status); divisions (list, get, create, update); device sessions (list, revoke, recovery) |
| Capture | observation detail; evidence image URL (presigned); capture metadata; GPS provenance; revision history and comparison; fieldwork assignments (list, get, create, edit, reassign, cancel) |
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
