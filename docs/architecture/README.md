# Frontend architecture

Status: Phase 2 (shared foundation). This document describes what exists in the code and
the conventions later phases must follow.

## Layers and boundaries

```text
src/
├── app/            Composition root, providers, routing, layouts (the only place that knows
│                   about every feature and about fixture vs. HTTP adapters)
├── features/<f>/   identity · capture · review · cases · analytics
│   ├── domain/         Types and rules. No React, Router, Query, Axios or fixtures.
│   ├── application/    Ports (interfaces) and use cases. No adapters, no UI.
│   ├── infrastructure/ Adapters: fixture*Adapter (in-memory) and http*Adapter (gateway).
│   ├── presentation/   Pages, components, query hooks. Reaches data only through ports.
│   ├── index.ts        Public API — the only entry other code may import.
│   ├── fixtures.ts     Fixture adapter factory — imported only by app/composition.
│   └── http.ts         HTTP adapter factory — imported only by app/composition.
├── shared/         Feature-agnostic: api client, components, design system, hooks, types.
└── fixtures/       Synthetic relational dataset and the in-memory FixtureStore.
```

These rules are enforced by `no-restricted-imports` in `eslint.config.js`:

| Code in | May not import |
| --- | --- |
| `src/shared/**` | `@/features/*`, `@/app/*`, `@/fixtures` |
| `src/fixtures/**` | features, app, React, TanStack Query, Axios |
| `src/features/**` | another feature's internals (`@/features/x/...`), `@/app/*` |
| `features/*/domain` | React, Router, Query, Axios, fixtures, other layers |
| `features/*/application` | React, Router, Axios, fixtures, infrastructure, presentation |
| `features/*/presentation` | Axios, the HTTP client, fixtures, infrastructure |

## Composition and data modes

`src/main.tsx` → `readConfig(import.meta.env)` → `createContainer(config)` → `<App>`.

- `VITE_DATA_SOURCE=fixtures` loads `app/composition/fixtureAdapters.ts` (dynamic import);
  `api` loads `httpAdapters.ts`. Only the selected chunk is downloaded, so fixture records
  and development accounts are never fetched in API mode (verified on the production build:
  the fixture data and dev password appear only in the `fixtureAdapters-*.js` chunk).
- An invalid configuration renders a configuration-error screen; there is no default mode.
- **No silent fallback.** An HTTP adapter failure surfaces as an `AppError`; nothing
  switches to fixture data. Sessions record the data source that issued them, and a
  fixture session is discarded when the app runs in API mode.
- Fixture mode is always labelled: the top-bar "Demo data" pill and the sidebar note
  "Demonstration data · UI design only" (both from Figma) render only when
  `dataSource === 'fixtures'`.

## Errors

`shared/api/httpClient.ts` (Axios) adds `x-correlation-id`, the bearer token and an
optional `idempotency-key`, validates every response with Zod, and converts every failure
to an `AppError` with a `kind`:

`unauthorized` (401) · `forbidden` (403) · `not_found` · `conflict` (409) · `validation`
(400/422) · `unavailable` (502–504) · `offline` · `timeout` · `cancelled` ·
`contract_pending` · `contract_mismatch` · `unknown`.

The backend error envelope `{ error: { code, message, correlationId, details? } }` is
preserved. The TanStack Query cache sends any `unauthorized` error to the session, which
moves to the session-expired state. Non-transient kinds are not retried.

`contract_pending` is raised by HTTP adapters whose endpoint has no approved contract (see
[pending contracts](../api-integration/pending-contracts.md)); no request is sent.

## Sessions and guards

- `SessionProvider` (identity presentation) holds `signed_out | signed_in | expired`.
- Storage: `sessionStorage`, or `localStorage` when "Remember me" is chosen; validated
  with Zod on load. Fixture sessions carry no token.
- `RequireSession` → `/login?next=…` when signed out, `/session-expired` when expired.
  `safeNextPath` accepts only in-app paths for `next`.
- `RequireRole` renders the access-denied screen in place (the URL is kept).
- Guards shape the UI only; the backend remains the authority on access and scope.

## Routing

`app/routing/screens.ts` lists every approved Figma screen with its route, screen ID and
delivery phase. In Phase 2 each route renders a `ScreenPending` placeholder that says the
screen is not built yet. Role home routes: Administrator `/admin`, Supervisor `/review`,
Disease Expert `/cases`, Reporting User `/analytics`.

## Decisions and deviations

| Decision | Note |
| --- | --- |
| Axios + `VITE_DATA_SOURCE=fixtures\|api` | Approved by the product owner. **Differs from the backend monorepo's ADR-0004** (`fetch` wrapper, `VITE_API_MODE=mock\|http`). The backend team should be told. |
| No DEMO-01 / "Switch Demo Role" | Approved. Fixture mode signs in through the normal login form with [development accounts](../development-accounts.md). The Figma "Switch Demo Role" button is therefore omitted from the top bar. |
| Inter bundled locally (`@fontsource/inter`) | No external font requests. |
| Icons | Generated from the Figma icon set (section 368:240) into `shared/design-system/icons/iconData.ts`, colours replaced by `currentColor`. |
| CSS Modules + design tokens | All sizes are the 3840×2160 Figma values ÷ 2 (`shared/design-system/tokens.css`). |
| Native `<select>` for form selects | Full keyboard and screen-reader support. Toolbar filters use the custom `FilterSelect` (ARIA select-only combobox) because their "Label: Value" trigger cannot be drawn with a native select. |

## States not drawn in Figma (derived, flagged for design review)

| Component | Derived state |
| --- | --- |
| Checkbox / Radio / Toggle | Checked / on state uses `primary-500` (only unchecked masters exist). |
| Modal | Close (×) button; focus trap; Escape closes unless an action is pending. |
| Text input focus | 2px `primary-500` border, mirroring the search focus frame. |
| Sidebar below 1024px | Forced into the designed collapsed (icon-only) form. |
| Top bar below 1024px | Search field and profile name hidden. |
| Profile menu | Items "My Profile" and "Sign out" (sign-out is shown on ID-14). |
| Search and bell | Show an info toast ("not available yet", Phase 8) instead of the Figma overlays. |
| Error state | Error variant of the GS-07 empty state, with correlation reference and retry. |
| Not-found page | No Figma design; uses the empty-state pattern. |
