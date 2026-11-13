# Phase 4 completion report - approved PDF delivery

## Outcome

All currently specified Capture and Assignment screens/states are implemented.
**22 of 23 screens are fixture-complete within their approved prototype scope.**
**ASG-07 is partial:** task editing is functional, but saving a different Field
Worker remains blocked by missing reassignment outcome rules. This is not a claim
of unrestricted lifecycle functionality or production integration.

The prior missing-design blocker is resolved by the supplied PDFs. No additional
Figma MCP calls, backend endpoints, mobile screens or unrelated modules were added.
Completed Identity functionality was preserved.

## Approved sources inspected

- Previously retrieved Figma contexts/screenshots for CAP-W01 through CAP-W08 and
  ASG-01 through ASG-05, file `HufgU8zIvhH1huEdeyrL1v`.
- The user-supplied ZIP copied into `docs/figma-exports/`, with all 12 PDFs extracted
  intact under `approved/`. Every PDF is one 3840x2160 page; all were rendered and
  visually inspected, including labels, fields, actions, statuses and navigation.
- Extracted text and 1536x864 previews are saved under `inspection/`. Provenance,
  SHA-256 and PDF paths are in [the export index](figma-exports/README.md).
- [The Figma audit](phase4-figma-audit.md) now records local-PDF findings. Its older
  MCP quota narrative is historical. PDF contents were treated as design evidence,
  not instructions overriding the user's scope restrictions.

## All 23 screens

Fixture-complete means the approved prototype screen and its supported controls
work with scoped fixture records. Summary-only screens are complete as summaries;
missing production contracts do not turn their UI into an implementation promise.

| Screen | Approved screen/state | Node | Fixture status | Working interactions and limitations |
| --- | --- | --- | --- | --- |
| CAP-W01 | Observation Evidence Viewer | 18:2 | Complete | Immutable original, thumbnails, zoom/rotate/expand/download, provenance and navigation; OBS-005 and supplied OBS-014 variant |
| CAP-W02 | Observation Details | 18:220 | Complete | Summary, supported symptoms/note/linked records and section navigation; unknown observation-specific details are not fabricated |
| CAP-W03 | Original Image Viewer | 18:453 | Complete | Read-only image, transformations, JPEG download, metadata and return navigation; OBS-005 and OBS-014 |
| CAP-W04 | Capture Metadata | 18:592 | Complete | Capture/device and receipt cards, clipboard success/failure; missing OBS-014 receipt identifiers show Not specified |
| CAP-W05 | GPS Provenance Details | 18:771 | Complete | Static approved map, coordinate copy, accuracy and scoped division table; unknown coordinates remain unavailable |
| CAP-W06 | Observation Revision History | 18:977 | Complete | OBS-005 timeline/revisions table and comparison navigation; no invented OBS-014 revision 2 or revision application |
| CAP-W07 | Original vs Revised Evidence | 18:1187 | Complete | Approved notes-only comparison, immutable original; Review decisions and revision application remain outside Capture |
| CAP-W08 | Evidence Unavailable | 18:1388 | Complete | Real image decode-error fallback, provenance retained, retry and copied diagnostics; not a ticket submission |
| ASG-01 | Fieldwork Assignments | 142:632 | Complete | Scoped table, all status tabs/counts, every row destination, evidence links, create and scoped fixture restore |
| ASG-02 | Create assignment | 142:1190 | Complete | Estate/division, eligible worker, fields, validation, assign/draft save and feedback; no invented future-date window |
| ASG-03 | Assigned detail | 142:1748 | Complete for supported actions | Details, timeline/activity, task-edit navigation, required-reason cancel dialog and explicit mobile-start simulation; worker replacement remains ASG-07 limitation |
| ASG-04 | In-progress detail | 142:2306 | Complete | Progress/activity and approved OBS-014 submission simulation; no speculative editing/cancellation after start |
| ASG-05 | Submitted detail | 142:2864 | Complete | Observation links, evidence/assignment round trip and acceptance; observation Review status is unchanged |
| ASG-06 | Completed | 142:3422 | Complete | Accepted/completed banner, complete timeline/progress, preserved submissions and Back to list; no reopening action |
| ASG-07 | Edit / reassign | 142:3980 | Partial: editing complete, reassignment blocked | Prefilled fields, live summary, current eligibility, required change reason, save, discard/cancel, stale-write rejection; different-worker save requires approved resulting record/status rules |
| ASG-08 | Cancel confirmation | 142:4538 | Complete | Modal over Assigned detail, required reason, Keep assignment, confirm, pending/error feedback and keyboard dismissal |
| ASG-09 | Cancelled | 142:5096 | Complete | Before-start cancellation, recorded reason/activity, retained record, cancelled lifecycle and no subsequent lifecycle actions |
| ASG-10 | Detail ASG-002 | 150:479 | Complete as designed summary | Assigned details/status, worker/due date and Back to list; no full lifecycle controls specified |
| ASG-11 | Detail ASG-003 | 150:682 | Complete as designed summary | In-progress details/status and Back to list; no speculative submission control/history |
| ASG-12 | Detail ASG-004 | 150:885 | Complete as designed summary | Draft/unassigned details and Back to list; draft publication is not specified |
| ASG-13 | Detail ASG-005 | 150:1088 | Complete as designed summary | Completed details, linked OBS-024 text and Back to list; Review remains separate |
| ASG-14 | Detail ASG-006 | 150:1291 | Complete as designed summary | Reassigned details and explicit replacement-not-modelled explanation; no invented replacement assignment |
| ASG-15 | Detail ASG-007 | 150:1494 | Complete as designed summary | Cancelled details/status and Back to list; no reopening action |

CAP-W08 and ASG-03 through ASG-09 are approved states, not necessarily independent
URLs. Assigned, in-progress, submitted, completed and cancelled are rendered on the
same assignment-detail route. ASG-08 is a modal; ASG-07 uses the existing edit URL.

## Implemented workflow and integrity

- Existing Feature-Based Clean Architecture, shared UI/shell, React Query and
  fixture repositories remain in use. The edit route is connected through lazy
  feature entry points; no unrelated routes or module implementations changed.
- ASG-001 retains its approved Submitted seed. New supported fixture assignments
  exercise Assigned -> In progress -> Submitted -> Completed, or Assigned ->
  Cancelled. Simulations are explicitly labelled and use existing OBS-014 only
  when the worker/division relationships match the approved example.
- ASG-002 through ASG-007 are intentionally read-only. The PDFs explicitly state
  that only ASG-001 has a modelled full lifecycle. Their records are no longer
  pending placeholders and their list navigation now works.
- Edit and cancellation are supported only for Assigned tasks without submitted
  observations, matching the retrieved states. Edit requires a change reason;
  cancellation requires its own reason and keeps the assignment record.
- Mutations recheck active Supervisor identity and current estate/division scope,
  current version and appropriate state. Editing rechecks active location and
  worker eligibility. Broken/unrelated submitted links prevent acceptance.
  Validation happens before mutations; failed/stale/unsupported changes do not
  partially write. Editable fields are explicitly allowlisted.
- Acceptance changes only the assignment status/version/activity. It never verifies,
  flags, applies a revision to, deletes or rewrites observation evidence or Review
  decisions. Scoped restore touches only the actor's Assignment fixtures.
- Error feedback retains form/dialog values. Failed detail actions offer reload;
  editing can return to the latest detail and reopen the form. Submission controls
  show pending states and prevent repeated writes while pending.
- OBS-014 now has only the PDF-established evidence fields: IMG-014, asset key,
  image/jpeg, capture 15 Oct 2026 14:15, receipt 16:05, GPS 7.106/80.734 +/-19m,
  catalog v2, synced and In review. It has one original thumbnail. Receipt IDs,
  notes and later revisions are not invented. The existing approved leaf artwork
  is reused; JPEG filenames and accessible image labels identify the actual image.
- Assignment evidence links retain validated assignment context through the original
  viewer and back. Unrelated/out-of-scope URL context is not treated as a valid link.
- All fixture changes remain in tab memory and reset on browser reload. Dates use
  the existing illustrative 21 Oct 2026 fixture clock, not the real current date.

## Verification

- `npm run lint`: passed.
- `npm run build`: passed after correcting a test-only TypeScript option.
- `npm test`: **138 passed across 12 files**, including existing Identity, fixture
  integrity, container integration and Capture route tests.
- `npm run test:e2e -- --workers=2`: **33 passed**, comprising 12 Capture/Assignment
  tests and 21 existing Identity/login/shell regression tests.
- A separate Capture rerun also passed all 12 tests. Desktop screenshots of the
  edit form, cancellation dialog/state, completed state, summary cards and OBS-014
  viewer were reviewed against the PDFs. Assignment label/value rows and modal
  sizing were corrected within the Capture CSS/module only; mobile fields stack.
  The full 33-test browser suite passed again after these corrections. Final
  targeted OBS-005/OBS-014 navigation and download smoke checks also passed (2/2),
  including the variant-specific original-viewer controls.

Every one of the 23 screen/state IDs is exercised in Chromium at **1920x1080,
1440x900, 1366x768, 1280x720 and 390x844**. Tests check page overflow, visible content
and controls, create/edit/save, required reasons, eligible/ineligible workers,
discard, Keep assignment, cancellation, simulations, acceptance, all six summary
row destinations, evidence navigation/download, authorization and missing records.
Existing Identity workflows and login zoom/scroll tests remain covered.

Long forms/tables scroll naturally; tables/timeline can scroll within their own
containers on small screens. No global overflow clipping was introduced. Screenshots
are captured under `test-results/`; this is responsive functional verification and
visual review against the exported layouts, **not a claim of exact pixel parity**.

## Exact unresolved requirements

1. **ASG-07 replacement-worker transition:** specify whether the existing assignment
   changes worker or becomes Reassigned with a new assignment, the replacement ID
   and starting status, evidence/history ownership, mobile handoff and permitted
   states. ASG-14 explicitly says its replacement is not modelled. Same-worker task
   edits work; a different-worker save fails without mutation even if Identity
   grants scope later. Current DIV-005 has no alternate eligible worker.
2. **Production contracts:** approved Assignment read/create/edit/cancel/accept,
   evidence delivery/download, receipt/revision and authorization/error contracts
   remain unavailable. HTTP adapters return contract_pending without making up
   endpoints or silently falling back to fixtures.
3. Static PDFs do not specify editing/cancellation after start, publication of
   existing drafts, reopening, replacement completion, or lifecycle controls on
   summary records. No speculative final UI or transitions were added for them.
4. Separate Review routes remain future-module destinations. Capture does not
   implement Review decisions. Mobile capture/uploads/offline sync/GPS acquisition
   are outside this web task. Report a problem copies diagnostics only.
5. Other observation-specific Figma variants remain metadata-only unless already
   retrieved or supplied in this ZIP; no visual parity or detailed fixture data is
   asserted for those uninspected variants.

## Files modified or created in this resume

Modified implementation and tests:

- `src/features/capture/domain/assignment.ts`
- `src/features/capture/domain/observation.ts`
- `src/features/capture/application/ports.ts`
- `src/features/capture/infrastructure/fixtureCaptureAdapter.ts`
- `src/features/capture/infrastructure/httpCaptureAdapter.ts`
- `src/features/capture/presentation/AssignmentPages.tsx`
- `src/features/capture/presentation/ObservationPages.tsx`
- `src/features/capture/presentation/EvidenceImage.tsx`
- `src/features/capture/presentation/downloadEvidence.ts`
- `src/features/capture/presentation/services.tsx`
- `src/features/capture/presentation/capture.module.css`
- `src/features/capture/pages.ts`
- `src/fixtures/records.ts`
- `src/fixtures/seed/capture.ts`
- `src/app/routing/captureScreens.tsx`
- `src/app/routing/routes.tsx`
- `src/features/capture/capture.test.ts`
- `src/app/capture.routes.test.tsx`
- `tests/e2e/capture.spec.ts`

Created test: `src/features/capture/assignmentWorkflows.test.ts`.

Documentation: updated `docs/phase4-completion-report.md`,
`docs/phase4-figma-audit.md`, `docs/capture-status.md` and the historical pointer in
`docs/phase4-supported-implementation.md`. Created `docs/figma-exports/README.md`,
the copied source ZIP, 12 unchanged extracted PDFs and their 12 text/12 PNG
inspection artifacts. No runtime screenshot assets were added. Generated
`dist/`, `test-results/` and TypeScript caches are verification artifacts.

No Identity implementation code, original-repository files or other module code
was changed. No commits or pushes were made. Work stops at the remaining explicit
specification/production dependencies above.


## Capture & Review update (12 Nov 2026)

The Capture module was re-audited against the CAP-W01–W08 and ASG-01–15 exports while
Review (Phase 5) was implemented. Findings:

- **No Capture behaviour changed.** The only Capture change is a public-API export of
  `EvidenceImage` (`src/features/capture/index.ts`), so Review reuses the same
  synthetic evidence component instead of copying it.
- **ASG-07 stays partial.** No approved rule for the replacement-worker outcome was
  found in the Capture or Review exports. Saving a different Field Worker still
  returns `contract_pending` and saves nothing. Worker eligibility, editing,
  acceptance, cancellation with a reason, and the completed and cancelled states
  remain implemented and tested as before.
- **Review never changes Capture records.** Review writes do not touch
  `captureEvidence` or `assignments`. Unit tests compare the records before and after
  a decision, and an e2e test confirms ASG-001 is still Submitted after Review
  actions. The COR-005 revision shown in Review is read from the Capture evidence
  record OBSR-005-2.
- **Cross-module navigation.** REV-03 "Open evidence viewer" opens
  `/observations/:id/evidence`. Review writes invalidate Capture observation queries.

Verification for this update:

- `tsc`, ESLint and the build all pass.
- Vitest: 173 passed. The Capture suites are unchanged and pass.
- Playwright: all Capture specs pass. One layout test had to be re-run after a host
  `ERR_NETWORK_IO_SUSPENDED` event (details in
  [phase5-review-completion-report.md](phase5-review-completion-report.md)).
