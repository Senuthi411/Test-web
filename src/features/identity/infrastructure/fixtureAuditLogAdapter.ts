import { AppError } from '@/shared/api'
import type { FixtureAuditEvent, FixtureDatabase, FixtureStore } from '@/fixtures'
import type { UserId } from '@/shared/types'
import { describeAudit } from '../domain/activity'
import { auditModuleOf, type AuditLogEntry, type AuditTarget } from '../domain/auditLog'
import type { AuditLogPort } from '../application/ports'
import { findUser, person } from './fixtureRecords'

const STATUS_LABEL = { active: 'Active', inactive: 'Inactive' } as const

function target(db: Readonly<FixtureDatabase>, event: FixtureAuditEvent): AuditTarget | null {
  if (event.kind.startsWith('configuration_')) {
    return { kind: 'configuration', id: event.configurationVersion ? `v${event.configurationVersion}` : 'draft', label: event.configurationVersion ? `Configuration v${event.configurationVersion}` : 'Configuration draft' }
  }
  if (event.sessionId) return { kind: 'session', id: event.sessionId, label: `Device session ${event.sessionId}` }
  if (event.userId) {
    const user = findUser(db, event.userId)
    return { kind: 'user', id: event.userId, label: user ? user.fullName : event.userId }
  }
  if (event.divisionId) {
    const division = db.divisions.find((item) => item.id === event.divisionId)
    return { kind: 'division', id: event.divisionId, label: division ? `${division.name} (${division.id})` : event.divisionId }
  }
  if (event.estateId) {
    const estate = db.estates.find((item) => item.id === event.estateId)
    return { kind: 'estate', id: event.estateId, label: estate ? `${estate.name} (${estate.id})` : event.estateId }
  }
  return null
}

/** Before and after values, only as the record states them (nothing is reconstructed). */
function values(event: FixtureAuditEvent): Pick<AuditLogEntry, 'previousValue' | 'newValue'> {
  switch (event.kind) {
    case 'scope_updated':
      return { previousValue: event.previousValue || null, newValue: event.scope?.join(', ') ?? null }
    case 'account_status_changed':
      return {
        previousValue: event.previousValue === 'active' || event.previousValue === 'inactive' ? STATUS_LABEL[event.previousValue] : null,
        newValue: event.status ? STATUS_LABEL[event.status] : null,
      }
    case 'role_changed':
      return { previousValue: event.previousValue ?? null, newValue: event.newValue ?? null }
    default:
      return { previousValue: event.previousValue ?? null, newValue: event.newValue ?? (event.status ? STATUS_LABEL[event.status] : null) }
  }
}

/** Maps the shared fixture audit records to audit-log entries (exported for tests). */
export function toAuditLogEntries(db: Readonly<FixtureDatabase>): AuditLogEntry[] {
  return [...db.auditEvents]
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((event) => {
      const user = event.userId ? findUser(db, event.userId) : undefined
      const division = event.divisionId ? db.divisions.find((item) => item.id === event.divisionId) : undefined
      const estate = event.estateId ? db.estates.find((item) => item.id === event.estateId) : undefined
      const actor = findUser(db, event.actorId)
      const described = describeAudit({
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
        previousValue: event.previousValue,
        newValue: event.newValue,
        configurationVersion: event.configurationVersion,
        summary: event.summary,
      })
      return {
        id: event.id,
        at: event.at,
        actor: actor ? person(actor) : null,
        action: event.kind,
        module: auditModuleOf(event.kind),
        target: target(db, event),
        ...values(event),
        outcome: event.outcome ?? 'success',
        reasonCode: event.reasonCode ?? null,
        summary: described.title,
        detail: described.detail,
        estateIds: [...event.estateIds],
      }
    })
}

/**
 * DEMONSTRATION DATA ONLY (fixture mode). Reads the shared fixture audit records, which the
 * other fixture adapters append to; nothing is added here. API mode never loads this file.
 */
export function createFixtureAuditLogAdapter(store: FixtureStore, options: { actorId: () => UserId | null }): AuditLogPort {
  return {
    listAuditLog(signal) {
      return store.run(() => {
        const actorId = options.actorId()
        const actor = actorId ? store.read((db) => findUser(db, actorId)) : undefined
        if (!actor || actor.role !== 'ADMINISTRATOR' || actor.status !== 'active') {
          throw new AppError('forbidden', 'Only an active Administrator can read the audit log.', { code: 'FORBIDDEN' })
        }
        return store.read((db) => toAuditLogEntries(db))
      }, signal)
    },
  }
}
