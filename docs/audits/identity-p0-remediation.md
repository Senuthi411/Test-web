# Identity / Administrator P0 remediation

Date: 18 November 2026 (Asia/Colombo). Development copy: `D:\TeaLeaf-Web-Development - Copy\tealeaf-web`. Branch: `feature/create-user-role-fields`.

This is a dated remediation addendum to `identity-administrator-final-audit.md`. The original findings and audit evidence have not been rewritten. These corrections implement the explicitly authorized fixture/frontend safeguards; they do not certify production security or complete Identity backend integration.

## Corrected findings

| Finding | Before | After | Evidence |
|---|---|---|---|
| SEC-01: Administrator authorization | Fixture admin operations accepted any actor, with role checked only for personal-field presentation | Every `IdentityAdminPort` operation requires a current, existing, **active Administrator**, resolved by actor ID against current fixture records. Missing, inactive, Supervisor, Disease Expert, Reporting User and Field Worker actors receive typed `forbidden` errors before record reads/writes. Authorization is rechecked after simulated latency | `infrastructure/fixtureAuthorization.ts`; guarded runner in `infrastructure/fixtureIdentityAdminAdapter.ts`; all-operation negative matrix in `p0Security.test.tsx` |
| SEC-02: self-service ownership | Account ports accepted arbitrary target user IDs | Get Profile, Update Profile, Change Password and Notification Preferences require an active actor whose ID equals the requested account. Even Administrators cannot use self-service to edit another account; the separately authorized administration workflow remains available | `infrastructure/fixtureAccountAdapter.ts`, wiring in `fixtures.ts`, ownership tests |
| SEC-03: last active Administrator | Demotion/deactivation could leave zero active Administrators | Domain invariant checks the actual current fixture state and rejects the update before mutation/audit if it would remove the last active Administrator. A second inactive Administrator does not satisfy the invariant. A second active Administrator permits the update | `domain/administratorSafety.ts`, `fixtureIdentityAdminAdapter.ts:updateUser`; atomicity tests and browser last-admin test |
| SEC-04: current-session reconciliation | Self-edits left persisted and rendered role/scope stale; restoration trusted the old snapshot | Fixture repository notifications reconcile the current session. Role changes invalidate the session and require sign-in again; inactive/missing/mobile-only accounts also invalidate it. Same-role scope/name/email changes refresh the session snapshot from the repository. Role/scope loss clears the current user's query cache. Unrelated record edits leave the current session/cache intact | `fixtureAuthAdapter.ts`, `application/authUseCases.ts`, `presentation/session/SessionProvider.tsx`; session/cache/restoration tests and browser self-edit tests |
| SES-01: lifecycle contract | Production expiration/refresh/revocation policies unspecified | Remains **BLOCKED BY BACKEND**. No arbitrary timer, offline period, token-refresh protocol, new endpoint or new storage mechanism was introduced; explicit 401 handling remains in place | Existing `AppProviders.tsx`, `queryClient.ts`, session expiry tests; contract section below |

## Authorization boundaries

The composition root already supplies `actorId` from session persistence. New checks use that identifier to look up the current fixture account and status; they do **not** accept a role passed by a form. The normal caller cannot grant themselves Administrator rights by changing an operation's target or input role. These are fixture consistency checks, not a claim that code or browser storage under the browser owner's control is a real security boundary.

Each guarded admin operation validates the actor after the simulated request delay and immediately before its synchronous repository work. Account operations validate ownership in the same way, before target data/credential access. Existing route guards, the five-role model, separate administrative editing, personal-data masking and pending HTTP adapters remain intact. No fixture seed record or development credential was changed.

The last-admin failure uses `AppError` kind `validation`, code `LAST_ACTIVE_ADMINISTRATOR`, and this message:

> At least one active Administrator must remain. Activate another Administrator before changing this account’s role or status.

The existing Edit User error banner displays it; no UI redesign or new workflow was added. Denied updates do not change record fields, versions, credentials or successful audit events. This is the minimal approved safeguard, not a new approval/transfer chain. Final server-side policy and any stronger self-change restrictions still require product-owner confirmation.

## Session and cache behavior

The existing auth port now has optional fixture reconciliation/notification capabilities. Only fixture mode uses them. API mode has no invented current-user or refresh call and continues to fail explicitly where a contract is pending.

- The fixture auth adapter reads the current user from the repository on restoration and fixture notifications. It refuses inactive, deleted, mobile-only or role-mismatched sessions. A role change requires sign-in again rather than silently promoting or retaining privileges.
- A same-role scope change updates estate/division IDs in both context and existing sessionStorage. Scope comparisons ignore ID order. The existing cache-clearing callback drops resources loaded under the old authorization context, including other modules' cached data; their implementation code is unchanged.
- Role/status invalidation clears stored access and publishes signed-out context; route guards then return to login. Browser tests verify no remaining administrative navigation and no stored session after permitted self-demotion/deactivation. No manual route rewrites or new navigation policy were introduced.
- A name/email-only edit refreshes display information without clearing authorization caches. Normal My Profile name updates still work. Session publication maintains a current ref in event/effect handlers so older callbacks cannot patch a stale authorization snapshot back into state.
- Updating another employee leaves the signed-in user's session and cached data unchanged. No other browser tab's storage is modified. Store subscriptions are unsubscribed on provider cleanup.
- On restoration, a current fixture account can refresh a stale same-role scope. An invalid or changed role is not accepted from stored data. In particular, a fixture reset must not silently upgrade a stored lower-role session back to the seed Administrator role.

Fixture mutations remain in-memory and reset on a full page reload. This correction does not make deactivation or new accounts durable, or provide cross-tab/server revocation. A signed-out session stays absent after reload; explicitly signing in again after a fixture reset uses the original seeded demonstration account. That is demo reset behavior, not production account reactivation.

## Permanent regression coverage

`src/features/identity/p0Security.test.tsx` adds **23 tests** covering:

- All 20 administrative port operations for six unauthorized/missing actor cases, with whole-repository equality after denials; inactive Administrator and authorization changes during simulated latency; valid authorized reads/writes.
- All four self-service operations for missing/non-owner actors, Administrator cross-account self-service rejection, active-owner profile/password/preferences success and inactive-owner rejection.
- Last-active-admin deactivation and demotion, unchanged record/version/audit state on failure, allowed changes with another active Administrator, and an inactive second Administrator not counting.
- Current-session demotion/deactivation, scope update and cache clearing, unrelated user edits, profile-name continuity, and restoration after role/scope/status/removal/mobile-role changes.

`tests/e2e/identity-p0.spec.ts` adds **three permanent browser tests**:

1. Last-admin deactivation displays the existing form error and preserves the active account.
2. Self-deactivation with a second active Administrator clears the session and blocks admin route restoration.
3. Self-demotion with a second active Administrator clears stored access and privileged navigation, including after reload.

Two existing privacy tests were **strengthened**, not removed: previously a Supervisor data-layer actor could receive a redacted admin user record; they now require full denial and absence of employee/personal details (`identityAdmin.test.ts`, `src/app/identity.routes.test.tsx`). Existing assertions verifying Administrator masking remain.

## Verification

Final verification results are recorded below. All final checks passed; intermediate failures and rechecks are retained for transparency. Logs and browser artifacts are under ignored `test-results/p0-remediation/`; earlier investigation logs are also retained under `test-results/p0-*.log`.

| Check | Result |
|---|---|
| ESLint | Passed after fixing a new ref-during-render violation; final implementation publishes refs only in handlers/effects |
| `npm run typecheck` | PASS, exit 0, including a final recheck |
| `npm test -- --maxWorkers=1` (isolated final full suite) | PASS: **410 tests in 27 files**, 129.20s; no assertions/timeouts/retries changed |
| New P0 tests | 23 passed |
| Fixture production build (`VITE_DATA_SOURCE=fixtures npm run build`) | PASS, exit 0; final Vite build completed in 577ms |
| Identity/authentication/admin/shared-shell and Capture/Review browser regressions | PASS: **108 Playwright tests**, 7.3 minutes, Chromium, including all three new P0 browser cases |

During development, the old redacted-record assertions failed under the intentionally stricter authorization behavior and were replaced with stronger denial assertions. The first new browser test also had an ambiguous heading locator (both page `h1` and profile-card `h2`); it now asserts the intended level-1 heading. Concurrent full-suite runs encountered timing failures; assertions, timeouts and retry settings were not relaxed. One concurrent full run had 409 passes and one route-heading timeout; another had 407 passes and three 5-second test timeouts. The isolated Review route recheck passed all 16 tests. After browser completion, the final full-suite run with one worker passed all 410 tests, retaining every test and the existing timeouts. The initial three-test P0 browser run had two passes and the one ambiguous-locator failure; the final 108-test browser regression passed every test.

The browser command was:

```text
npm run test:e2e -- tests/e2e/identity-p0.spec.ts tests/e2e/identity.spec.ts tests/e2e/auth-flows-layout.spec.ts tests/e2e/login-layout.spec.ts tests/e2e/dashboard.spec.ts tests/e2e/deviceSessions.spec.ts tests/e2e/security.spec.ts tests/e2e/admin-settings.spec.ts tests/e2e/shell.spec.ts tests/e2e/sidebar.spec.ts tests/e2e/capture.spec.ts tests/e2e/review.spec.ts --workers=2 --output=test-results/p0-remediation/browser
```

This reuses existing responsive checks (including login/auth, administrator tables/drawers, shared navigation, and Capture/Review layouts). No out-of-scope feature test or code was edited.

## Files changed by this remediation

New:

- `src/features/identity/domain/administratorSafety.ts`
- `src/features/identity/infrastructure/fixtureAuthorization.ts`
- `src/features/identity/p0Security.test.tsx`
- `tests/e2e/identity-p0.spec.ts`
- `docs/audits/identity-p0-remediation.md`

Modified:

- `src/features/identity/application/ports.ts` — optional fixture session capabilities.
- `src/features/identity/application/authUseCases.ts` — fixture restoration and subscription forwarding.
- `src/features/identity/fixtures.ts` — trusted actor wiring for the account adapter.
- `src/features/identity/infrastructure/fixtureIdentityAdminAdapter.ts` — all-operation Administrator authorization and last-admin invariant.
- `src/features/identity/infrastructure/fixtureAccountAdapter.ts` — self-service ownership checks.
- `src/features/identity/infrastructure/fixtureAuthAdapter.ts` — current-record reconciliation and repository subscription.
- `src/features/identity/presentation/session/SessionProvider.tsx` — current context/persistence/cache reconciliation and safe session publication.
- `src/features/identity/identityAdmin.test.ts` — strengthened unauthorized record-read assertion.
- `src/app/identity.routes.test.tsx` — strengthened Identity route/data-boundary privacy regression.

The **20 pre-existing CSS changes**, the original audit report and all other user work were preserved. Shared UI tokens/layout styles, navigation, login composition, other feature modules and deployment configuration were not edited. No commit, push, merge or deploy was performed.

## Remaining blocked requirements and decisions

| Requirement | Status / required decision |
|---|---|
| Real authorization and account ownership | **BLOCKED BY BACKEND verification.** Identity service must independently authenticate the actor and authorize every request and target; client role/context is not sufficient |
| Current-user/session refresh | **BLOCKED.** Approve operation/payload and handling when role, active status or estate/division scope changes. No endpoint path guessed |
| Absolute and idle expiration | **BLOCKED.** Agree lifetime, authoritative timestamps, inactivity policy and 401 behavior; no duration invented |
| Token issuance/refresh/rotation and logout revocation | **BLOCKED.** Cookie versus bearer storage, refresh lifecycle, replay/concurrency and failure behavior need a server contract |
| Device/account revocation | **BLOCKED.** Define invalidation of all existing sessions and effect on in-flight requests; fixture account deactivation does not cascade device-session or assignment state |
| Offline/cross-tab/mobile behavior | **BLOCKED.** Define validity/revalidation, queued evidence preservation and cross-client invalidation. No arbitrary offline period implemented |
| Last-admin policy | Minimal no-zero-active-admin invariant is implemented as authorized. Product owner must confirm final server policy, self-change restrictions and any recovery path; no new approval chain created |
| Stronger privileged-action policy | Re-authentication, role/status-change reasons, deactivation dependency handling and approvals remain undefined; no speculative implementation |

The audit's P1/P2 findings remain outside this change: scope-reason bypass, inactive-estate division creation, mixed-offset audit ordering, production attention-link navigation, broader organization dependency/concurrency issues, UI Kit mismatches and operational KPI scope. They are not marked fixed by these P0 corrections.

## Readiness

The corrected fixture frontend provides a more consistent boundary for parallel frontend work. Other members may continue against existing interfaces and fixtures while coordinating shared role/scope/session changes. **Production security enforcement, live authentication/session lifecycle, backend integration and security certification remain unverified/blocked.**
