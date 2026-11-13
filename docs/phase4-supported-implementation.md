# Phase 4 - historical first supported delivery

This document records the earlier CAP-W01-W08 / ASG-01-05 delivery only. Its older
pending-design statements are superseded by the current
[completion report](phase4-completion-report.md) and the local-PDF addendum in the
[Figma audit](phase4-figma-audit.md).

Scope: the already retrieved CAP-W01–CAP-W08 and ASG-01–ASG-05 designs only.
No additional Figma MCP calls were made. The existing Identity UI and authentication
logic were preserved. Review links lead to existing later-phase routes; Review,
Cases, Analytics and mobile capture were not implemented.

## Capture completion

| Screen | Implemented fixture workflow | Limits |
| --- | --- | --- |
| CAP-W01 Observation Evidence Viewer | Original illustration, thumbnails, pending-note preview, zoom/rotate/expand/download, provenance, GPS/history/original navigation | Detailed evidence is supplied only for the approved OBS-005 example |
| CAP-W02 Observation Details | Summary, disease/symptoms/note, linked records, Overview/Evidence/Metadata/Revisions navigation | Unknown observation-specific symptoms/revisions are not generated |
| CAP-W03 Original Image Viewer | Read-only image, transformations, synthetic JPEG download, unavailable demo toggle | Download is a rendering of the synthetic Figma artwork, not an uploaded original photograph |
| CAP-W04 Capture Metadata | Capture/device and asset/receipt cards, copy metadata with clipboard failure feedback | Missing receipts display Not specified |
| CAP-W05 GPS Provenance Details | Approved static map assets, device coordinates, copy, accuracy band, scoped same-division accuracy table | Unknown coordinates are unavailable; no map tiles or GPS acquisition |
| CAP-W06 Observation Revision History | Approved timeline and revision table, compare navigation, application-versus-approval warning | No revision application or Review mutation |
| CAP-W07 Original vs Revised Evidence | Effective/pending comparison, unchanged original, notes-only field differences | Fixture revision example is OBS-005 only |
| CAP-W08 Evidence Unavailable | Real image-decode failure fallback and designed demo state, provenance preserved, retry, problem-detail copy | Report a problem copies diagnostics; no ticket is submitted |

CAP-W08 is a state of the existing evidence/original route, not a speculative new
screen. The sidebar entry redirects to approved available evidence within current
scope; it does not add an undesigned observation list.

All ten downloaded Figma SVG assets are bundled locally, with no temporary URLs
used at runtime. Their root attributes are unchanged. Evidence and map geometry use
the retrieved node positions/dimensions. Browser output was visually inspected;
full pixel parity with every Figma variant is not claimed.

## Assignment completion

| Screen | Implemented fixture workflow | Limits |
| --- | --- | --- |
| ASG-01 Fieldwork Assignments | Seven approved Riverbend list rows, dynamic counts, status tabs, scoped empty state, restore demo state, record/evidence navigation | Unread summary-detail targets explicitly report that their design is pending |
| ASG-02 Create assignment | Scoped estate/division, active eligible worker, title/instructions/priority/due date, summary, Assign task and Save as draft, feedback | Structural input checks only; no invented future-date/window/length constraints |
| ASG-03 Assigned | Detail, lifecycle, progress/activity, prototype start simulation | Edit/reassign and cancel controls explain pending design and do not mutate |
| ASG-04 In progress | Progress/activity, no-submission state, labelled prototype submission simulation | Simulation uses approved existing OBS-014; no mobile capture is implemented |
| ASG-05 Submitted | Linked submitted observation and evidence, progress/activity, separate Review decision warning | Acceptance reports the ASG-06 dependency and does not complete the assignment |

New records receive the next shared identifier (ASG-008 onward); ASG-001 is not
overwritten to mimic the prototype's create branch. Drafts appear in the list; no
unapproved draft-detail design was added. Only the confirmed East Hills/Hiruni
scenario can simulate the existing OBS-014 submission; unrelated scenarios do not
fabricate mobile evidence. Demo restore resets scoped assignments only, preserving
Identity edits and other fixture records.

Seed ASG-001 remains Submitted as shown in ASG-01. Creating the supported example
provides the assigned → in-progress → submitted journey without resetting that seed
to an inconsistent initial state.

## Authorization and consistency

- Existing Supervisor-only Capture route guard retained.
- Every adapter request checks active account and current stored estate scope.
- Assignment creation checks estate/division relationship, active organization
  records and the selected active Field Worker's current division scope.
- Version conflicts reject stale simulation writes.
- Original evidence and observation Review status are never changed by simulations.
- Capture mutations refresh feature queries; sign-out/expiry clears the shared cache.
- API-mode methods remain contract pending and send no invented requests.
- Shared fixture integrity checks now include evidence and assignment references.

## Remaining Assignment designs — not complete

| ID | Known node | Known metadata | Exact information still needed |
| --- | --- | --- | --- |
| ASG-06 | 142:3422 | completed | Acceptance flow/confirmation, permissions, completion feedback and final layout |
| ASG-07 | 142:3980 | edit-reassign | Editable fields, eligible statuses, reassignment validation, reason/history behavior |
| ASG-08 | 142:4538 | cancel-confirm | Confirmation content, required fields/reason, permitted statuses and failure behavior |
| ASG-09 | 142:5096 | cancelled | Final state details, activity/observation preservation, permitted navigation |
| ASG-10 | 150:479 | detail-ASG-002 | Full summary layout, controls, interactions and states |
| ASG-11 | 150:682 | detail-ASG-003 | Full summary layout, controls, interactions and states |
| ASG-12 | 150:885 | detail-ASG-004 | Draft summary layout and any available actions |
| ASG-13 | 150:1088 | detail-ASG-005 | Completed summary layout and available actions |
| ASG-14 | 150:1291 | detail-ASG-006 | Reassigned summary layout and available actions |
| ASG-15 | 150:1494 | detail-ASG-007 | Cancelled summary layout and available actions |

Known IDs and metadata are preserved in phase4-figma-audit.md. None of these screens
is presented as completed. The edit route's inventory was corrected from ASG-08 to
ASG-07; its existing pending placeholder remains.

## Files created or modified

Feature:
- src/features/capture/domain/observation.ts
- src/features/capture/domain/assignment.ts (new)
- src/features/capture/application/ports.ts
- src/features/capture/application/captureUseCases.ts
- src/features/capture/infrastructure/fixtureCaptureAdapter.ts
- src/features/capture/infrastructure/httpCaptureAdapter.ts
- src/features/capture/index.ts
- src/features/capture/pages.ts (new)
- src/features/capture/presentation/ObservationPages.tsx (new)
- src/features/capture/presentation/AssignmentPages.tsx (new)
- src/features/capture/presentation/EvidenceImage.tsx (new)
- src/features/capture/presentation/evidenceAssets.ts (new)
- src/features/capture/presentation/downloadEvidence.ts (new)
- src/features/capture/presentation/common.tsx (new)
- src/features/capture/presentation/helpers.ts (new)
- src/features/capture/presentation/services.tsx (new)
- src/features/capture/presentation/capture.module.css (new)
- src/features/capture/presentation/assets/ (10 approved SVGs, new)
- src/features/capture/capture.test.ts

Integration/fixtures:
- src/app/providers/AppProviders.tsx
- src/app/routing/routes.tsx
- src/app/routing/screens.ts
- src/app/routing/captureScreens.tsx (new)
- src/fixtures/records.ts
- src/fixtures/index.ts
- src/fixtures/integrity.ts
- src/fixtures/seed/index.ts
- src/fixtures/seed/capture.ts (new)
- src/fixtures/seed/observations.ts (approved ASG-05 capture-time correction for OBS-014)

Tests/documentation:
- src/app/capture.routes.test.tsx (new)
- tests/e2e/capture.spec.ts (new)
- docs/capture-status.md
- docs/phase4-supported-implementation.md (this report)

## Verification

- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test`: 123 unit/integration tests passed across 11 files.
- `npm run test:e2e -- --workers=2`: all 28 browser tests passed, including 7 Capture
  tests and the existing Identity/login/shell regression suite. Two workers avoid
  oversubscribing this machine during the longer workflow tests.
- After the OBS-014 timestamp correction, all 7 Capture browser tests and the full
  unit/integration suite passed again. The final image-download rendering adjustment
  was checked with the affected browser workflow and a fresh lint/build.

Coverage includes scoped reads and
writes, eligibility, invalid forms, draft saving, stale versions, read-only evidence,
reset isolation, adapter failures/cancellation, route error/retry, scoped empty state,
unknown GPS, real browser image failures and retry, clipboard/download, all eight
Capture views/states, Assignment creation and simulation, and 1440px/390px layouts.

