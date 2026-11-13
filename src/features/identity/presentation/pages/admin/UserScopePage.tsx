import { useState } from 'react'
import { useParams } from 'react-router'
import { isAppError } from '@/shared/api'
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  Checkbox,
  DescriptionList,
  Modal,
  PageHeader,
  TextAreaField,
  usePageBreadcrumbs,
} from '@/shared/components'
import { ROLE_LABELS } from '@/shared/types'
import type { DivisionSummary, EstateSummary, IdentityUser } from '../../../domain/models'
import {
  coveredDivisionIds,
  describeScopeChange,
  effectiveScope,
  sameScope,
  scopeIdsOf,
  scopeLevelFor,
  validateScope,
  type ScopeSelection,
  type ScopeTopology,
} from '../../../domain/scope'
import { QueryBoundary, StatusBadge } from '../../components/common'
import { errorMessage, scopeLabel, useDemoWording, userPath } from '../../components/helpers'
import { useIdentityServices } from '../../services/identityServices'
import { useDivisions, useEstates, useUpdateUserScope, useUserDetail } from '../../services/queries'
import styles from '../../components/identity.module.css'
import scopeStyles from './UserScopePage.module.css'

/** ID-08 User Scope Assignment (Figma 16:335). */
export function UserScopePage() {
  const { userId = '' } = useParams()
  const detail = useUserDetail(userId)
  const estates = useEstates()
  const divisions = useDivisions()
  // Kept above the editor, which re-mounts when the user's version changes after a save.
  const [outcome, setOutcome] = useState<Outcome>(null)
  const [reloads, setReloads] = useState(0)
  usePageBreadcrumbs(
    detail.data
      ? [
          { label: 'Administration', to: '/admin' },
          { label: 'Users', to: '/admin/users' },
          { label: detail.data.user.fullName, to: userPath(userId) },
          { label: 'Scope assignment' },
        ]
      : null,
  )
  return (
    <div className={styles.page}>
      <QueryBoundary query={detail}>
        {(loaded) => (
          <QueryBoundary query={estates}>
            {(estateList) => (
              <QueryBoundary query={divisions}>
                {(divisionList) => (
                  // Re-mount when the stored version changes, so the draft starts from the latest scope.
                  <ScopeEditor
                    key={`${loaded.user.id}-${loaded.user.version}-${reloads}`}
                    user={loaded.user}
                    estates={estateList}
                    divisions={divisionList}
                    outcome={outcome}
                    setOutcome={setOutcome}
                    onReload={() =>
                      void detail.refetch().then(() => {
                        setOutcome(null)
                        setReloads((count) => count + 1)
                      })
                    }
                  />
                )}
              </QueryBoundary>
            )}
          </QueryBoundary>
        )}
      </QueryBoundary>
    </div>
  )
}

interface ScopeEditorProps {
  user: IdentityUser
  estates: readonly EstateSummary[]
  divisions: readonly DivisionSummary[]
  outcome: Outcome
  setOutcome: (outcome: Outcome) => void
  onReload: () => void
}

type Outcome = { kind: 'saved' } | { kind: 'conflict' } | { kind: 'error'; error: unknown } | null

function ScopeEditor({ user, estates, divisions, outcome, setOutcome, onReload }: ScopeEditorProps) {
  const { demo } = useDemoWording()
  const { simulateNextFailure } = useIdentityServices()
  const mutation = useUpdateUserScope(user.id)
  const level = scopeLevelFor(user.role)
  const topology: ScopeTopology = { estates, divisions }
  const current: ScopeSelection = { estateIds: user.estateIds, divisionIds: user.divisionIds }
  const [draft, setDraft] = useState<ScopeSelection>(current)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(estates.map((estate) => estate.id)))
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)

  const before = effectiveScope(level, current, topology)
  const after = effectiveScope(level, draft, topology)
  const changed = !sameScope(current, draft)
  const problem = validateScope(level, draft)
  const covered = new Set(coveredDivisionIds(level, draft, topology))

  if (level === 'all_estates') {
    return (
      <>
        <PageHeader back={{ to: userPath(user.id), label: 'Back to user' }} title="User Scope Assignment" subtitle={`${user.id} · ${ROLE_LABELS[user.role]}`} />
        <Banner tone="info">Administrators hold all estates. There is no estate or division scope to assign.</Banner>
      </>
    )
  }

  function toggleEstate(estateId: string, checked: boolean) {
    setOutcome(null)
    if (level === 'estate') {
      setDraft((previous) => ({
        estateIds: checked ? [...previous.estateIds, estateId].sort() : previous.estateIds.filter((id) => id !== estateId),
        divisionIds: [],
      }))
      return
    }
    const ids = divisions.filter((division) => division.estateId === estateId).map((division) => division.id)
    setDraft((previous) => ({
      estateIds: [],
      divisionIds: checked
        ? [...new Set([...previous.divisionIds, ...ids])].sort()
        : previous.divisionIds.filter((id) => !ids.includes(id)),
    }))
  }

  function toggleDivision(divisionId: string, checked: boolean) {
    setOutcome(null)
    setDraft((previous) => ({
      estateIds: [],
      divisionIds: checked ? [...previous.divisionIds, divisionId].sort() : previous.divisionIds.filter((id) => id !== divisionId),
    }))
  }

  function submit(simulateConflict = false) {
    if (!reason.trim()) {
      setReasonError('A reason is required for a privileged scope change')
      return
    }
    if (simulateConflict) simulateNextFailure?.('conflict')
    mutation.mutate(
      { scope: draft, reason, expectedVersion: user.version },
      {
        onSuccess: () => {
          setConfirmOpen(false)
          setOutcome({ kind: 'saved' })
        },
        onError: (error) => {
          setConfirmOpen(false)
          setOutcome(isAppError(error) && error.kind === 'conflict' ? { kind: 'conflict' } : { kind: 'error', error })
        },
      },
    )
  }

  const estatesLabel = (selection: ScopeSelection) => scopeIdsOf(selection).join(', ') || 'None'

  return (
    <>
      <PageHeader
        back={{ to: userPath(user.id), label: 'Back to user' }}
        title="User Scope Assignment"
        subtitle={`Assign ${level === 'estate' ? 'estate' : 'division'} scope for ${user.id} · ${ROLE_LABELS[user.role]}`}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setDraft(current)
                setOutcome(null)
              }}
              disabled={!changed}
            >
              Reset
            </Button>
            <Button
              icon="check"
              disabled={!changed || Boolean(problem)}
              onClick={() => {
                setReason('')
                setReasonError(null)
                setConfirmOpen(true)
              }}
            >
              Save assignment
            </Button>
          </>
        }
      />

      {outcome?.kind === 'saved' && (
        <Banner tone="success" title="Scope updated" onDismiss={() => setOutcome(null)}>
          {user.fullName} now holds {scopeLabel(user)}.{demo && ' Demonstration data: the change is held in this browser tab only.'}
        </Banner>
      )}
      {outcome?.kind === 'conflict' && (
        <Banner
          tone="error"
          title="409 · Scope changed elsewhere"
          action={
            <Button variant="secondary" icon="refresh" onClick={onReload}>
              Reload latest scope
            </Button>
          }
        >
          This user&apos;s scope was changed by another administrator. Your change was not applied.
        </Banner>
      )}
      {outcome?.kind === 'error' && (
        <Banner tone="error" title="The scope was not changed">
          {errorMessage(outcome.error)}
        </Banner>
      )}

      <div className={styles.sideFirst}>
        <Card title="Selected user">
          <div className={styles.person}>
            <Avatar name={user.fullName} size={48} />
            <span>
              <span className={scopeStyles.userName}>{user.fullName}</span>
              <span className={styles.muted}>
                {' '}
                <br />
                {user.id} · {ROLE_LABELS[user.role]}
              </span>
            </span>
          </div>
          <DescriptionList
            items={[
              { label: 'Scope level', value: level === 'estate' ? 'Estate-level (experts, supervisors)' : 'Division-level (field workers)' },
              { label: 'Current scope', value: scopeLabel(user) },
              { label: 'Status', value: <StatusBadge status={user.status} /> },
            ]}
          />
          <Banner tone="info">Field workers are assigned at division level; experts and supervisors at estate level.</Banner>
        </Card>

        <div className={styles.withSide}>
          <Card
            title="Scope tree"
            action={
              <button
                type="button"
                className={styles.textButton}
                onClick={() =>
                  setExpanded((previous) => (previous.size === estates.length ? new Set() : new Set(estates.map((estate) => estate.id))))
                }
              >
                {expanded.size === estates.length ? 'Collapse all' : 'Expand all'}
              </button>
            }
          >
            <ul className={scopeStyles.tree} aria-label="Estates and divisions">
              {estates.map((estate) => {
                const estateDivisions = divisions.filter((division) => division.estateId === estate.id)
                const selectedCount = estateDivisions.filter((division) => covered.has(division.id)).length
                const assigned = level === 'estate' ? draft.estateIds.includes(estate.id) : selectedCount > 0
                const allSelected = estateDivisions.length > 0 && selectedCount === estateDivisions.length
                const open = expanded.has(estate.id)
                return (
                  <li key={estate.id} className={scopeStyles.group}>
                    <div className={scopeStyles.estateRow} data-assigned={assigned}>
                      <Checkbox
                        label={<span className={scopeStyles.estateName}>{estate.name}</span>}
                        description={`${estate.id} · ${estate.region}`}
                        checked={level === 'estate' ? assigned : allSelected}
                        onChange={(event) => toggleEstate(estate.id, event.target.checked)}
                        aria-label={`${estate.name} (${estate.id})`}
                      />
                      <span className={scopeStyles.estateMeta}>
                        <Badge tone={assigned ? 'success' : 'neutral'}>{assigned ? 'Assigned' : 'Not assigned'}</Badge>
                        <button
                          type="button"
                          className={styles.textButton}
                          aria-expanded={open}
                          onClick={() =>
                            setExpanded((previous) => {
                              const next = new Set(previous)
                              if (open) next.delete(estate.id)
                              else next.add(estate.id)
                              return next
                            })
                          }
                        >
                          {open ? 'Hide divisions' : 'Show divisions'}
                        </button>
                      </span>
                    </div>
                    {open && (
                      <ul className={scopeStyles.divisions}>
                        {estateDivisions.map((division) => (
                          <li key={division.id} className={scopeStyles.divisionRow}>
                            <Checkbox
                              label={division.name}
                              checked={covered.has(division.id)}
                              disabled={level === 'estate'}
                              onChange={(event) => toggleDivision(division.id, event.target.checked)}
                              aria-label={`${division.name} (${division.id})`}
                            />
                            <span className={styles.muted}>{division.id}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
            {level === 'estate' && <p className={styles.caption}>Estate-level scope covers every division of the estate.</p>}
          </Card>

          <Card title="Effective scope">
            <DescriptionList
              items={[
                { label: 'Estates', value: `${after.estates.covered} of ${after.estates.total}` },
                { label: 'Divisions covered', value: `${after.divisions.covered} of ${after.divisions.total}` },
                {
                  label: 'Unassigned',
                  value: after.unassignedEstates.length
                    ? after.unassignedEstates.map((estate) => `${estate.name.replace(/\s+Tea Estate$/, '')} (${estate.id})`).join(', ')
                    : 'None',
                },
              ]}
            />
            {problem && <p className={styles.fieldError}>{problem}</p>}
            <Banner tone="warning">Preview only. The backend enforces scope on every request.</Banner>
          </Card>
        </div>
      </div>

      <Modal
        open={confirmOpen}
        title="Confirm privileged scope change"
        onClose={() => !mutation.isPending && setConfirmOpen(false)}
        dismissible={!mutation.isPending}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            {simulateNextFailure && (
              <Button variant="ghost" onClick={() => submit(true)} disabled={mutation.isPending}>
                Simulate 409 conflict
              </Button>
            )}
            <Button onClick={() => submit()} loading={mutation.isPending} loadingLabel="Saving…">
              Confirm change
            </Button>
          </>
        }
      >
        <div className={styles.stack}>
          {demo && (
            <div>
              <Badge tone="warning">Demo change</Badge>
            </div>
          )}
          <DescriptionList
            items={[
              { label: 'User', value: `${user.fullName} (${user.id}) · ${ROLE_LABELS[user.role]}` },
              { label: 'Change', value: describeScopeChange(level, current, draft, topology) },
              { label: level === 'estate' ? 'Estates' : 'Divisions', value: `${estatesLabel(current)} → ${estatesLabel(draft)}` },
              { label: 'Divisions covered', value: `${before.divisions.covered} of ${before.divisions.total} → ${after.divisions.covered} of ${after.divisions.total}` },
            ]}
          />
          <TextAreaField
            label="Reason (required)"
            required
            value={reason}
            error={reasonError ?? undefined}
            onChange={(event) => {
              setReason(event.target.value)
              setReasonError(null)
            }}
          />
          <p className={styles.caption}>Scope changes are privileged and audited by the backend.</p>
        </div>
      </Modal>
    </>
  )
}
