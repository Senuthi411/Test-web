import { useState } from 'react'
import { Badge, Banner, Card, ConfirmDialog, DataTable, SelectField, TextAreaField, useToast } from '@/shared/components'
import { formatDateTime } from '@/shared/utilities/format'
import { diffConfiguration, summarizeChanges, type ConfigurationState, type ConfigurationVersion } from '../../../../domain/configuration'
import { errorMessage, fieldErrorsOf } from '../../../components/helpers'
import { useRollbackConfiguration } from '../../../services/queries'
import styles from '../../../components/identity.module.css'
import settingsStyles from './SystemSettings.module.css'
import { ConfigurationChanges } from './ConfigurationChanges'

const KIND_LABELS: Record<ConfigurationVersion['kind'], string> = { baseline: 'Baseline', publish: 'Published', rollback: 'Rollback' }

/** Versions, comparison and rollback. A rollback adds a new version; none is ever removed. */
export function ConfigurationHistoryTab({ state }: { state: ConfigurationState }) {
  const toast = useToast()
  const rollback = useRollbackConfiguration()
  const { current, versions, draft } = state
  const ordered = [...versions].sort((a, b) => a.version - b.version)
  const previousOf = (version: ConfigurationVersion) => ordered.find((item) => item.version === version.version - 1)

  const [from, setFrom] = useState(String(ordered.length > 1 ? (ordered[ordered.length - 2]?.version ?? current.version) : current.version))
  const [to, setTo] = useState(String(current.version))
  const [target, setTarget] = useState<ConfigurationVersion | null>(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | undefined>()

  const fromVersion = versions.find((item) => String(item.version) === from) ?? current
  const toVersion = versions.find((item) => String(item.version) === to) ?? current
  const comparison = diffConfiguration(fromVersion.document, toVersion.document)
  const options = versions.map((item) => ({ value: String(item.version), label: `Version ${item.version}${item.version === current.version ? ' (current)' : ''}` }))

  function closeRollback() {
    setTarget(null)
    setReason('')
    setReasonError(undefined)
  }

  function confirmRollback() {
    if (!target) return
    rollback.mutate(
      { targetVersion: target.version, baseVersion: current.version, reason },
      {
        onSuccess: (created) => {
          toast.show({ tone: 'success', title: `Version ${created.version} created`, message: `The content of version ${target.version} is now in effect in this demonstration.` })
          closeRollback()
        },
        onError: (error) => {
          const fields = fieldErrorsOf(error)
          if (fields.reason) setReasonError(fields.reason)
          else toast.show({ tone: 'error', title: 'Rollback was not completed', message: errorMessage(error) })
        },
      },
    )
  }

  return (
    <>
      <Card title="Configuration versions" aria-label="Configuration versions" action={<span className={styles.muted}>{versions.length === 1 ? '1 version' : `${versions.length} versions`}</span>}>
        {draft && (
          <Banner tone="info" title="A draft is open">
            Publish or discard the draft before rolling back, so no unsaved work is replaced.
          </Banner>
        )}
        <DataTable<ConfigurationVersion>
          caption="Configuration versions"
          rows={versions}
          rowKey={(version) => String(version.version)}
          columns={[
            {
              id: 'version',
              header: 'Version',
              cell: (version) => (
                <span className={styles.stackTight}>
                  <span className={styles.idStrong}>Version {version.version}</span>
                  {version.version === current.version && (
                    <Badge tone="success" dot={false}>
                      Current
                    </Badge>
                  )}
                </span>
              ),
            },
            { id: 'kind', header: 'Type', cell: (version) => (version.kind === 'rollback' ? `Rollback to version ${version.restoredFrom}` : KIND_LABELS[version.kind]) },
            { id: 'when', header: 'Created', cell: (version) => <span className={styles.muted}>{formatDateTime(version.createdAt)}</span> },
            { id: 'by', header: 'By', cell: (version) => version.createdBy?.fullName ?? <span className={styles.muted}>System</span> },
            { id: 'reason', header: 'Reason', cell: (version) => version.reason },
            {
              id: 'changes',
              header: 'Changes',
              cell: (version) => {
                const previous = previousOf(version)
                return <span className={styles.muted}>{previous ? summarizeChanges(diffConfiguration(previous.document, version.document)) : 'Starting point'}</span>
              },
            },
            {
              id: 'rollback',
              header: 'Rollback',
              cell: (version) =>
                version.version === current.version ? (
                  <span className={styles.muted}>In effect</span>
                ) : (
                  <button type="button" className={styles.textButton} disabled={draft !== null} onClick={() => setTarget(version)} aria-label={`Roll back to version ${version.version}`}>
                    Roll back
                  </button>
                ),
            },
          ]}
        />
        <p className={styles.caption}>Rolling back creates a new version with the earlier content and an audit record. Earlier versions are never deleted.</p>
      </Card>

      <Card title="Compare versions" aria-label="Compare versions">
        <div className={settingsStyles.compare}>
          <SelectField label="From" value={from} options={options} onChange={(event) => setFrom(event.target.value)} />
          <SelectField label="To" value={to} options={options} onChange={(event) => setTo(event.target.value)} />
        </div>
        <p className={styles.caption} aria-live="polite">
          {fromVersion.version === toVersion.version ? 'Choose two different versions to compare.' : summarizeChanges(comparison)}
        </p>
        <ConfigurationChanges changes={comparison} caption={`Changes from version ${fromVersion.version} to version ${toVersion.version}`} empty="These versions have the same content." />
      </Card>

      <ConfirmDialog
        open={target !== null}
        title={`Roll back to version ${target?.version ?? ''}?`}
        description={target ? `Creates version ${current.version + 1} with the content of version ${target.version}. ${summarizeChanges(diffConfiguration(current.document, target.document))}.` : undefined}
        confirmLabel="Create rollback version"
        pending={rollback.isPending}
        onCancel={closeRollback}
        onConfirm={confirmRollback}
      >
        <TextAreaField label="Reason" required value={reason} error={reasonError} onChange={(event) => setReason(event.target.value)} />
      </ConfirmDialog>
    </>
  )
}
