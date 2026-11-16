# Administrator module audit (Identity ID-02 to ID-16)

Date: 2026-11-14. Mode: fixtures (`VITE_DATA_SOURCE=fixtures`). Signed in as the
Administrator Anika Perera (USR-001), the only Administrator in the dataset.

## 1. How this was tested

- **In the browser:** each admin screen was used through the real login form, with in-app
  navigation only. A page reload resets the in-memory fixtures, so it was avoided.
- **Against the admin service:** 22 scripted probes (P01 to P22) called the admin service
  directly, through the same container the app uses. After each one, the fixture integrity
  check was run.
- **Code review:** the Identity domain, adapter, use cases, pages, route guards and session
  handling were read.
- **Clean-up:** both temporary probe files were deleted afterwards. No application code was
  changed.

## 2. What already works well

- **Concurrent user edits:** a stale version gets a 409 conflict, and "Reload latest" keeps
  the rest of the form.
- **Email checks:** emails are trimmed, lower-cased and checked for duplicates (P10). Other
  inputs are re-validated in the use cases, so a direct call cannot store an empty name (P11).
- **Estate names:** duplicates are caught even with a trailing space (P12).
- **Scope reason:** a scope change on ID-08 requires a reason, and whitespace alone is
  rejected (P09).
- **Deactivated accounts:** a deactivated user cannot sign in (P18).
- **Errors and layout:** unknown records show a "could not be found" state, wrong roles get
  ID-15, and `/admin/users` does not overflow at 390 px.
- **Honest placeholders:** exports and global search say plainly that they are simulated or
  not yet available.

## 3. Weak points

Severity: **High** means it can lock out administration or lose accountability. **Medium**
means it corrupts data or misleads. **Low** means a gap or an unfinished feature.

### High

| # | Weak point | Evidence | Where |
| --- | --- | --- | --- |
| H1 | **The last Administrator can demote or deactivate themselves.** Nothing prevents it, and the edit form shows no warning. Afterwards no active Administrator remains. | P03 and P04: "active admins left: 0". In the browser, changing USR-001 to Reporting user saved with no warning. | [fixtureIdentityAdminAdapter.ts](../src/features/identity/infrastructure/fixtureIdentityAdminAdapter.ts) `updateUser`; [UserFormPage.tsx](../src/features/identity/presentation/pages/admin/UserFormPage.tsx) |
| H2 | **The session is not refreshed after an admin changes their own role.** After self-demotion the sidebar still shows the full Administration menu. | Browser: sidebar unchanged after saving USR-001 as Reporting user. | `SessionProvider`, `useUpdateUser` |
| H3 | **The fixture admin service does not check the caller's role.** The route guard is the only barrier. A Supervisor can change the Administrator's role, and a Reporting user can list every user. Review's fixture adapter does check role and scope, so Identity is inconsistent with it. | P01: "succeeded: USR-001 role now REPORTING_USER". P02: "13 users returned". | `createFixtureIdentityAdminAdapter` has no role check. |
| H4 | **Deactivating a user leaves their device sessions active and their assignments open.** The form shows no warning about the consequences. | P05: DS-3091 stays active, and ASG-001, ASG-003 and ASG-006 stay open. Browser: DS-3091 shows "Active · Revoke session" after deactivation. | `updateUser` |
| H5 | **Audit entries do not record what changed.** A role change to Administrator, a deactivation and a rename all produce the same "User updated" entry, with no before or after values. | P17: escalating USR-013 to Administrator produced only `{kind:'user_updated', userId, estateIds}`. | `audit()` in the adapter; [activity.ts](../src/features/identity/domain/activity.ts) |
| H6 | **A scope change made through Edit user skips the required reason.** It is logged as "User updated", not "Scope updated", so the reason ID-08 requires can be avoided. | P08: moving USR-002 from EST-001 to EST-003 was saved with no reason, as kind `user_updated`. | `updateUser` vs `updateUserScope` |

### Medium

| # | Weak point | Evidence |
| --- | --- | --- |
| M1 | **Changing a worker's role breaks existing records.** USR-009 has observations and assignments; changing them to Supervisor is allowed with no warning. | P06: 13 integrity errors (10 observations, 3 assignments). |
| M2 | **Moving a Supervisor's scope leaves the estate without a supervisor and invalidates past decisions.** There is no warning. The integrity check also tests past decisions against the *current* scope, not the scope at the time of the decision. | P07: Riverbend's supervisor becomes `null`; DEC-001 to DEC-011 are reported "outside the Supervisor's scope". |
| M3 | **Deactivating an estate does not cascade and shows no impact.** | P13: EST-003 is inactive, but its 3 divisions stay active, 5 users stay scoped to it and DS-3054 stays active. |
| M4 | **Some rules are enforced only in the screens.** "No new division in an inactive estate" is enforced only by a disabled menu item. Inactive divisions can still be assigned. | P14: DIV-010 was created in the inactive EST-003. P15: inactive DIV-009 was assigned. |
| M5 | **Estates and divisions have no version check, so concurrent edits are lost silently.** | P16: two estate writes from different starting states were both accepted. |
| M6 | **Audit timestamps mix time zones, and they are sorted as text.** New events are stored in UTC (`…04:30:00.000Z`), while seeded events use +05:30. Text sorting then puts some events in the wrong order where both kinds appear together, such as a user's Activity tab. | Event `at` value in P08. `auditActivity` and `userActivity` sort with `localeCompare`. |
| M7 | **Security events are not audited:** failed sign-ins, password changes, sign-in and sign-out, denied access and exports. | P22: a failed sign-in added 0 audit events. |
| M8 | **The browser session never expires.** There is no idle timeout and no expiry time. ID-16 appears only after an API 401, which never happens in fixture mode. | No expiry or idle handling in `session.ts`, `browserSessionPersistence.ts` or `SessionProvider.tsx`. |
| M9 | **There is no audit log screen.** The dashboard shows the latest 4 events, and estate and user Activity tabs show filtered slices, with no search, filters, paging or export. Some "Scope assigned" items in a user's Activity tab are made up from `scopeAssignedAt`; they are not audit records. | P20: 4 items. `userActivity()` in [fixtureRecords.ts](../src/features/identity/infrastructure/fixtureRecords.ts). |

### Low

| # | Weak point |
| --- | --- |
| L1 | Global search in the top bar is not available ("scheduled for Phase 8"). |
| L2 | Exports are simulated and produce no file. |
| L3 | Revoking a device session always records `DEVICE_SESSION_REVOKED`. The admin cannot enter a reason. |
| L4 | Create user has a review dialog, but Edit user saves privileged changes (role, status) immediately, with no confirmation. |
| L5 | The roles and permissions matrix is static and only illustrative, pending the approved permission model. |
| L6 | There are no invitations, password resets, bulk actions or "deactivate and reassign" flow. |
| L7 | The fixture login has no lockout or rate limit (the backend will own this). |

## 4. Feature-by-feature status

| Screen | What works | Weak points |
| --- | --- | --- |
| ID-02 Dashboard | KPIs derived from data, attention list, recent activity, simulated export | Only 4 activity items, no "view all" (M9); timestamp ordering (M6) |
| ID-03 Users | Search, filters, sorting, paging, action menus | No bulk actions or "deactivated by/when" column (L6); export simulated |
| ID-04 User Detail | Overview, scope, sessions and activity tabs | Activity mixes real audit records with derived ones (M9); no change history with values (H5) |
| ID-05 Create User | Role-aware scope, validation, review dialog | No invitation or credentials (L6) |
| ID-06 Edit User | Version conflict and reload | H1, H2, H4, H6, M1, M2, L4: the riskiest screen |
| ID-07 Roles | Role tabs, assigned users, matrix | Static and illustrative (L5) |
| ID-08 Scope | Required reason, effective-scope preview, 409 recovery | Can be bypassed through ID-06 (H6); no supervisor-coverage warning (M2) |
| ID-09 / ID-10 Estates | Search, filters, add/edit, status confirmation | No cascade or impact preview (M3); lost updates (M5) |
| ID-11 / ID-12 Divisions | Search, filters, add/edit, status confirmation | Rules enforced only in the screens (M4); lost updates (M5) |
| ID-13 Device Sessions | Filters, revoke confirmation, controlled recovery request | Fixed reason code (L3); not linked to deactivation (H4) |
| ID-14 Profile | Name, language, password, preferences | Password change not audited (M7) |
| ID-15 / ID-16 Access | Access denied for the wrong role, expiry after a 401 | No idle or absolute timeout (M8) |
| Fixture admin service | Versions and validation | No role enforcement (H3) |

## 5. What to build next (recommended order)

None of these rules is in the approved designs yet. Each needs **your approval of the
business rule**. Items 4 and 5 also need **a new Figma frame**, and every item needs **a
backend contract** before it can run in API mode.

1. **Administrator safeguards (fixes H1, H2, L4).**
   - Block demoting or deactivating the last active Administrator.
   - Warn before editing your own account.
   - Ask for confirmation, with a reason, for any role or status change.
   - Refresh the session, or sign the user out, when their own role changes.
2. **Deactivation impact preview (fixes H4, M1, M3).** Before a user, estate or division is
   deactivated, list:
   - active device sessions;
   - open assignments;
   - open corrections and referrals;
   - users left without scope;
   - estates left without a supervisor.

   Then offer approved choices, such as revoking the sessions or reassigning the work.
3. **Complete audit records (fixes H5, H6, M6, M7).**
   - Every write records the actor and role, the action, the target and its type, the
     before and after values, the reason, the outcome, a correlation ID and the source.
   - Store timestamps in UTC and sort them as dates.
   - Send scope changes made through ID-06 through the scope-change path, with a reason.
4. **Audit Log screen ("Admin Audit", new frame needed; fixes M9).**
   - A list of all audit events, filtered by:
     - actor;
     - action;
     - target type and ID;
     - estate;
     - date range;
     - outcome (success, denied or failed).
   - Search, paging and sorting.
   - A detail drawer showing the before and after values and the reason.
   - Links to the user, estate, division or session concerned.
   - Export (simulated in fixture mode).
   - Read-only and append-only: the screen offers no edit or delete.
   - Open questions:
     - who may see it (Administrator only?);
     - retention period;
     - whether personal data is masked;
     - whether Review and Capture decisions appear in the same log or only Identity events.
5. **Security events view (fixes M7, M8, L7).**
   - Failed sign-ins, lockouts, password changes and access-denied events.
   - An approved idle and absolute session timeout, which leads to ID-16.
6. **Consistency between the fixtures and the backend (fixes H3, M4, M5).**
   - The fixture admin service checks that the caller is an Administrator, as Review's
     already does.
   - Status rules are enforced in the service, not only in the screens.
   - Estates and divisions use `expectedVersion`.
   - The integrity check tests each decision against the scope that applied when it was
     made.
7. **Later (each needs its own approved contract):**
   - user invitations and password reset;
   - a revoke reason picker;
   - bulk user actions;
   - real exports;
   - global search (Phase 8);
   - the approved permission model for ID-07.

Items 1, 3 and 6 can be built now in fixture mode, without new designs, as soon as you
confirm the rules. Items 2, 4 and 5 need designs first.
