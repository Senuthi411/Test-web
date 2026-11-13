# Fixture data model

Fixture mode (`VITE_DATA_SOURCE=fixtures`) runs the whole UI against synthetic data held in
the browser. Nothing is sent to any server.

## Rules

1. **One dataset, shared by every module.** `src/fixtures/store.ts` (`FixtureStore`) holds
   a single in-memory database. Every fixture adapter reads and writes it, so a change in
   one module is visible in all others.
2. **Counts are derived, never hard-coded.** Dashboards and analytics compute totals from
   the records. Tests (`src/fixtures/fixtures.test.ts`) check that the derived totals match
   the Figma figures, e.g. AN-01: 33 observations, 5 verified, 8 submitted, 6 in review,
   suspected diseases 8 / 9 / 8 / 8.
3. **Figma is the source for identifiers and names.** Every record carries a provenance:
   `figma` (shown verbatim), `derived` (follows a Figma pattern) or `fixture-assigned`
   (not shown in Figma; chosen so totals stay consistent).
4. **No invented business rules.** Where Figma is contradictory, fixtures pick one
   consistent value and the conflict is recorded in
   [figma-inconsistencies.md](../figma-inconsistencies.md).
5. **Realistic behaviour.** `store.run()` adds latency (300 ms by default), honours
   `AbortSignal` (→ `cancelled`) and can inject a failure (`store.failNext(kind)`), so
   loading, error and retry states are exercised.
6. **Reset.** `container.fixtures.reset()` restores the seed. Changes are lost on reload.
7. **Integrity is tested.** `findIntegrityProblems()` checks unique IDs, every reference,
   role/scope consistency and that each observation was captured inside its field worker's
   division.

## Current contents (Phase 2)

| Collection | Records | Source |
| --- | --- | --- |
| Estates | EST-001 Highland, EST-002 Riverbend, EST-003 Mist Valley | ID-09 |
| Divisions | DIV-001 … DIV-009 (3 per estate) | ID-11 |
| Users | USR-001 … USR-013 | ID-03 |
| Diseases | DIS-001 … DIS-004 | CASE-07 |
| Observations | OBS-001 … OBS-048 | REV-02, AN-01 – AN-03 (patterns below) |
| Device sessions | DS-3091 … DS-2977 (7) | ID-13 |

Observation patterns reproduced from the designs:

- Division: `OBS-n → DIV-(((n − 1) mod 9) + 1)` — 6 per Highland division, 5 per Riverbend
  and Mist Valley division.
- Suspected disease cycles DIS-001 → DIS-004 by `(n − 1) mod 4`.
- Capture day: `(n mod 19) + 1` October 2026; OBS-005 at 13:15 and OBS-023 at 09:12.
- Review statuses for EST-001/EST-002 copied from REV-02; Mist Valley statuses are
  fixture-assigned.
- Reference "today": `FIXTURE_REFERENCE_DATE = 2026-10-21T10:00:00+05:30`.

Later phases extend the store with reviews, corrections, referrals, quarantine records,
cases, diagnoses, assignments and analytics snapshots, following the same rules.
