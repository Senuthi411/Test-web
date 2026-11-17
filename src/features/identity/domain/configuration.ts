import type { PersonRef } from './models'
import type { PreferredLanguage } from './userFields'

/**
 * System configuration (ID-19 System Settings): one versioned document made of general
 * settings, feature availability, predefined business-rule templates, workflow parameters
 * and a maintenance notice.
 *
 * CONFIGURATION ONLY. Nothing in the frontend evaluates a rule, enables a feature or
 * changes a workflow. The backend has no configuration, rule-evaluation or maintenance
 * contract yet (docs/api-integration/pending-contracts.md); in fixture mode a published
 * version is stored in this browser tab only. There is no free-form rule, script or query
 * input: every rule is a predefined template with validated parameters.
 */

// ---------------------------------------------------------------------------------------
// General settings
// ---------------------------------------------------------------------------------------

export type ConfigurationTimeZone = 'Asia/Colombo' | 'UTC'
export type ConfigurationDateFormat = 'DD MMM YYYY' | 'YYYY-MM-DD' | 'DD/MM/YYYY'

export const TIME_ZONE_OPTIONS: ReadonlyArray<{ value: ConfigurationTimeZone; label: string }> = [
  { value: 'Asia/Colombo', label: 'Asia/Colombo (UTC+05:30)' },
  { value: 'UTC', label: 'UTC' },
]

export const DATE_FORMAT_OPTIONS: ReadonlyArray<{ value: ConfigurationDateFormat; label: string }> = [
  { value: 'DD MMM YYYY', label: '21 Oct 2026' },
  { value: 'YYYY-MM-DD', label: '2026-10-21' },
  { value: 'DD/MM/YYYY', label: '21/10/2026' },
]

export interface GeneralSettings {
  organizationName: string
  timeZone: ConfigurationTimeZone
  dateFormat: ConfigurationDateFormat
  defaultLanguage: PreferredLanguage
  /** Shown to employees who need help signing in. Empty when not set. */
  supportEmail: string
}

// ---------------------------------------------------------------------------------------
// Feature Center
// ---------------------------------------------------------------------------------------

export type FeatureKey = 'gpsValidation' | 'offlineMode' | 'imageUpload' | 'notifications'

export interface FeatureDefinition {
  key: FeatureKey
  label: string
  description: string
  /** Protected features cannot be switched off from this screen. */
  protected: boolean
  protectionReason?: string
}

export const FEATURE_DEFINITIONS: readonly FeatureDefinition[] = [
  {
    key: 'gpsValidation',
    label: 'GPS Validation',
    description: 'Every observation records its GPS position and accuracy so reviewers can check where it was captured.',
    protected: true,
    protectionReason: 'Required for evidence integrity: observations without a position cannot be reviewed.',
  },
  {
    key: 'offlineMode',
    label: 'Offline Mode',
    description: 'Field Workers capture observations without a connection; the mobile app syncs them later.',
    protected: true,
    protectionReason: 'Required in estates without coverage. Controlled by the mobile app release, not by this screen.',
  },
  {
    key: 'imageUpload',
    label: 'Image Upload',
    description: 'Observations carry leaf photographs as evidence for review and diagnosis.',
    protected: true,
    protectionReason: 'Required for evidence integrity: review and diagnosis depend on the photographs.',
  },
  {
    key: 'notifications',
    label: 'Notifications',
    description: 'In-app and e-mail notifications that business rules can send (for example review reminders).',
    protected: false,
  },
]

export type FeatureSettings = Record<FeatureKey, boolean>

// ---------------------------------------------------------------------------------------
// Business rules (predefined templates only)
// ---------------------------------------------------------------------------------------

export type RuleKey = 'highSeverityNotification' | 'gpsValidation' | 'pendingReviewReminder'

export type NotifiableRole = 'SUPERVISOR' | 'DISEASE_EXPERT'

export const NOTIFIABLE_ROLE_LABELS: Record<NotifiableRole, string> = { SUPERVISOR: 'Supervisor', DISEASE_EXPERT: 'Disease expert' }

export type GpsRuleAction = 'flag_for_review' | 'show_warning'

export const GPS_RULE_ACTION_LABELS: Record<GpsRuleAction, string> = {
  flag_for_review: 'Flag the observation for supervisor review',
  show_warning: 'Show a warning in the review checklist',
}

export interface HighSeverityNotificationRule {
  enabled: boolean
  notifyRoles: NotifiableRole[]
}

export interface GpsValidationRule {
  enabled: boolean
  /** Worst acceptable accuracy in metres. Null: not set (no approved value exists). */
  maxAccuracyMeters: number | null
  action: GpsRuleAction
}

export interface PendingReviewReminderRule {
  enabled: boolean
  /** Hours an observation may wait for review before a reminder. Null: not set. */
  thresholdHours: number | null
  notifyRoles: NotifiableRole[]
}

export interface BusinessRules {
  highSeverityNotification: HighSeverityNotificationRule
  gpsValidation: GpsValidationRule
  pendingReviewReminder: PendingReviewReminderRule
}

export interface RuleTemplate {
  key: RuleKey
  /** "Rule A", "Rule B", "Rule C". */
  code: string
  name: string
  description: string
  /** Blocked templates cannot be enabled until the data they depend on exists. */
  availability: 'available' | 'blocked'
  blockedReason?: string
}

export const RULE_TEMPLATES: readonly RuleTemplate[] = [
  {
    key: 'highSeverityNotification',
    code: 'Rule A',
    name: 'High Severity Notification',
    description: 'Notify the chosen roles when an observation is recorded with high severity.',
    availability: 'blocked',
    blockedReason: 'Observations have no severity field yet. The rule can be enabled once the observation severity contract is approved.',
  },
  {
    key: 'gpsValidation',
    code: 'Rule B',
    name: 'GPS Validation',
    description: 'Act on observations whose GPS accuracy is worse than the configured limit.',
    availability: 'available',
  },
  {
    key: 'pendingReviewReminder',
    code: 'Rule C',
    name: 'Pending Review Reminder',
    description: 'Remind the chosen roles when an observation has waited for review longer than the configured time.',
    availability: 'available',
  },
]

export const GPS_ACCURACY_LIMITS = { min: 1, max: 100 } as const
export const REMINDER_HOURS_LIMITS = { min: 1, max: 336 } as const

/** One plain-language sentence describing what the rule would do with these parameters. */
export function describeRule(key: RuleKey, rules: BusinessRules): string {
  switch (key) {
    case 'highSeverityNotification': {
      const roles = rolesText(rules.highSeverityNotification.notifyRoles)
      return `When an observation is recorded with high severity, notify ${roles}.`
    }
    case 'gpsValidation': {
      const rule = rules.gpsValidation
      const limit = rule.maxAccuracyMeters === null ? 'the limit (not set)' : `±${rule.maxAccuracyMeters} m`
      return `When an observation's GPS accuracy is worse than ${limit}: ${GPS_RULE_ACTION_LABELS[rule.action].toLowerCase()}.`
    }
    case 'pendingReviewReminder': {
      const rule = rules.pendingReviewReminder
      const wait = rule.thresholdHours === null ? 'the threshold (not set)' : `${rule.thresholdHours} ${rule.thresholdHours === 1 ? 'hour' : 'hours'}`
      return `When an observation has waited for review longer than ${wait}, remind ${rolesText(rule.notifyRoles)}.`
    }
  }
}

function rolesText(roles: readonly NotifiableRole[]): string {
  if (roles.length === 0) return 'no one (choose at least one role)'
  return roles.map((role) => NOTIFIABLE_ROLE_LABELS[role]).join(' and ')
}

// ---------------------------------------------------------------------------------------
// Workflow configuration (predefined templates, protected state machines)
// ---------------------------------------------------------------------------------------

export type WorkflowKey = 'observationReview' | 'correction' | 'expertReferral'

export interface WorkflowTemplate {
  key: WorkflowKey
  name: string
  description: string
  /** The protected state machine, in order. It is shown, never edited. */
  states: readonly string[]
  /** What the single parameter measures. */
  parameterLabel: string
  limits: { min: number; max: number }
}

export const WORKFLOW_TEMPLATES: readonly WorkflowTemplate[] = [
  {
    key: 'observationReview',
    name: 'Observation review',
    description: 'Supervisors verify, flag, refer or request corrections to submitted observations.',
    states: ['Submitted', 'In review', 'Verified', 'Flagged', 'Correction requested', 'Referred'],
    parameterLabel: 'Review target (hours)',
    limits: { min: 1, max: 336 },
  },
  {
    key: 'correction',
    name: 'Correction',
    description: 'A correction is requested, resubmitted by the Field Worker and approved or rejected.',
    states: ['Requested', 'Resubmitted', 'Approved', 'Applied', 'Rejected'],
    parameterLabel: 'Correction target (hours)',
    limits: { min: 1, max: 336 },
  },
  {
    key: 'expertReferral',
    name: 'Expert referral',
    description: 'A referred observation is linked to a case and diagnosed by a Disease Expert.',
    states: ['Pending case link', 'Linked', 'Awaiting diagnosis', 'Diagnosed'],
    parameterLabel: 'Diagnosis target (hours)',
    limits: { min: 1, max: 720 },
  },
]

/** Target times for reporting. Null: not set (no approved value exists). */
export type WorkflowSettings = Record<WorkflowKey, { targetHours: number | null }>

// ---------------------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------------------

/**
 * A planned maintenance notice. Maintenance mode itself is never switched on from the
 * frontend: there is no maintenance contract, so the document holds only the notice.
 */
export interface MaintenanceSettings {
  noticeMessage: string
  /** Local date-time (`YYYY-MM-DDTHH:mm`) or empty when not planned. */
  plannedStart: string
  plannedEnd: string
}

export const MAINTENANCE_MESSAGE_MAX = 280

// ---------------------------------------------------------------------------------------
// The document, versions and drafts
// ---------------------------------------------------------------------------------------

export interface ConfigurationDocument {
  general: GeneralSettings
  features: FeatureSettings
  rules: BusinessRules
  workflows: WorkflowSettings
  maintenance: MaintenanceSettings
}

export type ConfigurationSection = keyof ConfigurationDocument

export const CONFIGURATION_SECTION_LABELS: Record<ConfigurationSection, string> = {
  general: 'General Settings',
  features: 'Feature Center',
  rules: 'Business Rules',
  workflows: 'Workflow Configuration',
  maintenance: 'Maintenance Mode',
}

export interface ConfigurationVersion {
  version: number
  document: ConfigurationDocument
  createdAt: string
  /** Null for the baseline, which no one published. */
  createdBy: PersonRef | null
  kind: 'baseline' | 'publish' | 'rollback'
  reason: string
  /** For a rollback: the version whose content was restored. */
  restoredFrom?: number
}

export interface ConfigurationDraft {
  document: ConfigurationDocument
  /** The published version the draft was started from. */
  baseVersion: number
  savedAt: string
  savedBy: PersonRef | null
}

export interface ConfigurationState {
  /** The version in effect (the newest). */
  current: ConfigurationVersion
  /** Every version, newest first. Versions are never deleted. */
  versions: ConfigurationVersion[]
  draft: ConfigurationDraft | null
}

/**
 * The baseline: protected features on, every rule off and every value without an approved
 * source left unset (no GPS limit, no reminder threshold, no workflow targets).
 */
export function baselineConfiguration(): ConfigurationDocument {
  return {
    general: { organizationName: 'TeaLeaf Field Scout', timeZone: 'Asia/Colombo', dateFormat: 'DD MMM YYYY', defaultLanguage: 'en', supportEmail: '' },
    features: { gpsValidation: true, offlineMode: true, imageUpload: true, notifications: false },
    rules: {
      highSeverityNotification: { enabled: false, notifyRoles: ['SUPERVISOR'] },
      gpsValidation: { enabled: false, maxAccuracyMeters: null, action: 'flag_for_review' },
      pendingReviewReminder: { enabled: false, thresholdHours: null, notifyRoles: ['SUPERVISOR'] },
    },
    workflows: { observationReview: { targetHours: null }, correction: { targetHours: null }, expertReferral: { targetHours: null } },
    maintenance: { noticeMessage: '', plannedStart: '', plannedEnd: '' },
  }
}

// ---------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------

export interface ConfigurationIssue {
  /** Dotted path, e.g. `rules.gpsValidation.maxAccuracyMeters`. */
  path: string
  section: ConfigurationSection
  message: string
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const isWhole = (value: number) => Number.isInteger(value)

function rangeIssue(value: number | null, limits: { min: number; max: number }, unit: string): string | null {
  if (value === null) return null
  if (!Number.isFinite(value) || !isWhole(value)) return `Enter a whole number of ${unit}`
  if (value < limits.min || value > limits.max) return `Enter a value from ${limits.min} to ${limits.max} ${unit}`
  return null
}

/** Every problem that blocks publishing. An empty list means the document can be published. */
export function validateConfiguration(document: ConfigurationDocument): ConfigurationIssue[] {
  const issues: ConfigurationIssue[] = []
  const add = (path: string, message: string | null) => {
    if (message) issues.push({ path, section: path.split('.')[0] as ConfigurationSection, message })
  }

  const { general, features, rules, workflows, maintenance } = document
  const name = general.organizationName.trim()
  add('general.organizationName', name.length < 2 ? 'Enter the organization name' : name.length > 80 ? 'Use 80 characters or fewer' : null)
  add('general.supportEmail', general.supportEmail.trim() && !EMAIL.test(general.supportEmail.trim()) ? 'Enter a valid e-mail address' : null)

  for (const feature of FEATURE_DEFINITIONS) {
    if (feature.protected && !features[feature.key]) add(`features.${feature.key}`, `${feature.label} is protected and cannot be switched off`)
  }

  for (const template of RULE_TEMPLATES) {
    if (template.availability === 'blocked' && rules[template.key].enabled) add(`rules.${template.key}.enabled`, `${template.name} cannot be enabled: ${template.blockedReason}`)
  }
  const gps = rules.gpsValidation
  add('rules.gpsValidation.maxAccuracyMeters', rangeIssue(gps.maxAccuracyMeters, GPS_ACCURACY_LIMITS, 'metres'))
  if (gps.enabled) {
    if (gps.maxAccuracyMeters === null) add('rules.gpsValidation.maxAccuracyMeters', 'Set the accuracy limit before enabling the rule')
    if (!features.gpsValidation) add('rules.gpsValidation.enabled', 'GPS Validation must be on in the Feature Center')
  }
  const reminder = rules.pendingReviewReminder
  add('rules.pendingReviewReminder.thresholdHours', rangeIssue(reminder.thresholdHours, REMINDER_HOURS_LIMITS, 'hours'))
  if (reminder.enabled) {
    if (reminder.thresholdHours === null) add('rules.pendingReviewReminder.thresholdHours', 'Set the reminder threshold before enabling the rule')
    if (reminder.notifyRoles.length === 0) add('rules.pendingReviewReminder.notifyRoles', 'Choose at least one role to remind')
    if (!features.notifications) add('rules.pendingReviewReminder.enabled', 'Turn on Notifications in the Feature Center to send reminders')
  }

  for (const template of WORKFLOW_TEMPLATES) {
    add(`workflows.${template.key}.targetHours`, rangeIssue(workflows[template.key].targetHours, template.limits, 'hours'))
  }

  const message = maintenance.noticeMessage.trim()
  add('maintenance.noticeMessage', message.length > MAINTENANCE_MESSAGE_MAX ? `Use ${MAINTENANCE_MESSAGE_MAX} characters or fewer` : null)
  const start = maintenance.plannedStart
  const end = maintenance.plannedEnd
  if (start || end) {
    add('maintenance.plannedStart', start ? null : 'Enter the planned start')
    add('maintenance.plannedEnd', end ? (start && end <= start ? 'The end must be after the start' : null) : 'Enter the planned end')
    add('maintenance.noticeMessage', message ? null : 'Enter the notice employees will see')
  }
  return issues
}

/** The first issue for a field, for inline errors. */
export function issueFor(issues: readonly ConfigurationIssue[], path: string): string | undefined {
  return issues.find((issue) => issue.path === path)?.message
}

// ---------------------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------------------

export interface ConfigurationChange {
  path: string
  section: ConfigurationSection
  label: string
  before: string
  after: string
}

const FIELD_LABELS: Record<string, string> = {
  'general.organizationName': 'Organization name',
  'general.timeZone': 'Time zone',
  'general.dateFormat': 'Date format',
  'general.defaultLanguage': 'Default language',
  'general.supportEmail': 'Support e-mail',
  'rules.highSeverityNotification.enabled': 'Rule A · enabled',
  'rules.highSeverityNotification.notifyRoles': 'Rule A · notify',
  'rules.gpsValidation.enabled': 'Rule B · enabled',
  'rules.gpsValidation.maxAccuracyMeters': 'Rule B · accuracy limit (m)',
  'rules.gpsValidation.action': 'Rule B · action',
  'rules.pendingReviewReminder.enabled': 'Rule C · enabled',
  'rules.pendingReviewReminder.thresholdHours': 'Rule C · threshold (hours)',
  'rules.pendingReviewReminder.notifyRoles': 'Rule C · notify',
  'maintenance.noticeMessage': 'Maintenance notice',
  'maintenance.plannedStart': 'Planned start',
  'maintenance.plannedEnd': 'Planned end',
}

function labelFor(path: string): string {
  if (FIELD_LABELS[path]) return FIELD_LABELS[path]
  const [section, key] = path.split('.')
  if (section === 'features') return FEATURE_DEFINITIONS.find((feature) => feature.key === key)?.label ?? path
  if (section === 'workflows') return WORKFLOW_TEMPLATES.find((workflow) => workflow.key === key)?.parameterLabel ?? path
  return path
}

function formatValue(path: string, value: unknown): string {
  if (value === null || value === '') return 'Not set'
  if (typeof value === 'boolean') return path.startsWith('features.') ? (value ? 'On' : 'Off') : value ? 'Enabled' : 'Disabled'
  if (Array.isArray(value)) return value.length === 0 ? 'None' : value.map((item) => NOTIFIABLE_ROLE_LABELS[item as NotifiableRole] ?? String(item)).join(', ')
  if (path === 'rules.gpsValidation.action') return GPS_RULE_ACTION_LABELS[value as GpsRuleAction] ?? String(value)
  return String(value)
}

function leaves(value: unknown, prefix: string, out: Map<string, unknown>): Map<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) leaves(child, prefix ? `${prefix}.${key}` : key, out)
  } else {
    out.set(prefix, value)
  }
  return out
}

/** Field-by-field differences from `before` to `after`, in document order. */
export function diffConfiguration(before: ConfigurationDocument, after: ConfigurationDocument): ConfigurationChange[] {
  const a = leaves(before, '', new Map())
  const b = leaves(after, '', new Map())
  const paths = [...new Set([...a.keys(), ...b.keys()])]
  return paths
    .filter((path) => JSON.stringify(a.get(path)) !== JSON.stringify(b.get(path)))
    .map((path) => ({
      path,
      section: path.split('.')[0] as ConfigurationSection,
      label: labelFor(path),
      before: formatValue(path, a.get(path)),
      after: formatValue(path, b.get(path)),
    }))
}

/** "3 changes: General Settings, Business Rules", for audit records and confirmations. */
export function summarizeChanges(changes: readonly ConfigurationChange[]): string {
  if (changes.length === 0) return 'No changes'
  const sections = [...new Set(changes.map((change) => CONFIGURATION_SECTION_LABELS[change.section]))]
  return `${changes.length} ${changes.length === 1 ? 'change' : 'changes'}: ${sections.join(', ')}`
}

/** Rule history: the versions in which a rule's settings changed, newest first. */
export function ruleHistory(versions: readonly ConfigurationVersion[], key: RuleKey): Array<{ version: ConfigurationVersion; changes: ConfigurationChange[] }> {
  const ordered = [...versions].sort((a, b) => a.version - b.version)
  const result: Array<{ version: ConfigurationVersion; changes: ConfigurationChange[] }> = []
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]
    const current = ordered[index]
    if (!previous || !current) continue
    const changes = diffConfiguration(previous.document, current.document).filter((change) => change.path.startsWith(`rules.${key}.`))
    if (changes.length > 0) result.push({ version: current, changes })
  }
  return result.reverse()
}

/** Enabled rules in a document (for the dashboard's configuration summary). */
export function enabledRuleCount(document: ConfigurationDocument): number {
  return RULE_TEMPLATES.filter((template) => document.rules[template.key].enabled).length
}
