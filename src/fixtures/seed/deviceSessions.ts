/**
 * Mobile device sessions. Source: ID-13 Device Sessions (17:613).
 * "Today" in the designs is 21 Oct 2026 (see FIXTURE_REFERENCE_DATE).
 */
import type { FixtureDeviceSession } from '../records'

export const deviceSessions: FixtureDeviceSession[] = [
  { id: 'DS-3091', userId: 'USR-009', device: 'Android 14 · Pixel 7', lastSeenAt: '2026-10-21T07:58:00+05:30', status: 'active' },
  { id: 'DS-3088', userId: 'USR-007', device: 'Android 13 · Galaxy A54', lastSeenAt: '2026-10-21T08:12:00+05:30', status: 'active' },
  { id: 'DS-3075', userId: 'USR-008', device: 'Android 14 · Pixel 6a', lastSeenAt: '2026-10-21T07:30:00+05:30', status: 'active' },
  { id: 'DS-3060', userId: 'USR-010', device: 'Android 12 · Redmi Note 11', lastSeenAt: '2026-10-20T17:20:00+05:30', status: 'active' },
  { id: 'DS-3054', userId: 'USR-012', device: 'Android 13 · Galaxy A34', lastSeenAt: '2026-10-20T15:02:00+05:30', status: 'active' },
  { id: 'DS-3012', userId: 'USR-011', device: 'Android 14 · Pixel 7', lastSeenAt: '2026-10-20T08:15:00+05:30', status: 'revoked', revokedAt: '2026-10-20T08:15:00+05:30', revokedReasonCode: 'DEVICE_SESSION_REVOKED' },
  { id: 'DS-2977', userId: 'USR-009', device: 'Android 13 · Galaxy A54', lastSeenAt: '2026-10-12T16:40:00+05:30', status: 'signed_out' },
]
