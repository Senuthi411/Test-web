import { Badge, Banner, Button, Card, Checkbox, SelectField, TextAreaField, TextField, Toggle } from '@/shared/components'
import { formatDateTime } from '@/shared/utilities/format'
import { PREFERRED_LANGUAGES, type PreferredLanguage } from '../../../../domain/userFields'
import {
  DATE_FORMAT_OPTIONS,
  FEATURE_DEFINITIONS,
  GPS_ACCURACY_LIMITS,
  GPS_RULE_ACTION_LABELS,
  MAINTENANCE_MESSAGE_MAX,
  NOTIFIABLE_ROLE_LABELS,
  REMINDER_HOURS_LIMITS,
  RULE_TEMPLATES,
  TIME_ZONE_OPTIONS,
  WORKFLOW_TEMPLATES,
  describeRule,
  issueFor,
  ruleHistory,
  type ConfigurationDateFormat,
  type ConfigurationDocument,
  type ConfigurationIssue,
  type ConfigurationTimeZone,
  type ConfigurationVersion,
  type GpsRuleAction,
  type NotifiableRole,
  type RuleTemplate,
} from '../../../../domain/configuration'
import styles from '../../../components/identity.module.css'
import settingsStyles from './SystemSettings.module.css'

export interface SectionProps {
  document: ConfigurationDocument
  onChange: (update: (document: ConfigurationDocument) => ConfigurationDocument) => void
  issues: readonly ConfigurationIssue[]
}

/** Empty input → null (not set); anything else is kept as a number for validation. */
const toNumber = (value: string): number | null => (value.trim() === '' ? null : Number(value))
const numberText = (value: number | null) => (value === null ? '' : String(value))

// ---------------------------------------------------------------------------------------
// General Settings
// ---------------------------------------------------------------------------------------

export function GeneralSection({ document, onChange, issues }: SectionProps) {
  const general = document.general
  const set = <K extends keyof typeof general>(key: K, value: (typeof general)[K]) => onChange((current) => ({ ...current, general: { ...current.general, [key]: value } }))
  return (
    <Card title="General settings" aria-label="General settings">
      <div className={settingsStyles.formGrid}>
        <TextField label="Organization name" required value={general.organizationName} error={issueFor(issues, 'general.organizationName')} onChange={(event) => set('organizationName', event.target.value)} />
        <TextField
          label="Support e-mail"
          type="email"
          value={general.supportEmail}
          hint="Shown to employees who need help signing in. Leave empty if not used."
          error={issueFor(issues, 'general.supportEmail')}
          onChange={(event) => set('supportEmail', event.target.value)}
        />
        <SelectField label="Time zone" value={general.timeZone} options={TIME_ZONE_OPTIONS} onChange={(event) => set('timeZone', event.target.value as ConfigurationTimeZone)} />
        <SelectField label="Date format" value={general.dateFormat} options={DATE_FORMAT_OPTIONS} onChange={(event) => set('dateFormat', event.target.value as ConfigurationDateFormat)} />
        <SelectField
          label="Default language"
          value={general.defaultLanguage}
          options={PREFERRED_LANGUAGES}
          hint="Used for new accounts until the employee chooses a language."
          onChange={(event) => set('defaultLanguage', event.target.value as PreferredLanguage)}
        />
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------------------
// Feature Center
// ---------------------------------------------------------------------------------------

export function FeatureCenterSection({ document, onChange, issues }: SectionProps) {
  return (
    <Card title="Feature Center" aria-label="Feature Center">
      <ul className={settingsStyles.featureList}>
        {FEATURE_DEFINITIONS.map((feature) => {
          const on = document.features[feature.key]
          const error = issueFor(issues, `features.${feature.key}`)
          return (
            <li key={feature.key} className={settingsStyles.featureItem}>
              <div>
                <p className={settingsStyles.featureName}>
                  {feature.label}
                  <Badge tone={on ? 'success' : 'neutral'} dot={false}>
                    {on ? 'On' : 'Off'}
                  </Badge>
                  {feature.protected && (
                    <Badge tone="info" dot={false}>
                      Protected · read-only
                    </Badge>
                  )}
                </p>
                <p className={styles.muted}>{feature.description}</p>
                {feature.protectionReason && <p className={styles.caption}>{feature.protectionReason}</p>}
                {error && <p className={styles.fieldError}>{error}</p>}
              </div>
              <Toggle
                label={`${feature.label} ${on ? 'on' : 'off'}`}
                checked={on}
                disabled={feature.protected}
                onChange={(event) => onChange((current) => ({ ...current, features: { ...current.features, [feature.key]: event.target.checked } }))}
              />
            </li>
          )
        })}
      </ul>
      <p className={styles.caption}>
        Feature availability is configuration only. The mobile app and backend do not read it until the configuration contract is implemented.
      </p>
    </Card>
  )
}

// ---------------------------------------------------------------------------------------
// Business Rules
// ---------------------------------------------------------------------------------------

function RoleChoices({ legend, roles, disabled, error, onChange }: { legend: string; roles: readonly NotifiableRole[]; disabled?: boolean; error?: string; onChange: (roles: NotifiableRole[]) => void }) {
  return (
    <fieldset className={settingsStyles.roleChoices} disabled={disabled}>
      <legend>{legend}</legend>
      {(Object.keys(NOTIFIABLE_ROLE_LABELS) as NotifiableRole[]).map((role) => (
        <Checkbox
          key={role}
          label={NOTIFIABLE_ROLE_LABELS[role]}
          checked={roles.includes(role)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked ? [...roles, role] : roles.filter((item) => item !== role))}
        />
      ))}
      {error && <p className={styles.fieldError}>{error}</p>}
    </fieldset>
  )
}

export function BusinessRulesSection({ document, onChange, issues, versions }: SectionProps & { versions: readonly ConfigurationVersion[] }) {
  return (
    <>
      <Banner tone="info" title="Predefined rule templates">
        Rules are configured from fixed templates with validated parameters. Custom rules, scripts and queries are not supported. Rules are not
        evaluated in production until the backend rule-evaluation and event integration exist.
      </Banner>
      {RULE_TEMPLATES.map((template) => (
        <RuleCard key={template.key} template={template} document={document} onChange={onChange} issues={issues} versions={versions} />
      ))}
    </>
  )
}

function RuleCard({ template, document, onChange, issues, versions }: SectionProps & { template: RuleTemplate; versions: readonly ConfigurationVersion[] }) {
  const rule = document.rules[template.key]
  const blocked = template.availability === 'blocked'
  const history = ruleHistory(versions, template.key)
  const title = `${template.code} · ${template.name}`
  const setRule = (patch: Record<string, unknown>) =>
    onChange((current) => ({ ...current, rules: { ...current.rules, [template.key]: { ...current.rules[template.key], ...patch } } }))
  const status = blocked ? { tone: 'warning' as const, label: 'Blocked' } : rule.enabled ? { tone: 'success' as const, label: 'Enabled in draft' } : { tone: 'neutral' as const, label: 'Disabled' }

  return (
    <Card
      title={title}
      aria-label={title}
      action={
        <Badge tone={status.tone} dot={false}>
          {status.label}
        </Badge>
      }
    >
      <p className={styles.muted}>{template.description}</p>
      {blocked && (
        <Banner tone="warning" title="Backend integration pending">
          {template.blockedReason}
        </Banner>
      )}
      <Toggle
        label="Enable rule"
        description={blocked ? 'Not available for this template yet.' : 'Takes effect only when published, and only once the backend evaluates rules.'}
        checked={rule.enabled}
        disabled={blocked}
        onChange={(event) => setRule({ enabled: event.target.checked })}
      />
      {issueFor(issues, `rules.${template.key}.enabled`) && <p className={styles.fieldError}>{issueFor(issues, `rules.${template.key}.enabled`)}</p>}

      <div className={settingsStyles.ruleGrid}>
        {template.key === 'highSeverityNotification' && (
          <RoleChoices
            legend="Notify"
            roles={document.rules.highSeverityNotification.notifyRoles}
            disabled
            onChange={(notifyRoles) => setRule({ notifyRoles })}
          />
        )}
        {template.key === 'gpsValidation' && (
          <>
            <TextField
              label="Accuracy limit (metres)"
              type="number"
              inputMode="numeric"
              min={GPS_ACCURACY_LIMITS.min}
              max={GPS_ACCURACY_LIMITS.max}
              step={1}
              value={numberText(document.rules.gpsValidation.maxAccuracyMeters)}
              hint={`No approved limit exists, so none is pre-filled. ${GPS_ACCURACY_LIMITS.min}–${GPS_ACCURACY_LIMITS.max} m.`}
              error={issueFor(issues, 'rules.gpsValidation.maxAccuracyMeters')}
              onChange={(event) => setRule({ maxAccuracyMeters: toNumber(event.target.value) })}
            />
            <SelectField
              label="Action"
              value={document.rules.gpsValidation.action}
              options={(Object.keys(GPS_RULE_ACTION_LABELS) as GpsRuleAction[]).map((value) => ({ value, label: GPS_RULE_ACTION_LABELS[value] }))}
              onChange={(event) => setRule({ action: event.target.value as GpsRuleAction })}
            />
          </>
        )}
        {template.key === 'pendingReviewReminder' && (
          <>
            <TextField
              label="Reminder threshold (hours)"
              type="number"
              inputMode="numeric"
              min={REMINDER_HOURS_LIMITS.min}
              max={REMINDER_HOURS_LIMITS.max}
              step={1}
              value={numberText(document.rules.pendingReviewReminder.thresholdHours)}
              hint={`A 48-hour default has been proposed but not approved, so no value is pre-filled. ${REMINDER_HOURS_LIMITS.min}–${REMINDER_HOURS_LIMITS.max} hours.`}
              error={issueFor(issues, 'rules.pendingReviewReminder.thresholdHours')}
              onChange={(event) => setRule({ thresholdHours: toNumber(event.target.value) })}
            />
            <RoleChoices
              legend="Remind"
              roles={document.rules.pendingReviewReminder.notifyRoles}
              error={issueFor(issues, 'rules.pendingReviewReminder.notifyRoles')}
              onChange={(notifyRoles) => setRule({ notifyRoles })}
            />
          </>
        )}
      </div>

      <div className={styles.stackTight}>
        <p className={styles.sectionTitle}>Preview</p>
        <p className={settingsStyles.preview} aria-label={`Preview of ${template.code}`}>
          {describeRule(template.key, document.rules)}
        </p>
      </div>

      <div className={styles.stackTight}>
        <p className={styles.sectionTitle}>History</p>
        {history.length === 0 ? (
          <p className={styles.caption}>No published changes to this rule yet.</p>
        ) : (
          <ul className={settingsStyles.historyList} aria-label={`History of ${template.code}`}>
            {history.map(({ version, changes }) => (
              <li key={version.version} className={styles.caption}>
                <strong>Version {version.version}</strong> · {formatDateTime(version.createdAt)} · {version.createdBy?.fullName ?? 'System'}:{' '}
                {changes.map((change) => `${change.label} ${change.before} → ${change.after}`).join('; ')}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------------------
// Workflow Configuration
// ---------------------------------------------------------------------------------------

export function WorkflowSection({ document, onChange, issues }: SectionProps) {
  return (
    <>
      <Banner tone="info" title="Protected state machines">
        Workflows are predefined. Their states and transitions are enforced by the backend and cannot be changed here; only the reporting targets
        below can be set.
      </Banner>
      {WORKFLOW_TEMPLATES.map((workflow) => (
        <Card
          key={workflow.key}
          title={workflow.name}
          aria-label={`${workflow.name} workflow`}
          action={
            <Badge tone="info" dot={false}>
              Protected
            </Badge>
          }
        >
          <p className={styles.muted}>{workflow.description}</p>
          <ol className={settingsStyles.states} aria-label={`${workflow.name} states`}>
            {workflow.states.map((state) => (
              <li key={state}>
                <Badge tone="neutral" dot={false}>
                  {state}
                </Badge>
              </li>
            ))}
          </ol>
          <div className={settingsStyles.formGrid}>
            <TextField
              label={workflow.parameterLabel}
              type="number"
              inputMode="numeric"
              min={workflow.limits.min}
              max={workflow.limits.max}
              step={1}
              value={numberText(document.workflows[workflow.key].targetHours)}
              hint={`Reporting target only; it does not change the workflow. No approved value exists. ${workflow.limits.min}–${workflow.limits.max} hours.`}
              error={issueFor(issues, `workflows.${workflow.key}.targetHours`)}
              onChange={(event) =>
                onChange((current) => ({ ...current, workflows: { ...current.workflows, [workflow.key]: { targetHours: toNumber(event.target.value) } } }))
              }
            />
          </div>
        </Card>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------------------
// Maintenance Mode
// ---------------------------------------------------------------------------------------

export function MaintenanceSection({ document, onChange, issues }: SectionProps) {
  const maintenance = document.maintenance
  const set = <K extends keyof typeof maintenance>(key: K, value: string) => onChange((current) => ({ ...current, maintenance: { ...current.maintenance, [key]: value } }))
  return (
    <>
      <Card
        title="Maintenance mode"
        aria-label="Maintenance mode"
        action={
          <Badge tone="neutral" dot={false}>
            Off
          </Badge>
        }
      >
        <p className={styles.muted}>
          Maintenance mode would stop sign-in and synchronization while the system is serviced. It is off and cannot be switched on from this
          screen: there is no backend maintenance contract, so turning it on here would not take effect.
        </p>
        <div>
          <Button variant="secondary" icon="lock" disabled aria-describedby="maintenance-activation-note">
            Activate maintenance mode
          </Button>
        </div>
        <p id="maintenance-activation-note" className={styles.caption}>
          Not available: activation needs the backend maintenance contract and enforcement.
        </p>
      </Card>
      <Card title="Planned maintenance notice" aria-label="Planned maintenance notice">
        <TextAreaField
          label="Notice for employees"
          value={maintenance.noticeMessage}
          maxLength={MAINTENANCE_MESSAGE_MAX + 20}
          hint={`${maintenance.noticeMessage.length} of ${MAINTENANCE_MESSAGE_MAX} characters. Saved with the configuration; not shown to employees until notices are supported by the backend.`}
          error={issueFor(issues, 'maintenance.noticeMessage')}
          onChange={(event) => set('noticeMessage', event.target.value)}
        />
        <div className={settingsStyles.formGrid}>
          <TextField label="Planned start" type="datetime-local" value={maintenance.plannedStart} error={issueFor(issues, 'maintenance.plannedStart')} onChange={(event) => set('plannedStart', event.target.value)} />
          <TextField label="Planned end" type="datetime-local" value={maintenance.plannedEnd} error={issueFor(issues, 'maintenance.plannedEnd')} onChange={(event) => set('plannedEnd', event.target.value)} />
        </div>
      </Card>
    </>
  )
}
