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

## Implemented as pending (Access history; temporary access retained for Supervisor)

`features/identity/infrastructure/pendingAccessGrantAdapter.ts` sends no requests. The backend has
no grant, approval or audit-history contract (audit logging is "Planned").

**Access history.** The Roles & Permissions page (permission matrix and Access History tab) was
removed from the Administrator UI. Identity and authorization events (role, scope and
account-status changes in the "Access" module, device-access revocations in "Device sessions") are
read in the Audit Logs (`/admin/audit-logs`) from `identity.auditLog.list`; there is no separate access-history screen.
`/admin/roles` and `/admin/roles/:role` redirect to the Audit Logs. `AccessGrantPort.listAccessHistory`
and its adapters are kept as a pending contract but no screen reads them now. Fieldwork (operational)
assignments are not authorization changes and are not shown. In API mode nothing falls back to fixtures. In
fixture mode the entries come from the demonstration audit log; Edit User and Scope Assignment
record role, scope (with the previous scope) and account-status changes as their own audit events.

**Temporary access.** The Temporary Access tab, its request form and the dashboard overview were
removed from the Administrator UI: temporary access will be requested and managed by Supervisors in
a later phase. The grant domain model, `AccessGrantPort`, its use cases and the fixture / pending
adapters below are kept unchanged for that workflow; no Administrator screen calls the grant
operations.

| Operation | Needs |
| --- | --- |
| `identity.accessGrants.list` | Grants visible to the caller: employee (id, name, role), type (`additional_estate` / `additional_division`), estate or division ids, `startsAt` / `expiresAt` (ISO 8601), backend status (`pending_approval`, `scheduled`, `active`, `rejected`, `expired`, `revoked`, `cancelled`), reason, requester, decider, end details. Pagination and filter names. |
| `identity.accessGrants.request` | Body `{ employeeId, type, estateIds, divisionIds, startsAt, expiresAt, reason }`. The backend decides the status; validation errors per field (`employeeId`, `type`, `estateIds`, `divisionIds`, `startsAt`, `expiresAt`, `reason`); `409` for overlapping open grants. Must refuse self-grants and inactive accounts. |
| `identity.accessGrants.end` | `{ action: "revoke" or "cancel", reason }`. Revoke applies to active grants, cancel to pending or scheduled ones; `409` when the status has changed. |
| `identity.accessHistory.list` | Read-only audit entries: time, employee (id, name, role), action (`permanent_role_changed`, `permanent_scope_changed`, `account_enabled`, `account_disabled`, `device_access_revoked`; the temporary-access actions once the Supervisor workflow exists), previous and new value, performer (actor), reason, result. Server-side filters for employee, actor, role, action, date range and result; pagination. |

Policy decisions still open:

1. Who approves a temporary grant (approval authority); whether an Administrator's own request can ever be auto-approved (the frontend assumes never).
2. Disease Expert access to individual cases inside a granted estate (needs the case-access contract).
3. Reporting User scope level (estate, division or both); the current estate-level model is used.
4. The "expiring soon" threshold (the frontend uses 24 hours, list filter only).
5. Whether `cancelled` is a distinct backend status or a kind of `revoked`.
6. Temporary Administrator delegation is out of scope here and needs its own workflow.
7. Whether the Administrator UI should later show Supervisor-managed temporary grants read-only.

## Implemented as pending (Administrator Dashboard)

The dashboard reads `identity.dashboard.get`, `identity.securityAlerts.list` (both in
`features/identity/infrastructure/httpIdentityAdapters.ts`). It no longer reads the
temporary-access operations. In API mode every section shows "Not available yet"; no count, alert
or activity is taken from fixtures, and no empty list stands in for a missing contract.

| Operation | Needs |
| --- | --- |
| `identity.dashboard.get` | Active and total users, estates (with division counts and status), total and active divisions, active device sessions, sessions revoked in the last 7 days, active users by role, the newest audit events (time, kind, actor, target), accounts requiring attention with reasons, and open device-session recoveries. |
| `identity.securityAlerts.list` | `{ alerts, reportedKinds }`. Each alert: id, kind (`failed_sign_in`, `account_locked`, `session_flagged`, `mfa_enrollment_pending`, `device_session_revoked`), time, employee (id, name, role) or null, session id and device or null, severity (`high`, `medium`, `low`) **only when the backend assigns one**, reason code. `reportedKinds` lists the kinds the service records, so the screen can say which are not reported instead of showing "none". |

Fixture mode records device sessions only: a revoked session without a recovery request is the
only alert it produces (no severity). It has no sign-in attempts, lockouts, session flags, MFA
enrollment, invitation or activation status, and the dashboard says so.

Decisions still open:

1. The security rules behind `failed_sign_in`, `account_locked` and `session_flagged` (thresholds,
   lockout policy). The frontend never infers suspicious activity from ordinary sign-in failures.
2. Invitation and activation statuses (`invited`, `pending_activation`) for the account summary and
   pending actions; the Identity model currently has `active` and `inactive` only.
3. Whether the design's ID-02 "Users requiring attention" entries with no recorded reason
   (USR-007, USR-006, USR-004) should stay in the demonstration data.

## Implemented as pending (Security Center)

`/admin/security` (Administrator only, formerly "Security & Settings") has four read-only tabs:
Security Overview, Authentication Policies, Device Security and Security Events. Earlier links
(`?tab=mfa`, `?tab=accounts`, `?tab=policies`, `?tab=audit`) open the matching new tab. It reuses
existing operations (`identity.users.list`, `identity.dashboard.get`,
`identity.deviceSessions.list`, `identity.securityAlerts.list`, `identity.auditLog.list`); in API
mode each section says "Not available yet" and nothing is taken from fixtures. It offers **no**
security action: no MFA reset, unlock, recovery approval or policy editing. Account activation and
suspension stay on the user's page; device-session revocation and recovery stay on Device Sessions.

Security Events is the shared audit log (`identity.auditLog.list`) filtered to `role_changed`,
`scope_updated`, `account_status_changed`, `device_session_revoked`,
`session_recovery_requested` and `configuration_publish_rejected`; there is no second audit system.

Contracts needed before Phase 2 actions can be added:

| Operation | Needs |
| --- | --- |
| `identity.mfa.status` (per user, or a field on the user) | Enrollment status of each Administrator (`enrolled`, `pending`, `reset_required`), enrolled-at time. Never the secret, setup key or recovery codes. |
| `identity.mfa.reset` | Start an Administrator MFA reset or recovery: requires the acting Administrator to re-authenticate, refuses self-reset, sends a one-time code to the target's verified e-mail address, is verified by the backend and writes an audit record. Idempotency key; error codes. |
| `identity.accountSecurity.list` | Locked accounts (lock reason, time, unlock policy) and failed sign-in events, with the thresholds the backend applies. |
| `identity.accounts.unlock` | Unlock with reason and audit record, if the lockout policy allows manual unlock. |
| `identity.recoveryRequests.list` | Password, MFA and device-session recovery requests with status, requester and decision. Only device-session recoveries exist today. |
| `identity.securityPolicies.get` | Current session expiration, inactivity timeout, offline session validity, re-authentication rules and recovery policy as enforced by the backend. |
| `identity.securityPolicies.update` | Only after the policies, their owners and enforcement are approved; versioned, audited, with re-authentication. |
| `identity.accessHistory.list` (extension) | Additional actions: `user_created`, `mfa_reset_requested`, `mfa_reset_completed`, `account_recovery_*`, `security_policy_changed`, `temporary_access_decided`. |

Policies shown as **approved** restate recorded decisions (Administrator TOTP MFA, 6-digit codes,
5-minute e-mail OTP, e-mail OTP password recovery, revoked and signed-out sessions cannot be
reused, unsynchronized observations are preserved through recovery, the ID-14 password minimum).
**Proposed**: the 7-day offline session validity (not enforced, not hard-coded anywhere).
**Not defined**: session expiration, inactivity timeout, re-authentication for sensitive actions,
MFA reset workflow, cross-estate temporary access approval authority.

## Implemented as pending (Audit Logs)

`/admin/audit-logs` (Administrator only) is the centralized, read-only audit trail with search,
date range, actor, module, action and outcome filters, pagination and a details panel. In fixture
mode it maps the shared fixture audit records, which every fixture administrative write appends to
(users, scope, role and status changes, estates, divisions, device sessions, configuration). In API
mode the adapter rejects with `contract_pending` and the page says the log is not available.

| Operation | Needs |
| --- | --- |
| `identity.auditLog.list` | Read-only records: id, time (ISO 8601 with offset), actor (id, name) or null, action code, module, target (kind, id, display label), previous and new value **only when recorded**, outcome (`success` / `failure`), reason code, estate ids. Server-side filters (search, from/to, actor, module, action, outcome) and pagination. Never passwords, tokens, OTPs or secrets. No write, edit or delete operation. |

## Implemented as pending (System Settings)

`/admin/settings` (Administrator only) holds one versioned configuration document in six tabs:
General Settings, Feature Center, Business Rules, Workflow Configuration, Maintenance Mode and
Configuration History. Changes are edited as a draft, validated, previewed and published with a
reason; publishing and rollback each create a **new** version (versions are never deleted) and an
audit record. **Nothing is evaluated or enforced**: in fixture mode the configuration lives in the
browser tab only and is labelled "Demonstration mode · UI only"; in API mode every operation below
rejects with `contract_pending` and no setting is shown as in effect.

- **Feature Center**: GPS Validation, Offline Mode and Image Upload are protected (read-only, on);
  only Notifications can change in a draft. The mobile app and backend do not read these flags yet.
- **Business Rules**: predefined templates only, no scripts, expressions or queries.
  Rule A (High Severity Notification) is **blocked**: observations have no severity field.
  Rule B (GPS Validation) has no approved accuracy limit, so none is pre-filled.
  Rule C (Pending Review Reminder): a 48-hour default has been proposed but **not approved**, so
  the threshold is empty until an Administrator enters one; enabling it requires Notifications.
- **Workflow Configuration**: the review, correction and expert-referral state machines are shown
  as protected; only reporting targets (hours, unset by default) can be configured.
- **Maintenance Mode**: shown as Off. Activation is disabled: there is no maintenance contract,
  so maintenance mode is never switched on from the frontend. Only a planned notice can be drafted.

| Operation | Needs |
| --- | --- |
| `configuration.get` | Current version (number, document, created at/by, kind, reason, restored-from), version history and the open draft with its base version. |
| `configuration.draft.save` | Body `{ document, baseVersion }`; `409` when `baseVersion` is not the current version. Audited. |
| `configuration.draft.discard` | Body `{ baseVersion }`. Audited. |
| `configuration.publish` | Body `{ baseVersion, reason }`; backend re-validates and returns per-field errors (`path`, `message`); `409` on a stale base. Successful and rejected publishes are audited. Re-authentication policy to be decided. |
| `configuration.rollback` | Body `{ targetVersion, baseVersion, reason }`; creates a new version with the target's content; refused while a draft is open. Audited. |
| Rule evaluation and event integration | Backend evaluation of Rule B and Rule C against observation and review events, and the notification channel. Rule A additionally needs the observation severity field. Until these exist, rules are configuration only. |
| Maintenance mode | Activation/deactivation endpoint, enforcement in sign-in and sync, and how notices are delivered. |

Permission codes `configuration.settings.manage`, `configuration.rules.manage`,
`security.sessions.manage`, `security.policies.read` and `security.audit.read` are listed for the
Administrator in the frontend role catalog (no permission matrix is shown); like the other codes
they are display content pending the backend role model (P8), not enforcement. The five predefined
roles are assigned in User Management and authorization is enforced by the backend.

## Planned (Phase 3) — Supervisor coverage and temporary delegation

Not implemented. No Administrator screen creates, approves or activates temporary access, and no
handover UI exists in the Administrator module.

- **Same scope** (both Supervisors hold EST-001): delegating review work is a temporary *work
  assignment* in the Supervisor module. Neither permanent scope changes.
- **Different scope** (Supervisor B holds EST-002 and must cover EST-001): Supervisor A must not
  grant EST-001 directly. Proposed workflow:
  1. Supervisor A opens a coverage request naming Supervisor B, the estate, the permitted
     operations, the reason, the start and the expiry.
  2. An authorized approver (not the requester, not Supervisor B) approves or rejects it.
  3. The backend activates only the approved temporary scope; Supervisor B works under their own
     identity; every action is audited.
  4. The backend expires the grant automatically and rejects access after expiry or revocation.

Requirements for the backend: authorization on every request, no self-approval, expiry enforced
server-side, audit of request, decision, activation, use, expiry and revocation, and protection
against privilege escalation. `AccessGrantPort` and the grant domain model are kept for this.

Decision still open: **who approves** cross-estate coverage. If Administrators are designated, a
limited "Access approval requests" queue may be added under the Security Center, restricted to
approve or reject within that policy; it must not become a workforce assignment screen.

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
