# Identity / Administrator final audit — Member 1

Date: 18 November 2026 (Asia/Colombo). Repository: `D:\TeaLeaf-Web-Development - Copy\tealeaf-web`. Audited HEAD: `cdfb450` plus the **20 pre-existing, uncommitted CSS changes** present at the start of this audit. Those changes are part of the assessed working tree, not fixes made by this audit.

## A. Executive summary

**Ready for other members to begin parallel frontend development against the existing session, role, routing, UI and fixture interfaces, with the qualifications below. Not production-ready, not fully backend-integrated, and not yet conformant to the supplied WEB UI KIT.** The implementation is substantial and usable; a rewrite would discard working functionality.

- All current Identity/Administrator route entries resolve to implementations or intentional legacy redirects. User, estate, division, session and profile fixture workflows work. Audit Logs and versioned System Settings exist; older reports that say they are absent are obsolete.
- The approved removal of the Roles & Permissions screen and Permission Matrix is implemented. The Users table has exactly Employee, User ID, Role, Assigned Scope, Status and Actions; email remains searchable and available in forms/details. Estate Details has the approved three organizational summaries.
- Authentication beyond fixture password sign-in is **UI/use-case complete but service-pending**: no fixture MFA challenge, real OTP, invitation, activation or recovery is issued. Identity HTTP adapters deliberately reject as `contract_pending`; there is no approved endpoint integration to verify.
- Existing automated checks passed: TypeScript, ESLint, production build, **387 tests in 26 Vitest files**, and **83 Identity/shared-shell Playwright tests**. Additional browser inspection passed **136 route/width checks plus 3 zoom-equivalent checks**. This does not establish security enforcement or complete interaction-state coverage.
- Targeted negative probes confirmed gaps despite passing tests: fixture administration/account ports lack caller authorization; the sole Administrator can be deactivated; Edit User changes scope without the dedicated workflow's reason; deactivation leaves active device sessions; inactive estates accept divisions through the service; timestamp sorting misorders mixed offsets.
- A production-preview probe confirmed the dashboard's Accounts requiring attention link changes the hash route to `#attention` and opens **Page not found**.
- UI kit mismatches are concrete: page titles 26 rather than 24px, body 13.5 rather than 16px, captions 12 rather than 13px, different brand/semantic colors, additional spacing/radius values. Keep Inter and the approved login photograph; do not blindly rescale shared styling.

**Changes made:** this report only among publishable project files. Temporary probes, screenshots, extracted PDF text and logs are under ignored `test-results/audit-20261118/`. No application code, existing tests, dependency manifests, deployment configuration or original repository were changed. No commit, push, merge or deployment was performed.

### Evidence and boundaries

Code paths below are relative to this repository. Line references describe this working tree. Browser evidence is local and ignored, not a committed test suite:

| Evidence | Location / meaning |
|---|---|
| Current route inventory and guards | `src/app/routing/screens.ts:32–49`, `src/app/routing/routes.tsx`, `src/app/routing/guards.tsx` |
| Browser workflow results | `test-results/audit-20261118/e2e.log` — 83 passed, 4.2 minutes |
| Responsive and negative probes | `test-results/audit-20261118/inspect.mjs`, `inspection.json`, `inspection.log`, `layout-progress.json` |
| Production hash-link reproduction | `test-results/audit-20261118/production.mjs`, `production.json` |
| Static import graph | `test-results/audit-20261118/architecture.json` |
| Actual inspected design reference | `C:\Users\ASUS\Downloads\Mobile UI Kit\TeaLeaf\WEB UI KIT • components and tokens.pdf`, page 1; text and rendered image saved as `ui-kit-1.txt` / `.png` under the evidence directory |
| Screenshot samples | `-admin.png`, `-admin-users.png`, `-admin-divisions-DIV-001.png`, `-admin-settings.png` under the evidence directory |
| Existing specification dependencies | `docs/api-integration/pending-contracts.md`, `docs/identity-status.md` |

The local PDF was actually extracted, rendered and inspected. No additional Figma request was made. The latest login's exact approved composition was not independently compared with a current approved screenshot; source comments and existing layout tests are evidence of implementation, not visual parity. The older `docs/admin-module-audit.md` was consulted as historical context, not treated as current proof. No backend repository, gateway, real Identity service, browser screen reader, Safari or Firefox was tested. No claim of exhaustive penetration testing, dependency vulnerability scanning, full Git-history secret scanning or WCAG certification is made.

## B. Page-by-page audit

All `/admin/*` pages intend an **Administrator**; `/profile` serves the signed-in web user. The following names/IDs are the current repository inventory, not newly invented Figma frames. ID-17–19 are implemented extensions recorded in the route manifest.

| Screen / route | Purpose and working frontend interactions | Classification / required improvement / unnecessary content | Backend and testing limits |
|---|---|---|---|
| AUTH-01 Login `/login` | User ID/password validation, generic unknown/wrong-password error, password visibility, Remember User ID, safe return path, disabled/mobile-only account handling, MFA/enrollment routing, photographic hero | **KEEP** layout, photo and functionality. **BLOCKED BY BACKEND** live authentication. `presentation/pages/auth/LoginPage.tsx`, `LoginPage.module.css` under Identity | Fixture password login works; API sign-in sends no request. `identity.test.ts`, login-layout and shell E2E passed. Exact latest-reference parity NOT VERIFIED |
| AUTH-02 Verify Your Identity `/login/verify` | Administrator TOTP entry, code validation, expired/incorrect/attempt-limit messages, return to login | **KEEP**, **BLOCKED BY BACKEND**. `presentation/pages/auth/MfaPages.tsx` | Test stubs exercise use cases; fixture login never issues MFA. An unavailable flow is not a working authenticator |
| AUTH-03 Set Up Two-Factor Authentication `/login/mfa-setup` | Enrollment context, server-supplied QR/setup key, confirmation and recovery-code presentation | **KEEP**, **BLOCKED BY BACKEND**. Same source | No generated mock secret or accepted demo OTP. Real QR/token lifecycle unverified |
| AUTH-04 Forgot Password `/forgot-password` | Company User ID validation, keyboard submission, service-unavailable feedback | **KEEP**, **BLOCKED BY BACKEND**. `presentation/pages/auth/RecoveryPages.tsx` | E2E verifies unavailable service honestly, not successful email delivery |
| AUTH-05 Verify Your Email `/forgot-password/verify` | OTP form, expiry/resend timing, missing-context handling and errors | **KEEP**, **BLOCKED BY BACKEND** | No email/OTP backend; success paths are stubbed tests, not operational fixture recovery |
| AUTH-06 Create a New Password `/forgot-password/reset` | Password minimum and matching confirmation, reset authorization checks | **KEEP**, **NEEDS REQUIREMENT CONFIRMATION** full backend password policy | UI minimum 12 characters; server policy, reset session expiry and final codes unapproved |
| AUTH-07 Password Updated Successfully `/forgot-password/complete` | Confirmed-reset completion and return to login; no automatic sign-in | **KEEP** guarded completion state. Actual route is declared in `AUTH_FLOW_SCREENS`; backend-dependent entry | No end-to-end reset can reach it with current adapters |
| AUTH-08 Activate Your Account `/activate` | Reads invitation token once, removes it from URL, missing/invalid/expired/used states, password setup and enrollment next step | **KEEP**, **BLOCKED BY BACKEND**. `presentation/pages/auth/ActivateAccountPage.tsx` | E2E verifies token removal and unavailable-service state; real invitation and activation unavailable |
| ID-02 Administrator Dashboard `/admin` | Organizational KPIs, users by role, account lifecycle, estate coverage, security alerts, pending recovery, recent administrative activity, configuration summary, quick actions | **KEEP** administrative content. **IMPROVE P1** broken attention hash link and count semantics. Export **NEEDS REQUIREMENT CONFIRMATION** | `AdminDashboardPage.tsx:96`, dashboard child cards. Dashboard E2E passed; additional production probe found a missed link failure |
| ID-03 User Management `/admin/users` | Correct six columns, employee-name/details links, email/name/ID search, role/estate/status filters, reset, sort before pagination, actions and create | **KEEP**. EMAIL column remains removed. Export optional approval item; do not delete automatically | `UsersPage.tsx`; fixture list works, real paginated list contract pending. Identity E2E checks sorting, filters and navigation |
| ID-04 User Detail `/admin/users/:userId` | Overview, role-specific contact/staff fields, email, masked personal data, scope, sessions, activity, edit links and breadcrumbs | **KEEP**. **IMPROVE** mixed derived/audited activity and chronology. Personal fields are not fully editable; confirm intended lifecycle | `UserDetailPage.tsx`, `fixtureRecords.ts:175`; current backend profile/privacy schema pending |
| ID-05 Create User `/admin/users/new` | Five predefined roles, common and role-specific fields, role-aware scope, duplicate email/staff/NIC validation, review dialog, saved detail page | **KEEP**. Invitation result correctly says not sent in demo. **BLOCKED BY BACKEND** provisioning | `UserFormPage.tsx`, `UserFormSections.tsx`, domain rules/use cases. Creation is not issuance of credentials; new fixture users do not automatically receive a web password |
| ID-06 Edit User `/admin/users/:userId/edit` | Edits account fields, role/status/scope, preserves unsupported multi-estate draft scope, optimistic version conflict/reload | **IMPROVE P0/P1** self-admin safety, current-session reconciliation, reason bypass and confirmation/impact review | `UserFormPage.tsx:344–369`, `queries.ts:99`, adapter `updateUser:327`. Tested success/409 is not coverage of administrative lockout |
| ID-07 Roles & Permissions (removed) | `/admin/roles` and `/admin/roles/:role` intentionally redirect to Audit Logs | **KEEP removal**. No standalone page, matrix or sidebar entry. Keep RBAC utilities, role catalog and pending ports | `routes.tsx`, `navigation.ts`; legacy redirect E2E passed. Permission codes are catalog content, not a verified backend permission model |
| ID-08 User Scope Assignment `/admin/users/:userId/scope` | Estate/division tree, expansion, effective preview, reset, mandatory reason, confirmation, stale-version recovery | **KEEP** dedicated workflow. **IMPROVE P1** make equivalent writes obey the same reason rule | `UserScopePage.tsx`, `identityUseCases.ts:updateUserScope`; scope E2E passes; Edit User bypass reproduced separately |
| ID-09 Estate Management `/admin/estates` | Search, region/status filters, sortable list, add/edit/status confirmation, division navigation | **KEEP** organizational operations. **REMOVE CANDIDATE / confirm scope** Observations column and Observations by estate chart | `EstatesPage.tsx:138,163`. No automatic deletion; those operational metrics expand Member 1's data dependencies. No optimistic estate version contract |
| ID-10 Estate Detail `/admin/estates/:estateId` | Total Divisions, Assigned Employees, Estate Status; Divisions/Team/Activity tabs, user/child links, edit and add division | **KEEP** approved organizational summaries. Four prohibited operational KPI cards are absent. **IMPROVE** service enforcement behind disabled Add division | `EstateDetailPage.tsx`, `EstateDetailPage.module.css`; estate tab and status E2E passed |
| ID-11 Division Management `/admin/divisions` | Search, estate/status filters, sorting, pagination, add/edit/status feedback and worker/estate links | **KEEP** management. **REMOVE CANDIDATE / confirm scope** observation/pending-review columns; Export optional | `DivisionsPage.tsx:173–174`; real list/search/versions blocked by contracts |
| ID-12 Division Detail `/admin/divisions/:divisionId` | Parent estate, worker/supervisor links, edit/status, organization profile; read-only observations | **IMPROVE P1 / REMOVE CANDIDATE** operational KPI row and recent-observation table. Open review queue only displays guidance, not navigation | `DivisionDetailPage.tsx:63–95`; operational content still includes observations, verified, pending review and expert-confirmed cases. It does not implement a review action |
| ID-13 Device Sessions `/admin/device-sessions` | User/status/time search/filters, sort/page/refresh, details drawer, revoke confirmation, feedback, recovery request | **KEEP** fixture interaction. **BLOCKED BY BACKEND** real device revocation. **NEEDS REQUIREMENT CONFIRMATION** admin reason selection | `DeviceSessionsPage.tsx`, adapter `revokeDeviceSession:515`. Tests cover drawer focus/close and revocation |
| ID-13 Controlled recovery `/admin/device-sessions/:sessionId/recovery` | Existing/new request progress and links, revoked-session remains revoked | **KEEP** clearly limited progress view. **BLOCKED BY BACKEND** worker verification, replacement session and queue revalidation | `SessionRecoveryPage.tsx`; a fixture request records initial steps only, not recovery completion |
| ID-14 My Profile `/profile` | Current-user name/language, password/current-password validation, preferences, security focus link, logout; session display name updates after save | **KEEP** authorized UI. **IMPROVE** caller ownership at fixture account boundary. **NEEDS REQUIREMENT CONFIRMATION** translation/delivery semantics | `ProfilePage.tsx:43,133`, `fixtureAccountAdapter.ts`; preferences/password are tab-memory-only, not actual notification delivery; interface remains English |
| ID-15 Access Denied `/forbidden` or in-place guard | Role-aware 403 state and return to role home, no admin controls for other roles | **KEEP**. Source explicitly records no dedicated Identity Figma frame | `AccessDeniedPage.tsx`, `guards.tsx`. E2E denial passes; backend enforcement NOT VERIFIED |
| ID-16 Session Expired `/session-expired` | Expired state, local session discard, sign-in return; query 401 bridge clears cached data | **KEEP**, **BLOCKED BY BACKEND** absolute/idle expiry and refresh | `SessionExpiredPage.tsx`, `SessionProvider.tsx:74`, `AppProviders.tsx`. Explicit 401 behavior is not a timer or token lifecycle |
| ID-17 Security Center `/admin/security` | Four read-only tabs: overview, authentication policies, devices and shared security audit events; contextual links | **KEEP** separation from Settings. **IMPROVE** MFA count wording: counts all Administrators while enrollment status is not reported | `SecurityCenterPage.tsx:119–125`, `securityPolicies.ts`. No editable policy duplication; no real enforcement proven |
| ID-18 Audit Logs `/admin/audit-logs` | Central read-only list/detail, search/date/actor/module/action/outcome filters, pagination, role/scope/status history | **KEEP**. **IMPROVE P1** timestamp ordering and missing security event source | `AuditLogsPage.tsx`, `audit/AuditLogTable.tsx`, `fixtureAuditLogAdapter.ts:51`, `domain/auditLog.ts:142`; shared records reused by Security Center |
| ID-19 System Settings `/admin/settings` | Six tabs, draft/save/discard/preview, validation, reasoned publish, conflict detection, version history and rollback as a new version | **KEEP** config lifecycle, **BLOCKED BY BACKEND** runtime effects. Rule/action options require confirmation before integration | `SystemSettingsPage.tsx`, `settings/SettingsSections.tsx`, `fixtureConfigurationAdapter.ts`. E2E draft→publish→rollback→audit passes; no rule execution or maintenance activation |

The authentication completion route should be consumed from `src/app/routing/screens.ts` rather than copied from documentation; the endpoint and state contract are still pending.

## C. Feature inventory and interaction status

| Category | Working frontend | Demonstration-only / deliberately unavailable |
|---|---|---|
| Organization/accounts | CRUD-style user, estate and division forms; validation; linked details; role/scope/status edits; users and scope version checks | In-memory records reset on reload. No mail/SMS, invitation delivery, backend account creation or production version checks |
| Lists/navigation | Sidebar, breadcrumbs, role home, name links, table actions, search/filters/sort, pagination on users/divisions/sessions/audit; old roles redirects | Estate list has no pagination (small fixture list; scaling contract needed). Global top-bar search and Notifications show explicit later-phase messages |
| Dialogs | Create-user review; scope reason and confirmation; organization status confirmation; session details/revoke; audit details; config preview/publish/rollback | Edit User saves directly, including privileged changes; no comprehensive dependency-impact review |
| Feedback/states | Query loading boundaries, retry/error/empty states; field errors; success banners/toasts; 409 reload paths; permission and expired states | Most API failure presentation is exercised with simulated errors or pending adapters, not a real service |
| Authentication | Fixture User ID sign-in, tab session, User-ID-only remembering, local sign-out, role guards and safe internal return paths | MFA, OTP, activation, reset service and remote sign-out are unavailable, not simulated successes |
| Security/history | Read-only policies, role/scope/status audit entries, fixture revoke/recovery, draft/config event history | No sign-in attempt/lockout/MFA/password-recovery event source; no verified server policy or durable audit retention |
| Enterprise configuration | Versioned tab-local document, dependent-field validation, protected options, rejected-publish audit | No runtime engine, notification transport, settings propagation, workflow changes or maintenance enforcement |
| Exports | Buttons produce honest simulation feedback | No file; approval, format, authorization and backend job contracts unknown. Optional, not automatically unnecessary |

Sources: `presentation/services/queries.ts`, `presentation/components/OrganisationModals.tsx`, `presentation/components/common.tsx`, `presentation/components/helpers.ts`, `src/app/layouts/TopBar.tsx:40`, the page sources in section B, and `docs/api-integration/pending-contracts.md`.

### System Settings specifics

- General Settings: organization, support email, time zone, date format and default language are editable draft values. Validation exists; publishing does not reconfigure the application. Source: `domain/configuration.ts`, `application/configurationUseCases.ts`, `settings/SettingsSections.tsx`.
- Feature Center: GPS Validation, Offline Mode and Image Upload are protected; Notifications can be drafted. No downstream component consumes these settings as runtime feature flags.
- Business Rules: predefined templates only. High Severity Notification is blocked by the absent severity field. GPS accuracy and reminder thresholds are unset until entered; dependencies and positive-integer rules are validated. Allowed GPS actions and recipient roles are frontend proposals, not proven service contracts.
- Workflow Configuration: protected review/correction/referral state diagrams with reporting parameters, not editable state machines. Keep the read-only distinction; confirm ownership of any operational timing rule with the owning member.
- Maintenance Mode: activation unavailable; planned notice/window can be drafted. No false claim that login or synchronization is blocked.
- Configuration History: save/discard/publish/rollback/rejected publish generate shared fixture audit events. Publish/rollback require a reason; rollback creates a new version and refuses an open draft. A stale base is rejected. Durable history, server validation and sensitive-action re-authentication are pending.

## D. UI/UX, responsive and accessibility audit

### UI kit differences — verified against PDF page 1

`src/shared/design-system/tokens.css` still cites an older Figma size-halving convention. That explains the current scale but does not resolve its disagreement with the supplied WEB UI KIT. The PDF itself specifies sizes directly; do not halve its 16px body value again.

| Role / token | Supplied kit | Current working tree | Finding |
|---|---|---|---|
| Display | 32px bold | hero KPI 34px/700 | **IMPROVE P1** reconcile approved scale |
| Heading | 24px bold | page title 26px/700 | Browser confirmed 26px on dashboard/users/settings |
| Title | 18px bold | modal 22px/700; card/section 16px/600 | Multiple differing mappings; review hierarchy intentionally |
| Body | 16px regular | body 13.5px/400; table 13px; sidebar 13.5px tokens | Dense rendering; not kit-equivalent |
| Caption | 13px | 12px; table heading 11px | Small text is consistent internally but below supplied scale |
| Primary | `#338732` | `--tl-primary-500: #2e7d32` | **IMPROVE P1**, not a contrast failure by itself |
| Forest | `#214622` | forest-900 `#12351f`; sidebar `#062f1d` | Different palette, including sidebar-specific override |
| Leaf | `#4C8A40` | multiple greens; no equivalent approved leaf token | Reconcile palette, preserve established role semantics |
| Canvas / Surface | `#F6F8F4` / white | `#f4f7f3` / white | Canvas differs; surface matches |
| Danger / Warning | `#A1120B` / `#9A6300` | danger text `#a8221a`, solid `#b3261e`; warning text `#7a4f00` | Semantic differences |
| Success background | `#EAF3E8` | mint-100 `#e3f2da`, mint-50 `#e8f5e0` | Different success surfaces |
| Spacing | 4/8/12/16/24/32 | Includes these plus 2/3/5/6/10/14/20 | **P2** distinguish approved exceptions from accidental drift |
| Radius | 8/12/16 | Also 6/10/14/20 | **P2** document pills and intentional exceptions before cleanup |

Keep the existing Inter family. Desktop screenshot inspection confirms coherent cards, aligned table controls and readable hierarchy, but that is not exact kit parity. Login intentionally uses a separate photographic composition and literal responsive sizes; do not apply a global typography replacement to it. Source: `LoginPage.module.css:22–30` and its responsive sections.

### Actual responsive results

The additional browser probe visits 17 Identity/admin paths (section B, excluding intentionally redirected legacy roles and public auth variants) as the Administrator at each width. Each path waits for visible page content and loaded tables. Public auth variants and security/settings tabs have additional existing E2E coverage.

| Width | Height | Route samples | Document overflow | Browser exceptions / unlabelled form-control scan |
|---|---|---:|---|---|
| 320 | 900 | 17 | None | None |
| 375 | 900 | 17 | None | None |
| 430 | 900 | 17 | None | None |
| 768 | 900 | 17 | None | None |
| 1024 | 900 | 17 | None | None |
| 1440 | 900 | 17 | None | None |
| 1920 | 900 | 17 | None | None |
| 3840 | 2160 | 17 | None | None |
| 640 CSS px (200% equivalent of 1280×720) | 360 | 3: Create User, Profile, Settings | None; final enabled main control scrolls into view | No browser exceptions |

The existing login/auth suite separately passes keyboard order, viewport fitting and 200% zoom-equivalent checks. This is CSS viewport reflow, not a manual browser-zoom or assistive-technology certification. Data-heavy pages can and do scroll vertically. A scrollable table is not a document-overflow failure. All sampled pages ultimately had an `h1`; there were no unlabelled inputs/selects/textareas under the probe's labels/ARIA check.

### Accessibility observations and limits

- **KEEP:** native labelled fields, error text, named tables/regions, `aria-sort`, tab roles and keyboard handlers, visible focus tokens, skip link, drawer focus restoration, modal Escape handling and focus trapping. Evidence: `src/shared/components/Overlay/Modal.tsx:52–125`, `Tabs/Tabs.tsx`, `DataTable/DataTable.tsx`, and passed device/sidebar/auth E2E.
- **IMPROVE P2:** generic Modal uses `aria-modal` and focus trapping but does not itself make background content inert. The mobile shell additionally manages background accessibility. Validate nested confirmation-over-details behavior and screen-reader traversal before changing this shared component; a global fix affects every module.
- **Contrast spot-check:** current primary `#2e7d32` on white is 5.13:1; supplied primary `#338732` on white is 4.51:1. Current subtle text `#6b7a72` is 4.51:1 on white but **4.18:1 on canvas `#f4f7f3`**. `Feedback/Feedback.module.css:119–121` uses this token for small metadata. **P2:** inspect actual error/empty-state background combinations and adjust only confirmed failing placements; no assertion that every occurrence fails. This is a token calculation, not a complete rendered contrast audit.
- Text wrapping, table scroll regions and modal sizing are covered by the listed responsive tests; long localized strings, unusually large datasets, all modal/validation states at every width, OS text enlargement and real screen-reader output remain unverified.

## E. Architecture audit

### Current layout and separation

```text
src/features/identity/
  domain/                  models, scope, rules, roles, session, auth flows,
                           dashboard, audit and configuration
  application/             ports and use cases
  infrastructure/          fixture, pending and HTTP adapters; browser persistence
  presentation/
    components/            Identity-specific forms, shared Identity states/helpers
    pages/auth/            login, MFA, recovery, activation, denial, expiry
    pages/admin/           users, organization, devices, security, audit, settings
    pages/account/         profile
    services/              query/mutation hooks and service context
    session/               session and transient auth-flow providers
  index.ts / pages.ts / fixtures.ts / http.ts
src/app/                   composition, providers, layouts, lazy routing
src/shared/                API errors/client, design tokens, common controls/utilities
src/fixtures/              shared synthetic dataset and in-memory repository
tests/e2e/                 browser workflows
```

- **KEEP:** feature boundary, ports/use cases, composition-root adapter selection, lazy `pages.ts` entry and centralized shared controls. `src/app/composition/container.ts` is the legitimate integration point, not misplaced Identity presentation.
- Static import analysis examined **93 Identity TS/TSX files including tests**, following static imports, re-exports and literal dynamic imports. It found **no Identity-touching cycles, no unreferenced non-test file candidates, and no direct imports from Identity into another feature**. This is a bounded static check, not proof against every computed import or runtime dependency.
- Shared organization/session/role types live outside Identity legitimately. Identity fixture projections in `fixtureIdentityAdminAdapter.ts:getDivision` and `fixtureRecords.ts` depend on observations/cases in the common fixture database; this is **data coupling** even without cross-feature imports. Remove unnecessary operational projections only after scope approval.
- No concrete duplicate shared component requiring deletion was established. Security Events intentionally reuses `AuditLogTable`; dashboard cards reuse common sources. Do not mistake that reuse for duplicate audit systems.
- Form validation and use-case validation overlap intentionally to provide immediate feedback and protect non-form callers. Keep both. Move genuinely identical rule definitions to domain functions only when verified; do not remove boundary validation.
- Shared tokens/layouts were already dirty at audit start and affect Review/Capture/other members. Any future correction requires an impact list and cross-module regression checks before editing; this audit did not change them.
- Unused CSS and unnecessary dependencies were reviewed through references/configuration/imports, but **no safe deletion set was established**. Existing lint/typecheck pass. Names, literal selector searches and a route's lack of direct imports are insufficient grounds for deletion. Package-wide vulnerability and bundle optimization audits are outside this evidence set.
- Temporary-access domain/ports/adapters and permission utilities remain deliberately available for later Supervisor work despite removed Administrator UI. **KEEP infrastructure**; approval authority/status contracts need confirmation. Source: `domain/accessGrants.ts`, `application/accessGrantUseCases.ts`, `pendingAccessGrantAdapter.ts`, pending-contracts documentation.
- **P2 documentation drift:** `docs/admin-module-audit.md` still describes missing Audit Logs and the old roles matrix; `docs/identity-status.md` contains older counts and Figma access notes. This report supersedes those assertions, not their historical provenance.

## F. Security/correctness findings

Priority meanings: **P0** blocks a trustworthy production Identity release; **P1** significant required correctness/usability work; **P2** refinement or confirmation. P0 findings in fixture adapters are **not claims of a live backend breach**. Frontend code is not a security boundary; backend enforcement remains mandatory.

| ID / classification | Exact finding and evidence | Priority / recommendation |
|---|---|---|
| SEC-01 **IMPROVE** | Fixture admin use cases/adapters do not require an active Administrator. Probe with actor `USR-003` listed 13 users and successfully updated `USR-001`. `fixtureIdentityAdminAdapter.ts:121` checks role only to decide personal-data visibility, not authorization of operations. `identityUseCases.ts` validates inputs, not caller permissions | **P0 release gate.** Enforce expected role at fixture boundary for faithful demos/tests and require server authorization for all real calls. Preserve existing route guards |
| SEC-02 **IMPROVE** | Fixture account adapter accepts arbitrary `userId` without current-actor ownership. A Supervisor probe updated the Administrator's profile name. `infrastructure/fixtureAccountAdapter.ts:updateProfile/getProfile/changePassword/setNotificationPreference` has no actor provider | **P0 release gate.** Self-service ownership must be verified at backend and mirrored in fixture contract tests; do not regard current-user UI binding as sufficient |
| SEC-03 **MISSING / NEEDS REQUIREMENT CONFIRMATION** | Last-active-admin safeguard absent. Deactivating `USR-001` through `admin.updateUser` succeeded and left **0 active Administrators**. `fixtureIdentityAdminAdapter.ts:327` | **P0** agree last-admin/self-deactivation policy before production; add service and UI tests. Do not invent a transfer/approval workflow |
| SEC-04 **IMPROVE** | Admin editing self role/status/scope does not update or invalidate session context. `queries.ts:88,99` only invalidates Identity queries; `UserFormPage.tsx:347` only navigates; `SessionProvider.tsx:80` updates session only when explicitly called. Restore accepts source-matching stored role/scope without current-record verification | **P0 release gate** for authorization consistency. Reconcile session/current-user data and server-invalidated access; define token refresh and policy. Profile name update already does call session update |
| COR-01 **IMPROVE** | Dedicated scope change requires reason, while Edit User changes scope with none. Probe produced `scope_updated` event for `USR-002`, EST-001→EST-003, previous/new scope present but no `reasonCode`. `identityUseCases.ts:updateUser` vs `updateUserScope`; adapter lines 327/368 | **P1** one privileged-scope rule across both flows; approval needed on whether role/status changes also require a reason |
| COR-02 **NEEDS REQUIREMENT CONFIRMATION / MISSING** | Account deactivation left device session `DS-3091` **active**. Update only mutates user/credential fields, not sessions/dependent work. `fixtureIdentityAdminAdapter.ts:updateUser` | **P1** confirm effect on sessions, scope and dependent assignments; add impact feedback. Backend must enforce disabled accounts irrespective of displayed session status; do not invent cascading assignment transitions |
| COR-03 **IMPROVE** | UI disables Add division for inactive estates, but a direct use-case call created active `DIV-010` in an inactive estate. `fixtureIdentityAdminAdapter.ts:481` checks existence only; `identityUseCases.ts:createDivision` checks draft fields | **P1** enforce the UI's established inactive-parent restriction at the application/repository boundary |
| COR-04 **IMPROVE** | Audit/history sorts ISO timestamp strings via `localeCompare`. Probe sorted `10:00+05:30` (04:30Z) ahead of `05:00Z`, although the latter is newer. `fixtureAuditLogAdapter.ts:51`, `domain/auditLog.ts:142`, `fixtureRecords.ts:124,175` | **P1** chronological instant comparison. Decide date-filter timezone; current filter takes each record's written calendar date (`auditLog.ts:126`) |
| NAV-01 **IMPROVE** | Production preview: clicking Accounts requiring attention changes `/Test-web/#/admin` to `/Test-web/#attention` and renders **Page not found**. `AdminDashboardPage.tsx:96` uses a plain fragment anchor; `src/app/App.tsx` uses hash routing for Pages | **P1** scroll without replacing router hash; add a production-base navigation regression test. No deployment changes needed to fix the page interaction |
| COR-05 **IMPROVE / NEEDS REQUIREMENT CONFIRMATION** | Estate/division update signatures lack expected versions. Concurrent changes can overwrite each other; no version check in adapter `updateEstate:430` / `updateDivision:496`, unlike users and configuration | **P1** agree record version/ETag contract before server integration; add concurrency tests |
| COR-06 **NEEDS REQUIREMENT CONFIRMATION** | Role/scope edits can invalidate linked worker/supervisor relationships and historical fixture assumptions; resolveRoleDetails checks newly named people, not all dependents. No reassignment/coverage impact review | **P1** agree invariant and historical-scope semantics with owning members. Historical decisions must not be reinterpreted blindly using current scope. Older audit claims about exact integrity-error counts were not rerun here |
| AUD-01 **MISSING / BLOCKED BY BACKEND** | Failed/successful login, logout, password change, MFA and recovery events are not appended by current auth/account adapters. Audit page explicitly discloses missing sources. Role/scope/status changes **are now separate audited events** | **P1** real service audit source, immutable retention and defined sensitive-data redaction; do not synthesize enforcement events |
| SES-01 **BLOCKED BY BACKEND / NEEDS REQUIREMENT CONFIRMATION** | Session has `signedInAt`, no expires-at/idle handling; restore only validates storage shape and source. `domain/session.ts`, `browserSessionPersistence.ts`, `authUseCases.ts:75`. Expiry comes from explicit 401 bridge | **P0 production integration gate**, not grounds to add an arbitrary timeout. Confirm absolute/idle/refresh/offline rules and current-user refresh |
| UX-01 **IMPROVE** | Accounts requiring attention KPI uses raw `data.attention.length`; card excludes duplicates already in pending actions. Some seeded entries have no recorded reason. MFA overview counts all Administrators while enrollment unknown | **P1** align KPI/list populations and use wording distinguishing policy applicability from known pending enrollment. Sources: dashboard line 99, `dashboard/AttentionCard.tsx`, `SecurityCenterPage.tsx:119–125` |
| UX-02 **IMPROVE / NEEDS REQUIREMENT CONFIRMATION** | Edit User has no privileged-save confirmation while Create User and dedicated Scope do. Personal NIC/date-of-birth fields are create-only (`UserFormPage.tsx:212,533`) | **P1** confirm privileged confirmation and authorized personal-data correction requirements; do not unlock sensitive fields by assumption |

### Security measures that should remain

- API mode does not silently fall back to fixtures. Adapter selection is lazy and data-source-specific (`container.ts`, `http.ts`). Development account modules are not imported by API runtime; the public demo is intentionally a fixture build, not real authentication.
- Remember User ID persists only the identifier. Session persistence uses sessionStorage; older localStorage sessions are not restored. A fixture session cannot be reused in API mode (`authUseCases.ts:75–83`). This is useful hygiene, **not proof that client-stored session data is authoritative or tamper-proof**.
- MFA does not create a session until verification/enrollment confirms it. Transient challenge/recovery data stays in context; activation tokens are removed from the address bar. Safe internal return-path handling avoids accepting arbitrary external destinations.
- Local logout clears persisted session and query cache. Remote sign-out errors are swallowed after local logout; backend revocation remains unverified (`SessionProvider.tsx:56–70`).
- Masked NIC and Administrator-only personal detail presentation exist, and no passwords/tokens are intentionally placed in audit records. Real data minimization/authorization is a server responsibility. The fixture actor check for personal data itself does not check active status.
- Bounded pattern scan of `src/features/identity` and `src/app/composition` found no Gmail, private-key, GitHub-token or AWS-key patterns. Fixture credentials are explicitly synthetic. `.gitignore` excludes `.env`, generated builds, dependencies and test evidence. This is **not** a complete repository/history secret attestation; no real environment values were copied into the report.

## G. Backend integration readiness

**Separation is ready; contracts and enforcement are not.** `tealeaf-identity-service` was not accessed. Every required HTTP endpoint path below is **UNSPECIFIED / requires an approved contract**. Operation names are existing frontend ports/pending-adapter identifiers, not proposed REST URLs.

| Workflow / existing operation | UI / adapter status | Request and response requirements already represented | Errors / auth / blocker |
|---|---|---|---|
| `identity.auth.signIn`, `verifyMfa`, enrollment start/confirm, `signOut` | Login works in fixtures; all real auth operations pending (`httpAuthAdapter.ts`) | User ID/password; completed session or challenge/enrollment reference; TOTP verification; server enrollment details and recovery codes; session termination | Generic credential error, disabled/mobile-only denial, expired challenge and attempt limits. Token/cookie choice, refresh, revocation, server role/scope and MFA enforcement unresolved |
| `identity.recovery.request/resend/verify/complete` | Forms present; **both data sources use pending adapters** | User ID→non-enumerating request reference/masked destination/expiry/cooldown; OTP→reset authorization; new password | Rate limiting, expiry, resend and error-code contract; verified email and delivery service. No accepted mock OTP |
| `identity.activation.validate/activate` | UI/state handling present; pending adapter | Invitation token→user/role context; password→activation result and any mandatory enrollment | Expired/used/invalid token mapping, invitation issuance/statuses, secret lifetime and activation permissions |
| `identity.users.list/get/create/update` | Complete supported fixture UI; API adapter entirely pending | ID, names/contact/staff/language, predefined role/status, estate/division scope, role-discriminated fields, masked personal representation, version; create invitation result | Administrator authorization; uniqueness and field errors, 404, 409; pagination/filter schema; private-data access; last-admin and dependency effects |
| `identity.users.scope.update` | Fixture tree/confirmation/reason/409; pending API | Target user, estate/division selection, reason, expected version; saved role/scope/version | Actor authorization, valid/active topology, scope level, Reporting User scope decision, conflict mapping and server enforcement |
| `identity.estates.*`, `identity.divisions.*` | Fixture list/detail/create/edit/status; pending API | IDs, names, region/parent/status, organization relationships; administrative activity, versions where agreed | Uniqueness, inactive parent, dependent scope, status impact and concurrency contracts. Operational aggregates should not become mandatory Identity fields without scope approval |
| `identity.deviceSessions.list/revoke`, recovery get/request | Fixture controls work; API pending | Device ID, user, status/times/reason/scope; recovery reference/steps | Administrator auth; stale-state conflicts; permanent revoked/signed-out handling; worker/mobile verification, queue safety and replacement issuance |
| `identity.account.profile.get/update`, password and notifications | Fixture tab-local writes; API pending | Current account, permitted profile fields, language/preferences; current/new password | Self-service authorization, server password policy, 401/field errors; persistence and audit. Preference storage is not delivery |
| `identity.dashboard.get`, `identity.securityAlerts.list` | Fixture-derived read-only sections; API pending | Organizational counts, latest events, reasoned attention/open recoveries; alerts plus reportedKinds capability metadata | Separate unknown/unreported from zero; no guessed lockout/suspicion/MFA status; scoped Administrator aggregate contract |
| `identity.auditLog.list` | Fixture read-only list/detail/filter; pending API | Actor/target/action/time/outcome, before/after when recorded, reason, estate IDs; pagination/filter schema | Active Administrator authorization; durable server audit, redaction, timezone/ordering; frontend must not create an authoritative log |
| `configuration.get/draft.save/draft.discard/publish/rollback` | Fixture lifecycle complete; API pending | Versioned document/draft/history, base and target versions, reason; field error paths and newly created version | Administrator authorization, 409, policy/re-authentication, supported fields. Persistence is not evaluation; rules, notifications, workflow parameters and maintenance need separate approved enforcement |
| `identity.export` | Simulated feedback only; pending API | Approved dataset, format, filters and job/file result not specified | Approval, permission, sensitive-data scope and delivery contract; optional until required |
| Access grants / access history ports | Infrastructure retained, no Administrator granting UI; pending live contract | Existing typed grant request/date/scope/reason/status representation | Approval authority, allowed statuses, expiry and self-approval rules not confirmed. Do not expand UI or finalize permissions from fixture types |

Cross-cutting infrastructure already includes typed `AppError`, schema validation capability, cancellation, bearer injection, correlation IDs, optional idempotency key and 401 propagation (`src/shared/api/httpClient.ts`, `src/app/providers/queryClient.ts`). These mechanisms do not constitute completed Identity response schemas or approved REST contracts. Do not invent endpoints to fill the table.

## H. Testing results and quality

Executed on the existing working tree, not a cleaned or rewritten copy:

| Command / inspection | Result |
|---|---|
| `npm run lint` | PASS, exit 0 |
| `npm run typecheck` | PASS, exit 0 |
| `npm test` | PASS, 26 files / 387 tests, 33.73s; includes Identity domain/use cases, routes, session/auth flow and configuration/audit tests as well as existing shared/other-feature regression tests |
| `VITE_DATA_SOURCE=fixtures npm run build` (PowerShell environment assignment) | PASS, exit 0; TypeScript and Vite production output generated under ignored `dist/` |
| `npm run test:e2e -- tests/e2e/identity.spec.ts tests/e2e/dashboard.spec.ts tests/e2e/deviceSessions.spec.ts tests/e2e/security.spec.ts tests/e2e/admin-settings.spec.ts tests/e2e/login-layout.spec.ts tests/e2e/auth-flows-layout.spec.ts tests/e2e/sidebar.spec.ts tests/e2e/shell.spec.ts --workers=2 --output=test-results/audit-20261118/browser` | PASS, **83 tests**, 4.2m, Chromium; no test edits or suppressed failures |
| Additional `node test-results/audit-20261118/inspect.mjs` | Completed, exit 0; **139 layout/reachability observations**, no document horizontal overflow, no page errors, no unlabelled fields under its bounded scan; seven negative probes completed and exposed the listed issues |
| Additional `node test-results/audit-20261118/production.mjs` against local Vite preview | Confirmed **NAV-01 defect**, not a pass: attention link yields `http://127.0.0.1:5189/Test-web/#attention`, heading `Page not found` |
| Static import/reference inspection | 93 Identity source/test files; no detected Identity cycles or direct cross-feature imports; no safe unused-file deletion candidate |
| Local PDF and screenshot inspection | WEB UI KIT page 1 inspected; actual typography/palette mismatch recorded; exact latest login parity remains unverified |

The first exploratory responsive harness waited only for `h1` during startup and did not complete. It was rerun with content-ready heading handling and persisted per-route evidence; the final completed run found an `h1` on every sampled route. The production probe initially waited for `h1` after the broken link; its final inspection reads the actual not-found `h2`. These were changes to ignored audit probes, not changes to application/tests to hide errors. NAV-01 remains reported as a failure.

### Test quality and important uncovered cases

Existing tests assert real outcomes (creation visible in lists, sorting across pages, stale version no-save, device status, reason validation, URL navigation, audit before/after values, config history/rollback and no-request pending adapters). Auth flow unit tests use stub ports for success branches. Layout tests alone do not prove business completion. Review of names/pass counts alone was not used as evidence.

Missing permanent regression coverage includes:

1. Admin/account port authorization and ownership; last-active-admin changes; active session reconciliation after self role/status/scope edits.
2. Scope reason through **both** edit entry points; inactive-parent creation through use cases; role/scope dependency integrity and estate/division write conflicts.
3. Chronological audit ordering with mixed UTC offsets; date filtering in an agreed business timezone; audit of real security events.
4. Production-base/hash navigation for every dashboard action, specifically Accounts requiring attention. Existing dev-server E2E cannot expose this hash collision.
5. Real API mode success/error contracts; actual MFA/email/activation/recovery; token expiration/refresh, concurrent requests, durable session revocation and logout failure consequences.
6. Real screen-reader behavior, rendered contrast across all states, nested-dialog focus, long/localized text, larger datasets, and every modal/error state at each viewport. A 139-observation route sweep is not that full Cartesian test matrix.

No permanent tests were added for these findings because this is an audit-only task; targeted evidence is retained locally. Running the whole Vitest suite did not modify the out-of-scope modules.

## I. Recommended changes and ownership

### P0 — establish before production Identity integration/release

1. Agree the authoritative session/token/current-user/expiry contract with the Identity service owner; keep frontend guards as UX only. Live backend authorization is **NOT VERIFIED**.
2. Agree last-active-admin and self-change policy, and implement actor/ownership safeguards consistently in fixtures and real service contracts (SEC-01–04). Add negative tests first. Do not silently change assignment states or introduce guessed approval rules.
3. Require real service verification for privileged operations, MFA and session revocation before calling the module production-ready. The pending adapters are correct placeholders, not a finished integration.

### P1 — required frontend corrections after approval

1. Fix NAV-01 locally in the dashboard interaction and add a production-base regression test; no redesign required.
2. Unify scope-change reason handling across Edit User and Scope Assignment; reconcile self-edits with session context. Review privileged-save confirmation and dependent-record impact with the product owner.
3. Enforce inactive-parent restrictions at the service boundary; compare audit timestamps as instants; align dashboard attention and MFA count wording with reported data.
4. Reconcile the supplied UI kit with the older token source. First list consumers of changed shared tokens/components, agree exceptions, then verify other members' screens. Preserve Inter and the tea-estate login photograph.
5. Agree organization-only Division Details and whether operational columns/chart should remain on Estate/Division lists. **Remove candidates only after confirmation**; retain parent/worker/supervisor/status/administrative activity.
6. Finalize record concurrency, session/deactivation effects, personal-field correction rights and backend payloads without inventing contracts.

### P2 — optional refinement and cleanup

Document intended spacing/radius exceptions, review small metadata contrast placements, complete assistive-tech/nested-modal checks, refresh historical status documents, and decide Export requirements. Global search/notifications remain shared later-phase work, not grounds to expand Member 1 now. No verified orphan component/dependency should be deleted speculatively.

### Explicit keep / improve / remove / missing / integrate decisions

| Decision | Items |
|---|---|
| **Remain unchanged** | Clean Architecture, lazy mode selection, shared design-system reuse, route guards and role catalog, user email available outside the list column, five-role assignment, dedicated scope UI, organizational Estate Details, read-only Security Center and shared audit source, versioned configuration lifecycle, Inter font, photographic login |
| **Improve** | Findings SEC-01–04, COR-01–06, NAV-01, UX-01–02; UI-kit token mapping; appropriate service-level checks; reliable session reconciliation |
| **Remove** | Standalone Roles & Permissions/matrix already removed: keep removed. No new deletion was approved. Division operational KPIs/table and estate/division operational list metrics are **remove candidates**, not automatically disposable code |
| **Missing requirements** | Last-admin/self-change policy, dependency/cascade behavior, supervisor coverage/history semantics, Reporting User scope level, re-authentication, idle/absolute expiry, complete password/User-ID rules, activation lifecycle, personal-field correction, export scope, operational timing/rule ownership, server permission model |
| **Backend integration required** | All live Identity auth/admin/account/session/audit/config operations, durable versions, invitation/OTP/MFA/recovery transport, runtime config/rules/maintenance and notification enforcement |
| **Implement first after approval** | Production hash link and negative authorization/self-change regression coverage; then agreed safeguards and common scope reason handling; then contracts/session integration and scoped UI-kit corrections |

## J. Final verification matrix

| Feature | Implemented | Required | Issues | Recommendation | Priority |
|---|---|---|---|---|---|
| Login/photo and normal fixture authentication | Yes | Yes | Live service pending; exact latest visual parity unverified | KEEP UI; integrate approved auth | P0 integration / P1 visual review |
| MFA, enrollment, reset and activation | Forms/use cases yes; real operation no | Yes per recorded flow | Pending adapters in fixture/API modes | BLOCKED BY BACKEND, no mock security success | P0 integration |
| Session/role/estate/division authorization | UI guards and mode separation yes | Yes | Stale restored/self-edited session; no server enforcement evidence | IMPROVE and verify service | P0 |
| Administrator Dashboard | Yes, fixture | Yes | Attention hash link, count semantics | IMPROVE NAV-01 and UX-01 | P1 |
| User list/columns/search/details | Yes, fixture | Yes | Export simulated | KEEP correct columns/email behavior | P1 API / P2 export decision |
| User create/edit and role assignment | Yes, fixture | Yes | Last-admin risk; self-session stale; confirmation/impact gaps | IMPROVE after policy approval | P0/P1 |
| Permanent scope | Yes, fixture | Yes | Edit reason bypass, dependency/Reporting User policy | IMPROVE common invariant | P1 |
| Standalone roles/matrix | Removed, legacy redirects work | No, approved removal | None requiring restoration | KEEP removed; retain RBAC infrastructure | KEEP |
| Estates and organizational Estate Details | Yes, fixture | Yes | Inactive-parent boundary, versions, list operational chart | KEEP org detail; improve/confirm list scope | P1 |
| Divisions/details | Yes, fixture | Yes | Operational KPI/table scope, versions | Confirm remove candidates; preserve organization profile | P1 |
| Device listing/revoke | Yes, fixture | Yes | Not actual remote revocation; deactivation effects undefined | KEEP UI; backend/session integration | P0 integration / P1 effects |
| Controlled session recovery | Initial request/progress only | Yes | Worker verification/new session/revalidation absent | BLOCKED BY BACKEND/mobile contracts | P1 |
| Security Center | Yes, read-only fixture | Yes | MFA enrollment unknown; no enforcement proof | KEEP read-only; clarify count | P1 |
| Audit Logs | Yes, fixture read-only | Yes | Mixed-offset order; missing real security events | IMPROVE chronology; integrate durable source | P1 |
| System Settings six tabs | Yes, fixture config lifecycle | Yes | No runtime effects; some rule policies unconfirmed | KEEP lifecycle; no invented engine | P1 integration |
| Profile/password/preferences | Yes, fixture | Yes | Account adapter ownership; no durable writes/delivery | IMPROVE boundary, integrate backend | P0/P1 |
| 403 / session-expired screens | Yes | Yes | Actual expiration policy not defined | KEEP states; verify token lifecycle | P0 integration |
| Typography/colors/spacing/radius | Internally coherent, not supplied-kit conformant | Yes | Exact differences in D | Scoped approved design-system correction | P1/P2 |
| Eight-width responsive behavior | Sampled checks pass | Yes | Full state/device/assistive-tech matrix not verified | KEEP layout; extend targeted coverage | P2 |
| Architecture and cross-member boundaries | Suitable foundation | Yes | Fixture operational data coupling; shared-style changes affect others | Parallel frontend work can begin against existing interfaces | P1 coordination |

### Parallel-development decision

**Yes — other team members can begin parallel frontend development now using the existing public Identity exports, service interfaces, role navigation, app shell and synthetic fixture data.** They must treat those interfaces as frontend integration seams, not finalized Identity service contracts. They should not depend on Identity operational charts, runtime configuration enforcement, temporary grants, real tokens or live revocation being available.

Member 1 should retain ownership of session/auth contract changes and shared role/scope models, coordinate changes to shared tokens/components, and address the identified P0/P1 items. Other members can work behind their own ports with contract-pending behavior until the service contracts are approved. **Do not label Member 1 production-complete, security-certified, visually identical to the latest Figma or fully backend-ready.** No further application changes are authorized by this report.
