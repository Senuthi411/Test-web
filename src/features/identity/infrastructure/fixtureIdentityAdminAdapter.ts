import { AppError } from '@/shared/api'
import type { FixtureAuditEvent, FixtureDatabase, FixtureStore, FixtureUser } from '@/fixtures'
import type { UserId } from '@/shared/types'
import type { Clock } from '@/shared/utilities/clock'
import { formatIsoDate } from '@/shared/utilities/format'
import type { AdminDashboard, AttentionRow, DivisionDetail, RecoveryRequest, UserDetail } from '../domain/models'
import { normaliseScope, sameScope, scopeIdsOf, scopeLevelFor, type ScopeSelection, type ScopeTopology } from '../domain/scope'
import type { IdentityAdminPort, UserInput } from '../application/ports'
import {
  auditActivity,
  estateStats,
  estateTeam,
  findUser,
  nextId,
  person,
  toDeviceSession,
  toDivisionSummary,
  toEstateSummary,
  toIdentityUser,
  userActivity,
  usersByRole,
} from './fixtureRecords'

export interface FixtureIdentityOptions {
  clock: Clock
  /** The signed-in administrator, recorded as the actor of audit events. */
  actorId: () => UserId | null
}

type Db = Readonly<FixtureDatabase>

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function notFound(what: string): AppError {
  return new AppError('not_found', `${what} could not be found.`)
}

function conflict(message: string): AppError {
  return new AppError('conflict', message, { code: 'VERSION_CONFLICT' })
}

function invalid(path: string, message: string): AppError {
  return new AppError('validation', message, { code: 'VALIDATION_FAILED', details: [{ path, message }] })
}

function topologyOf(db: Db): ScopeTopology {
  return { estates: db.estates, divisions: db.divisions }
}

/** Checks that every scope identifier exists and returns the scope stored for the role. */
function resolveScope(db: Db, input: UserInput): ScopeSelection {
  const level = scopeLevelFor(input.role)
  const scope = normaliseScope(level, input.scope, topologyOf(db))
  if (scope.estateIds.some((id) => !db.estates.some((estate) => estate.id === id))) throw invalid('estateId', 'Select an existing estate')
  if (scope.divisionIds.some((id) => !db.divisions.some((division) => division.id === id))) throw invalid('divisionIds', 'Select existing divisions')
  return scope
}

function assertUniqueEmail(db: Db, email: string, exceptId?: UserId): void {
  if (db.users.some((user) => user.id !== exceptId && user.email.toLowerCase() === email.toLowerCase())) {
    throw invalid('email', 'Another user already uses this email address')
  }
}

/**
 * Fixture adapter for Identity administration. Reads derive everything from the shared
 * store; writes change it in this browser tab only, bump record versions and append an
 * audit event, so the dashboard and activity timelines reflect them.
 */
export function createFixtureIdentityAdminAdapter(store: FixtureStore, options: FixtureIdentityOptions): IdentityAdminPort {
  const { clock } = options
  const nowIso = () => clock.now().toISOString()
  const today = () => formatIsoDate(clock.now().toISOString())

  function audit(db: FixtureDatabase, event: Omit<FixtureAuditEvent, 'id' | 'at' | 'actorId' | 'provenance'>): void {
    db.auditEvents.push({
      ...event,
      id: nextId('AUD', db.auditEvents.map((item) => item.id)),
      at: nowIso(),
      actorId: options.actorId() ?? 'unknown',
      provenance: 'fixture-assigned',
    })
  }

  function estatesOfScope(db: Db, scope: ScopeSelection): string[] {
    if (scope.estateIds.length > 0) return [...scope.estateIds]
    return [...new Set(scope.divisionIds.map((id) => db.divisions.find((division) => division.id === id)?.estateId ?? ''))].filter(Boolean)
  }

  function userDetail(db: Db, userId: UserId): UserDetail {
    const user = findUser(db, userId)
    if (!user) throw notFound('This user')
    const estateIds = new Set(
      user.role === 'ADMINISTRATOR'
        ? db.estates.map((estate) => estate.id)
        : estatesOfScope(db, { estateIds: user.estateIds, divisionIds: user.divisionIds }),
    )
    return {
      user: toIdentityUser(db, user),
      estates: db.estates
        .filter((estate) => estateIds.has(estate.id))
        .map((estate) => ({ id: estate.id, name: estate.name, region: estate.region, status: estate.status })),
      divisions: user.divisionIds.flatMap((id) => {
        const division = db.divisions.find((item) => item.id === id)
        if (!division) return []
        const estateName = db.estates.find((estate) => estate.id === division.estateId)?.name ?? division.estateId
        return [{ id: division.id, name: division.name, estateId: division.estateId, estateName, status: division.status }]
      }),
      deviceSessions: db.deviceSessions.filter((session) => session.userId === user.id).map((session) => toDeviceSession(db, session)),
      activity: userActivity(db, user),
    }
  }

  function attentionRow(db: Db, user: FixtureUser): AttentionRow {
    const sessions = db.deviceSessions.filter((session) => session.userId === user.id)
    const revokedOnly = sessions.length > 0 && sessions.some((s) => s.status === 'revoked') && !sessions.some((s) => s.status === 'active')
    const identity = toIdentityUser(db, user)
    return {
      user: { ...person(user), role: user.role, scopeIds: scopeIdsOf(user) },
      status: revokedOnly ? 'session_revoked' : user.status,
      lastDeviceSessionAt: identity.lastSignInAt,
    }
  }

  function recovery(db: Db, sessionId: string): RecoveryRequest | null {
    const request = db.recoveryRequests.find((item) => item.sessionId === sessionId)
    if (!request) return null
    const requester = findUser(db, request.requestedBy)
    return {
      id: request.id,
      sessionId: request.sessionId,
      requestedBy: requester ? person(requester) : { id: request.requestedBy, fullName: request.requestedBy },
      requestedAt: request.requestedAt,
      steps: [...request.steps],
    }
  }

  return {
    getDashboard(signal) {
      return store.run(
        () =>
          store.read((db): AdminDashboard => {
            const now = clock.now().getTime()
            return {
              activeUsers: db.users.filter((user) => user.status === 'active').length,
              totalUsers: db.users.length,
              estates: db.estates.map((estate) => toEstateSummary(db, estate)),
              divisionCount: db.divisions.length,
              activeDeviceSessions: db.deviceSessions.filter((session) => session.status === 'active').length,
              revokedSessionsThisWeek: db.deviceSessions.filter((session) => {
                if (!session.revokedAt) return false
                const at = new Date(session.revokedAt).getTime()
                return at <= now && now - at <= WEEK_MS
              }).length,
              usersByRole: usersByRole(db),
              recentActivity: auditActivity(db, db.auditEvents).slice(0, 4),
              attention: db.dashboardAttentionUserIds.flatMap((id) => {
                const user = findUser(db, id)
                return user ? [attentionRow(db, user)] : []
              }),
            }
          }),
        signal,
      )
    },

    listUsers(signal) {
      return store.run(() => store.read((db) => db.users.map((user) => toIdentityUser(db, user))), signal)
    },

    getUser(userId, signal) {
      return store.run(() => store.read((db) => userDetail(db, userId)), signal)
    },

    createUser(input) {
      return store.run(() =>
        store.write((db) => {
          assertUniqueEmail(db, input.email)
          const scope = resolveScope(db, input)
          const user: FixtureUser = {
            id: nextId('USR', db.users.map((item) => item.id)),
            fullName: input.fullName,
            email: input.email,
            role: input.role,
            status: input.status,
            estateIds: scope.estateIds,
            divisionIds: scope.divisionIds,
            createdAt: today(),
            lastSignInAt: null,
            scopeAssignedAt: today(),
            version: 1,
            language: 'en',
            notificationPreferences: { reviewEscalations: true, deviceSessionAlerts: true, weeklySummary: false },
          }
          db.users.push(user)
          audit(db, { kind: 'user_created', userId: user.id, estateIds: estatesOfScope(db, scope) })
          return toIdentityUser(db, user)
        }),
      )
    },

    updateUser(userId, input) {
      return store.run(() =>
        store.write((db) => {
          const user = db.users.find((item) => item.id === userId)
          if (!user) throw notFound('This user')
          if (user.version !== input.expectedVersion) throw conflict('This user was changed by another administrator. Your changes were not saved.')
          assertUniqueEmail(db, input.email, userId)
          const scope = resolveScope(db, input)
          const scopeChanged = !sameScope(scope, { estateIds: user.estateIds, divisionIds: user.divisionIds })
          Object.assign(user, {
            fullName: input.fullName,
            email: input.email,
            role: input.role,
            status: input.status,
            estateIds: scope.estateIds,
            divisionIds: scope.divisionIds,
            scopeAssignedAt: scopeChanged ? today() : user.scopeAssignedAt,
            version: user.version + 1,
          })
          const credential = db.credentials.find((item) => item.userId === userId)
          if (credential) credential.email = input.email
          audit(db, { kind: 'user_updated', userId, estateIds: estatesOfScope(db, scope) })
          return toIdentityUser(db, user)
        }),
      )
    },

    updateUserScope(userId, input) {
      return store.run(() =>
        store.write((db) => {
          const user = db.users.find((item) => item.id === userId)
          if (!user) throw notFound('This user')
          if (user.version !== input.expectedVersion) {
            throw conflict("This user's scope was changed by another administrator. Your change was not applied.")
          }
          const scope = resolveScope(db, { fullName: user.fullName, email: user.email, role: user.role, status: user.status, scope: input.scope })
          user.estateIds = scope.estateIds
          user.divisionIds = scope.divisionIds
          user.scopeAssignedAt = today()
          user.version += 1
          audit(db, {
            kind: 'scope_updated',
            userId,
            scope: scopeIdsOf(scope),
            reasonCode: input.reason,
            estateIds: estatesOfScope(db, scope),
          })
          return toIdentityUser(db, user)
        }),
      )
    },

    listEstates(signal) {
      return store.run(() => store.read((db) => db.estates.map((estate) => toEstateSummary(db, estate))), signal)
    },

    getEstate(estateId, signal) {
      return store.run(
        () =>
          store.read((db) => {
            const estate = db.estates.find((item) => item.id === estateId)
            if (!estate) throw notFound('This estate')
            return {
              estate: toEstateSummary(db, estate),
              stats: estateStats(db, estate.id),
              divisions: db.divisions.filter((division) => division.estateId === estate.id).map((division) => toDivisionSummary(db, division)),
              team: estateTeam(db, estate.id),
              activity: auditActivity(db, db.auditEvents.filter((event) => event.estateIds.includes(estate.id))),
            }
          }),
        signal,
      )
    },

    createEstate(input) {
      return store.run(() =>
        store.write((db) => {
          if (db.estates.some((estate) => estate.name.toLowerCase() === input.name.toLowerCase())) {
            throw invalid('name', 'An estate with this name already exists')
          }
          const estate = { id: nextId('EST', db.estates.map((item) => item.id)), ...input, createdAt: today() }
          db.estates.push(estate)
          audit(db, { kind: 'estate_created', estateId: estate.id, status: estate.status, estateIds: [estate.id] })
          return toEstateSummary(db, estate)
        }),
      )
    },

    updateEstate(estateId, input) {
      return store.run(() =>
        store.write((db) => {
          const estate = db.estates.find((item) => item.id === estateId)
          if (!estate) throw notFound('This estate')
          if (db.estates.some((item) => item.id !== estateId && item.name.toLowerCase() === input.name.toLowerCase())) {
            throw invalid('name', 'An estate with this name already exists')
          }
          Object.assign(estate, input)
          audit(db, { kind: 'estate_updated', estateId, status: estate.status, estateIds: [estateId] })
          return toEstateSummary(db, estate)
        }),
      )
    },

    listDivisions(signal) {
      return store.run(() => store.read((db) => db.divisions.map((division) => toDivisionSummary(db, division))), signal)
    },

    getDivision(divisionId, signal) {
      return store.run(
        () =>
          store.read((db): DivisionDetail => {
            const division = db.divisions.find((item) => item.id === divisionId)
            if (!division) throw notFound('This division')
            const estate = db.estates.find((item) => item.id === division.estateId)
            const observations = db.observations.filter((observation) => observation.divisionId === division.id)
            const observationIds = new Set(observations.map((observation) => observation.id))
            const supervisor = db.users.find((user) => user.role === 'SUPERVISOR' && user.status === 'active' && user.estateIds.includes(division.estateId))
            return {
              division: toDivisionSummary(db, division),
              region: estate?.region ?? '',
              supervisor: supervisor ? person(supervisor) : null,
              expertConfirmedCaseIds: db.cases.filter((item) => observationIds.has(item.observationId)).map((item) => item.id).sort(),
              recentObservations: [...observations]
                .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
                .slice(0, 5)
                .sort((a, b) => a.id.localeCompare(b.id))
                .map((observation) => ({
                  id: observation.id,
                  capturedAt: observation.capturedAt,
                  suspectedDisease: db.diseases.find((disease) => disease.id === observation.suspectedDiseaseId)?.name ?? observation.suspectedDiseaseId,
                  reviewStatus: observation.reviewStatus,
                  gpsAccuracyM: observation.gpsAccuracyM,
                })),
            }
          }),
        signal,
      )
    },

    createDivision(input) {
      return store.run(() =>
        store.write((db) => {
          if (!db.estates.some((estate) => estate.id === input.estateId)) throw invalid('estateId', 'Select an existing estate')
          if (db.divisions.some((division) => division.estateId === input.estateId && division.name.toLowerCase() === input.name.toLowerCase())) {
            throw invalid('name', 'This estate already has a division with this name')
          }
          const division = { id: nextId('DIV', db.divisions.map((item) => item.id)), ...input }
          db.divisions.push(division)
          audit(db, { kind: 'division_created', divisionId: division.id, status: division.status, estateIds: [division.estateId] })
          return toDivisionSummary(db, division)
        }),
      )
    },

    updateDivision(divisionId, input) {
      return store.run(() =>
        store.write((db) => {
          const division = db.divisions.find((item) => item.id === divisionId)
          if (!division) throw notFound('This division')
          if (db.divisions.some((item) => item.id !== divisionId && item.estateId === division.estateId && item.name.toLowerCase() === input.name.toLowerCase())) {
            throw invalid('name', 'This estate already has a division with this name')
          }
          Object.assign(division, input)
          audit(db, { kind: 'division_updated', divisionId, status: division.status, estateIds: [division.estateId] })
          return toDivisionSummary(db, division)
        }),
      )
    },

    listDeviceSessions(signal) {
      return store.run(() => store.read((db) => db.deviceSessions.map((session) => toDeviceSession(db, session))), signal)
    },

    revokeDeviceSession(sessionId) {
      return store.run(() =>
        store.write((db) => {
          const session = db.deviceSessions.find((item) => item.id === sessionId)
          if (!session) throw notFound('This device session')
          if (session.status !== 'active') throw conflict('This device session is no longer active.')
          session.status = 'revoked'
          session.revokedAt = nowIso()
          session.revokedReasonCode = 'DEVICE_SESSION_REVOKED'
          const user = findUser(db, session.userId)
          audit(db, {
            kind: 'device_session_revoked',
            userId: session.userId,
            sessionId,
            reasonCode: 'DEVICE_SESSION_REVOKED',
            estateIds: user ? estatesOfScope(db, { estateIds: user.estateIds, divisionIds: user.divisionIds }) : [],
          })
          return toDeviceSession(db, session)
        }),
      )
    },

    getRecoveryRequest(sessionId, signal) {
      return store.run(
        () =>
          store.read((db) => {
            if (!db.deviceSessions.some((item) => item.id === sessionId)) throw notFound('This device session')
            return recovery(db, sessionId)
          }),
        signal,
      )
    },

    requestSessionRecovery(sessionId) {
      return store.run(() =>
        store.write((db) => {
          const session = db.deviceSessions.find((item) => item.id === sessionId)
          if (!session) throw notFound('This device session')
          if (session.status !== 'revoked') throw conflict('Only a revoked device session can enter controlled recovery.')
          const existing = recovery(db, sessionId)
          if (existing) return existing
          db.recoveryRequests.push({
            id: `REC-${sessionId}`,
            sessionId,
            requestedBy: options.actorId() ?? 'unknown',
            requestedAt: nowIso(),
            steps: ['done', 'pending', 'open', 'not_issued', 'waiting'],
          })
          const user = findUser(db, session.userId)
          audit(db, {
            kind: 'session_recovery_requested',
            userId: session.userId,
            sessionId,
            estateIds: user ? estatesOfScope(db, { estateIds: user.estateIds, divisionIds: user.divisionIds }) : [],
          })
          return recovery(db, sessionId) as RecoveryRequest
        }),
      )
    },

    exportData() {
      // Fixture mode never produces a file; the screen says so.
      return store.run(() => ({ simulated: true }))
    },
  }
}
