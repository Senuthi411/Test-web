# Identity delivery status

Scope: AUTH-01 and ID-02 through ID-16 only. Existing implementations and the login
viewport fix were preserved. No later-phase module has been implemented.

## Screen-by-screen audit

Names and frame references below come from the existing page source comments and
route inventory. Figma access was retried and denied, so these names cannot be
independently checked against the current Figma file. ID-15's source specifically
records that no Identity frame was available and that it follows the existing 403
visual language. No screen is a placeholder or missing in the source inventory.

"Fully implemented" below describes the supported fixture UI, not production API
integration or verified Figma parity. Every screen remains visually unverified.
Simulated exports and informational recovery steps are explicitly identified.

| ID | Recorded screen name / frame | Initial audit | Final fixture status | Working interactions | Remaining limitation |
| --- | --- | --- | --- | --- | --- |
| AUTH-01 | Login (enterprise reference, 2026-11-15) | Fully implemented | Fully implemented | User ID + password, validation, password visibility, Remember User ID, MFA step, disabled/expired/unavailable states, return path, reset guidance | Synthetic credentials only; MFA and live sign-in need the Identity API |
| AUTH-02 | Verify Your Identity (Administrator TOTP) | New | UI complete, service pending | 6-digit code, validation, incorrect / expired / too many attempts, Back to Log In | Needs `verifyMfa`; fixture mode never issues a challenge |
| AUTH-03 | Set Up Two-Factor Authentication | New | UI complete, service pending | Backend QR image or setup key, confirm code, recovery codes shown once, no skip | Needs the enrollment operations |
| AUTH-04 | Forgot Password? | New | UI complete, service pending | User ID validation, generic message, support note | Shows "Password reset service unavailable" until the API exists |
| AUTH-05 | Verify Your Email | New | UI complete, service pending | 6-digit OTP, backend expiry countdown (or the 5-minute policy), resend cooldown, invalid / expired / attempt limit | Needs the recovery operations |
| AUTH-06 | Create a New Password | New | UI complete, service pending | 12-character minimum, confirmation, expired authorisation | Backend password policy to confirm |
| AUTH-07 | Password Updated Successfully | New | UI complete | Only reachable after a confirmed reset; clears any session; no automatic login | — |
| AUTH-08 | Activate Your Account | New | UI complete, service pending | Token read once and removed from the URL; invalid / expired / used / missing links; Administrator enrollment next | Needs the activation operations |
| ID-02 | Administrator Dashboard (14:8) | Fully implemented | Fully implemented | Derived KPIs, estate and attention rows, activity links, Create user, export feedback | Export simulated |
| ID-03 | User Management (15:2) | Partially implemented | Fully implemented | Search, role/estate/status filters, sorting before pagination, row details, action menus, create, export feedback | Export simulated; no invitation service |
| ID-04 | User Detail (15:459) | Fully implemented | Fully implemented | Overview/scope/session/activity tabs, edit, scope links, estate/division/session links | Mobile session data illustrative |
| ID-05 | Create User (15:712) | Fully implemented | Fully implemented | Role-aware estate/division fields, validation, duplicate errors, review confirmation and create | No invitations or credentials provisioned |
| ID-06 | Edit User (15:891) | Fully implemented | Fully implemented | Role/status/name/email edits, multi-estate preservation, version conflict and record reload | Live account effects need API |
| ID-07 | Roles and Permissions (16:2; role details 161:74 onward) | Removed | Removed | Page, permission matrix, access history tab and export removed; `/admin/roles` redirects to the Audit Logs | Roles are assigned in User Management; access changes are in the Audit Logs |
| ID-08 | User Scope Assignment (16:335) | Fully implemented | Fully implemented | Scope tree, expand/collapse, effective preview, reset, required reason, confirmation, 409 recovery | Backend remains authority on live scope |
| ID-09 | Estate Management (16:596) | Partially implemented | Fully implemented | Search, region/status filters, sort, row/action links, add/edit, status confirmation | Summary counts use fixtures |
| ID-10 | Estate Detail (16:865) | Fully implemented | Fully implemented | Overview/divisions/team/activity tabs, team links, edit, Add division, division navigation | Evidence/review summaries read-only |
| ID-11 | Division Management (17:2) | Partially implemented | Fully implemented | Search, estate/status filters, sort, pagination, add/edit, user/estate links, export feedback | Export simulated |
| ID-12 | Division Detail (17:364) | Fully implemented | Fully implemented | Edit, status confirmation, estate/worker/supervisor links, read-only observations, review guidance | Administrators do not perform review |
| ID-13 | Device Sessions (17:613; Controlled recovery 166:972) | Partially implemented | Partially implemented | Search, user/status/time filters, sort, pagination, details, refresh, revoke confirmation, recovery request | Worker verification, new-session issuance and queue revalidation require backend/mobile capabilities |
| ID-14 | My Profile (17:934) | Fully implemented | Fully implemented | Name edits, supported language, password/current-password validation, preferences, sign-out | English only; fixture password changes reset on reload |
| ID-15 | Access denied (no Identity frame recorded) | Fully implemented | Fully implemented | Role-aware denial, dashboard return, protected navigation | Exact Identity design unavailable |
| ID-16 | Session expired (17:1249) | Fully implemented | Fully implemented | 401 transition, stored session clearing, direct-entry expiry, sign-in return | Live token lifecycle pending |

Sorting is opt-in on Identity list columns. Shared DataTable keyboard handling now
ignores events originating inside nested controls, so Enter on an action menu opens
the menu rather than also navigating the row. Role query failures are visible and
retryable instead of being rendered as an empty assignment list.

User edits now retain the record version that populated the draft. On a conflict,
Reload latest fetches that user and starts a fresh draft without reloading the browser
or losing other fixture mutations.

## Verification

- Verification commands: `npm run lint`, `npm run build`, `npm run test`,
  `npm run test:e2e`.
- Final results: lint and production build passed; 101 unit/integration tests
  passed across 8 files (44 Identity unit/route tests); all 21 Playwright tests
  passed (13 Identity workflows/responsive checks, 6 login layout checks,
  2 existing shell checks).
- Login viewport coverage: 1920 × 1080, 1440 × 900, 1366 × 768,
  1280 × 720 and 390 × 844, plus a 200% zoom-equivalent CSS viewport.
- Identity route overflow coverage: desktop and phone widths.
- Browser workflows exercise tabs, breadcrumbs, role-to-user links,
  estate-to-division links, keyboard action menus, create/edit confirmations,
  scope conflicts, status transitions, sorting across multiple pages, filter resets,
  device revocation/recovery, profile/security settings and access denial.

## Remaining external dependencies

This is a fixture implementation, not completed production Identity integration.

- The connected Figma account is denied access to file
  `UEYKbYMHwSPdcFwQqdksAF`; current visual parity cannot be verified.
- Production authentication, token refresh, account administration, profile writes,
  session operations and exports require approved backend contracts. See
  `api-integration/pending-contracts.md`. HTTP adapters report contract pending
  and do not invent API requests or substitute fixtures.
- Recovery requests display the controlled process; worker verification, ticket
  completion, new session issuance and queued-record revalidation require backend
  and mobile capabilities. Revoked sessions remain revoked.
- No permission matrix is shown; role permission codes remain illustrative pending the approved permission model.
- Fixture exports are simulated; newly created users do not receive invitations or
  provisioned credentials. Self-service password reset is not approved.
- Fixture mutations persist in memory until page reload. The session lasts for the
  browser tab; "Remember User ID" keeps only the User ID.

## Files changed in this audit

- `src/features/identity/presentation/components/useIdentityTableSort.ts` (created)
- `src/features/identity/presentation/pages/admin/UsersPage.tsx`
- `src/features/identity/presentation/pages/admin/EstatesPage.tsx`
- `src/features/identity/presentation/pages/admin/DivisionsPage.tsx`
- `src/features/identity/presentation/pages/admin/DeviceSessionsPage.tsx`
- `src/features/identity/presentation/pages/admin/RolesPage.tsx`
- `src/shared/components/DataTable/DataTable.tsx`
- `src/shared/components/DataTable/DataTable.module.css`
- `src/app/identity.routes.test.tsx`
- `tests/e2e/identity.spec.ts`
- `tests/e2e/shell.spec.ts` (stale login heading assertion only)
- `docs/identity-status.md`

## Create User: role-based fields (2026-11-14)

Create User (ID-05) and Edit User (ID-06) now carry these fields.

**Every role:**

- Phone number: required; +94XXXXXXXXX or 0XXXXXXXXX, spaces and hyphens ignored.
- Employee / Staff ID: required; must be unique, ignoring letter case.
- Preferred language: required; Sinhala, Tamil or English.
- NIC and date of birth: optional.
  - Only a signed-in Administrator can enter them, and only on Create User.
  - NIC: 9 digits followed by V or X, or 12 digits.
  - Date of birth: from 1940-01-01 to today. The date is stored, not an age.

**Role-specific:**

| Role | Scope | Extra fields |
| --- | --- | --- |
| Administrator | All estates | Multi-factor sign-in (required). Enforcement belongs to the sign-in service. |
| Supervisor | One or more estates | Reports to (optional; active Supervisors), office phone |
| Disease expert | One or more estates | Registration number (required), institution, qualifications |
| Field worker | One estate, then its divisions | Supervisor (optional; active Supervisors of that estate), mobile number (required), "mobile application access only" note |
| Reporting user | One or more estates (`REPORTING_USER_SCOPE_LEVEL`) | Organisation or department |

**Changing role:**

- Fields that no longer apply are cleared.
- If the administrator had entered any of them, a dialog lists them first.
- Cancelling keeps the previous role and every value.
- Only the selected role's details are ever submitted.

**Privacy:**

- The data layer masks the NIC before returning it: the first 2 characters and the last character stay visible.
- NIC and date of birth are returned only when the reader is an Administrator. They never appear in user lists, the dashboard, exports, URLs or audit entries.
- The existing "User created" activity entry records the name, ID and role only.

**Fixture data:**

- Seeded users get synthetic, ID-derived values (EMP-007, +94770000007, REG-DEMO-005).
- No NICs, dates of birth, field-worker supervisors or reporting lines are seeded.

**Open decisions (not guessed):**

- Reporting user scope: estate or division. It is estate today and switchable in `src/features/identity/domain/scope.ts`.
- Whether NIC is required for Field workers (recovery verification). It is optional today.
- Which users may be chosen as "Reports to". Active Supervisors for now.
- Whether a field worker's supervisor is required. The brief marks it optional.
- Edit User does not show or change NIC and date of birth, and the fields have no approved Figma frame yet.

## Enterprise login and Create User follow-up (2026-11-15)

**Login (AUTH-01)**

- The page now matches the enterprise login reference. The tea plantation background is
  full-bleed with a dark-green fade on the left; the product story is on the left and a
  rounded white card is on the right.
- Sign-in uses the company User ID (for example USR-003) and a password. E-mail sign-in,
  the development-account list and the "Demonstration data" footer were removed from the page.
- "Remember User ID" keeps only the User ID in `localStorage` (`tealeaf.rememberedUserId`).
  The session itself now lives in `sessionStorage` only and ends with the browser tab.
  A session left in `localStorage` by an earlier build is never loaded.
- An unknown User ID and a wrong password show the same message. Disabled accounts,
  mobile-only roles, an expired session and an unavailable sign-in service each have
  their own message.
- MFA: `AuthPort.signIn` returns either a session or an MFA challenge, and
  `AuthPort.verifyMfa` completes the challenge. Fixture mode never issues a challenge;
  route tests cover the step with a stubbed port.
- Layout: split screen from 1024 px, a compact story above the card on tablets, the card
  only on phones (with a full-width Log In button), and a scaled composition on 4K displays.

**Create User (ID-05)**

- A read-only "Company User ID" note: the ID is assigned by the system on creation and
  is separate from the Employee / Staff ID. The frontend never generates it.
- Choosing Reporting User shows a visible "pending team decision" notice for the scope.
- `createUser` returns `{ user, invitation }`. User Detail reports exactly that status:
  `sent`, `pending` (queued, not confirmed) or `not_sent`. Fixture mode always returns
  `not_sent`, and the page says so.
- An empty estate list says "No estates are available to assign."

**Backend dependencies (no endpoint was guessed):**

| Needed | Blocked by |
| --- | --- |
| Sign-in request and response (User ID, password, session or MFA challenge) | P1 token signing, Identity OpenAPI |
| MFA verification (code format, expiry, error codes) | P1, Identity OpenAPI |
| Error codes `INVALID_CREDENTIALS`, `ACCOUNT_DISABLED`, `WEB_ACCESS_NOT_PERMITTED`, `MFA_CODE_REJECTED` | Identity OpenAPI (frontend names, to be confirmed) |
| Create User request and response, the Company User ID allocation policy, invitation status | P8 role model, Identity OpenAPI |
| Uniqueness of Staff ID and NIC, and Administrator-only access to personal fields | Identity service |

**Open decisions:**

- Reporting User scope (estate, division or both). Estate is used for now, with a visible notice.
- Whether e-mail stays required on Create User. It depends on how invitations are delivered.
- Account status on creation: the form still offers Active or Inactive. The lifecycle
  rules (for example "invited" until activation) are not approved.
- The GitHub Pages build deliberately uses `VITE_DATA_SOURCE=fixtures`. This is explicit,
  not a silent fallback: the variable is required, and API mode never loads fixtures.

## Enterprise authentication flows (2026-11-15)

Screens AUTH-02 to AUTH-08 are built against ports whose HTTP adapters are
`contract_pending` (see `docs/api-integration/pending-contracts.md`). Nothing in these flows
succeeds without the backend: no code, token or reset is ever accepted by the frontend.

- **Flow state** (MFA challenge, enrollment, recovery reference, reset authorisation) is
  kept in memory only (`AuthFlowProvider`), never in browser storage or the URL. Reloading
  a step ends it and the screen asks the user to start again.
- **No session before MFA.** Sign-in stores a session only when the backend returns one;
  an MFA challenge or enrollment does not.
- **No account-existence leakage.** Recovery always shows "If an eligible account exists, a
  verification code will be sent to its registered recovery email."
- **Activation links** are read once; the token is removed from the address bar.
- **After a password reset** any stored session is cleared and the user logs in again.
- **QR codes** are shown only when the backend sends an image data URL.

Decisions to confirm:

- Company User ID format (`USR-` + digits) enforced on the login and recovery forms.
- Password minimum of 12 characters (from the ID-14 design) until the backend policy is published.
- Fixture mode signs Administrators in without MFA. This is a development-only data source
  (`VITE_DATA_SOURCE=fixtures`), and the GitHub Pages demo uses it deliberately. API mode
  never loads fixtures.
- Final error codes for MFA, recovery and activation (frontend names in `domain/authFlows.ts`).

Tests: `src/app/authFlows.routes.test.tsx` drives every screen with controlled test doubles
for the ports (only inside that test file); `src/features/identity/domain/authFlows.test.ts`
covers the User ID and code rules; `tests/e2e/auth-flows-layout.spec.ts` checks the screens
from 320 px to 1440 px.
