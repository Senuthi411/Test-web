/**
 * Maps fixture records into Identity domain models. Every derived value (counts, team,
 * supervisor, last sign-in, activity) is computed here from the shared fixture store,
 * so a change made anywhere in the dataset shows on every Identity screen.
 */
import type { FixtureAuditEvent, FixtureDatabase, FixtureDivision, FixtureEstate, FixtureUser } from '@/fixtures'
import { USER_ROLES, type UserId, type UserRole } from '@/shared/types'
import { describeAudit } from '../domain/activity'
import type {
  ActivityEvent,
  DeviceSession,
  DivisionSummary,
  EstateSummary,
  IdentityUser,
  PersonRef,
  TeamMember,
} from '../domain/models'

type Db = Readonly<FixtureDatabase>

const PENDING_REVIEW = new Set(['submitted', 'in_review'])

export const person = (user: Pick<FixtureUser, 'id' | 'fullName'>): PersonRef => ({ id: user.id, fullName: user.fullName })

export function findUser(db: Db, id: UserId): FixtureUser | undefined {
  return db.users.find((user) => user.id === id)
}

function latestSessionAt(db: Db, userId: UserId): string | null {
  const times = db.deviceSessions.filter((session) => session.userId === userId).map((session) => session.lastSeenAt)
  return times.sort().at(-1) ?? null
}

export function toIdentityUser(db: Db, user: FixtureUser): IdentityUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
    estateIds: [...user.estateIds],
    divisionIds: [...user.divisionIds],
    createdAt: user.createdAt,
    // Field workers sign in on the mobile app: their latest device session stands in.
    lastSignInAt: user.role === 'FIELD_WORKER' ? latestSessionAt(db, user.id) : user.lastSignInAt,
    scopeAssignedAt: user.scopeAssignedAt,
    version: user.version,
    phone: user.phone,
    employeeId: user.employeeId,
    preferredLanguage: user.preferredLanguage,
    // NIC and date of birth are deliberately not part of IdentityUser (lists, dashboard, exports).
    roleDetails: { ...user.roleDetails },
  }
}

export function toDeviceSession(db: Db, session: FixtureDatabase['deviceSessions'][number]): DeviceSession {
  const user = findUser(db, session.userId)
  return {
    id: session.id,
    user: user ? person(user) : { id: session.userId, fullName: session.userId },
    device: session.device,
    lastSeenAt: session.lastSeenAt,
    status: session.status,
    revokedAt: session.revokedAt ?? null,
    revokedReasonCode: session.revokedReasonCode ?? null,
    scopeDivisionIds: user ? [...user.divisionIds] : [],
  }
}

function divisionIdsOf(db: Db, estateId: string): Set<string> {
  return new Set(db.divisions.filter((division) => division.estateId === estateId).map((division) => division.id))
}

/** The first supervisor / expert whose estate scope includes the estate (ID-09 columns). */
function firstWithRole(db: Db, role: UserRole, estateId: string): PersonRef | null {
  const match = db.users.find((user) => user.role === role && user.status === 'active' && user.estateIds.includes(estateId))
  return match ? person(match) : null
}

export function toEstateSummary(db: Db, estate: FixtureEstate): EstateSummary {
  const divisions = divisionIdsOf(db, estate.id)
  return {
    id: estate.id,
    name: estate.name,
    region: estate.region,
    status: estate.status,
    divisionCount: divisions.size,
    observationCount: db.observations.filter((observation) => divisions.has(observation.divisionId)).length,
    supervisor: firstWithRole(db, 'SUPERVISOR', estate.id),
    expert: firstWithRole(db, 'DISEASE_EXPERT', estate.id),
  }
}

export function toDivisionSummary(db: Db, division: FixtureDivision): DivisionSummary {
  const observations = db.observations.filter((observation) => observation.divisionId === division.id)
  return {
    id: division.id,
    name: division.name,
    estateId: division.estateId,
    estateName: db.estates.find((estate) => estate.id === division.estateId)?.name ?? division.estateId,
    status: division.status,
    fieldWorkers: db.users
      .filter((user) => user.role === 'FIELD_WORKER' && user.divisionIds.includes(division.id))
      .map(person),
    observationCount: observations.length,
    verifiedCount: observations.filter((observation) => observation.reviewStatus === 'verified').length,
    pendingReviewCount: observations.filter((observation) => PENDING_REVIEW.has(observation.reviewStatus)).length,
  }
}

export function estateStats(db: Db, estateId: string) {
  const divisions = divisionIdsOf(db, estateId)
  const observations = db.observations.filter((observation) => divisions.has(observation.divisionId))
  const observationIds = new Set(observations.map((observation) => observation.id))
  return {
    observations: observations.length,
    pendingReview: observations.filter((observation) => PENDING_REVIEW.has(observation.reviewStatus)).length,
    correctionsRequested: observations.filter((observation) => observation.reviewStatus === 'correction_requested').length,
    expertConfirmedCases: db.cases.filter((item) => observationIds.has(item.observationId)).length,
  }
}

/** Supervisors, experts and field workers working in the estate (ID-10 "Team"). */
export function estateTeam(db: Db, estateId: string): TeamMember[] {
  const divisions = divisionIdsOf(db, estateId)
  const order: UserRole[] = ['SUPERVISOR', 'DISEASE_EXPERT', 'FIELD_WORKER']
  return db.users
    .filter((user) => user.status === 'active' && order.includes(user.role))
    .filter((user) => user.estateIds.includes(estateId) || user.divisionIds.some((id) => divisions.has(id)))
    .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || a.id.localeCompare(b.id))
    .map((user) => ({ ...person(user), role: user.role, divisionIds: user.divisionIds.filter((id) => divisions.has(id)) }))
}

export function auditActivity(db: Db, events: readonly FixtureAuditEvent[]): ActivityEvent[] {
  return [...events]
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((event) => {
      const user = event.userId ? findUser(db, event.userId) : undefined
      const division = event.divisionId ? db.divisions.find((item) => item.id === event.divisionId) : undefined
      const estate = event.estateId ? db.estates.find((item) => item.id === event.estateId) : undefined
      return describeAudit({
        id: event.id,
        at: event.at,
        kind: event.kind,
        user: user ? { id: user.id, fullName: user.fullName, role: user.role } : undefined,
        division: division ? { id: division.id, name: division.name } : undefined,
        estate: estate ? { id: estate.id, name: estate.name } : undefined,
        sessionId: event.sessionId,
        reasonCode: event.reasonCode,
        scope: event.scope,
        status: event.status,
      })
    })
}

const SESSION_STATE_LABEL = { active: 'active', revoked: 'revoked', signed_out: 'signed out' } as const

/** ID-04 Activity tab: device sessions, scope assignments and audit events for one user. */
export function userActivity(db: Db, user: FixtureUser): ActivityEvent[] {
  const sessions: ActivityEvent[] = db.deviceSessions
    .filter((session) => session.userId === user.id)
    .map((session) => ({
      id: `session-${session.id}`,
      at: session.revokedAt ?? session.lastSeenAt,
      title: `Device session ${session.id} ${SESSION_STATE_LABEL[session.status]}`,
      detail: session.device,
      link: { kind: 'session', id: session.id },
    }))
  const scopes: ActivityEvent[] = user.scopeAssignedAt
    ? user.divisionIds.map((divisionId) => {
        const division = db.divisions.find((item) => item.id === divisionId)
        const estate = db.estates.find((item) => item.id === division?.estateId)
        return {
          id: `scope-${divisionId}`,
          at: user.scopeAssignedAt ?? '',
          title: `Scope assigned: ${division?.name ?? divisionId} (${divisionId})`,
          detail: estate?.name ?? '',
          link: { kind: 'division', id: divisionId },
        }
      })
    : []
  const audits = auditActivity(db, db.auditEvents.filter((event) => event.userId === user.id && event.kind !== 'device_session_revoked'))
  return [...sessions, ...scopes, ...audits].sort((a, b) => b.at.localeCompare(a.at))
}

/** ID-02 "Users by role", in the order of the design (largest group first). */
export function usersByRole(db: Db): Array<{ role: UserRole; count: number }> {
  const order: UserRole[] = ['FIELD_WORKER', 'SUPERVISOR', 'DISEASE_EXPERT', 'ADMINISTRATOR', 'REPORTING_USER']
  const known = new Set(order)
  return [...order, ...USER_ROLES.filter((role) => !known.has(role))].map((role) => ({
    role,
    count: db.users.filter((user) => user.role === role && user.status === 'active').length,
  }))
}

export function nextId(prefix: string, ids: readonly string[]): string {
  const max = ids.reduce((highest, id) => {
    const match = new RegExp(`^${prefix}-(\\d+)$`).exec(id)
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)
  return `${prefix}-${String(max + 1).padStart(3, '0')}`
}
