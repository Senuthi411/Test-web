import { newestFirst } from './chronology'
import type { AuditKind } from './activity'
import type { PersonRef } from './models'

/**
 * The administrative audit log (ID-18 Audit Logs, and the Security Center's Security Events
 * tab, which reads the same source). Read-only: no screen edits or deletes an audit record.
 */
export type AuditModule = 'Users' | 'Access' | 'Estates' | 'Divisions' | 'Device sessions' | 'Configuration'

export const AUDIT_MODULES: readonly AuditModule[] = ['Users', 'Access', 'Estates', 'Divisions', 'Device sessions', 'Configuration']

export type AuditOutcome = 'success' | 'failure'

export const AUDIT_OUTCOME_LABELS: Record<AuditOutcome, string> = { success: 'Succeeded', failure: 'Failed' }

export const AUDIT_ACTION_LABELS: Record<AuditKind, string> = {
  user_invited: 'User invited',
  user_created: 'User created',
  user_updated: 'User updated',
  scope_updated: 'Scope changed',
  role_changed: 'Role changed',
  account_status_changed: 'Account status changed',
  estate_created: 'Estate created',
  estate_updated: 'Estate updated',
  division_created: 'Division created',
  division_updated: 'Division updated',
  division_reviewed: 'Division reviewed',
  device_session_revoked: 'Device session revoked',
  session_recovery_requested: 'Session recovery requested',
  configuration_draft_saved: 'Configuration draft saved',
  configuration_draft_discarded: 'Configuration draft discarded',
  configuration_published: 'Configuration published',
  configuration_rolled_back: 'Configuration rolled back',
  configuration_publish_rejected: 'Configuration publish rejected',
}

export const AUDIT_ACTIONS = Object.keys(AUDIT_ACTION_LABELS) as AuditKind[]

const MODULE_OF: Record<AuditKind, AuditModule> = {
  user_invited: 'Users',
  user_created: 'Users',
  user_updated: 'Users',
  scope_updated: 'Access',
  role_changed: 'Access',
  account_status_changed: 'Access',
  estate_created: 'Estates',
  estate_updated: 'Estates',
  division_created: 'Divisions',
  division_updated: 'Divisions',
  division_reviewed: 'Divisions',
  device_session_revoked: 'Device sessions',
  session_recovery_requested: 'Device sessions',
  configuration_draft_saved: 'Configuration',
  configuration_draft_discarded: 'Configuration',
  configuration_published: 'Configuration',
  configuration_rolled_back: 'Configuration',
  configuration_publish_rejected: 'Configuration',
}

export function auditModuleOf(kind: AuditKind): AuditModule {
  return MODULE_OF[kind]
}

/**
 * Security events: access, account-status and device-session changes, and rejected
 * configuration publishes. The Security Center shows these from the same audit source.
 */
export const SECURITY_EVENT_KINDS: readonly AuditKind[] = [
  'role_changed',
  'scope_updated',
  'account_status_changed',
  'device_session_revoked',
  'session_recovery_requested',
  'configuration_publish_rejected',
]

export const isSecurityEvent = (entry: Pick<AuditLogEntry, 'action'>) => SECURITY_EVENT_KINDS.includes(entry.action)

export interface AuditTarget {
  kind: 'user' | 'estate' | 'division' | 'session' | 'configuration'
  id: string
  label: string
}

export interface AuditLogEntry {
  id: string
  at: string
  /** Null when the source does not identify who acted. */
  actor: PersonRef | null
  action: AuditKind
  module: AuditModule
  target: AuditTarget | null
  /** Value before and after the change, when the source recorded them. */
  previousValue: string | null
  newValue: string | null
  outcome: AuditOutcome
  reasonCode: string | null
  /** Short sentence ("Scope updated for Dr Tara Wijesinghe") and detail line. */
  summary: string
  detail: string
  estateIds: string[]
}

export interface AuditLogFilters {
  search: string
  /** `YYYY-MM-DD`, inclusive, or empty. Compared in the record's own offset. */
  from: string
  to: string
  actorId: string | 'all'
  module: AuditModule | 'all'
  action: AuditKind | 'all'
  outcome: AuditOutcome | 'all'
}

export const EMPTY_AUDIT_FILTERS: AuditLogFilters = { search: '', from: '', to: '', actorId: 'all', module: 'all', action: 'all', outcome: 'all' }

export function auditFiltersActive(filters: AuditLogFilters): boolean {
  return (Object.keys(EMPTY_AUDIT_FILTERS) as Array<keyof AuditLogFilters>).some((key) => filters[key] !== EMPTY_AUDIT_FILTERS[key])
}

/** Filters newest first. The date range compares the calendar date written in the record. */
export function filterAuditLog(entries: readonly AuditLogEntry[], filters: AuditLogFilters): AuditLogEntry[] {
  const term = filters.search.trim().toLowerCase()
  return entries
    .filter((entry) => {
      const day = entry.at.slice(0, 10)
      if (filters.from && day < filters.from) return false
      if (filters.to && day > filters.to) return false
      if (filters.actorId !== 'all' && entry.actor?.id !== filters.actorId) return false
      if (filters.module !== 'all' && entry.module !== filters.module) return false
      if (filters.action !== 'all' && entry.action !== filters.action) return false
      if (filters.outcome !== 'all' && entry.outcome !== filters.outcome) return false
      if (term) {
        const haystack = [entry.id, entry.summary, entry.detail, entry.actor?.fullName, entry.actor?.id, entry.target?.label, entry.target?.id, AUDIT_ACTION_LABELS[entry.action], entry.reasonCode]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
    .sort(newestFirst)
}

/** Distinct actors in the log, by name, for the actor filter. */
export function auditActors(entries: readonly AuditLogEntry[]): PersonRef[] {
  const byId = new Map<string, PersonRef>()
  for (const entry of entries) if (entry.actor) byId.set(entry.actor.id, entry.actor)
  return [...byId.values()].sort((a, b) => a.fullName.localeCompare(b.fullName))
}
