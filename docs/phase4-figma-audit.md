# Phase 4 — new Figma file access and requirements audit

Current source: [TeaLeaf design copy](https://www.figma.com/design/HufgU8zIvhH1huEdeyrL1v/).

Access was verified by retrieving the actual CAP-W01 frame **18:2**, its generated
design context, and its rendered screenshot. Session: `de37ef0b-83a0-4544-b0d1-a5ccd2485d70`.
The previous file-access denial is no longer the active blocker for this new copy.

## Retrieved frame inventory

| Node | Figma frame name | Inspection status |
| --- | --- | --- |
| 18:2 | WEB / Capture / CAP-W01 / default / 3840x2160 | Design context retrieved |
| 18:220 | WEB / Capture / CAP-W02 / default / 3840x2160 | Design context retrieved |
| 18:453 | WEB / Capture / CAP-W03 / default / 3840x2160 | Design context retrieved |
| 18:592 | WEB / Capture / CAP-W04 / default / 3840x2160 | Design context retrieved |
| 18:771 | WEB / Capture / CAP-W05 / default / 3840x2160 | Design context retrieved |
| 18:977 | WEB / Capture / CAP-W06 / default / 3840x2160 | Design context retrieved |
| 18:1187 | WEB / Capture / CAP-W07 / default / 3840x2160 | Design context retrieved |
| 18:1388 | WEB / Capture / CAP-W08 / evidence-unavailable / 3840x2160 | Design context retrieved |
| 142:632 | WEB / Capture / ASG-01 / list / 3840x2160 | Design context retrieved |
| 142:1190 | WEB / Capture / ASG-02 / create / 3840x2160 | Design context retrieved |
| 142:1748 | WEB / Capture / ASG-03 / assigned / 3840x2160 | Design context retrieved |
| 142:2306 | WEB / Capture / ASG-04 / in-progress / 3840x2160 | Design context retrieved |
| 142:2864 | WEB / Capture / ASG-05 / submitted / 3840x2160 | Design context retrieved |
| 142:3422 | WEB / Capture / ASG-06 / completed / 3840x2160 | Approved local PDF visually inspected (12 Nov 2026) |
| 142:3980 | WEB / Capture / ASG-07 / edit-reassign / 3840x2160 | Approved local PDF visually inspected (12 Nov 2026) |
| 142:4538 | WEB / Capture / ASG-08 / cancel-confirm / 3840x2160 | Approved local PDF visually inspected (12 Nov 2026) |
| 142:5096 | WEB / Capture / ASG-09 / cancelled / 3840x2160 | Approved local PDF visually inspected (12 Nov 2026) |
| 150:479 | WEB / Capture / ASG-10 / detail-ASG-002 / 3840x2160 | Approved local PDF visually inspected (12 Nov 2026) |
| 150:682 | WEB / Capture / ASG-11 / detail-ASG-003 / 3840x2160 | Approved local PDF visually inspected (12 Nov 2026) |
| 150:885 | WEB / Capture / ASG-12 / detail-ASG-004 / 3840x2160 | Approved local PDF visually inspected (12 Nov 2026) |
| 150:1088 | WEB / Capture / ASG-13 / detail-ASG-005 / 3840x2160 | Approved local PDF visually inspected (12 Nov 2026) |
| 150:1291 | WEB / Capture / ASG-14 / detail-ASG-006 / 3840x2160 | Approved local PDF visually inspected (12 Nov 2026) |
| 150:1494 | WEB / Capture / ASG-15 / detail-ASG-007 / 3840x2160 | Approved local PDF visually inspected (12 Nov 2026) |
| 206:140 | WEB / Capture / CAP-W02 / obs-014 / 3840x2160 | Metadata only |
| 206:422 | WEB / Capture / CAP-W02 / obs-023 / 3840x2160 | Metadata only |
| 206:704 | WEB / Capture / CAP-W02 / obs-032 / 3840x2160 | Metadata only |
| 206:986 | WEB / Capture / CAP-W02 / obs-041 / 3840x2160 | Metadata only |
| 413:6197 | WEB / Capture / CAP-W01 / obs-002 / nimal / 3840x2160 | Metadata only |
| 413:6426 | WEB / Capture / CAP-W03 / obs-002 / nimal / 3840x2160 | Metadata only |

## Requirements confirmed in retrieved design contexts

- CAP-W01: Observation Evidence Viewer; original immutable image; revision thumbnails;
  zoom out/in, rotation, expand, download; Compare revisions and Open original;
  provenance card with image ID, MIME type, capturer, capture/receipt times, GPS,
  separate mobile sync and review status. Existing shell/design assets should be reused.
- CAP-W02: Observation Details; Overview/Evidence/Metadata/Revisions navigation;
  original evidence, summary, suspected disease and symptoms, field note and linked records.
- CAP-W03: Original Image Viewer; download, read-only original, zoom and immutable
  asset information. The image illustrated in Figma is synthetic evidence, not a photograph.
- CAP-W04: Capture Metadata; copy metadata; capture/device and asset/server-receipt
  cards. OBS-005 is IMG-005, MIME image/jpeg, asset key
  `demo/observations/OBS-005/original.jpg`, receipt `SYNC-005`, idempotency key
  `demo-OBS-005-v1`; received 06 Oct 2026 15:05 (+05:30).
- CAP-W05: GPS Provenance Details; copy coordinates; static demo map, no live tiles;
  read-only device_gps provenance, accuracy band and same-division observation table.
  OBS-005 coordinates are 6.980, 80.635 with ±10 m accuracy.
- CAP-W06: Observation Revision History; timeline and revisions table; compare navigation.
  Correction approval is separate from revision application. Original revision 1 remains
  effective while OBSR-005-2 is pending application; review returns to in_review only
  after revision application. This is a display workflow, not authorization to implement Review.
- CAP-W07: Original vs Revised Evidence; revision 1 effective vs revision 2 pending;
  original image unchanged; only notes differ. Symptoms SYM-001/SYM-003 and suspected
  disease DIS-001 remain unchanged. Revised note: Updated synthetic symptom description.
- CAP-W08: Evidence Unavailable; image-load failure warning, Report a problem, and
  still-available metadata/provenance. An unavailable URL does not imply loss of immutable evidence.
- ASG-01: Fieldwork Assignments, seven Riverbend assignments in scope, status tabs,
  table columns assignment/title/division/worker/priority/due/status/observations.
  ASG-001 has the full prototype journey; others are summary records.
- ASG-02: Create assignment; scoped estate/division; eligible active Field Worker with
  scope on the selected division; title/instructions/priority/due date and summary.
  Priority options Low/Medium/High. Draft is shown in the unsaved summary.
  The exact remaining validation and edit/cancel rules require inspection of later frames.
- ASG-03: Assigned detail, five-step Draft → Assigned → In progress → Submitted → Completed
  timeline, assignment details, progress, activity, submitted observations and explicitly
  labelled fixture simulation of external mobile start.
- ASG-04: In progress detail with no observations yet and explicitly labelled simulation
  of the mobile submission arriving as existing observation OBS-014 in DIV-005.
- ASG-05: Submitted detail with OBS-014, warning that Submitted is not Completed;
  Supervisor acceptance is separate from verifying/flagging the observation in Review.

## Historical local mismatches (resolved by implementation)

- Local routing labels `/assignments/:assignmentId/edit` as ASG-08. The actual Figma
  ASG-07 is edit/reassign, and ASG-08 is the cancellation confirmation state.
- CAP-W08 is a designed evidence-unavailable state, rather than an independent list page.
- Current foundation lacks evidence, receipt, coordinates and revision fixtures.
  Design now supplies specific examples for OBS-005; these must not be generalized
  into invented facts for every observation.
- ASG-01 prototype starts ASG-001 in Submitted, while ASG-03/04 show earlier lifecycle
  states. A consistent fixture setup must preserve the supported prototype scenarios.

## Historical MCP dependency (resolved by local PDFs below)

Requests starting with ASG-06 returned: "You've reached the Figma MCP tool call limit
on the Starter plan." The connected account remains `[email redacted]` on a
Starter team with a View seat. Permission was sufficient for the successful reads;
changing file sharing again does not address the reported quota limit.

Still required: high-fidelity design contexts/screenshots for ASG-06–ASG-15, their
components/interaction targets and states, any additional validation/permission notes,
and applicable observation variants. Page metadata was retrieved but is insufficient
for implementing those screens as approved designs.

The initial MCP-only inspection made documentation changes only. This historical
statement does not describe the subsequent implementation using local PDFs; see
the current completion report for implementation and verification results.


## Approved local PDF inspection - 12 November 2026

The user supplied the ZIP copied to `figma-exports/`. All 12 one-page PDFs were
extracted, text-extracted and visually inspected at 1536x864 from 3840x2160 pages.
See `figma-exports/README.md` for the source hash and paths. No Figma MCP calls were
made in this resume. PDF labels are design evidence, not executable instructions.

- ASG-06: accepted/completed detail; only Back to list remains. Green completion
  banner, completed lifecycle, full progress and submitted evidence remain visible.
  Acceptance by Malini on 21 Oct 2026 does not change OBS-014's In review decision.
- ASG-07: edit/reassign an Assigned task. Estate, division, eligible worker, title,
  instructions, Low/Medium/High priority, due date, required Reason for change,
  Save changes, Discard and Cancel. Existing summary updates with the form.
  Hiruni is currently the only eligible DIV-005 worker. Ravindu cannot be selected
  for DIV-005. Identity administrators manage scope; this module does not grant it.
- ASG-08: cancellation dialog over Assigned detail, required Reason, Keep assignment
  and destructive Cancel assignment. No evidence has been submitted. The record
  survives cancellation; the mobile worker no longer sees the task.
- ASG-09: cancelled-before-start branch, reason banner, Draft/Assigned/Cancelled
  lifecycle, no-progress bar, recorded cancellation and no submitted observations.
- ASG-10 through ASG-15 explicitly say: "Summary record. Full lifecycle history,
  progress and evidence are modelled only for ASG-001 in this prototype."
  Each has Assignment details, Status card and Back to list; no edit/cancel/mobile
  simulations are specified. ASG-002 Assigned, ASG-003 In progress, ASG-004 Draft
  (unassigned), ASG-005 Completed (OBS-024 text), ASG-006 Reassigned (replacement
  not modelled), ASG-007 Cancelled. No histories or instructions are supplied.
- CAP-W01/03 OBS-014: exactly one original thumbnail, IMG-014/image/jpeg,
  Hiruni USR-009, captured 15 Oct 2026 14:15, received 16:05, coordinates
  7.106,80.734 +/-19m, synced, In review, catalog v2, immutable asset
  `demo/observations/OBS-014/original.jpg`. Back to assignment / evidence viewer,
  transforms and download are shown. The artwork matches the existing synthetic
  leaf illustration. No revision 2, note, receipt ID or idempotency key is supplied.

### Rules still not established by the static PDFs

Selecting a replacement worker is shown as a concept, but there is no defined
replacement-record ID, resulting status, transition, evidence transfer or mobile
handoff. ASG-14 expressly says the replacement is not modelled. The frontend
therefore supports task edits with the same eligible worker; actual worker changes
fail without mutation until those rules are approved. No reassignment result is
invented. Editing/cancelling after start, reopening, draft publication and summary
record lifecycle actions are not established and are not implemented.

All production read/write/evidence contracts remain pending. Local PDF inspection
resolves the missing visual-design dependency; it does not create backend contracts.
