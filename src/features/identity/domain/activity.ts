import { ROLE_LABELS, type UserRole } from '@/shared/types'
import type { ActivityEvent, RecordStatus } from './models'

export type AuditKind =
  | 'user_invited'
  | 'user_created'
  | 'user_updated'
  | 'scope_updated'
  | 'estate_created'
  | 'estate_updated'
  | 'division_created'
  | 'division_updated'
  | 'division_reviewed'
  | 'device_session_revoked'
  | 'session_recovery_requested'

/** An audit record with the names it refers to already resolved. */
export interface AuditEntry {
  id: string
  at: string
  kind: AuditKind
  user?: { id: string; fullName: string; role: UserRole }
  division?: { id: string; name: string }
  estate?: { id: string; name: string }
  sessionId?: string
  reasonCode?: string
  scope?: string[]
  status?: RecordStatus
}

const STATUS_LABEL: Record<RecordStatus, string> = { active: 'active', inactive: 'inactive' }

/**
 * Timeline wording, following ID-02: "Scope updated for Dr Tara Wijesinghe" /
 * "EST-001, EST-002", "Device session revoked" / "USR-011 · DEVICE_SESSION_REVOKED",
 * "User invited: Maya Dissanayake" / "Reporting user".
 */
export function describeAudit(entry: AuditEntry): ActivityEvent {
  const base = { id: entry.id, at: entry.at }
  const userLink = entry.user ? { kind: 'user' as const, id: entry.user.id } : undefined
  switch (entry.kind) {
    case 'scope_updated':
      return { ...base, title: `Scope updated for ${entry.user?.fullName ?? 'a user'}`, detail: (entry.scope ?? []).join(', '), link: userLink }
    case 'user_invited':
      return { ...base, title: `User invited: ${entry.user?.fullName ?? ''}`, detail: entry.user ? ROLE_LABELS[entry.user.role] : '', link: userLink }
    case 'user_created':
      return { ...base, title: `User created: ${entry.user?.fullName ?? ''}`, detail: entry.user ? `${entry.user.id} · ${ROLE_LABELS[entry.user.role]}` : '', link: userLink }
    case 'user_updated':
      return { ...base, title: `User updated: ${entry.user?.fullName ?? ''}`, detail: entry.user ? `${entry.user.id} · ${ROLE_LABELS[entry.user.role]}` : '', link: userLink }
    case 'device_session_revoked':
      return {
        ...base,
        title: 'Device session revoked',
        detail: [entry.user?.id, entry.reasonCode].filter(Boolean).join(' · '),
        link: entry.sessionId ? { kind: 'session', id: entry.sessionId } : undefined,
      }
    case 'session_recovery_requested':
      return {
        ...base,
        title: `Recovery requested for ${entry.sessionId ?? 'a device session'}`,
        detail: [entry.user?.id, entry.sessionId ? `REC-${entry.sessionId}` : undefined].filter(Boolean).join(' · '),
        link: entry.sessionId ? { kind: 'session', id: entry.sessionId } : undefined,
      }
    case 'division_reviewed':
    case 'division_created':
    case 'division_updated': {
      const verb = entry.kind === 'division_reviewed' ? 'reviewed' : entry.kind === 'division_created' ? 'added' : 'updated'
      return {
        ...base,
        title: `Division ${entry.division?.id ?? ''} ${entry.division?.name ?? ''} ${verb}`.replace(/\s+/g, ' '),
        detail: entry.status ? `Status ${STATUS_LABEL[entry.status]}` : '',
        link: entry.division ? { kind: 'division', id: entry.division.id } : undefined,
      }
    }
    case 'estate_created':
    case 'estate_updated':
      return {
        ...base,
        title: `Estate ${entry.estate?.id ?? ''} ${entry.estate?.name ?? ''} ${entry.kind === 'estate_created' ? 'added' : 'updated'}`.replace(/\s+/g, ' '),
        detail: entry.status ? `Status ${STATUS_LABEL[entry.status]}` : '',
        link: entry.estate ? { kind: 'estate', id: entry.estate.id } : undefined,
      }
  }
}
