# Development sign-in accounts (fixture mode only)

> **DEVELOPMENT ONLY.** These accounts exist only when `VITE_DATA_SOURCE=fixtures`. They are
> not real credentials, grant nothing outside the browser tab, and are **not available in
> API mode**: the fixture module (including this account list) is never loaded there, and
> API-mode sign-in goes to the backend.

Password for every account: `tealeaf-dev-only`

| Role | Person (from Figma) | E-mail | Username | Home |
| --- | --- | --- | --- | --- |
| Administrator | Anika Perera (USR-001) | anika.perera@example.test | anika.perera | `/admin` |
| Supervisor | Malini Fernando (USR-003) · Riverbend EST-002 | malini.fernando@example.test | malini.fernando | `/review` |
| Supervisor | Nimal Silva (USR-002) · Highland EST-001 | nimal.silva@example.test | nimal.silva | `/review` |
| Disease Expert | Dr Tara Wijesinghe (USR-005) | dr.tara.wijesinghe@example.test | tara.wijesinghe | `/cases` |
| Reporting User | Maya Dissanayake (USR-013) | maya.dissanayake@example.test | maya.dissanayake | `/analytics` |

Field workers use the mobile app and have no web account.

Source: `src/fixtures/accounts.ts`. The login screen (AUTH-01) that uses these accounts is
delivered in Phase 3; until then the shell can be opened by seeding a session (see
`tests/e2e/shell.spec.ts`).
