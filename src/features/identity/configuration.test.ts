import { describe, expect, it } from 'vitest'
import { FixtureStore } from '@/fixtures'
import { AppError, isAppError } from '@/shared/api'
import { fixedClock } from '@/shared/utilities/clock'
import { createConfigurationUseCases } from './application/configurationUseCases'
import {
  EMPTY_AUDIT_FILTERS,
  SECURITY_EVENT_KINDS,
  auditActors,
  auditFiltersActive,
  filterAuditLog,
  isSecurityEvent,
} from './domain/auditLog'
import {
  FEATURE_DEFINITIONS,
  RULE_TEMPLATES,
  baselineConfiguration,
  describeRule,
  diffConfiguration,
  enabledRuleCount,
  ruleHistory,
  summarizeChanges,
  validateConfiguration,
  type ConfigurationDocument,
} from './domain/configuration'
import { PERMISSION_MODULES, ROLE_CATALOG, permissionModule } from './domain/roles'
import { createFixtureAuditLogAdapter, toAuditLogEntries } from './infrastructure/fixtureAuditLogAdapter'
import { createFixtureConfigurationAdapter } from './infrastructure/fixtureConfigurationAdapter'
import { createPendingAuditLogAdapter, createPendingConfigurationAdapter } from './infrastructure/pendingConfigurationAdapters'

const clock = fixedClock('2026-10-21T10:00:00+05:30')

function edit(update: (document: ConfigurationDocument) => void): ConfigurationDocument {
  const document = baselineConfiguration()
  update(document)
  return document
}

const paths = (document: ConfigurationDocument) => validateConfiguration(document).map((issue) => issue.path)

async function rejection(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise
  } catch (error) {
    if (isAppError(error)) return error
    throw error
  }
  throw new Error('Expected the operation to be rejected')
}

describe('configuration domain', () => {
  it('starts from a valid baseline: protected features on, every rule off and no unapproved value pre-filled', () => {
    const baseline = baselineConfiguration()
    expect(validateConfiguration(baseline)).toEqual([])
    for (const feature of FEATURE_DEFINITIONS.filter((item) => item.protected)) expect(baseline.features[feature.key]).toBe(true)
    expect(enabledRuleCount(baseline)).toBe(0)
    expect(baseline.rules.gpsValidation.maxAccuracyMeters).toBeNull()
    expect(baseline.rules.pendingReviewReminder.thresholdHours).toBeNull()
    expect(Object.values(baseline.workflows).every((workflow) => workflow.targetHours === null)).toBe(true)
  })

  it('offers three predefined rule templates and blocks Rule A until observations have a severity', () => {
    expect(RULE_TEMPLATES.map((template) => `${template.code} ${template.name}`)).toEqual(['Rule A High Severity Notification', 'Rule B GPS Validation', 'Rule C Pending Review Reminder'])
    expect(paths(edit((document) => void (document.rules.highSeverityNotification.enabled = true)))).toContain('rules.highSeverityNotification.enabled')
  })

  it('validates rule parameters and their dependencies on features', () => {
    expect(paths(edit((document) => void (document.rules.gpsValidation.enabled = true)))).toEqual(['rules.gpsValidation.maxAccuracyMeters'])
    expect(paths(edit((document) => void (document.rules.gpsValidation.maxAccuracyMeters = 0)))).toEqual(['rules.gpsValidation.maxAccuracyMeters'])
    expect(paths(edit((document) => void (document.rules.gpsValidation.maxAccuracyMeters = 12.5)))).toEqual(['rules.gpsValidation.maxAccuracyMeters'])
    expect(
      paths(
        edit((document) => {
          document.rules.gpsValidation.enabled = true
          document.rules.gpsValidation.maxAccuracyMeters = 15
        }),
      ),
    ).toEqual([])
    const reminder = edit((document) => {
      document.rules.pendingReviewReminder.enabled = true
      document.rules.pendingReviewReminder.notifyRoles = []
    })
    expect(paths(reminder)).toEqual(['rules.pendingReviewReminder.thresholdHours', 'rules.pendingReviewReminder.notifyRoles', 'rules.pendingReviewReminder.enabled'])
    expect(
      paths(
        edit((document) => {
          document.features.notifications = true
          document.rules.pendingReviewReminder.enabled = true
          document.rules.pendingReviewReminder.thresholdHours = 48
        }),
      ),
    ).toEqual([])
  })

  it('rejects switching off a protected feature, a bad e-mail and an incomplete maintenance window', () => {
    expect(paths(edit((document) => void (document.features.imageUpload = false)))).toEqual(['features.imageUpload'])
    expect(paths(edit((document) => void (document.general.supportEmail = 'not-an-email')))).toEqual(['general.supportEmail'])
    expect(paths(edit((document) => void (document.general.organizationName = ' ')))).toEqual(['general.organizationName'])
    expect(paths(edit((document) => void (document.maintenance.plannedStart = '2026-11-01T22:00')))).toEqual(['maintenance.plannedEnd', 'maintenance.noticeMessage'])
    expect(
      paths(
        edit((document) => {
          document.maintenance = { noticeMessage: 'Planned upgrade', plannedStart: '2026-11-01T22:00', plannedEnd: '2026-11-01T21:00' }
        }),
      ),
    ).toEqual(['maintenance.plannedEnd'])
  })

  it('compares documents field by field and summarises the sections changed', () => {
    const after = edit((document) => {
      document.general.organizationName = 'TeaLeaf Estates'
      document.rules.gpsValidation.maxAccuracyMeters = 20
    })
    const changes = diffConfiguration(baselineConfiguration(), after)
    expect(changes).toEqual([
      { path: 'general.organizationName', section: 'general', label: 'Organization name', before: 'TeaLeaf Field Scout', after: 'TeaLeaf Estates' },
      { path: 'rules.gpsValidation.maxAccuracyMeters', section: 'rules', label: 'Rule B · accuracy limit (m)', before: 'Not set', after: '20' },
    ])
    expect(summarizeChanges(changes)).toBe('2 changes: General Settings, Business Rules')
    expect(summarizeChanges([])).toBe('No changes')
  })

  it('describes what a rule would do in plain words', () => {
    const document = edit((item) => {
      item.rules.gpsValidation.maxAccuracyMeters = 15
      item.rules.pendingReviewReminder.thresholdHours = 1
    })
    expect(describeRule('gpsValidation', document.rules)).toBe("When an observation's GPS accuracy is worse than ±15 m: flag the observation for supervisor review.")
    expect(describeRule('pendingReviewReminder', document.rules)).toBe('When an observation has waited for review longer than 1 hour, remind Supervisor.')
  })
})

describe('permission modules', () => {
  it('groups permissions in the seven matrix modules and gives Configuration and Security to the Administrator only', () => {
    expect(PERMISSION_MODULES).toEqual(['Identity', 'Capture', 'Review', 'Cases', 'Analytics', 'Configuration', 'Security'])
    for (const definition of ROLE_CATALOG) {
      const modules = definition.permissions.map(permissionModule)
      const governs = modules.includes('Configuration') || modules.includes('Security')
      expect(governs).toBe(definition.role === 'ADMINISTRATOR')
    }
  })
})

describe('fixture configuration adapter', () => {
  const setup = (actor: string | null = 'USR-001') => {
    const store = new FixtureStore({ latencyMs: 0 })
    const port = createFixtureConfigurationAdapter(store, { clock, actorId: () => actor })
    return { store, port, useCases: createConfigurationUseCases(port) }
  }
  const configurationEvents = (store: FixtureStore) => store.read((db) => db.auditEvents.filter((event) => event.kind.startsWith('configuration_')))

  it('creates the baseline once and refuses anyone but an active Administrator', async () => {
    const { port, store } = setup()
    const state = await port.getConfiguration()
    expect(state.current).toMatchObject({ version: 1, kind: 'baseline', createdBy: null })
    expect(state.versions).toHaveLength(1)
    expect(state.draft).toBeNull()
    expect((await port.getConfiguration()).versions).toHaveLength(1)
    expect(configurationEvents(store)).toEqual([])
    const supervisor = setup('USR-003')
    expect((await rejection(supervisor.port.getConfiguration())).kind).toBe('forbidden')
  })

  it('saves a draft, publishes it as a new audited version with a reason, and keeps every version', async () => {
    const { store, useCases } = setup()
    await useCases.getConfiguration()
    const document = edit((item) => void (item.general.organizationName = 'TeaLeaf Estates'))
    await useCases.saveDraft(document, 1)
    expect((await useCases.getConfiguration()).draft?.document.general.organizationName).toBe('TeaLeaf Estates')
    expect((await rejection(useCases.publishDraft(1, '  '))).details?.[0]?.path).toBe('reason')

    const published = await useCases.publishDraft(1, 'Company rename')
    expect(published).toMatchObject({ version: 2, kind: 'publish', reason: 'Company rename', createdBy: { id: 'USR-001', fullName: 'Anika Perera' } })
    const state = await useCases.getConfiguration()
    expect(state.versions.map((version) => version.version)).toEqual([2, 1])
    expect(state.draft).toBeNull()
    expect(configurationEvents(store).map((event) => [event.kind, event.configurationVersion ?? null, event.summary])).toEqual([
      ['configuration_draft_saved', null, '1 change: General Settings'],
      ['configuration_published', 2, '1 change: General Settings'],
    ])
  })

  it('rejects an invalid or stale publish, records the rejection as a failed audit event and keeps the version', async () => {
    const { store, useCases } = setup()
    await useCases.getConfiguration()
    await useCases.saveDraft(edit((item) => void (item.rules.gpsValidation.enabled = true)), 1)
    const invalid = await rejection(useCases.publishDraft(1, 'Turn on GPS rule'))
    expect(invalid.kind).toBe('validation')
    expect(invalid.details?.map((detail) => detail.path)).toEqual(['rules.gpsValidation.maxAccuracyMeters'])
    expect((await rejection(useCases.publishDraft(7, 'Stale'))).kind).toBe('conflict')
    expect((await useCases.getConfiguration()).current.version).toBe(1)
    const rejected = configurationEvents(store).filter((event) => event.kind === 'configuration_publish_rejected')
    expect(rejected.map((event) => [event.reasonCode, event.outcome])).toEqual([
      ['VALIDATION_FAILED', 'failure'],
      ['VERSION_CONFLICT', 'failure'],
    ])
  })

  it('rolls back by creating a new version with the earlier content, never deleting history', async () => {
    const { store, useCases } = setup()
    await useCases.getConfiguration()
    await useCases.saveDraft(edit((item) => void (item.rules.gpsValidation.maxAccuracyMeters = 25)), 1)
    await useCases.publishDraft(1, 'Set GPS limit')
    const restored = await useCases.rollback(1, 2, 'Limit not approved')
    expect(restored).toMatchObject({ version: 3, kind: 'rollback', restoredFrom: 1, reason: 'Limit not approved' })
    const state = await useCases.getConfiguration()
    expect(state.versions.map((version) => version.version)).toEqual([3, 2, 1])
    expect(state.current.document).toEqual(baselineConfiguration())
    expect(ruleHistory(state.versions, 'gpsValidation').map(({ version, changes }) => [version.version, changes.map((change) => `${change.before}→${change.after}`)])).toEqual([
      [3, ['25→Not set']],
      [2, ['Not set→25']],
    ])
    expect((await rejection(useCases.rollback(3, 3, 'Same'))).code).toBe('ROLLBACK_TO_CURRENT')
    expect(configurationEvents(store).at(-1)).toMatchObject({ kind: 'configuration_rolled_back', configurationVersion: 3, summary: 'Restored version 1 · 1 change: Business Rules' })
  })

  it('does not roll back over an open draft, and discards a draft with an audit record', async () => {
    const { store, useCases } = setup()
    await useCases.getConfiguration()
    await useCases.saveDraft(edit((item) => void (item.general.supportEmail = 'help@example.test')), 1)
    await useCases.publishDraft(1, 'Support contact')
    await useCases.saveDraft(edit((item) => void (item.general.supportEmail = 'other@example.test')), 2)
    expect((await rejection(useCases.rollback(1, 2, 'Undo'))).code).toBe('CONFIGURATION_DRAFT_OPEN')
    await useCases.discardDraft(2)
    expect((await useCases.getConfiguration()).draft).toBeNull()
    expect(configurationEvents(store).at(-1)?.kind).toBe('configuration_draft_discarded')
  })

  it('sends nothing in API mode: every operation is contract_pending', async () => {
    const port = createPendingConfigurationAdapter()
    for (const call of [port.getConfiguration(), port.saveDraft({ document: baselineConfiguration(), baseVersion: 1 }), port.publishDraft({ baseVersion: 1, reason: 'x' }), port.rollback({ targetVersion: 1, baseVersion: 2, reason: 'x' })]) {
      expect((await rejection(call)).kind).toBe('contract_pending')
    }
    expect((await rejection(createPendingAuditLogAdapter().listAuditLog())).kind).toBe('contract_pending')
  })
})

describe('audit log', () => {
  it('maps the shared fixture audit records, newest first, with actor, target and recorded values only', () => {
    const store = new FixtureStore({ latencyMs: 0 })
    const entries = store.read((db) => toAuditLogEntries(db))
    expect(entries.map((entry) => entry.id)).toEqual(store.read((db) => [...db.auditEvents].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).map((event) => event.id)))
    const revoked = entries.find((entry) => entry.action === 'device_session_revoked')!
    expect(revoked).toMatchObject({
      actor: { id: 'USR-001', fullName: 'Anika Perera' },
      module: 'Device sessions',
      target: { kind: 'session', id: 'DS-3012', label: 'Device session DS-3012' },
      outcome: 'success',
      reasonCode: 'DEVICE_SESSION_REVOKED',
      previousValue: null,
    })
    expect(entries.find((entry) => entry.action === 'scope_updated')).toMatchObject({ module: 'Access', newValue: 'EST-001, EST-002', target: { kind: 'user', label: 'Dr Tara Wijesinghe' } })
  })

  it('filters by search, date, actor, module, action and outcome', () => {
    const store = new FixtureStore({ latencyMs: 0 })
    const entries = store.read((db) => toAuditLogEntries(db))
    expect(auditFiltersActive(EMPTY_AUDIT_FILTERS)).toBe(false)
    expect(filterAuditLog(entries, EMPTY_AUDIT_FILTERS)).toHaveLength(entries.length)
    expect(filterAuditLog(entries, { ...EMPTY_AUDIT_FILTERS, search: 'ds-3012' }).map((entry) => entry.action)).toEqual(['device_session_revoked'])
    expect(filterAuditLog(entries, { ...EMPTY_AUDIT_FILTERS, from: '2026-10-20', to: '2026-10-20' }).every((entry) => entry.at.startsWith('2026-10-20'))).toBe(true)
    expect(filterAuditLog(entries, { ...EMPTY_AUDIT_FILTERS, module: 'Divisions' }).every((entry) => entry.module === 'Divisions')).toBe(true)
    expect(filterAuditLog(entries, { ...EMPTY_AUDIT_FILTERS, outcome: 'failure' })).toEqual([])
    expect(filterAuditLog(entries, { ...EMPTY_AUDIT_FILTERS, actorId: 'USR-999' })).toEqual([])
    expect(auditActors(entries).map((actor) => actor.id)).toEqual(['USR-001'])
    expect(entries.filter(isSecurityEvent).every((entry) => SECURITY_EVENT_KINDS.includes(entry.action))).toBe(true)
  })

  it('lets only an active Administrator read the audit log', async () => {
    const store = new FixtureStore({ latencyMs: 0 })
    expect((await createFixtureAuditLogAdapter(store, { actorId: () => 'USR-001' }).listAuditLog()).length).toBeGreaterThan(0)
    expect((await rejection(createFixtureAuditLogAdapter(store, { actorId: () => 'USR-003' }).listAuditLog())).kind).toBe('forbidden')
    expect((await rejection(createFixtureAuditLogAdapter(store, { actorId: () => null }).listAuditLog())).kind).toBe('forbidden')
  })
})
