# Development sign-in accounts (fixture mode only)

> **DEVELOPMENT ONLY.** These accounts exist only when `VITE_DATA_SOURCE=fixtures`. They are
> not real credentials, grant nothing outside the browser tab, and are **not available in
> API mode**: the fixture module (including this account list) is never loaded there, and
> API-mode sign-in goes to the backend.

The login page (AUTH-01) signs in with the company **User ID** and password. It does not
list these accounts or offer shortcuts to them. Type the User ID and password.

Password for every account: `tealeaf-dev-only`

| Role | Person (from Figma) | User ID | Home |
| --- | --- | --- | --- |
| Administrator | Anika Perera | USR-001 | `/admin` |
| Supervisor | Malini Fernando · Riverbend EST-002 | USR-003 | `/review` |
| Supervisor | Nimal Silva · Highland EST-001 | USR-002 | `/review` |
| Disease Expert | Dr Tara Wijesinghe | USR-005 | `/cases` |
| Reporting User | Maya Dissanayake | USR-013 | `/analytics` |

Field workers use the mobile app and cannot sign in to the web application.

Fixture mode never asks for a second factor: it has no authenticator. The Administrator
MFA step on AUTH-01 is covered by tests that use a stubbed sign-in port, until the Identity
API defines the MFA contract.

Source: `src/fixtures/accounts.ts`.
