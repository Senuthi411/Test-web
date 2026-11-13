# Phase 4 Capture status

**Current authoritative report:** [phase4-completion-report.md](phase4-completion-report.md).

The approved local PDFs have been inspected. CAP-W01-W08 and ASG-01-15 have
implemented approved fixture screens/states, including all six read-only summaries.
ASG-07 supports task edits and scope eligibility; an actual replacement-worker
transition remains specification-blocked. Production contracts remain pending.
No additional Figma MCP calls, Identity UI changes or other module work were made.

## Historical foundation and access investigation

The sections below record the earlier foundation-only state and access investigation;
they do not describe the current screen implementation. Use the report linked above
for current completion status.

**Latest access update:** the new file `HufgU8zIvhH1huEdeyrL1v` is accessible.
CAP-W01 was retrieved with design context and screenshot. All eight Capture designs
and ASG-01–ASG-05 were retrieved before Figma reported its Starter-plan MCP call
limit. ASG-06–ASG-15 remain blocked by that quota, rather than file permissions.
See [the latest design audit](phase4-figma-audit.md) for exact node IDs, confirmed
requirements and routing mismatches. The access-denial investigation below records
the earlier file and is historical. No runtime screen implementation has been added.

This phase is **not complete**. Only the observation read foundation is implemented.
No Capture or Assignment screen has been replaced or claimed to match Figma.
The existing Identity screens, other feature placeholders and Figma file were not edited.

## Sources inspected

- Application routes/navigation, shared components/tokens, composition/providers,
  Identity session and scope data, fixture model/store/seed, pending API contracts.
- No Capture feature implementation existed before this change.
- Figma file `UEYKbYMHwSPdcFwQqdksAF`: metadata access denied by the connected account.
  No high-fidelity screen context or screenshots could be retrieved.
- Local specs do not define assignment fields, statuses, transitions, validation,
  editing/reassignment/cancellation rules or records. These must not be invented.
- Observation fixtures have IDs, capture time, division/worker/disease relationships,
  review status, catalog version, sync status and GPS accuracy. They do not contain
  evidence images, image availability, actual GPS coordinates or revision records.
- `docs/figma-inconsistencies.md` leaves the `/observations` sidebar entry unresolved
  because no observation picker/list design was recorded.

## Capture screen checklist

Names below are the existing route inventory, not newly verified Figma names.

| Screen | Recorded name | Current state | Missing dependency |
| --- | --- | --- | --- |
| CAP-W01 | Evidence Viewer | Placeholder | Frame/assets; image availability model; sidebar entry behavior |
| CAP-W02 | Observation Details | Placeholder; read foundation ready | Frame and detailed metadata specification |
| CAP-W03 | Original Image | Placeholder | Frame and original evidence asset |
| CAP-W04 | Capture Metadata | Placeholder; existing metadata readable | Frame and any additional metadata definitions |
| CAP-W05 | GPS Provenance | Placeholder; accuracy readable | Coordinates/provenance specification and frame |
| CAP-W06 | Revision History | Placeholder | Revision data model and frame |
| CAP-W07 | Original vs Revised | Placeholder | Original/revised evidence, comparison rules and frame |
| CAP-W08 | Name unavailable | Missing from local route inventory | Actual frame/name, workflow and route |

## Fieldwork Assignment screen checklist

| Screen | Recorded name | Current state |
| --- | --- | --- |
| ASG-01 | Fieldwork Assignments | Route placeholder |
| ASG-02 | Create Assignment | Route placeholder |
| ASG-03 | Assignment Detail | Route placeholder |
| ASG-04 | Name unavailable | No local screen mapping |
| ASG-05 | Name unavailable | No local screen mapping |
| ASG-06 | Name unavailable | No local screen mapping |
| ASG-07 | Name unavailable | No local screen mapping |
| ASG-08 | Edit Assignment | Route placeholder |
| ASG-09 | Name unavailable | No local screen mapping |
| ASG-10 | Name unavailable | No local screen mapping |
| ASG-11 | Name unavailable | No local screen mapping |
| ASG-12 | Name unavailable | No local screen mapping |
| ASG-13 | Name unavailable | No local screen mapping |
| ASG-14 | Name unavailable | No local screen mapping |
| ASG-15 | Name unavailable | No local screen mapping |

All assignments are blocked by unavailable Figma frames and absent approved assignment
rules. IDs may represent modal/state variants; no new routes or screens were invented.
The current route inventory permits Supervisors only. The full approved authorization
specification is required before extending that policy to any other role.

## Implemented foundation

- Capture domain projection of existing observation metadata and related records.
- Application read port/use case with identifier validation.
- Shared-store fixture adapter: signed-in active Supervisor required, current estate
  scope checked on every read; absent/out-of-scope records return the same not-found error.
- No invented image URLs, GPS coordinates, assignment statuses or API endpoints.
- Existing fixture latency, failure injection, cancellation and reset policy reused.
- API adapter reports contract pending without sending a request or using fixture data.
- Composition root exposes `container.capture`; fixture/API adapters remain lazily selected.
- Unit tests and Identity-to-Capture composition integration tests.

## Changed files

Created:

- `src/features/capture/domain/observation.ts`
- `src/features/capture/application/ports.ts`
- `src/features/capture/application/captureUseCases.ts`
- `src/features/capture/infrastructure/fixtureCaptureAdapter.ts`
- `src/features/capture/infrastructure/httpCaptureAdapter.ts`
- `src/features/capture/index.ts`, `fixtures.ts`, `http.ts`, `capture.test.ts`
- `src/app/capture.integration.test.ts`
- `docs/capture-status.md`

Modified only required composition integration points:

- `src/app/composition/adapterSet.ts`
- `src/app/composition/fixtureAdapters.ts`
- `src/app/composition/httpAdapters.ts`
- `src/app/composition/container.ts`

## Required to continue

Accessible approved Figma Capture/Assignment frames and their evidence assets;
assignment fields/statuses/transitions/access-control rules; revision and GPS provenance
specifications. Production API integration separately requires approved contracts.

### Access investigation on resume

- Figma `whoami` succeeded: the connected account is
  `[email redacted]`, with a View seat on a Starter team.
- `create_session` for the approved file failed with the explicit response
  "Looks like you don't have edit access to this file."
  Debug reference: `1efa2a27-5c7a-4040-b24b-e7a20ea08d94`.
- Page discovery through `get_metadata` with no guessed node ID failed with
  the same access response. Debug reference:
  `d0f48d87-18ca-423d-b4dc-412a207782eb`.
- CAP-W01 could not be discovered or retrieved. No screenshot or design-context
  response was obtained; file access has **not** been restored or verified.
- Searched the development copy, including hidden project files, docs, assets,
  route references and the two available pasted-text attachments. No approved
  Capture/Assignment design export, full screen specification, assignment state
  model or authorization specification was found. The second attachment concerns
  Analytics and does not supply Phase 4 requirements.
- No screen, route, fixture or implementation code was changed during this
  investigation. Tests were not rerun for this documentation-only update; the
  verification below records the preceding implementation run.

The file owner needs to grant the connected account the access required by the
Figma tools, or provide accessible approved exports/specifications. A direct
CAP-W01 node link is also needed if page discovery remains unavailable. The agent
cannot grant itself sharing rights or change its Figma seat.

## Verification

- ESLint and production build passed.
- Full unit/integration suite: 115 tests passed across 10 files, including 14
  new Capture unit/integration cases.
- Existing Playwright suite: 21 tests passed, confirming Identity, login and shell
  regressions. These are not Capture-screen workflow tests: those screens remain
  blocked and no claim of Capture browser coverage is made.
