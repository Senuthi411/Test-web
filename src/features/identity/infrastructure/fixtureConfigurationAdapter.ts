import { AppError } from '@/shared/api'
import type { FixtureAuditEvent, FixtureConfigurationVersion, FixtureDatabase, FixtureStore, FixtureUser } from '@/fixtures'
import type { UserId } from '@/shared/types'
import type { Clock } from '@/shared/utilities/clock'
import { rejectInvalidConfiguration } from '../application/configurationUseCases'
import type { ConfigurationPort } from '../application/ports'
import {
  baselineConfiguration,
  diffConfiguration,
  summarizeChanges,
  type ConfigurationDocument,
  type ConfigurationDraft,
  type ConfigurationState,
  type ConfigurationVersion,
} from '../domain/configuration'
import { findUser, nextId, person } from './fixtureRecords'

export interface FixtureConfigurationOptions {
  clock: Clock
  actorId: () => UserId | null
}

const asDocument = (value: Record<string, unknown>) => structuredClone(value) as unknown as ConfigurationDocument
const asRecord = (document: ConfigurationDocument) => structuredClone(document) as unknown as Record<string, unknown>

const conflict = () =>
  new AppError('conflict', 'The configuration was changed by someone else. Reload it and review the changes before trying again.', { code: 'CONFIGURATION_VERSION_CONFLICT' })

/**
 * DEMONSTRATION DATA ONLY (fixture mode). Configuration versions live in this browser tab's
 * fixture store; nothing is sent anywhere, no rule is evaluated and no feature changes.
 * Every save, discard, publish, rollback and rejected publish appends a record to the
 * shared fixture audit log. Versions are never deleted. API mode never loads this file.
 */
export function createFixtureConfigurationAdapter(store: FixtureStore, options: FixtureConfigurationOptions): ConfigurationPort {
  const nowIso = () => options.clock.now().toISOString()

  function requireAdministrator(db: Readonly<FixtureDatabase>): FixtureUser {
    const actorId = options.actorId()
    const actor = actorId ? findUser(db, actorId) : undefined
    if (!actor || actor.role !== 'ADMINISTRATOR' || actor.status !== 'active') {
      throw new AppError('forbidden', 'Only an active Administrator can change the system configuration.', { code: 'FORBIDDEN' })
    }
    return actor
  }

  /** The baseline is created from the domain defaults the first time the store is used. */
  function ensureBaseline(db: FixtureDatabase): void {
    if (db.configurationVersions.length > 0) return
    db.configurationVersions.push({ version: 1, document: asRecord(baselineConfiguration()), createdAt: nowIso(), createdBy: null, kind: 'baseline', reason: 'Baseline: template defaults' })
  }

  const latest = (db: Readonly<FixtureDatabase>) => db.configurationVersions[db.configurationVersions.length - 1] as FixtureConfigurationVersion

  function audit(db: FixtureDatabase, actor: FixtureUser, event: Pick<FixtureAuditEvent, 'kind' | 'configurationVersion' | 'summary' | 'reasonCode' | 'outcome'>): void {
    db.auditEvents.push({ ...event, id: nextId('AUD', db.auditEvents.map((item) => item.id)), at: nowIso(), actorId: actor.id, estateIds: [], provenance: 'fixture-assigned' })
  }

  function toVersion(db: Readonly<FixtureDatabase>, stored: FixtureConfigurationVersion): ConfigurationVersion {
    const by = stored.createdBy ? findUser(db, stored.createdBy) : undefined
    return {
      version: stored.version,
      document: asDocument(stored.document),
      createdAt: stored.createdAt,
      createdBy: by ? person(by) : null,
      kind: stored.kind,
      reason: stored.reason,
      ...(stored.restoredFrom ? { restoredFrom: stored.restoredFrom } : {}),
    }
  }

  function toDraft(db: Readonly<FixtureDatabase>): ConfigurationDraft | null {
    const draft = db.configurationDraft
    if (!draft) return null
    const by = draft.savedBy ? findUser(db, draft.savedBy) : undefined
    return { document: asDocument(draft.document), baseVersion: draft.baseVersion, savedAt: draft.savedAt, savedBy: by ? person(by) : null }
  }

  function state(db: Readonly<FixtureDatabase>): ConfigurationState {
    const versions = [...db.configurationVersions].reverse().map((stored) => toVersion(db, stored))
    return { current: versions[0] as ConfigurationVersion, versions, draft: toDraft(db) }
  }

  /** Records a rejected publish (it happened) and then rejects. */
  function rejectPublish(db: FixtureDatabase, actor: FixtureUser, reasonCode: string, error: AppError): never {
    audit(db, actor, { kind: 'configuration_publish_rejected', reasonCode, outcome: 'failure', summary: error.message })
    throw error
  }

  return {
    getConfiguration(signal) {
      return store.run(() => {
        store.read((db) => requireAdministrator(db))
        return store.write((db) => {
          ensureBaseline(db)
          return state(db)
        })
      }, signal)
    },

    saveDraft({ document, baseVersion }) {
      return store.run(() =>
        store.write((db) => {
          const actor = requireAdministrator(db)
          ensureBaseline(db)
          if (baseVersion !== latest(db).version) throw conflict()
          const changes = diffConfiguration(asDocument(latest(db).document), document)
          db.configurationDraft = { document: asRecord(document), baseVersion, savedAt: nowIso(), savedBy: actor.id }
          audit(db, actor, { kind: 'configuration_draft_saved', summary: summarizeChanges(changes) })
          return toDraft(db) as ConfigurationDraft
        }),
      )
    },

    discardDraft({ baseVersion }) {
      return store.run(() =>
        store.write((db) => {
          const actor = requireAdministrator(db)
          ensureBaseline(db)
          if (!db.configurationDraft) return
          if (db.configurationDraft.baseVersion !== baseVersion) throw conflict()
          const changes = diffConfiguration(asDocument(latest(db).document), asDocument(db.configurationDraft.document))
          db.configurationDraft = null
          audit(db, actor, { kind: 'configuration_draft_discarded', summary: summarizeChanges(changes) })
        }),
      )
    },

    publishDraft({ baseVersion, reason }) {
      return store.run(() =>
        store.write((db) => {
          const actor = requireAdministrator(db)
          ensureBaseline(db)
          const draft = db.configurationDraft
          if (!draft) throw new AppError('validation', 'Save a draft before publishing.', { code: 'CONFIGURATION_NO_DRAFT' })
          if (baseVersion !== latest(db).version || draft.baseVersion !== baseVersion) rejectPublish(db, actor, 'VERSION_CONFLICT', conflict())
          const document = asDocument(draft.document)
          try {
            rejectInvalidConfiguration(document)
          } catch (error) {
            rejectPublish(db, actor, 'VALIDATION_FAILED', error as AppError)
          }
          const changes = diffConfiguration(asDocument(latest(db).document), document)
          if (changes.length === 0) throw new AppError('validation', 'The draft has no changes to publish.', { code: 'CONFIGURATION_NO_CHANGES' })
          const version = latest(db).version + 1
          db.configurationVersions.push({ version, document: asRecord(document), createdAt: nowIso(), createdBy: actor.id, kind: 'publish', reason })
          db.configurationDraft = null
          audit(db, actor, { kind: 'configuration_published', configurationVersion: version, summary: summarizeChanges(changes) })
          return toVersion(db, latest(db))
        }),
      )
    },

    rollback({ targetVersion, baseVersion, reason }) {
      return store.run(() =>
        store.write((db) => {
          const actor = requireAdministrator(db)
          ensureBaseline(db)
          if (baseVersion !== latest(db).version) throw conflict()
          const target = db.configurationVersions.find((item) => item.version === targetVersion)
          if (!target) throw new AppError('not_found', 'This configuration version could not be found.')
          if (targetVersion === baseVersion) throw new AppError('validation', 'This version is already in effect.', { code: 'ROLLBACK_TO_CURRENT' })
          if (db.configurationDraft) throw new AppError('conflict', 'Publish or discard the open draft before rolling back.', { code: 'CONFIGURATION_DRAFT_OPEN' })
          const document = asDocument(target.document)
          const changes = diffConfiguration(asDocument(latest(db).document), document)
          const version = latest(db).version + 1
          // A rollback is a new version with the earlier content; history is never removed.
          db.configurationVersions.push({ version, document: asRecord(document), createdAt: nowIso(), createdBy: actor.id, kind: 'rollback', reason, restoredFrom: targetVersion })
          audit(db, actor, { kind: 'configuration_rolled_back', configurationVersion: version, summary: `Restored version ${targetVersion} · ${summarizeChanges(changes)}` })
          return toVersion(db, latest(db))
        }),
      )
    },
  }
}
