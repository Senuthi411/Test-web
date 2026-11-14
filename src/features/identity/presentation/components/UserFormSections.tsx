import type { Ref } from 'react'
import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { Banner, Button, Checkbox, Modal, SelectField, TextAreaField, TextField } from '@/shared/components'
import { ROLE_LABELS, type UserRole } from '@/shared/types'
import type { EstateSummary, PersonRef } from '../../domain/models'
import { isFieldRequired, type UserDraft, type UserDraftField } from '../../domain/rules'
import { DATE_OF_BIRTH_MIN } from '../../domain/userFields'
import styles from './identity.module.css'

/**
 * Sections of the Create / Edit User form (ID-05, ID-06) that depend on the selected
 * role. Each section only renders inputs; values, validation and clearing are owned by
 * UserFormPage and the domain rules.
 */

interface SectionProps {
  register: UseFormRegister<UserDraft>
  errors: FieldErrors<UserDraft>
  role: UserRole | ''
}

const required = (field: UserDraftField, role: UserRole | '') => isFieldRequired(field, role)

/** Visible asterisk for fieldset legends; screen readers rely on "(required)" instead. */
function LegendText({ text, isRequired }: { text: string; isRequired: boolean }) {
  return (
    <>
      {text}
      {isRequired && (
        <>
          <span aria-hidden="true"> *</span>
          <span className="tl-visually-hidden"> (required)</span>
        </>
      )}
    </>
  )
}

/** NIC and date of birth. Rendered only for a signed-in Administrator. */
export function PersonalDetailsFields({ register, errors, today }: Omit<SectionProps, 'role'> & { today: string }) {
  return (
    <>
      <h3 className={styles.sectionTitle}>Personal details</h3>
      <p className={styles.caption}>Optional. Visible to Administrators only; the NIC is shown masked after the account is created.</p>
      <div className={styles.formGrid}>
        <TextField
          label="NIC"
          placeholder="e.g. 199012345678"
          autoComplete="off"
          spellCheck={false}
          hint="9 digits followed by V or X, or 12 digits"
          error={errors.nic?.message}
          {...register('nic')}
        />
        <TextField label="Date of birth" type="date" min={DATE_OF_BIRTH_MIN} max={today} error={errors.dateOfBirth?.message} {...register('dateOfBirth')} />
      </div>
    </>
  )
}

interface EstateChecklistProps {
  estates: readonly EstateSummary[]
  value: string[]
  onChange: (next: string[]) => void
  error?: string
  isRequired: boolean
  /** Attached to the first checkbox so "focus first invalid field" can reach the group. */
  inputRef?: Ref<HTMLInputElement>
}

/** Estate picker allowing several estates (Supervisor, Disease expert, estate-scoped Reporting user). */
export function EstateChecklist({ estates, value, onChange, error, isRequired, inputRef }: EstateChecklistProps) {
  const errorId = 'estate-ids-error'
  return (
    <fieldset className={styles.fieldset} aria-describedby={error ? errorId : undefined}>
      <legend className={styles.legend}>
        <LegendText text="Estates" isRequired={isRequired} />
      </legend>
      <div className={styles.checkList} aria-invalid={Boolean(error) || undefined}>
        {estates.map((estate, index) => (
          <Checkbox
            key={estate.id}
            ref={index === 0 ? inputRef : undefined}
            label={`${estate.name} (${estate.id})`}
            checked={value.includes(estate.id)}
            disabled={estate.status !== 'active' && !value.includes(estate.id)}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => onChange(event.target.checked ? [...value, estate.id].sort() : value.filter((id) => id !== estate.id))}
          />
        ))}
      </div>
      {error && (
        <p id={errorId} className={styles.fieldError} role="alert">
          {error}
        </p>
      )}
    </fieldset>
  )
}

export { LegendText }

interface RoleDetailsProps extends SectionProps {
  /** Active Supervisors offered as "Reports to". */
  reportsToOptions: readonly PersonRef[]
  /** Active Supervisors of the field worker's selected estate. */
  supervisorOptions: readonly PersonRef[]
  /** The field worker's estate, so the supervisor list can explain itself. */
  fieldWorkerEstateId: string
}

/** The fields that apply to the selected role only. Nothing renders before a role is chosen. */
export function RoleDetailsFields({ register, errors, role, reportsToOptions, supervisorOptions, fieldWorkerEstateId }: RoleDetailsProps) {
  if (!role) return null
  const title = `${ROLE_LABELS[role]} details`
  switch (role) {
    case 'ADMINISTRATOR':
      return (
        <section aria-label={title} className={styles.form}>
          <h3 className={styles.sectionTitle}>{title}</h3>
          <Checkbox
            label={
              <>
                Require multi-factor sign-in
                <span aria-hidden="true"> *</span>
                <span className="tl-visually-hidden"> (required)</span>
              </>
            }
            description="Required for Administrators. Enforced by the sign-in service, not by this form."
            aria-invalid={Boolean(errors.mfaRequired) || undefined}
            aria-describedby={errors.mfaRequired ? 'mfa-required-error' : undefined}
            {...register('mfaRequired')}
          />
          {errors.mfaRequired && (
            <p id="mfa-required-error" className={styles.fieldError} role="alert">
              {errors.mfaRequired.message}
            </p>
          )}
        </section>
      )
    case 'SUPERVISOR':
      return (
        <section aria-label={title} className={styles.form}>
          <h3 className={styles.sectionTitle}>{title}</h3>
          <div className={styles.formGrid}>
            <SelectField
              label="Reports to"
              hint="Optional. Lists active Supervisors; the reporting-line rule is pending approval."
              options={[{ value: '', label: 'No reporting line' }, ...reportsToOptions.map((person) => ({ value: person.id, label: `${person.fullName} (${person.id})` }))]}
              error={errors.reportsToId?.message}
              {...register('reportsToId')}
            />
            <TextField label="Office phone" type="tel" autoComplete="off" placeholder="+94112345678" error={errors.officePhone?.message} {...register('officePhone')} />
          </div>
        </section>
      )
    case 'DISEASE_EXPERT':
      return (
        <section aria-label={title} className={styles.form}>
          <h3 className={styles.sectionTitle}>{title}</h3>
          <div className={styles.formGrid}>
            <TextField
              label="Registration number"
              required={required('registrationNumber', role)}
              autoComplete="off"
              error={errors.registrationNumber?.message}
              {...register('registrationNumber')}
            />
            <TextField label="Institution" autoComplete="off" error={errors.institution?.message} {...register('institution')} />
          </div>
          <TextAreaField label="Qualifications" rows={3} error={errors.qualifications?.message} {...register('qualifications')} />
        </section>
      )
    case 'FIELD_WORKER':
      return (
        <section aria-label={title} className={styles.form}>
          <h3 className={styles.sectionTitle}>{title}</h3>
          <Banner tone="info">Mobile application access only. The web application never creates observations.</Banner>
          <div className={styles.formGrid}>
            <SelectField
              label="Supervisor"
              disabled={!fieldWorkerEstateId}
              hint={!fieldWorkerEstateId ? 'Select an estate first' : supervisorOptions.length === 0 ? 'No active supervisor is assigned to this estate' : 'Supervisors of the selected estate'}
              options={[{ value: '', label: 'No supervisor' }, ...supervisorOptions.map((person) => ({ value: person.id, label: `${person.fullName} (${person.id})` }))]}
              error={errors.supervisorId?.message}
              {...register('supervisorId')}
            />
            <TextField
              label="Mobile number"
              required={required('mobileNumber', role)}
              type="tel"
              autoComplete="off"
              placeholder="+94771234567"
              error={errors.mobileNumber?.message}
              {...register('mobileNumber')}
            />
          </div>
        </section>
      )
    case 'REPORTING_USER':
      return (
        <section aria-label={title} className={styles.form}>
          <h3 className={styles.sectionTitle}>{title}</h3>
          <div className={styles.formGrid}>
            <TextField label="Organisation or department" autoComplete="off" error={errors.organisation?.message} {...register('organisation')} />
          </div>
        </section>
      )
  }
}

interface RoleChangeDialogProps {
  from: UserRole | ''
  to: UserRole | '' | null
  lost: ReadonlyArray<{ label: string }>
  onConfirm: () => void
  onCancel: () => void
}

/** Asks before a role change removes values the administrator already entered. */
export function RoleChangeDialog({ from, to, lost, onConfirm, onCancel }: RoleChangeDialogProps) {
  const toLabel = to ? ROLE_LABELS[to] : 'no role'
  return (
    <Modal
      open={to !== null}
      size="small"
      title={`Change role to ${toLabel}?`}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Keep {from ? ROLE_LABELS[from] : 'current role'}
          </Button>
          <Button variant="destructive" onClick={onConfirm} data-autofocus>
            Change role
          </Button>
        </>
      }
    >
      <p>These entries do not apply to {toLabel} and will be cleared:</p>
      <ul className={styles.noteList}>
        {lost.map((item) => (
          <li key={item.label}>{item.label}</li>
        ))}
      </ul>
    </Modal>
  )
}
