# TeaLeaf Field Scout — Web Frontend

The browser-based portal of **TeaLeaf Field Scout** for administrators, supervisors,
disease experts and reporting users. It is a standalone repository, separate from the
backend microservices and the React Native mobile app, and talks to the backend only
through the API Gateway.

> **Project status: Phase 2 of 8 — shared frontend foundation.** Design tokens, shared
> components, the application shell (sidebar, top bar, route guards), the API client,
> the fixture data store and the test setup are in place. Every Figma screen has a route
> that currently shows a "screen not built yet" placeholder. Screens are delivered in
> Phases 3–7. See [Implementation status](#implementation-status).

## Technology stack

| Tool | Purpose |
| --- | --- |
| React 19 · TypeScript 6 (strict) · Vite 8 | UI, typing, build |
| React Router 8 | Routing and role guards |
| TanStack Query 5 | Server state |
| Axios | API Gateway client |
| React Hook Form · Zod | Forms and validation (Zod also validates config, storage and API responses) |
| CSS Modules + design tokens | Styling from the approved Figma design system |
| `@fontsource/inter` | Inter, bundled locally (no external font requests) |
| Vitest · React Testing Library · jsdom | Unit and integration tests |
| Playwright | End-to-end tests |

## Getting started

Requires Node.js `^20.19.0` or `>=22.12.0`.

```bash
npm ci
cp .env.example .env.local   # then choose a data source
npm run dev
```

### Data source

| `VITE_DATA_SOURCE` | Behaviour |
| --- | --- |
| `fixtures` | Synthetic, relational demo data held in the browser. The UI shows "Demo data" indicators. Sign in with the [development-only accounts](docs/development-accounts.md). |
| `api` | Uses the API Gateway at `VITE_API_BASE_URL` (e.g. `http://localhost:3000/api/v1`). Fixture data and accounts are not loaded. Operations whose backend contract is not yet approved report "Not yet available" — see [pending contracts](docs/api-integration/pending-contracts.md). |

The variable is required; the app shows a configuration error if it is missing. All
`VITE_*` values are public in the browser bundle — never put secrets in them.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Type-check and production build |
| `npm run lint` | ESLint, including architecture import boundaries |
| `npm run typecheck` | TypeScript only |
| `npm test` | Vitest (unit + integration) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright (starts its own dev server in fixture mode; first run `npx playwright install chromium`) |
| `npm run preview` | Serve the production build |

## Architecture

Feature-based Clean Architecture with ports and adapters. Five feature modules
(`identity`, `capture`, `review`, `cases`, `analytics`), each split into `domain`,
`application`, `infrastructure` and `presentation`, plus `src/shared`, `src/fixtures` and
the `src/app` composition root. Boundaries are enforced by ESLint.

Details: [docs/architecture/README.md](docs/architecture/README.md) ·
[fixture model](docs/architecture/fixture-model.md) ·
[Figma inconsistencies](docs/figma-inconsistencies.md).

## Web roles

| Role | Home | Area |
| --- | --- | --- |
| Administrator | `/admin` | Identity: users, roles, estates, divisions, device sessions |
| Supervisor | `/review` | Review queues, evidence viewer, fieldwork assignments |
| Disease Expert | `/cases` | Assigned cases, diagnosis, disease catalog |
| Reporting User | `/analytics` | Analytics reports and data freshness |

Route guards only shape the UI. Authorisation and scope are enforced by the backend.

## Implementation status

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Figma and repository analysis | Done |
| 2 | Shared foundation: tokens, components, shell, guards, API client, fixture store, tests | Done |
| 3 | Login, 401/403, Identity screens (ID-02 – ID-16) | Planned |
| 4 | Capture (CAP-W01 – W08) and Fieldwork Assignments (ASG-01 – ASG-15) | Planned |
| 5 | Review (REV-01 – REV-24) and global states | Planned |
| 6 | Cases (CASE-01 – CASE-10) | Planned |
| 7 | Analytics (AN-01 – AN-12) and export | Planned |
| 8 | Notifications, global search, Figma QA, end-to-end journeys | Planned |
