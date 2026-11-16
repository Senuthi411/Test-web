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
| `identity.auth.signIn` | `features/identity/infrastructure/httpAuthAdapter.ts` | P1, Identity OpenAPI. Request is a company User ID + password (no e-mail sign-in). Response is a session or an MFA challenge. |
| `identity.auth.verifyMfa` | same | P1, Identity OpenAPI: challenge format, code format, expiry and error codes |
| `identity.auth.signOut` | same | P1, Identity OpenAPI |
| `identity.auth.mfaEnrollment.start` | same | P1, Identity OpenAPI: mandatory Administrator TOTP enrollment. Response is a backend-rendered QR image (`data:image/...`) and/or setup key and account label. The frontend never generates or checks TOTP secrets. |
| `identity.auth.mfaEnrollment.confirm` | same | P1, Identity OpenAPI: first authenticator code; response is a session or "log in again", plus one-time recovery codes if the approved design issues them |
| `identity.recovery.request` | `features/identity/infrastructure/pendingAuthFlowAdapters.ts` | Identity OpenAPI: company User ID → recovery reference, code expiry and resend time. Must answer the same way whether or not the account exists. |
| `identity.recovery.resend` | same | Identity OpenAPI: rate limit and cooldown error codes (`RESEND_COOLDOWN`, `RESEND_UNAVAILABLE`) |
| `identity.recovery.verify` | same | Identity OpenAPI: 6-digit e-mail OTP (5 minutes), attempt limit; returns a short-lived reset authorisation |
| `identity.recovery.complete` | same | Identity OpenAPI: new password with the reset authorisation; password policy; revokes existing sessions; no automatic sign-in |
| `identity.activation.validate` | same | Identity OpenAPI: invitation token → invitation (invalid, expired and already-used codes), whether MFA enrollment follows |
| `identity.activation.activate` | same | Identity OpenAPI: token + new password; returns "activated" or an MFA enrollment session for Administrators |
| `users.create` | `features/identity/infrastructure/httpIdentityAdapters.ts` | P8, Identity OpenAPI. The response must return the stored account with its backend-assigned Company User ID and an invitation status (`sent`, `pending` or `not_sent`). |

## Implemented as pending (Temporary access and access history)

`features/identity/infrastructure/pendingAccessGrantAdapter.ts` sends no requests. The backend has
no grant, approval or audit-history contract (audit logging is "Planned"). In API mode the
Temporary Access and Access History tabs show "not available yet"; they never fall back to
fixtures. Fixture mode starts with no grants and keeps requests in memory as **Pending approval**:
nothing is approved, activated or enforced, and no history record is invented.

| Operation | Needs |
| --- | --- |
| `identity.accessGrants.list` | Grants visible to the caller: employee (id, name, role), type (`additional_estate` / `additional_division`), estate or division ids, `startsAt` / `expiresAt` (ISO 8601), backend status (`pending_approval`, `scheduled`, `active`, `rejected`, `expired`, `revoked`, `cancelled`), reason, requester, decider, end details. Pagination and filter names. |
| `identity.accessGrants.request` | Body `{ employeeId, type, estateIds, divisionIds, startsAt, expiresAt, reason }`. The backend decides the status; validation errors per field (`employeeId`, `type`, `estateIds`, `divisionIds`, `startsAt`, `expiresAt`, `reason`); `409` for overlapping open grants. Must refuse self-grants and inactive accounts. |
| `identity.accessGrants.end` | `{ action: "revoke" or "cancel", reason }`. Revoke applies to active grants, cancel to pending or scheduled ones; `409` when the status has changed. |
| `identity.accessHistory.list` | Read-only audit entries: time, employee, action (temporary requested / approved / rejected / activated / expired / revoked / cancelled; permanent role / scope changed), previous and new access, performer, reason, result. Server-side filters for employee, role, action, date range and result; pagination. |

Policy decisions still open:

1. Who approves a temporary grant (approval authority); whether an Administrator's own request can ever be auto-approved (the frontend assumes never).
2. Disease Expert access to individual cases inside a granted estate (needs the case-access contract).
3. Reporting User scope level (estate, division or both); the current estate-level model is used.
4. The "expiring soon" threshold (the frontend uses 24 hours, list filter only).
5. Whether `cancelled` is a distinct backend status or a kind of `revoked`.
6. Temporary Administrator delegation is out of scope here and needs its own workflow.

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
6. What are the final error codes for MFA, recovery and activation? The frontend currently
   uses `MFA_CHALLENGE_EXPIRED`, `TOO_MANY_ATTEMPTS`, `OTP_INVALID`, `OTP_EXPIRED`,
   `RESEND_COOLDOWN`, `RESEND_UNAVAILABLE`, `RECOVERY_SESSION_EXPIRED`,
   `RESET_AUTHORIZATION_EXPIRED`, `ACTIVATION_TOKEN_INVALID`, `ACTIVATION_TOKEN_EXPIRED` and
   `ACTIVATION_TOKEN_USED` (see `domain/authFlows.ts`).
7. Is the company User ID format always `USR-` followed by digits? The login form enforces it.
8. What is the backend password policy? The forms require at least 12 characters (ID-14 design)
   and show any further server-side rule as a field error.
