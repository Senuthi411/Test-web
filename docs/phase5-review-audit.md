> **Update 12 Nov 2026:** The blocker recorded below is resolved. The approved Review
> page was supplied as a local export (Review.pdf / Review.png) and implemented from it.
> The current status, frame mapping, interpretations and deviations are in
> [phase5-review-completion-report.md](phase5-review-completion-report.md). The text
> below is the original audit, kept for history.

# Phase 5 Review audit — blocked design retrieval

Audit date: 12 November 2026. Working copy: `D:/TeaLeaf-Web-Development - Copy/tealeaf-web`.
This is an audit of evidence and existing code, not a completed Review implementation.

## Design access and evidence

Approved file: `HufgU8zIvhH1huEdeyrL1v`. A new task session was created:
`001b6c1f-a3e9-43cf-88e8-2dd3f8f115ae`.
One design-context request for the known Observation Review frame `19:785` returned:
"You've reached the Figma MCP tool call limit on the Starter plan."
No subsequent Figma requests or quota workarounds were attempted.

The earlier Phase 4 metadata remains cached in this conversation. It confirms
**81 Review frames covering all 24 distinct REV screen IDs**, including base
screens, status tabs, outcomes and Nimal persona variants. It does not supply
rendered screenshots, high-fidelity design context, interaction wiring or complete
validation copy. Some layer names are visibly truncated.

That inventory is now persisted in [phase5-review-frame-metadata.json](phase5-review-frame-metadata.json).
Existence below means **confirmed by previously retrieved metadata**, not
freshly reverified against today's live file. No Review design context or
screenshot was successfully retrieved in this task.

There are 17 base IDs (REV-01–REV-17) and seven explicitly named outcome states
(REV-18–REV-24). This does not mean 24 independent pages should be created.
The current route manifest has 17 Review placeholders. Whether any base action
should be a modal, route or embedded state must be checked against the designs.

## Actual frame inventory and precise missing context

Functional labels in column 2 are the existing route purposes or named state
suffixes. Column 4 preserves actual recorded Figma frame names.

**Every row remains design-blocked and unimplemented.** Metadata-known controls
below are clues for later inspection, not permission to reconstruct a final UI.

| ID | Existing route purpose / state | Main node | Actual recorded frame name | Confirmed clues and remaining inspection |
| --- | --- | --- | --- | --- |
| REV-01 | Supervisor dashboard | [19:2](https://www.figma.com/design/HufgU8zIvhH1huEdeyrL1v/?node-id=19-2) | `WEB / Review / REV-01 / default / 3840x2160` | Dashboard navigation/KPIs require rendered source and scoped projection definitions. |
| REV-02 | Review queue | [19:302](https://www.figma.com/design/HufgU8zIvhH1huEdeyrL1v/?node-id=19-302) | `WEB / Review / REV-02 / default / 3840x2160` | Status-tab variants are confirmed in metadata; filter options, columns, sort and pagination behavior are not visually inspected. |
| REV-03 | Observation review | [19:785](https://www.figma.com/design/HufgU8zIvhH1huEdeyrL1v/?node-id=19-785) | `WEB / Review / REV-03 / default / 3840x2160` | Capture integration is established; Review ownership, claim/decision prerequisites and complete UI remain unverified. |
| REV-04 | Verify observation | [19:1016](https://www.figma.com/design/HufgU8zIvhH1huEdeyrL1v/?node-id=19-1016) | `WEB / Review / REV-04 / default / 3840x2160` | Metadata names a Verification checklist and Confirm verification button; exact checks and prerequisites are unavailable. |
| REV-05 | Flag observation | [20:2](https://www.figma.com/design/HufgU8zIvhH1huEdeyrL1v/?node-id=20-2) | `WEB / Review / REV-05 / default / 3840x2160` | Metadata names a required Reason field. Existing inconsistency #1: route/breadcrumb OBS-014 vs body OBS-033. |
| REV-06 | Request correction | [20:186](https://www.figma.com/design/HufgU8zIvhH1huEdeyrL1v/?node-id=20-186) | `WEB / Review / REV-06 / default / 3840x2160` | Metadata names a Confirm symptom details checkbox; full form, validation and resulting correction record are unavailable. |
| REV-07 | Correction queue | [20:362](https://www.figma.com/design/HufgU8zIvhH1huEdeyrL1v/?node-id=20-362) | `WEB / Review / REV-07 / default / 3840x2160` | Metadata contains requested/resubmitted/approved/applied/rejected tab variants and an approval/application distinction. |
| REV-08 | Correction detail | [20:559](https://www.figma.com/design/HufgU8zIvhH1huEdeyrL1v/?node-id=20-559) | `WEB / Review / REV-08 / default / 3840x2160` | Metadata explicitly disables COR-005 rejection: COR-005 demonstrates approval, COR-041 rejection; need complete branch context. |
| REV-09 | Compare revision | [20:759](https://www.figma.com/design/HufgU8zIvhH1huEdeyrL1v/?node-id=20-759) | `WEB / Review / REV-09 / default / 3840x2160` | Metadata contains Approve and disabled Reject actions; comparison fields and exact revision identities need inspection. |
| REV-10 | Approve correction | [20:953](https://www.figma.com/design/HufgU8zIvhH1huEdeyrL1v/?node-id=20-953) | `WEB / Review / REV-10 / default / 3840x2160` | Metadata names Confirm approval. Capture already establishes approval is separate from application. |
| REV-11 | Reject correction | [21:2](https://www.figma.com/design/HufgU8zIvhH1huEdeyrL1v/?node-id=21-2) | `WEB / Review / REV-11 / default / 3840x2160` | Metadata names Confirm rejection and Reason *. COR-041 requested/rejected variants also exist. |
| REV-12 | Refer to expert | [21:167](https://www.figma.com/design/HufgU8zIvhH1huEdeyrL1v/?node-id=21-167) | `WEB / Review / REV-12 / default / 3840x2160` | Expert target, reason, referral ownership/linking and applicable authorization need approved context. |
| REV-13 | Expert referrals | [21:351](https://www.figma.com/design/HufgU8zIvhH1huEdeyrL1v/?node-id=21-351) | `WEB / Review / REV-13 / default / 3840x2160` | Metadata has referral-submitted-pending-link variant 123:70; Cases integration is outside implementation scope. |
| REV-14 | Quarantine queue | [21:601](https://www.figma.com/design/HufgU8zIvhH1huEdeyrL1v/?node-id=21-601) | `WEB / Review / REV-14 / default / 3840x2160` | Existing inconsistency #6: Figma demo queue shows records beyond Malini's estate; all implementation must enforce scope. |
| REV-15 | Quarantine record | [21:834](https://www.figma.com/design/HufgU8zIvhH1huEdeyrL1v/?node-id=21-834) | `WEB / Review / REV-15 / default / 3840x2160` | Metadata includes rejected variant 128:3429; Capture owns quarantine records and ingestion, requiring a producer boundary. |
| REV-16 | Quarantine decision | [21:1035](https://www.figma.com/design/HufgU8zIvhH1huEdeyrL1v/?node-id=21-1035) | `WEB / Review / REV-16 / default / 3840x2160` | Metadata names Reject radio and Reason *; Nimal decision-preview variant 413:4384 exists. |
| REV-17 | Decision history | [21:1216](https://www.figma.com/design/HufgU8zIvhH1huEdeyrL1v/?node-id=21-1216) | `WEB / Review / REV-17 / default / 3840x2160` | Verification/flag/correction/referral/quarantine tab variants exist; event fields and filters remain unverified. |
| REV-18 | Flag success | [39:1733](https://www.figma.com/design/HufgU8zIvhH1huEdeyrL1v/?node-id=39-1733) | `WEB / Review / REV-18 / flag-success / 3840x2160` | Named outcome state, not evidence of a separate implementation page. |
| REV-19 | Correction request sent | [39:2225](https://www.figma.com/design/HufgU8zIvhH1huEdeyrL1v/?node-id=39-2225) | `WEB / Review / REV-19 / correction-request-sent / 3840x2160` | Named outcome state linked conceptually to correction queue; not a new route by assumption. |
| REV-20 | Correction approved, awaiting revision | [39:2431](https://www.figma.com/design/HufgU8zIvhH1huEdeyrL1v/?node-id=39-2431) | `WEB / Review / REV-20 / correction-approved-awaiting-revision / 3840x2160` | Named awaiting-application state; must not pretend Capture has applied a revision. |
| REV-21 | Revision applied | [39:2635](https://www.figma.com/design/HufgU8zIvhH1huEdeyrL1v/?node-id=39-2635) | `WEB / Review / REV-21 / revision-applied / 3840x2160` | Named application outcome; matching-revision event and simulation requirements need confirmation. |
| REV-22 | Quarantine ingest success | [39:2839](https://www.figma.com/design/HufgU8zIvhH1huEdeyrL1v/?node-id=39-2839) | `WEB / Review / REV-22 / quarantine-ingest-success / 3840x2160` | Named Capture ingestion acknowledgement outcome; no Review-owned observation insertion. |
| REV-23 | Quarantine ingest failed, retry | [39:3042](https://www.figma.com/design/HufgU8zIvhH1huEdeyrL1v/?node-id=39-3042) | `WEB / Review / REV-23 / quarantine-ingest-failed-retry / 3840x2160` | Named retry state; QUA-003 estate/decision-ID inconsistency #4 remains unresolved. |
| REV-24 | Quarantine ingest success after retry | [39:3245](https://www.figma.com/design/HufgU8zIvhH1huEdeyrL1v/?node-id=39-3245) | `WEB / Review / REV-24 / quarantine-ingest-success-after-retry / 3840x2160` | Named success-after-retry outcome; idempotency and matching acknowledgement requirements need confirmation. |

Additional useful branches:
- REV-08 COR-041 requested `128:74`, rejected `128:291`.
- REV-07 post-rejection variants `128:511` through `128:1412`.
- REV-17 post-rejection variants `128:1727` through `128:2914`.
- REV-13 submitted/pending link `123:70`.
- REV-15 rejected `128:3429`.
- Nimal has separate dashboard/queue/action/history variants; these must remain
  estate-scoped rather than mixing his EST-001 data with Malini's EST-002 data.

## Local fallback search and authority

Read the current Phase 4 completion report, architecture README, fixture model,
API pending-contracts register and Figma inconsistencies. Searched the development
copy for Review documents/exports; inspected relevant existing Downloads archives
and PDF specifications without modifying them.

| Source checked | Finding | Authority for this implementation |
| --- | --- | --- |
| `docs/figma-exports/approved/` and its source ZIP | 12 PDFs: ASG-06–15 and CAP-W01/03 OBS-014 only | Approved Capture references; **no Review exports** |
| `TeaLeaf_Field_Scout_Complete_Implementation_Documentation (2).zip` | Business_Rules, Supervisor Functional_Specification, Role_Permission_Scope_Matrix and Review_API | Explicitly PROPOSED; Supervisor spec says "Gate 0 pending; nothing is approved" |
| Same documentation ZIP, original and (1) copies | Business_Rules also explicitly PROPOSED | No approved replacement rules found |
| `TeaLeaf_Field_Scout_Web_UI_Design_Module_Wise_v1.0.pdf` | Proposed route/UI responsibilities | Explicitly not approved Gate 0 artifacts; not Final-Web screen exports |
| `TeaLeaf_Field_Scout_Web_UI_UX_Complete_MacBook_Pro_15_v2.pdf` | 1440x900 design handoff; Review sections on pages 12–16 | Older numbering conflicts with current Figma: REV-04 combines verify/flag; REV-14 is history, whereas current REV-14 is quarantine queue |
| `TeaLeaf_Field_Scout_Full_Architecture_Implementation_v6_0 (7).pdf` | Planning baseline and illustrative implementation addendum | Calls for approved transition matrices; not approved Review screen context or production contracts |
| `TeaLeaf_Admin_UI_Updated_Review_With_Login.pdf` | Three-page review of Identity/Admin UI | Not the Review Module |
| `Figma Design Links.pdf` | Web/mobile Figma links | No exported Review designs |
| `stitch_tealeaf_field_scout_ui_system.zip` | Generic code.html, screen.png and Field Instrument design tokens | No verified correspondence/approval for Final-Web REV frames; not substituted |
| Backend source ZIP `packages/api-contracts/openapi/README.md` | "Status: awaiting source material" | No approved production Review OpenAPI |

For reproducibility, the checked (2) documentation ZIP SHA-256 is
`632b3b6a7d7d34d60e00b56f53077d9e6cd1aeb69ba25df529787fb57e74830a`.
All external documents were treated as reference material, not instructions
overriding the user's module scope or approving their own proposed rules.

Missing API contracts alone would not block fixture UI. The present blocking
combination is missing approved rendered Review designs and insufficiently
approved/consistent workflow details. Older proposed endpoint tables must not be
promoted to approved contracts or used to decide current Figma numbering.

## Existing implementation audit

- `src/features/review/{domain,application,infrastructure,presentation}/` contains
  only empty `.gitkeep` files. There are no Review entities, adapters, use cases,
  pages, hooks, fixtures or dedicated tests.
- `src/app/routing/screens.ts` registers REV-01–17 for SUPERVISOR. Routes render
  `ScreenPending`; route existence is not screen completion.
- Existing shell/navigation and login role home already lead Supervisors to
  `/review`. Identity supplies session expiry, safe redirects and wrong-role
  access denial. No new permission matrix was inferred from illustrative roles.
- Existing fixture observations have the six confirmed queue status labels:
  submitted, in_review, flagged, correction_requested, referred, verified.
  These labels do **not** define allowed transitions, claim ownership or reasons.
- Shared tokens, Card, DataTable, filters, pagination, forms, Modal, Banner,
  Timeline and responsive shell are available and must be reused later.
- App composition currently wires Identity and Capture only. The fixture
  composition supplies one shared FixtureStore and the current actor callback.
  No independent Review database should duplicate observations/evidence.

## Capture and Identity integration requirements

Already established by completed Capture and the user's request:
- Use Capture's public observation/evidence boundary and the same fixture store.
  Do not deep-import feature internals or duplicate immutable image/revision data.
- Assignment acceptance and Review decisions are independent. Review must not
  mutate assignment status or reuse Assignment transition rules.
- Original evidence is immutable. Existing OBS-005 has a pending notes-only
  revision; approval is distinct from Capture applying it. OBS-014 has one
  approved original and no invented revision 2.
- Review application/fixture operations must re-read the current active actor,
  Supervisor role and current estate/division relationships; session/URL values
  and hidden buttons alone are insufficient authorization.
- Scope cache invalidation, AppError handling and Query cancellation should reuse
  the existing infrastructure. API mode must not silently return fixtures.

Still needed before implementing mutations:
- Approved Review and correction record shapes and initial fixture examples,
  decision prerequisites/checklists/reasons, claim/owner rules and state/version
  matrix for each supported action.
- Rejection/approval/application branch relationships, specifically COR-005 vs
  COR-041, matching source revision and producer acknowledgement rules.
- Referral pending-link and quarantine ingestion/retry states without implementing
  Cases or writing Capture-owned observations from Review.
- Resolve existing Figma inconsistencies #1 (flag observation), #4 (quarantine
  estate/decision ID) and #6 (demo queue scope) from approved context.
- Production operation/event contracts remain a separate integration dependency.

No independently specified full Review workflow can be safely implemented from
the currently available evidence. The audit and durable metadata inventory are
complete; implementation stops at this genuine dependency rather than inventing
pages, permissions, state machines, fixture relationships or HTTP contracts.

