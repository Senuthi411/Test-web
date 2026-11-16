import { useMemo, useState } from 'react'
import { Banner, Button, Checkbox, DescriptionList, Modal, SelectField, TextAreaField, TextField, useToast } from '@/shared/components'
import { ROLE_LABELS } from '@/shared/types'
import {
  EMPTY_GRANT_DRAFT,
  GRANT_STATUS_LABELS,
  ROLE_GRANT_POLICY,
  estatesOfDivisions,
  grantRequestFromDraft,
  parseLocalDateTime,
  validateGrantDraft,
  type AccessGrant,
  type GrantDraft,
  type GrantField,
  type GrantType,
} from '../../../../domain/accessGrants'
import type { DivisionSummary as Division, EstateSummary as Estate, IdentityUser } from '../../../../domain/models'
import { errorMessage, fieldErrorsOf, scopeLabel } from '../../../components/helpers'
import { useIdentityServices } from '../../../services/identityServices'
import { useRequestAccessGrant } from '../../../services/queries'
import { useCurrentSession } from '../../../session/sessionContext'
import styles from '../../../components/identity.module.css'
import roleStyles from '../RolesPage.module.css'
import { toLocalInput } from './grantDisplay'

export interface GrantRequestModalProps {
  open: boolean
  onClose: () => void
  users: readonly IdentityUser[]
  estates: readonly Estate[]
  divisions: readonly Division[]
  existing: readonly AccessGrant[]
}

/**
 * Request temporary access. The request goes to the backend, which decides the status
 * (approval, scheduling). The screen never approves or activates a grant.
 */
export function GrantRequestModal({ open, onClose, users, estates, divisions, existing }: GrantRequestModalProps) {
  const { clock, demo } = useIdentityServices()
  const session = useCurrentSession()
  const toast = useToast()
  const request = useRequestAccessGrant()
  const [draft, setDraft] = useState<GrantDraft>(() => ({ ...EMPTY_GRANT_DRAFT, startsAt: toLocalInput(clock.now()) }))
  const [submitted, setSubmitted] = useState(false)

  const employee = users.find((user) => user.id === draft.employeeId) ?? null
  const policy = employee ? ROLE_GRANT_POLICY[employee.role] : null
  const divisionEstate = useMemo(() => {
    const map = new Map(divisions.map((division) => [division.id, division.estateId]))
    return (id: string) => map.get(id)
  }, [divisions])

  const errors = validateGrantDraft(draft, {
    actorId: session.user.id,
    employee,
    divisionEstate,
    now: clock.now(),
    existing,
  })
  const serverErrors = fieldErrorsOf(request.error)
  const errorOf = (field: GrantField) => (submitted ? errors[field] : undefined) ?? serverErrors[field]

  const update = (patch: Partial<GrantDraft>) => {
    request.reset()
    setDraft((previous) => ({ ...previous, ...patch }))
  }

  function chooseEmployee(id: string) {
    const next = users.find((user) => user.id === id)
    const options = next ? ROLE_GRANT_POLICY[next.role].options : []
    update({ employeeId: id, type: options.length === 1 ? options[0]!.type : '', estateIds: [], divisionIds: [] })
  }

  function toggle(key: 'estateIds' | 'divisionIds', id: string, checked: boolean) {
    const current = draft[key]
    update({ [key]: checked ? [...current, id] : current.filter((item) => item !== id) })
  }

  // What can be chosen: scope the employee does not already hold; Field Workers stay in their estate.
  const estateChoices = estates.filter((estate) => estate.status === 'active' && !employee?.estateIds.includes(estate.id))
  const ownEstates = employee ? estatesOfDivisions(employee.divisionIds, divisionEstate) : []
  const divisionChoices = divisions.filter(
    (division) =>
      division.status === 'active' &&
      !employee?.divisionIds.includes(division.id) &&
      (employee?.role !== 'FIELD_WORKER' || ownEstates.includes(division.estateId)),
  )

  function submit() {
    setSubmitted(true)
    if (Object.keys(errors).length > 0) return
    request.mutate(grantRequestFromDraft(draft), {
      onSuccess: (grant) => {
        toast.show({
          tone: 'info',
          title: 'Temporary access requested',
          message: `${grant.id} for ${grant.employee.fullName} · Status: ${GRANT_STATUS_LABELS[grant.status]}`,
        })
        close()
      },
    })
  }

  function close() {
    setDraft({ ...EMPTY_GRANT_DRAFT, startsAt: toLocalInput(clock.now()) })
    setSubmitted(false)
    request.reset()
    onClose()
  }

  const start = parseLocalDateTime(draft.startsAt)
  const expiry = parseLocalDateTime(draft.expiresAt)
  const added = draft.type === 'additional_estate' ? draft.estateIds : draft.type === 'additional_division' ? draft.divisionIds : []
  const formError = request.isError && Object.keys(serverErrors).length === 0 ? request.error : null

  return (
    <Modal
      open={open}
      onClose={close}
      title="Request temporary access"
      description="Time-limited additional scope within the employee’s current role. It never adds permissions or changes the role."
      size="large"
      dismissible={!request.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={request.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={request.isPending} disabled={Boolean(policy && policy.options.length === 0)}>
            Submit request
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        {formError && (
          <Banner tone="error" title="The request was not submitted">
            {errorMessage(formError)}
          </Banner>
        )}
        <div className={styles.formGrid}>
          <SelectField
            label="Employee"
            placeholder="Select an employee"
            value={draft.employeeId}
            onChange={(event) => chooseEmployee(event.target.value)}
            error={errorOf('employeeId')}
            options={users.map((user) => ({
              value: user.id,
              label: `${user.fullName} · ${ROLE_LABELS[user.role]}${user.status === 'active' ? '' : ' · Inactive'}`,
            }))}
          />
          <div className={styles.readOnlyField}>
            <span className={styles.readOnlyLabel}>User ID</span>
            <span className={styles.muted}>{employee?.id ?? '—'}</span>
          </div>
          <div className={styles.readOnlyField}>
            <span className={styles.readOnlyLabel}>Role</span>
            <span className={styles.muted}>{employee ? ROLE_LABELS[employee.role] : '—'}</span>
          </div>
          <div className={styles.readOnlyField}>
            <span className={styles.readOnlyLabel}>Current access</span>
            <span className={styles.muted}>{employee ? scopeLabel(employee) : '—'}</span>
          </div>
        </div>

        {policy && (
          <Banner tone={policy.options.length === 0 ? 'warning' : 'info'} title={policy.options.length === 0 ? 'Not available for this role' : undefined}>
            {policy.note}
          </Banner>
        )}
        {policy?.pending && (
          <Banner tone="warning" title="Pending decision">
            {policy.pending}
          </Banner>
        )}

        {policy && policy.options.length > 0 && (
          <>
            <SelectField
              label="Access type"
              placeholder="Select an access type"
              value={draft.type}
              onChange={(event) => update({ type: event.target.value as GrantType | '', estateIds: [], divisionIds: [] })}
              error={errorOf('type')}
              options={policy.options.map((option) => ({ value: option.type, label: option.label }))}
            />
            {draft.type === 'additional_estate' && (
              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>Estates</legend>
                <div className={styles.checkList} aria-invalid={Boolean(errorOf('estateIds'))}>
                  {estateChoices.length === 0 ? (
                    <span className={styles.muted}>No other active estates.</span>
                  ) : (
                    estateChoices.map((estate) => (
                      <Checkbox
                        key={estate.id}
                        label={`${estate.name} (${estate.id})`}
                        checked={draft.estateIds.includes(estate.id)}
                        onChange={(event) => toggle('estateIds', estate.id, event.target.checked)}
                      />
                    ))
                  )}
                </div>
                {errorOf('estateIds') && <p className={styles.fieldError}>{errorOf('estateIds')}</p>}
              </fieldset>
            )}
            {draft.type === 'additional_division' && (
              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>Divisions</legend>
                <div className={styles.checkList} aria-invalid={Boolean(errorOf('divisionIds'))}>
                  {divisionChoices.length === 0 ? (
                    <span className={styles.muted}>No other active divisions in this estate.</span>
                  ) : (
                    divisionChoices.map((division) => (
                      <Checkbox
                        key={division.id}
                        label={`${division.name} (${division.id})`}
                        description={division.estateId}
                        checked={draft.divisionIds.includes(division.id)}
                        onChange={(event) => toggle('divisionIds', division.id, event.target.checked)}
                      />
                    ))
                  )}
                </div>
                {errorOf('divisionIds') && <p className={styles.fieldError}>{errorOf('divisionIds')}</p>}
              </fieldset>
            )}
            <div className={styles.formGrid}>
              <TextField
                label="Start"
                type="datetime-local"
                value={draft.startsAt}
                onChange={(event) => update({ startsAt: event.target.value })}
                error={errorOf('startsAt')}
              />
              <TextField
                label="Expiry"
                type="datetime-local"
                value={draft.expiresAt}
                onChange={(event) => update({ expiresAt: event.target.value })}
                error={errorOf('expiresAt')}
              />
            </div>
            <TextAreaField
              label="Business reason"
              rows={3}
              value={draft.reason}
              onChange={(event) => update({ reason: event.target.value })}
              error={errorOf('reason')}
              hint="Recorded in the access history."
            />

            <section className={roleStyles.impact} aria-label="Access impact preview">
              <h3 className={styles.sectionTitle}>Access impact preview</h3>
              <DescriptionList
                items={[
                  { label: 'Current access', value: employee ? scopeLabel(employee) : '—' },
                  { label: 'Added for the period', value: added.length > 0 ? added.join(', ') : '—' },
                  {
                    label: 'Period',
                    value: start && expiry && expiry > start ? `${draft.startsAt.replace('T', ' ')} – ${draft.expiresAt.replace('T', ' ')}` : '—',
                  },
                  { label: 'Permissions', value: 'Unchanged · the role’s existing permissions apply in the added scope' },
                  { label: 'After expiry', value: 'Access returns to the current access above' },
                  {
                    label: 'Approval',
                    value: 'Decided by the backend. No approval authority is defined yet, so a request stays Pending approval.',
                  },
                ]}
              />
            </section>
          </>
        )}
        <p className={styles.caption}>
          {demo ? 'Demonstration data: requests are kept in this browser tab only. ' : ''}
          To change permanent access, use Users → Manage scope.
        </p>
      </div>
    </Modal>
  )
}
