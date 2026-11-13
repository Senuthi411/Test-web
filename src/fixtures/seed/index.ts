import { FIXTURE_ACCOUNTS } from '../accounts'
import type { FixtureDatabase } from '../records'
import { auditEvents, cases, dashboardAttentionUserIds } from './administration'
import { deviceSessions } from './deviceSessions'
import { observations } from './observations'
import { diseases, divisions, estates, users } from './organisation'
import { assignments, captureEvidence } from './capture'
import { corrections, quarantineItems, referrals, reviewDecisions, reviewFollowUpObservationIds, reviewObservationDetails, reviewRecords } from './review'

/** "Today" in the approved designs ("Wed 21 Oct 2026", "Data as of 21 Oct 2026"). */
export const FIXTURE_REFERENCE_DATE = '2026-10-21T10:00:00+05:30'

/** Builds a fresh, independent copy of the seed dataset. */
export function createSeedDatabase(): FixtureDatabase {
  return structuredClone({
    estates,
    assignments,
    captureEvidence,
    divisions,
    users,
    diseases,
    observations,
    deviceSessions,
    credentials: FIXTURE_ACCOUNTS.map(({ userId, email, username, password }) => ({ userId, email, username, password })),
    cases,
    auditEvents,
    recoveryRequests: [],
    dashboardAttentionUserIds,
    reviewRecords,
    reviewDecisions,
    corrections,
    referrals,
    quarantineItems,
    reviewObservationDetails,
    reviewFollowUpObservationIds,
  })
}
