# Demonstration dataset (Identity, Capture, Fieldwork Assignments, Review)

All four modules read and write **one** in-memory dataset: `src/fixtures`, built by
`createSeedDatabase()` and held by a single `FixtureStore` per browser tab. No module keeps
its own copy. A Review decision is immediately visible to Capture and to the Identity
statistics, because they all project the same `observations` records.

The data is synthetic. Every name, ID and e-mail address (`example.test`) comes from the
approved designs. Changes live only in tab memory and are lost on reload. The UI shows
"Demo data" and "Demonstration data · UI design only" on every screen.

## 1. Identifiers and relationships

| Record | IDs | Owner of truth | Used by |
| --- | --- | --- | --- |
| Estates | EST-001 Highland, EST-002 Riverbend, EST-003 Mist Valley | `seed/organisation.ts` | all modules |
| Divisions | DIV-001 … DIV-009, three per estate | same | all modules |
| Users | USR-001 … USR-013 (roles and estate/division scope) | same | all modules; scope drives every adapter |
| Diseases | DIS-001 … DIS-004 (catalog version 2) | same | Capture, Review |
| Observations | OBS-001 … OBS-048 (division, field worker, disease, capture date, **review status**) | `seed/observations.ts` | Identity stats, Capture, Assignments, Review |
| Capture evidence | OBS-005 (IMG-005, revision OBSR-005-2), OBS-014 (IMG-014) | `seed/capture.ts` | Capture viewers, Review evidence and compare |
| Assignments | ASG-001 … ASG-007 (EST-002) | `seed/capture.ts` | Assignments; ASG-001→OBS-014 and ASG-005→OBS-024 link to observations |
| Review records | REV-nnn per OBS-nnn, with version | `seed/review.ts` | Review |
| Decisions | DEC-001 … (REV-17 history) | same | Review history, state-machine check |
| Corrections | COR-005, COR-041 | same | Review |
| Referrals | REF-006/023/042 (EST-002), REF-011/047 (EST-001, derived) | same | Review; diagnosed ones must match expert-confirmed cases |
| Cases | CASE-006/018/030/042 (expert-confirmed) | `seed/administration.ts` | Identity statistics, Review referrals |
| Quarantine | QUA-001 … QUA-004, decision QDEC-002 | `seed/review.ts` | Review |

`findIntegrityProblems()` (`src/fixtures/integrity.ts`) runs in the test suite. It checks:

- unique IDs;
- every cross-reference;
- estate/division consistency;
- role and scope rules;
- that open corrections match `correction_requested` observations;
- that referrals match referred observations and diagnosed referrals match
  expert-confirmed cases;
- that every decision was made inside its supervisor's scope.

## 2. Workflow states come only from approved transitions

Observation review states are checked against the approved transitions (REV-04/05/06/10/11/12
and RevisionApplied). The integrity check **replays each observation's recorded decisions**
from `in_review` and fails if the stored status differs, or if any step is not an approved
transition. For example, setting OBS-015 to `flagged` is reported because its verification
decision leads to `verified` (tested in `src/app/dataset.integration.test.ts`).

Approved transitions:

| From | Event | To |
| --- | --- | --- |
| `in_review` | verify | `verified` |
| `in_review` | flag | `flagged` |
| `in_review` | request correction | `correction_requested` (correction `requested`) |
| `in_review` | refer | `referred` (referral `pending_case_link`) |
| correction `resubmitted` | approve | correction `approved`; observation unchanged |
| correction `requested` / `resubmitted` | reject | correction `rejected`; observation unchanged |
| correction `approved` | RevisionApplied (system event; fixture-only simulation) | correction `applied`; observation `in_review` |

Seeded statuses with no recorded decision are design snapshots:

- EST-001 and EST-002 statuses are copied from REV-02.
- EST-003 statuses are fixture-assigned (documented in `seed/observations.ts`).

## 3. Scenario coverage

| Scenario | Where to see it |
| --- | --- |
| Normal | OBS-014 in review → verify / flag / correction / refer; OBS-015 and OBS-032 verified; ASG-001 submitted → accept |
| Pending | Submitted OBS-013/022/031 ("Oldest awaiting review"); QUA-002 released pending ingest; REF-023 awaiting diagnosis; a new referral (e.g. REF-014) pending case link; ASG-004 draft |
| Correction | COR-005 resubmitted with revision OBSR-005-2 (compare, approve, simulated RevisionApplied); COR-041 requested (no revision yet) |
| Rejected / cancelled | COR-041 after REV-11 rejection (state produced by the approved action); QUA-004 rejected; ASG-007 cancelled |
| Unavailable evidence | Observations other than OBS-005/OBS-014 have no evidence record. Capture shows "Coordinates unavailable"; Review shows "not included in the demonstration fixtures" (nothing inferred). The `?state=unavailable` Capture demo state |
| Authorization errors | Wrong role → ID-15 Access denied (e.g. Administrator on `/review`); other estate → same `not_found` as missing records; expired session → ID-16; transient failures injected with `FixtureStore.failNext()` in tests |

## 4. KPIs are derived, not hard-coded

Every count is computed from records at read time:

- **REV-01:** all five KPIs, status distribution, attention items, pending by division,
  oldest awaiting and age.
- **REV-02, REV-07, REV-17:** tab counts.
- **REV-12:** awaiting-diagnosis cases.
- **ID-09–ID-12:** observations, pending review, verified, corrections requested and
  expert-confirmed cases.
- **ASG-01:** assignment counts.

"Pending" means `submitted` or `in_review` in both Identity and Review. A test asserts
that the per-division counts agree across the two modules, and that they change together
after a Review decision.

The one data-driven list is REV-01's flagged follow-up list. Figma lists only OBS-024, so
it is seeded, and every newly flagged observation is added to it.

## 5. Images

**No licensed tea-leaf photographs are available to the project** (none in the repository,
the backend workspace or the design exports). The evidence image is therefore the
synthetic leaf illustration from the approved designs.

Each evidence record carries `imageSource`:

```ts
{ kind: 'synthetic_illustration' | 'licensed_photo', attribution, license, sourceUrl }
```

- Both current records are `synthetic_illustration` with the attribution "Synthetic leaf
  illustration from the approved TeaLeaf designs; not a photograph".
- Review shows this attribution under the evidence image.
- Alt text says "Synthetic tea leaf evidence placeholder".
- The integrity check rejects evidence without attribution, and any `licensed_photo`
  without a licence and source URL.

To add real demonstration photos later:

1. Add the files under `src/assets`.
2. Set `kind: 'licensed_photo'` with the licence (for example CC BY 4.0), the author
   attribution and the source URL.
3. Keep the "Demonstration photo, not field evidence" label.

## 6. Replaceable with the NestJS API

Each module talks to a port:

- Identity: `AuthPort`, `IdentityAdminPort`, `AccountPort`.
- Capture: `CaptureReadPort`.
- Review: `ReviewPort`.

The composition root (`src/app/composition`) picks fixture or HTTP adapters from
`VITE_DATA_SOURCE`. HTTP adapters raise `contract_pending` until contracts exist; see
[pending-contracts.md](api-integration/pending-contracts.md).

No PostgreSQL schema was modified and no backend endpoint was introduced. Fixture records
are frontend storage shapes only, mapped into each feature's domain types exactly as the
HTTP adapters will map gateway responses.

## 7. Missing data and workflow rules

| # | Missing | Effect now |
| --- | --- | --- |
| 1 | Licensed tea-leaf photographs (file, licence, author, source URL) | Synthetic illustration, labelled |
| 2 | Evidence records (image, GPS, receipt) for 46 of 48 observations | Shown as unavailable; nothing inferred |
| 3 | Symptoms and field notes for observations other than OBS-014 (and OBS-005's note) | "Not provided in the demonstration fixtures" |
| 4 | Claim-for-review transition (`submitted` → `in_review`) | Submitted records are read-only in Review |
| 5 | REV-16 quarantine decision, its reasons, ingest-receipt arrival and retry | REV-16 route explains the block; "Refresh status" only refetches |
| 6 | Field-worker resubmission event (mobile) | New corrections stay `requested`; COR-005 is the seeded resubmitted example |
| 7 | Flag, concern and rejection reason catalogues | Only the values visible in Figma are offered |
| 8 | Whether a rejected correction changes the observation's review status | Unchanged (design: "remain unchanged") |
| 9 | Case creation and referral reconciliation (Cases, Phase 6) | Referrals stay `pending_case_link` |
| 10 | ASG-07 replacement-worker outcome | Saving a different worker returns `contract_pending` |
| 11 | Notification delivery ("Notify field worker") | The flag is stored with the decision only |
| 12 | EST-003 review statuses and EST-001 decision history | Fixture-assigned or derived, tagged with `provenance` |
| 13 | Persistence across reloads | None by design (in-memory demonstration) |
