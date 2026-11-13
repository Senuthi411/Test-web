/**
 * DEVELOPMENT-ONLY sign-in accounts for fixture mode.
 *
 * - These credentials work only when VITE_DATA_SOURCE=fixtures. The fixture module is
 *   loaded lazily and never in API mode, where sign-in goes to the backend.
 * - They are not secrets and grant nothing outside this browser tab: fixture mode
 *   never contacts a server.
 * - One account per web role, using the personas from the approved Figma designs.
 *   Field workers (mobile only) have no web account.
 */
export const FIXTURE_DEV_PASSWORD = 'tealeaf-dev-only'

export interface FixtureAccount {
  userId: string
  /** Sign in with either the e-mail address or the username. */
  email: string
  username: string
  password: string
  /** Shown in development documentation only. */
  persona: string
}

export const FIXTURE_ACCOUNTS: readonly FixtureAccount[] = [
  { userId: 'USR-001', email: 'anika.perera@example.test', username: 'anika.perera', password: FIXTURE_DEV_PASSWORD, persona: 'Administrator — Anika Perera' },
  { userId: 'USR-003', email: 'malini.fernando@example.test', username: 'malini.fernando', password: FIXTURE_DEV_PASSWORD, persona: 'Supervisor — Malini Fernando (Riverbend, EST-002)' },
  { userId: 'USR-002', email: 'nimal.silva@example.test', username: 'nimal.silva', password: FIXTURE_DEV_PASSWORD, persona: 'Supervisor — Nimal Silva (Highland, EST-001)' },
  { userId: 'USR-005', email: 'dr.tara.wijesinghe@example.test', username: 'tara.wijesinghe', password: FIXTURE_DEV_PASSWORD, persona: 'Disease Expert — Dr Tara Wijesinghe' },
  { userId: 'USR-013', email: 'maya.dissanayake@example.test', username: 'maya.dissanayake', password: FIXTURE_DEV_PASSWORD, persona: 'Reporting User — Maya Dissanayake' },
]

export function findFixtureAccount(identifier: string): FixtureAccount | undefined {
  const normalised = identifier.trim().toLowerCase()
  return FIXTURE_ACCOUNTS.find(
    (account) => account.email === normalised || account.username === normalised,
  )
}
