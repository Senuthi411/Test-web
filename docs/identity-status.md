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
| AUTH-01 | Login (10:3) | Fully implemented | Fully implemented | Credentials, validation, password visibility, remember me, return path, reset guidance | Synthetic credentials only; self-service reset unapproved |
| ID-02 | Administrator Dashboard (14:8) | Fully implemented | Fully implemented | Derived KPIs, estate and attention rows, activity links, Create user, export feedback | Export simulated |
| ID-03 | User Management (15:2) | Partially implemented | Fully implemented | Search, role/estate/status filters, sorting before pagination, row details, action menus, create, export feedback | Export simulated; no invitation service |
| ID-04 | User Detail (15:459) | Fully implemented | Fully implemented | Overview/scope/session/activity tabs, edit, scope links, estate/division/session links | Mobile session data illustrative |
| ID-05 | Create User (15:712) | Fully implemented | Fully implemented | Role-aware estate/division fields, validation, duplicate errors, review confirmation and create | No invitations or credentials provisioned |
| ID-06 | Edit User (15:891) | Fully implemented | Fully implemented | Role/status/name/email edits, multi-estate preservation, version conflict and record reload | Live account effects need API |
| ID-07 | Roles and Permissions (16:2; role details 161:74 onward) | Partially implemented | Fully implemented | Role links/tabs, assigned-user links, counts, permission matrix, query failure/retry, export feedback | Permission model illustrative; export simulated |
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
- The role permission matrix is illustrative pending the approved permission model.
- Fixture exports are simulated; newly created users do not receive invitations or
  provisioned credentials. Self-service password reset is not approved.
- Fixture mutations persist in memory until page reload. Remember me persists the
  session, not the fixture database.

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
