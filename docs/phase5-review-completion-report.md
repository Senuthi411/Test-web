# Phase 5 Review — completion report

**Status: fixture-complete for the approved Review screens that exist in the design
export. Not production-integrated.** All Review operations run against the
in-browser demonstration dataset. The API-mode adapter reports `contract_pending`
for every operation because no Review backend contract exists. Nothing in this module
is production-ready until a backend is integrated.

Earlier versions of this report recorded Phase 5 as blocked by the Figma MCP quota.
That block is resolved: the approved Review file was supplied as a local export, and no
further Figma MCP calls were made.

## 1. Design source and numbering

| Item | Value |
| --- | --- |
| Source | Local export of the approved Figma Review page: `Review.pdf` (92920 × 23600 pt), `Review.png` (32768 × 8323 px), user Downloads folder, 12 Nov 2026 |
| Live file | [Final-Web design copy](https://www.figma.com/design/HufgU8zIvhH1huEdeyrL1v/); node IDs from [phase5-review-frame-metadata.json](phase5-review-frame-metadata.json) |
| Method | Per-frame text extraction (`pypdfium2.get_text_bounded`) and per-frame renders at about 1920 px. The artefacts are in the session scratchpad and are not committed; the 160 MB PDF is not copied into the repository |
| Frames found | 51 frames: 23 primary screens, tab and state variants, and one full-shell dashboard |

**Numbering.** The route inventory in `src/app/routing/screens.ts` uses the current
Figma IDs. REV-12 (Refer) lives at `observations/:id/refer`, between REV-06 and REV-07
in routing order. Older local specifications numbered Review screens differently. They
were not used.

**Absent from the export:**

- REV-16 Quarantine decision.
- The REV-18–REV-24 outcome frames. REV-18–24 are named outcomes, not pages. Their
  states are taken from frames that are present (COR-041 rejected, REF-014 pending link,
  history after rejection).
- The QUA-002 rejected variant.
- The Nimal (Highland) persona variants.

## 2. Screen status

Legend:

- **Fixture-complete**: every visible element, action and state is implemented on
  demonstration data.
- **Partial**: implemented except the noted part.
- **Blocked**: no approved design or rule exists.
- **Production-integrated**: none of the Review screens.

| ID | Screen | Route | Figma node | Status |
| --- | --- | --- | --- | --- |
| REV-01 | Supervisor Dashboard | `/review` | 19:2 | Fixture-complete |
| REV-02 | Observation Review Queue | `/review/queue` | 19:302 (+6 tab frames) | Fixture-complete. Tabs, search, Division/Disease/Captured filters, reset, sort, pagination (15/page), row menu, simulated export |
| REV-03 | Observation Review | `/review/observations/:id` | 19:785 | Fixture-complete for in-review records. Read-only for other statuses (see interpretation I-1) |
| REV-04 | Verify Observation | `…/verify` | 19:1016 | Fixture-complete |
| REV-05 | Flag Observation | `…/flag` | 20:2 | Fixture-complete |
| REV-06 | Request Correction | `…/request-correction` | 20:186 | Fixture-complete |
| REV-07 | Correction Queue | `/review/corrections` | 20:362 (+5 tab frames) | Fixture-complete. Lifecycle counts are in-scope (deviation D-2) |
| REV-08 | Correction Detail | `/review/corrections/:id` | 20:559 | Fixture-complete: resubmitted, requested, approved, applied and rejected states |
| REV-09 | Original vs Revised | `…/compare` | 20:759 | Fixture-complete |
| REV-10 | Approve Correction | `…/approve` | 20:953 | Fixture-complete |
| REV-11 | Reject Correction | `…/reject` | 21:2 | Fixture-complete |
| REV-12 | Refer to Expert | `/review/observations/:id/refer` | 21:167 | Fixture-complete. Case creation belongs to Cases (Phase 6) and is not simulated |
| REV-13 | Expert Referral Status | `/review/referrals` | 21:351 | Fixture-complete, including the REF-014 "pending case link" state. "Prototype handoff: continue as Disease Expert" is omitted because Cases is out of scope |
| REV-14 | Quarantine Queue | `/review/quarantine` | 21:601 | Fixture-complete. Scoped to the Supervisor (deviation D-1) |
| REV-15 | Quarantine Record | `/review/quarantine/:id` | 21:834 | Fixture-complete for QUA-002; other records show only the fields the designs provide. "Refresh status" refetches |
| REV-16 | Quarantine Decision | `…/decide` | 21:1035 | **Blocked.** The frame is not in the export, so the route explains this and records nothing |
| REV-17 | Review and Decision History | `/review/history` | 21:1216 (+5 tab frames, after-rejection set) | Fixture-complete |
| REV-18–24 | Outcome states | — | 39:1733 … 39:3245 | Partial. Outcomes shown in present frames are implemented; frames missing from the export are not verified |

## 3. Workflows

1. **Verify** (REV-03 → REV-04):
   - Every checklist item must be confirmed and the note is optional.
   - The status changes from `in_review` to `verified`.
   - The review version increments and a history row is added.
2. **Flag** (REV-05):
   - Reason and Explanation are required.
   - The status changes from `in_review` to `flagged`.
   - The observation joins the dashboard's follow-up list.
   - Evidence is untouched.
3. **Request correction** (REV-06):
   - At least one item and a message are required.
   - A new `COR-nnn` record is created as `requested`, for revision 2.
   - The observation changes to `correction_requested`.
   - Only one open correction is allowed per observation.
4. **Approve** (REV-09 → REV-10):
   - Only `resubmitted` corrections can be approved, and both confirmations are required.
   - The correction changes to `approved`. The observation **stays**
     `correction_requested` ("Approval is not application").
5. **RevisionApplied** (fixture-only):
   - On an approved correction, the button "Simulate RevisionApplied event" changes the
     correction to `applied` and the observation to `in_review`, and increments the
     review version.
   - It is labelled as a demonstration event. The HTTP adapter reports it as
     `…fixtureOnly`.
6. **Reject** (REV-11):
   - Allowed from `requested` (as REV-11 shows for COR-041) or `resubmitted`.
   - Reason and message are required.
   - The correction changes to `rejected`. The observation and evidence are unchanged.
7. **Refer** (REV-12):
   - An eligible active Disease Expert covering the estate and a note are required.
   - A new `REF-nnn` record is created as `pending_case_link` with no case. The
     observation changes to `referred`.
   - The user is redirected to REV-13 with the success banner.

Every write:

- requires an active Supervisor;
- re-checks estate scope on the server side of the adapter;
- checks `expectedVersion`, returning a 409 `conflict` with a "Refresh record" action;
- carries an idempotency key, one per form instance (a repeated key returns the
  first result and never records twice).

Failed writes keep the form values and never show a success toast.

## 4. Business rules and interpretations

Rules come from the design text:

- "Approved is not Applied".
- "Only the RevisionApplied event returns the review to in_review".
- "Rejecting leaves the original observation and evidence unchanged".
- "Referral creates a case… pending case link until it is reconciled".
- "Pending = submitted or in review".
- The resulting status shown on each decision screen.

They are coded in `features/review/domain/rules.ts`.

Where the designs are silent, these conservative interpretations apply:

| # | Interpretation | Reason |
| --- | --- | --- |
| I-1 | Decisions are allowed only on `in_review`. `submitted` records are read-only and state that no claim action is designed | REV-03 history shows "Claimed for review" before decisions, but no claim screen exists |
| I-2 | The verification checklist and the two approval confirmations must all be ticked | They are presented as confirmations. Requiring them is the safer reading; confirm with the product owner |
| I-3 | The "Open" correction tab = requested + resubmitted + approved | Approved is not final until Applied |
| I-4 | Rejection does not change the observation's review status | "The original observation and evidence remain unchanged"; no transition is designed |
| I-5 | Reason dropdowns offer only the values visible in Figma ("Image quality issue", "Evidence", "Evidence still unclear") | No reason catalogue is specified |
| I-6 | The dashboard's flagged follow-up list is data (OBS-024 seeded), plus any newly flagged observation | Figma lists only OBS-024 of the three flagged; "Flagging marks a concern for follow up" |

Deviations from Figma:

- **D-1:** REV-14 shows several estates as an illustration. Its banner says production
  must be scoped, so the list is scoped (Malini sees QUA-002; Nimal sees QUA-001 and
  QUA-004).
- **D-2:** The REV-07 lifecycle card shows "Demo counts across all estates". This build
  shows in-scope counts instead, to avoid cross-estate leakage.

Figma inconsistencies, not reproduced:

- REV-05 shows the suspected disease "Blister blight" and "Notify field worker (Ravindu
  Kumara)" for OBS-014. The record is Grey blight and Hiruni Nadeesha, so the record
  values are shown.

## 5. Fixtures

Fixtures are in `src/fixtures/seed/review.ts`, with record types in `records.ts` and
cross-checks in `integrity.ts`. Each row carries a provenance tag.

- **Review records:** `REV-nnn` per observation, version 1. In-review records are
  claimed by the estate supervisor.
- **Decisions:** the 11 REV-17 rows (`figma`), plus REF-011 and REF-047 (`derived` from
  CASE-011/CASE-047 "Awaiting diagnosis" on REV-12).
- **Corrections:**
  - COR-005 is resubmitted; its revision OBSR-005-2 is read from the Capture evidence,
    never copied or modified.
  - COR-041 is requested.
- **Referrals:**
  - REF-006 and REF-042 are diagnosed (CASE-006 and CASE-042 are the existing
    expert-confirmed cases).
  - REF-023 is awaiting diagnosis. CASE-023 is not added to `db.cases`, so Identity's
    "expert-confirmed" counts are unchanged.
- **Quarantine:** QUA-001–004 and QDEC-002.
- **REV-03 details:** the OBS-014 symptom chips and field note.

All screens show "Demo data" in the shell. Queue and quarantine copy says
"demo data" / "Demonstration data". Export and RevisionApplied say they are simulated.

## 6. Authorization and integration

- `/review/*` is limited to `SUPERVISOR` (RequireRole → ID-15 Access denied). The
  adapter re-checks the role and active status on every call.
- Estate scope comes from the stored user record, never from the caller. Out-of-scope
  and missing records return the same `not_found`; direct URLs to other estates'
  observations and corrections show "unavailable".
- Capture integration:
  - Review reuses Capture's `EvidenceImage` through the public API
    (`@/features/capture`).
  - REV-03 links to the Capture evidence viewer (`/observations/:id/evidence`).
  - Successful Review writes also invalidate Capture observation queries.
  - Review never writes `captureEvidence` or `assignments`; unit and e2e tests verify
    this.
- Observation, division, worker and disease IDs are the shared fixture IDs used by
  Capture and Identity.

## 7. Verification (run 12 Nov 2026)

| Check | Result |
| --- | --- |
| `tsc -b` | Pass |
| `npm run lint` (ESLint, including architecture boundaries) | Pass, 0 problems |
| `npm run build` | Pass |
| `vitest run` | **178 passed** (15 files), including 5 unified-dataset integration tests. Review: 19 unit + 16 route tests. Identity and Capture suites unchanged and passing |
| Playwright | **43 passed** when run as `shell + identity + login-layout` (21, `--workers=1`) and `capture + review` (22, `--workers=2`). See note |

Review e2e coverage:

- the decision → correction → approval → RevisionApplied → history flow;
- assignment status unchanged afterwards;
- cross-module evidence navigation;
- keyboard-only verification;
- the referral pending case link;
- administrator denial;
- Highland scope;
- 10 Review screens at 1920×1080, 1440×900, 1366×768, 1280×720 and 390×844 with no
  page-level horizontal scroll.

**Note on the full parallel run:** with all specs on the default worker count, slow
existing layout tests intermittently time out loading the dev server. Examples are
Identity overflow (48 s of its 60 s budget even alone) and Capture layouts. One run
also hit `net::ERR_NETWORK_IO_SUSPENDED` from the host. Each passes when re-run, with
no assertion failures. Increasing those tests' timeouts or worker isolation is
recommended but was not changed here.

## 8. Limitations and pending backend work

- No Review backend contract exists. All operations listed in
  [pending-contracts.md](api-integration/pending-contracts.md) are `contract_pending`.
- Not modelled (no design or rule):
  - claim for review;
  - REV-16 quarantine release/reject;
  - quarantine ingest retry;
  - field-worker resubmission (mobile);
  - case creation and linking (Cases, Phase 6);
  - notifications actually being sent ("Notify field worker" is stored only).
- Demonstration changes live only in tab memory and reset on reload.
- REV-18–24 frames missing from the export are not verified against visuals.

## 9. Files

**Created**

- `src/features/review/domain/models.ts`, `rules.ts`, `checklist.ts`
- `src/features/review/application/ports.ts`, `reviewUseCases.ts`
- `src/features/review/infrastructure/fixtureReviewAdapter.ts`, `httpReviewAdapter.ts`
- `src/features/review/index.ts`, `fixtures.ts`, `http.ts`, `pages.ts`
- `src/features/review/presentation/services/reviewServices.ts`, `queries.ts`, `useReviewClock.ts`
- `src/features/review/presentation/components/badges.tsx`, `parts.tsx`, `format.ts`, `useTableSort.ts`, `review.module.css`
- `src/features/review/presentation/pages/`:
  - `ReviewDashboardPage.tsx`, `ReviewQueuePage.tsx`;
  - `ObservationReviewPage.tsx`, `ObservationDecisionPage.tsx`;
  - `CorrectionQueuePage.tsx`, `CorrectionDetailPage.tsx`, `CorrectionComparePage.tsx`, `CorrectionDecisionPage.tsx`;
  - `ReferralsPage.tsx`, `QuarantinePages.tsx`, `DecisionHistoryPage.tsx`
- `src/features/review/review.test.ts`
- `src/fixtures/seed/review.ts`
- `src/app/routing/reviewScreens.tsx`
- `src/app/review.routes.test.tsx`
- `tests/e2e/review.spec.ts`
- `src/app/dataset.integration.test.ts` (unified-dataset checks)
- `docs/demonstration-dataset.md`

**Modified**

- `src/fixtures/records.ts`, `src/fixtures/seed/index.ts`, `src/fixtures/integrity.ts`: Review records, state-machine replay and image-source checks.
- `src/fixtures/seed/capture.ts`, `src/features/capture/domain/observation.ts`: `imageSource` attribution on evidence; no visual Capture change.
- `src/features/capture/index.ts`: public export of `EvidenceImage`; no Capture behaviour change.
- `src/app/composition/adapterSet.ts`, `container.ts`, `fixtureAdapters.ts`, `httpAdapters.ts`
- `src/app/providers/AppProviders.tsx`
- `src/app/routing/routes.tsx`: 17 Review routes added to IMPLEMENTED.
- `src/shared/components/Display/Display.module.css`: BarList label width is now a CSS
  variable with the same 130 px default.
- `src/app/app.test.tsx`, `tests/e2e/shell.spec.ts`: placeholder assertions moved from
  REV-02 (now implemented) to the still-pending CASE-02 / Review heading.
- `docs/api-integration/pending-contracts.md`, `docs/phase4-completion-report.md`,
  `docs/phase5-review-audit.md`, this report.

**Deleted:** the four `.gitkeep` placeholders under `src/features/review/*/`.

No Identity behaviour, backend, mobile app or Figma file was changed. No commits or
pushes were made.
