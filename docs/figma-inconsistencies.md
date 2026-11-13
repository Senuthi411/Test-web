# Figma inconsistencies (unresolved)

The approved Figma file (`UEYKbYMHwSPdcFwQqdksAF`) is the visual source of truth and has
**not** been changed. Where frames disagree, the implementation uses one consistent
fixture value and records the conflict here. None of these is resolved; each needs a
decision from the design or product owner.

| # | Where | Conflict | Proposed handling (pending confirmation) |
| --- | --- | --- | --- |
| 1 | REV-05 Flag | Breadcrumb says **OBS-014**; the body shows **OBS-033** with Blister blight. | Fixtures keep both observations as generated. The flag screen will use the observation from the route. |
| 2 | CASE-10 Pending Case Link | Title says **REF-999 / OBS-011**; the body says **REF-014 / OBS-014** (CASE-01 also says REF-014 · OBS-014). | Fixtures will use REF-014 / OBS-014. |
| 3 | GS-01, GS-04 | Field worker named **"Ravindu Perera"**; everywhere else **"Ravindu Kumara"**. | Fixtures use "Ravindu Kumara". |
| 4 | REV-23 | QUA-003 header says **Riverbend**; the record is in **Mist Valley (EST-003)**; it reuses **QDEC-002**. | Fixtures will place QUA-003 in Mist Valley with its own decision ID. |
| 5 | AN-01 donut | Segment colours do not match the legend. | Charts will follow the legend colours. |
| 6 | REV-14 Quarantine Queue | Shows items outside Malini Fernando's scope (EST-002); labelled "Demo view". | Fixtures will scope the queue to the supervisor's estates. |
| 7 | ID-07 Roles & Permissions | The permission matrix is labelled illustrative and the backend roles are provisional (P8). | Treated as display content only, not as an approved permission rule set. Route guards use role → area mapping only. |
| 8 | ID-02 vs ID-13 | ID-02 KPI "Active device sessions **11**"; ID-13 lists only **5** active sessions. | Not resolved. ID-02 will derive the count from the session records (5) unless told otherwise. |
| 9 | CASE-04 vs CAP-W05 | OBS-023 GPS shown as 6.9421 / 80.7710 ±6 m on CASE-04; CAP-W05's DIV-005 coordinate list may differ (metadata values truncated). | To be checked against the frame text in Phase 4. |
| 10 | Supervisor sidebar | "Evidence Viewer" (CAP-W01) is a nav item but the screen needs an observation; no list/picker is designed. | `/observations` route exists; its content is decided in Phase 4. |
| 11 | Supervisor sidebar | "Evidence Viewer" and "Fieldwork Assignments" use the same `image` icon. | Implemented as drawn. |
| 12 | Design-system page | Note says "0 image fills", but the logo and login hero are image fills. | Both images exported and bundled. |
| 13 | Header master | "Switch Demo Role" button appears in every top bar. | Omitted by product decision (no DEMO-01). |
