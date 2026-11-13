# Responsive route audit

Date: 13 November 2026. Development copy only. The audit covers every route in the
existing screen-group manifest, shared account/public routes, error samples and
additional Capture/Assignment states. Actual route paths are read by the browser
suite from `src/app/routing/screens.ts`; unsupported modules are not implemented.

## Viewport matrix

| Width | Route/state samples | Page overflow | Browser runtime errors |
| --- | --- | --- | --- |
| 320px | 77 | None detected | None detected |
| 375px | 77 | None detected | None detected |
| 430px | 77 | None detected | None detected |
| 768px | 77 | None detected | None detected |
| 1024px | 77 | None detected | None detected |
| 1280px | 77 | None detected | None detected |
| 1440px | 77 | None detected | None detected |
| 1920px | 77 | None detected | None detected |
| 3840px | 77 | None detected | None detected |

693 route-width combinations passed in Chromium. Screenshots and detailed JSON
records are in ignored `test-results/responsive/`. These are responsive checks,
not production API integration tests or claims that placeholders are functional.

## Route-by-route checklist

Each row was checked at all nine widths above. Existing feature/state restrictions
were preserved. Mobile interactions additionally exercise a newly assigned task's
edit screen, cancellation dialog, submission, evidence expansion and completion,
plus correction approval. They do not bypass the guarded submitted-task edit URL.

| Fixture role | Route sample | Result/scope |
| --- | --- | --- |
| ADMINISTRATOR | `/admin` | Existing fixture screen/state checked |
| ADMINISTRATOR | `/admin/users` | Existing fixture screen/state checked |
| ADMINISTRATOR | `/admin/users/new` | Existing fixture screen/state checked |
| ADMINISTRATOR | `/admin/users/USR-005` | Existing fixture screen/state checked |
| ADMINISTRATOR | `/admin/users/USR-005/edit` | Existing fixture screen/state checked |
| ADMINISTRATOR | `/admin/users/USR-005/scope` | Existing fixture screen/state checked |
| ADMINISTRATOR | `/admin/roles` | Existing fixture screen/state checked |
| ADMINISTRATOR | `/admin/roles/supervisor` | Existing fixture screen/state checked |
| ADMINISTRATOR | `/admin/estates` | Existing fixture screen/state checked |
| ADMINISTRATOR | `/admin/estates/EST-001` | Existing fixture screen/state checked |
| ADMINISTRATOR | `/admin/divisions` | Existing fixture screen/state checked |
| ADMINISTRATOR | `/admin/divisions/DIV-001` | Existing fixture screen/state checked |
| ADMINISTRATOR | `/admin/device-sessions` | Existing fixture screen/state checked |
| ADMINISTRATOR | `/admin/device-sessions/DS-3012/recovery` | Existing fixture screen/state checked |
| ADMINISTRATOR | `/profile` | Existing fixture screen/state checked |
| ADMINISTRATOR | `/forbidden` | Existing fixture screen/state checked |
| public | `/login` | Existing fixture screen/state checked |
| public | `/session-expired` | Existing fixture screen/state checked |
| SUPERVISOR | `/review` | Existing fixture screen/state checked |
| SUPERVISOR | `/review/queue` | Existing fixture screen/state checked |
| SUPERVISOR | `/review/observations/OBS-014` | Existing fixture screen/state checked |
| SUPERVISOR | `/review/observations/OBS-014/verify` | Existing fixture screen/state checked |
| SUPERVISOR | `/review/observations/OBS-014/flag` | Existing fixture screen/state checked |
| SUPERVISOR | `/review/observations/OBS-014/request-correction` | Existing fixture screen/state checked |
| SUPERVISOR | `/review/observations/OBS-014/refer` | Existing fixture screen/state checked |
| SUPERVISOR | `/review/corrections` | Existing fixture screen/state checked |
| SUPERVISOR | `/review/corrections/COR-005` | Existing fixture screen/state checked |
| SUPERVISOR | `/review/corrections/COR-005/compare` | Existing fixture screen/state checked |
| SUPERVISOR | `/review/corrections/COR-005/approve` | Existing fixture screen/state checked |
| SUPERVISOR | `/review/corrections/COR-005/reject` | Existing fixture screen/state checked |
| SUPERVISOR | `/review/referrals` | Existing fixture screen/state checked |
| SUPERVISOR | `/review/quarantine` | Existing fixture screen/state checked |
| SUPERVISOR | `/review/quarantine/QUA-002` | Existing fixture screen/state checked |
| SUPERVISOR | `/review/quarantine/QUA-002/decide` | Existing specification-limited screen; layout checked |
| SUPERVISOR | `/review/history` | Existing fixture screen/state checked |
| SUPERVISOR | `/observations` | Existing fixture screen/state checked |
| SUPERVISOR | `/observations/OBS-014` | Existing fixture screen/state checked |
| SUPERVISOR | `/observations/OBS-014/evidence` | Existing fixture screen/state checked |
| SUPERVISOR | `/observations/OBS-014/original` | Existing fixture screen/state checked |
| SUPERVISOR | `/observations/OBS-014/metadata` | Existing fixture screen/state checked |
| SUPERVISOR | `/observations/OBS-014/gps` | Existing fixture screen/state checked |
| SUPERVISOR | `/observations/OBS-014/revisions` | Existing fixture screen/state checked |
| SUPERVISOR | `/observations/OBS-014/compare` | Existing fixture screen/state checked |
| SUPERVISOR | `/assignments` | Existing fixture screen/state checked |
| SUPERVISOR | `/assignments/new` | Existing fixture screen/state checked |
| SUPERVISOR | `/assignments/ASG-001` | Existing fixture screen/state checked |
| SUPERVISOR | `/assignments/ASG-001/edit` | Seeded state correctly guarded; actual edit form checked in 320px workflow |
| SUPERVISOR | `/observations/OBS-005/revisions` | Existing fixture screen/state checked |
| SUPERVISOR | `/observations/OBS-005/compare` | Existing fixture screen/state checked |
| SUPERVISOR | `/observations/OBS-005/original?state=unavailable` | Existing fixture screen/state checked |
| SUPERVISOR | `/assignments/ASG-002` | Existing fixture screen/state checked |
| SUPERVISOR | `/assignments/ASG-003` | Existing fixture screen/state checked |
| SUPERVISOR | `/assignments/ASG-004` | Existing fixture screen/state checked |
| SUPERVISOR | `/assignments/ASG-005` | Existing fixture screen/state checked |
| SUPERVISOR | `/assignments/ASG-006` | Existing fixture screen/state checked |
| SUPERVISOR | `/assignments/ASG-007` | Existing fixture screen/state checked |
| SUPERVISOR | `/review/observations/OBS-999` | Missing-record state checked |
| SUPERVISOR | `/assignments/ASG-999` | Missing-record state checked |
| DISEASE_EXPERT | `/cases` | Existing placeholder; layout checked, module not implemented |
| DISEASE_EXPERT | `/cases/assigned` | Existing placeholder; layout checked, module not implemented |
| DISEASE_EXPERT | `/cases/catalog` | Existing placeholder; layout checked, module not implemented |
| DISEASE_EXPERT | `/cases/catalog/DIS-001` | Existing placeholder; layout checked, module not implemented |
| DISEASE_EXPERT | `/cases/history` | Existing placeholder; layout checked, module not implemented |
| DISEASE_EXPERT | `/cases/referrals/REF-014` | Existing placeholder; layout checked, module not implemented |
| DISEASE_EXPERT | `/cases/CASE-018` | Existing placeholder; layout checked, module not implemented |
| DISEASE_EXPERT | `/cases/CASE-018/evidence` | Existing placeholder; layout checked, module not implemented |
| DISEASE_EXPERT | `/cases/CASE-018/diagnose` | Existing placeholder; layout checked, module not implemented |
| DISEASE_EXPERT | `/cases/CASE-018/diagnose/confirm` | Existing placeholder; layout checked, module not implemented |
| REPORTING_USER | `/analytics` | Existing placeholder; layout checked, module not implemented |
| REPORTING_USER | `/analytics/estates` | Existing placeholder; layout checked, module not implemented |
| REPORTING_USER | `/analytics/divisions` | Existing placeholder; layout checked, module not implemented |
| REPORTING_USER | `/analytics/observations` | Existing placeholder; layout checked, module not implemented |
| REPORTING_USER | `/analytics/diseases` | Existing placeholder; layout checked, module not implemented |
| REPORTING_USER | `/analytics/suspected-vs-confirmed` | Existing placeholder; layout checked, module not implemented |
| REPORTING_USER | `/analytics/bottlenecks` | Existing placeholder; layout checked, module not implemented |
| REPORTING_USER | `/analytics/filters` | Existing placeholder; layout checked, module not implemented |
| REPORTING_USER | `/analytics/freshness` | Existing placeholder; layout checked, module not implemented |
