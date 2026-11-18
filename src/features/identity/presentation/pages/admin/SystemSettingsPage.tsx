import { useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  Banner,
  Button,
  Card,
  ConfirmDialog,
  Modal,
  PageHeader,
  Tabs,
  TextAreaField,
  tabPanelProps,
  usePageBreadcrumbs,
  useToast,
  type TabItem,
} from '@/shared/components'
import { formatDateTime } from '@/shared/utilities/format'
import {
  CONFIGURATION_SECTION_LABELS,
  diffConfiguration,
  summarizeChanges,
  validateConfiguration,
  type ConfigurationDocument,
  type ConfigurationSection,
  type ConfigurationState,
} from '../../../domain/configuration'
import { errorMessage, fieldErrorsOf, useDemoWording } from '../../components/helpers'
import { useConfiguration, useDiscardConfigurationDraft, usePublishConfiguration, useSaveConfigurationDraft } from '../../services/queries'
import styles from '../../components/identity.module.css'
import { SectionBoundary } from './dashboard/SectionBoundary'
import { ConfigurationChanges } from './settings/ConfigurationChanges'
import { ConfigurationHistoryTab } from './settings/ConfigurationHistoryTab'
import { BusinessRulesSection, FeatureCenterSection, GeneralSection, MaintenanceSection, WorkflowSection } from './settings/SettingsSections'
import settingsStyles from './settings/SystemSettings.module.css'

type SettingsTab = 'general' | 'features' | 'rules' | 'workflows' | 'maintenance' | 'history'

const SETTINGS_TABS: readonly TabItem<SettingsTab>[] = [
  { id: 'general', label: 'General Settings' },
  { id: 'features', label: 'Feature Center' },
  { id: 'rules', label: 'Business Rules' },
  { id: 'workflows', label: 'Workflow Configuration' },
  { id: 'maintenance', label: 'Maintenance Mode' },
  { id: 'history', label: 'Configuration History' },
]

const isSettingsTab = (value: string | null): value is SettingsTab => SETTINGS_TABS.some((tab) => tab.id === value)

const same = (a: ConfigurationDocument, b: ConfigurationDocument) => JSON.stringify(a) === JSON.stringify(b)

/**
 * ID-19 System Settings: one versioned configuration, edited as a draft, validated,
 * previewed and published with a reason. Publishing and rollback each create a new
 * audited version. Nothing here evaluates a rule or switches a feature; in API mode the
 * configuration contract is pending, so nothing can be saved or published.
 */
export function SystemSettingsPage() {
  usePageBreadcrumbs([{ label: 'Administration', to: '/admin' }, { label: 'System Settings' }])
  const { demo } = useDemoWording()
  const configuration = useConfiguration()
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab: SettingsTab = isSettingsTab(requested) ? requested : 'general'

  return (
    <div className={styles.page}>
      <PageHeader
        title="System Settings"
        subtitle={`General settings, feature availability, business rule templates, workflow parameters, maintenance and configuration history.${demo ? ' Demonstration data: configuration is kept in this browser tab only.' : ''}`}
      />
      <Tabs
        items={SETTINGS_TABS}
        value={tab}
        onChange={(next) => setParams(next === 'general' ? {} : { tab: next }, { replace: true })}
        label="System settings sections"
        idBase="settings"
      />
      <div {...tabPanelProps('settings', tab)} className={styles.stack}>
        <SectionBoundary
          queries={[configuration]}
          unavailable="System configuration is not available yet: the backend configuration contract has not been approved. Nothing can be saved, published or rolled back, and no setting is shown as in effect."
        >
          {() => {
            const state = configuration.data!
            // Remount when the stored draft or version changes, so the editor starts from it.
            const key = `${state.current.version}:${state.draft?.savedAt ?? 'none'}`
            return tab === 'history' ? <ConfigurationHistoryTab state={state} /> : <SettingsEditor key={key} state={state} tab={tab} demo={demo} />
          }}
        </SectionBoundary>
      </div>
    </div>
  )
}

function SettingsEditor({ state, tab, demo }: { state: ConfigurationState; tab: Exclude<SettingsTab, 'history'>; demo: boolean }) {
  const toast = useToast()
  const save = useSaveConfigurationDraft()
  const discard = useDiscardConfigurationDraft()
  const publish = usePublishConfiguration()
  const { current, draft } = state

  const saved = draft?.document ?? current.document
  const [working, setWorking] = useState<ConfigurationDocument>(saved)
  const [showIssues, setShowIssues] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | undefined>()

  const issues = validateConfiguration(working)
  const unsaved = !same(working, saved)
  const changes = diffConfiguration(current.document, working)
  const canPublish = draft !== null && draft.baseVersion === current.version && !unsaved && issues.length === 0 && changes.length > 0
  const stale = draft !== null && draft.baseVersion !== current.version
  const sectionsWithIssues = [...new Set(issues.map((issue) => issue.section))]

  const onChange = (update: (document: ConfigurationDocument) => ConfigurationDocument) => setWorking((document) => update(document))

  function saveDraft() {
    save.mutate(
      { document: working, baseVersion: current.version },
      {
        onSuccess: () => toast.show({ tone: 'success', title: 'Draft saved', message: issues.length > 0 ? `${issues.length} problem(s) must be fixed before publishing.` : 'Validate and publish when ready.' }),
        onError: (error) => toast.show({ tone: 'error', title: 'Draft was not saved', message: errorMessage(error) }),
      },
    )
  }

  function confirmDiscard() {
    if (!draft) {
      setWorking(saved)
      setDiscardOpen(false)
      return
    }
    discard.mutate(current.version, {
      onSuccess: () => {
        setDiscardOpen(false)
        toast.show({ tone: 'success', title: 'Draft discarded', message: `Version ${current.version} remains in effect.` })
      },
      onError: (error) => toast.show({ tone: 'error', title: 'Draft was not discarded', message: errorMessage(error) }),
    })
  }

  function confirmPublish() {
    publish.mutate(
      { baseVersion: current.version, reason },
      {
        onSuccess: (version) => {
          setPublishOpen(false)
          toast.show({
            tone: 'success',
            title: `Version ${version.version} published`,
            message: demo ? 'Stored in this demonstration only. No rule is evaluated until the backend supports it.' : undefined,
          })
        },
        onError: (error) => {
          const fields = fieldErrorsOf(error)
          if (fields.reason) setReasonError(fields.reason)
          else {
            setPublishOpen(false)
            toast.show({ tone: 'error', title: 'Configuration was not published', message: errorMessage(error) })
          }
        },
      },
    )
  }

  return (
    <>
      {demo && (
        <Banner tone="warning" title="Demonstration mode · UI only">
          Saved and published configuration lives in this browser tab only and is audited in the demonstration audit log. No backend receives it, no
          business rule runs and no feature changes in production.
        </Banner>
      )}
      <Card aria-label="Configuration status">
        <div className={settingsStyles.bar}>
          <div className={settingsStyles.barStatus}>
            <p className={settingsStyles.barTitle}>
              Version {current.version} in effect{current.createdBy ? ` · published by ${current.createdBy.fullName}` : ' · baseline'} · {formatDateTime(current.createdAt)}
            </p>
            <p className={styles.caption} aria-live="polite">
              {draft ? `Draft saved ${formatDateTime(draft.savedAt)}${draft.savedBy ? ` by ${draft.savedBy.fullName}` : ''}` : 'No saved draft'}
              {unsaved ? ' · unsaved changes' : ''}
              {changes.length > 0 ? ` · ${summarizeChanges(changes)} from version ${current.version}` : ''}
            </p>
          </div>
          <div className={settingsStyles.barActions}>
            <Button variant="ghost" onClick={() => setShowIssues(true)}>
              Validate
            </Button>
            <Button variant="ghost" onClick={() => setPreviewOpen(true)}>
              Preview changes
            </Button>
            <Button variant="secondary" onClick={() => setDiscardOpen(true)} disabled={!draft && !unsaved}>
              Discard
            </Button>
            <Button variant="secondary" onClick={saveDraft} loading={save.isPending} disabled={!unsaved}>
              Save draft
            </Button>
            <Button
              onClick={() => {
                setReason('')
                setReasonError(undefined)
                setPublishOpen(true)
              }}
              disabled={!canPublish}
              aria-describedby="settings-publish-note"
            >
              Publish
            </Button>
          </div>
        </div>
        <p id="settings-publish-note" className={styles.caption}>
          {stale
            ? `This draft was started from version ${draft?.baseVersion}; discard it and start again from version ${current.version}.`
            : unsaved
              ? 'Save the draft before publishing.'
              : !draft
                ? 'Change a setting and save a draft to publish it.'
                : issues.length > 0
                  ? 'Fix the problems found by validation before publishing.'
                  : changes.length === 0
                    ? 'The draft has no changes from the version in effect.'
                    : 'Ready to publish.'}
        </p>
        {showIssues && (
          <Banner tone={issues.length === 0 ? 'success' : 'error'} title={issues.length === 0 ? 'No problems found' : `${issues.length} problem(s) found`} onDismiss={() => setShowIssues(false)}>
            {issues.length === 0 ? (
              'The configuration can be published once the draft is saved.'
            ) : (
              <ul className={styles.noteList}>
                {issues.map((issue) => (
                  <li key={`${issue.path}:${issue.message}`}>
                    <strong>{CONFIGURATION_SECTION_LABELS[issue.section]}:</strong> {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </Banner>
        )}
        {!showIssues && sectionsWithIssues.length > 0 && (
          <p className={styles.caption}>Problems in: {sectionsWithIssues.map((section: ConfigurationSection) => CONFIGURATION_SECTION_LABELS[section]).join(', ')}.</p>
        )}
      </Card>

      {tab === 'general' && <GeneralSection document={working} onChange={onChange} issues={issues} />}
      {tab === 'features' && <FeatureCenterSection document={working} onChange={onChange} issues={issues} />}
      {tab === 'rules' && <BusinessRulesSection document={working} onChange={onChange} issues={issues} versions={state.versions} />}
      {tab === 'workflows' && <WorkflowSection document={working} onChange={onChange} issues={issues} />}
      {tab === 'maintenance' && <MaintenanceSection document={working} onChange={onChange} issues={issues} />}

      <Modal
        open={previewOpen}
        title="Preview changes"
        description={`${summarizeChanges(changes)} compared with version ${current.version}.`}
        onClose={() => setPreviewOpen(false)}
        size="large"
      >
        <ConfigurationChanges changes={changes} caption={`Changes from version ${current.version}`} empty="No changes from the version in effect." />
        {issues.length > 0 && <p className={styles.fieldError}>{issues.length} problem(s) must be fixed before publishing.</p>}
      </Modal>

      <ConfirmDialog
        open={publishOpen}
        title={`Publish version ${current.version + 1}?`}
        description={`${summarizeChanges(changes)}. The change is recorded in the audit log.`}
        confirmLabel="Publish"
        pending={publish.isPending}
        onCancel={() => setPublishOpen(false)}
        onConfirm={confirmPublish}
      >
        <ConfigurationChanges changes={changes} caption="Changes to publish" />
        <TextAreaField label="Reason for this change" required value={reason} error={reasonError} onChange={(event) => setReason(event.target.value)} />
      </ConfirmDialog>

      <ConfirmDialog
        open={discardOpen}
        title={draft ? 'Discard the saved draft?' : 'Discard unsaved changes?'}
        description={`Version ${current.version} stays in effect.${draft ? ' The discard is recorded in the audit log.' : ''}`}
        confirmLabel="Discard"
        destructive
        pending={discard.isPending}
        onCancel={() => setDiscardOpen(false)}
        onConfirm={confirmDiscard}
      />
    </>
  )
}
