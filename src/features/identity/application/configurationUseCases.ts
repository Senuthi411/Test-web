import { AppError } from '@/shared/api'
import type { AuditLogEntry } from '../domain/auditLog'
import { validateConfiguration, type ConfigurationDocument, type ConfigurationDraft, type ConfigurationState, type ConfigurationVersion } from '../domain/configuration'
import type { AuditLogPort, ConfigurationPort } from './ports'
import { rejectField } from './authUseCases'

export interface AuditLogUseCases {
  listAuditLog(signal?: AbortSignal): Promise<AuditLogEntry[]>
}

export function createAuditLogUseCases(port: AuditLogPort): AuditLogUseCases {
  return { listAuditLog: (signal) => port.listAuditLog(signal) }
}

export interface ConfigurationUseCases {
  getConfiguration(signal?: AbortSignal): Promise<ConfigurationState>
  saveDraft(document: ConfigurationDocument, baseVersion: number): Promise<ConfigurationDraft>
  discardDraft(baseVersion: number): Promise<void>
  publishDraft(baseVersion: number, reason: string): Promise<ConfigurationVersion>
  rollback(targetVersion: number, baseVersion: number, reason: string): Promise<ConfigurationVersion>
}

/** Rejects a document that fails validation, with one detail per field. */
function rejectInvalid(document: ConfigurationDocument): void {
  const issues = validateConfiguration(document)
  if (issues.length === 0) return
  throw new AppError('validation', 'The configuration has problems that must be fixed first.', {
    code: 'CONFIGURATION_INVALID',
    details: issues.map((issue) => ({ path: issue.path, message: issue.message })),
  })
}

/**
 * System configuration. A draft may be saved while incomplete, but it is validated before
 * it is published; the backend (or fixture adapter) validates again and decides.
 */
export function createConfigurationUseCases(port: ConfigurationPort): ConfigurationUseCases {
  return {
    getConfiguration: (signal) => port.getConfiguration(signal),
    saveDraft: (document, baseVersion) => port.saveDraft({ document, baseVersion }),
    discardDraft: (baseVersion) => port.discardDraft({ baseVersion }),
    async publishDraft(baseVersion, reason) {
      rejectField('reason', reason.trim() ? null : 'Enter the reason for this change')
      return port.publishDraft({ baseVersion, reason: reason.trim() })
    },
    async rollback(targetVersion, baseVersion, reason) {
      rejectField('reason', reason.trim() ? null : 'Enter the reason for the rollback')
      if (targetVersion === baseVersion) throw new AppError('validation', 'This version is already in effect.', { code: 'ROLLBACK_TO_CURRENT' })
      return port.rollback({ targetVersion, baseVersion, reason: reason.trim() })
    },
  }
}

export { rejectInvalid as rejectInvalidConfiguration }
