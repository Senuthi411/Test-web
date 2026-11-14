import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm, useWatch, type FieldErrors as FormErrors, type Resolver } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { isAppError } from '@/shared/api'
import {
  Badge,
  Banner,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  DescriptionList,
  Modal,
  PageHeader,
  SelectField,
  TextField,
  usePageBreadcrumbs,
} from '@/shared/components'
import { Icon } from '@/shared/design-system'
import { ROLE_LABELS, type UserRole } from '@/shared/types'
import { formatIsoDate } from '@/shared/utilities/format'
import type { DivisionSummary, EstateSummary, IdentityUser, PersonRef } from '../../../domain/models'
import { permissionLabel, roleDefinition } from '../../../domain/roles'
import {
  clearedForRole,
  draftFromRoleDetails,
  EMPTY_USER_DRAFT,
  isFieldRequired,
  personalFromDraft,
  roleDetailsFromDraft,
  scopeFromDraft,
  validateUserDraft,
  valuesLostOnRoleChange,
  type UserDraft,
  type UserDraftField,
} from '../../../domain/rules'
import { scopeLevelFor } from '../../../domain/scope'
import { maskNic, PREFERRED_LANGUAGES, preferredLanguageLabel, type PreferredLanguage } from '../../../domain/userFields'
import type { UserInput } from '../../../application/ports'
import { QueryBoundary } from '../../components/common'
import { errorMessage, fieldErrorsOf, scopeLabel, useDemoWording, userPath } from '../../components/helpers'
import { EstateChecklist, LegendText, PersonalDetailsFields, RoleChangeDialog, RoleDetailsFields } from '../../components/UserFormSections'
import { useIdentityServices } from '../../services/identityServices'
import { useCreateUser, useDivisions, useEstates, useUpdateUser, useUserDetail, useUsers } from '../../services/queries'
import { useSession } from '../../session/sessionContext'
import type { UserSavedState } from './UserDetailPage'
import styles from '../../components/identity.module.css'

const ROLE_OPTIONS: UserRole[] = ['ADMINISTRATOR', 'SUPERVISOR', 'DISEASE_EXPERT', 'FIELD_WORKER', 'REPORTING_USER']

/** Visual order of the form, used to focus the first invalid field after submit. */
const FIELD_ORDER: readonly UserDraftField[] = [
  'fullName',
  'email',
  'phone',
  'employeeId',
  'role',
  'preferredLanguage',
  'nic',
  'dateOfBirth',
  'estateIds',
  'estateId',
  'divisionIds',
  'mfaRequired',
  'reportsToId',
  'officePhone',
  'registrationNumber',
  'institution',
  'qualifications',
  'supervisorId',
  'mobileNumber',
  'organisation',
]

/**
 * The edit draft for a user, and whether the form can show the user's scope exactly.
 * A field worker holding divisions of several estates keeps that scope here and changes
 * it on ID-08, so an edit never silently drops a division.
 */
function draftFor(user: IdentityUser, divisions: readonly DivisionSummary[]): { draft: UserDraft; scopeShown: boolean } {
  const base: UserDraft = {
    ...EMPTY_USER_DRAFT,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
    phone: user.phone,
    employeeId: user.employeeId,
    preferredLanguage: user.preferredLanguage,
    ...draftFromRoleDetails(user.roleDetails),
  }
  const level = scopeLevelFor(user.role)
  if (level === 'all_estates') return { draft: base, scopeShown: true }
  if (level === 'estate') return { draft: { ...base, estateIds: [...user.estateIds] }, scopeShown: true }
  const estates = new Set(user.divisionIds.map((id) => divisions.find((division) => division.id === id)?.estateId))
  if (estates.size !== 1) return { draft: base, scopeShown: false }
  return { draft: { ...base, estateId: [...estates][0] ?? '', divisionIds: [...user.divisionIds] }, scopeShown: true }
}

/** ID-05 Create User (15:712) and ID-06 Edit User (15:891). */
export function UserFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const estates = useEstates()
  const divisions = useDivisions()
  const users = useUsers()
  return (
    <div className={styles.page}>
      {mode === 'create' ? (
        <>
          <CreateBreadcrumbs />
          <QueryBoundary query={estates}>
            {(estateList) => (
              <QueryBoundary query={divisions}>
                {(divisionList) => (
                  <QueryBoundary query={users}>{(userList) => <UserForm estates={estateList} divisions={divisionList} users={userList} />}</QueryBoundary>
                )}
              </QueryBoundary>
            )}
          </QueryBoundary>
        </>
      ) : (
        <EditLoader estates={estates} divisions={divisions} users={users} />
      )}
    </div>
  )
}

function CreateBreadcrumbs() {
  usePageBreadcrumbs([
    { label: 'Administration', to: '/admin' },
    { label: 'Users', to: '/admin/users' },
    { label: 'Create user' },
  ])
  return null
}

interface LoaderProps {
  estates: ReturnType<typeof useEstates>
  divisions: ReturnType<typeof useDivisions>
  users: ReturnType<typeof useUsers>
}

function EditLoader({ estates, divisions, users }: LoaderProps) {
  const { userId = '' } = useParams()
  const detail = useUserDetail(userId)
  const [reloads, setReloads] = useState(0)
  usePageBreadcrumbs(
    detail.data
      ? [
          { label: 'Administration', to: '/admin' },
          { label: 'Users', to: '/admin/users' },
          { label: detail.data.user.fullName, to: userPath(userId) },
          { label: `Edit ${detail.data.user.fullName}` },
        ]
      : null,
  )
  return (
    <QueryBoundary query={detail}>
      {(loaded) => (
        <QueryBoundary query={estates}>
          {(estateList) => (
            <QueryBoundary query={divisions}>
              {(divisionList) => (
                <QueryBoundary query={users}>
                  {(userList) => (
                    <UserForm
                      key={`${loaded.user.id}-${reloads}`}
                      user={loaded.user}
                      estates={estateList}
                      divisions={divisionList}
                      users={userList}
                      onReload={() =>
                        void detail.refetch().then((result) => {
                          if (result.isSuccess) setReloads((count) => count + 1)
                        })
                      }
                    />
                  )}
                </QueryBoundary>
              )}
            </QueryBoundary>
          )}
        </QueryBoundary>
      )}
    </QueryBoundary>
  )
}

interface UserFormProps {
  user?: IdentityUser
  estates: readonly EstateSummary[]
  divisions: readonly DivisionSummary[]
  users: readonly IdentityUser[]
  onReload?: () => void
}

const person = (user: IdentityUser): PersonRef => ({ id: user.id, fullName: user.fullName })

function UserForm({ user: loadedUser, estates, divisions, users, onReload }: UserFormProps) {
  // The draft and expectedVersion must describe the same snapshot, even if queries
  // refresh in the background. Only an explicit reload starts a new edit.
  const [user] = useState(loadedUser)
  const editing = Boolean(user)
  const navigate = useNavigate()
  const { demo } = useDemoWording()
  const { clock } = useIdentityServices()
  const { state: session } = useSession()
  const createUser = useCreateUser()
  const updateUser = useUpdateUser(user?.id ?? '')
  const mutation = editing ? updateUser : createUser
  const today = formatIsoDate(clock.now().toISOString())
  // NIC and date of birth: entered on Create User, by a signed-in Administrator only.
  const showPersonal = !editing && session.status === 'signed_in' && session.session.user.role === 'ADMINISTRATOR'

  const initial = useMemo(() => (user ? draftFor(user, divisions) : { draft: EMPTY_USER_DRAFT, scopeShown: true }), [user, divisions])
  const divisionEstate = useMemo(() => {
    const map = new Map(divisions.map((division) => [division.id, division.estateId]))
    return (id: string) => map.get(id)
  }, [divisions])

  const [infoOpen, setInfoOpen] = useState(true)
  const [review, setReview] = useState<UserDraft | null>(null)
  const [failure, setFailure] = useState<unknown>(null)
  const [pendingRole, setPendingRole] = useState<{ role: UserRole | ''; lost: Array<{ label: string }> } | null>(null)

  /** Edit only: the current scope cannot be shown in this form and the scope level is unchanged. */
  function keepsCurrentScope(role: UserDraft['role']): boolean {
    if (!user || initial.scopeShown || !role) return false
    return scopeLevelFor(role) === scopeLevelFor(user.role)
  }

  const resolver: Resolver<UserDraft> = (values) => {
    const keepScope = keepsCurrentScope(values.role)
    const checked = keepScope ? { ...values, estateIds: ['kept'], estateId: 'kept', divisionIds: ['kept'] } : values
    const errors = validateUserDraft(checked, { divisionEstate: keepScope ? () => 'kept' : divisionEstate, today })
    if (!showPersonal) {
      delete errors.nic
      delete errors.dateOfBirth
    }
    const entries = Object.entries(errors).filter(([, message]) => message)
    if (entries.length === 0) return { values, errors: {} }
    return {
      values: {},
      errors: Object.fromEntries(entries.map(([field, message]) => [field, { type: 'validation', message }])),
    }
  }

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    setError,
    setFocus,
    trigger,
    formState: { errors, isSubmitted },
  } = useForm<UserDraft>({ resolver, defaultValues: initial.draft, shouldFocusError: false })

  const role = useWatch({ control, name: 'role' })
  const estateId = useWatch({ control, name: 'estateId' })
  const level = role ? scopeLevelFor(role) : null
  const scopeKept = keepsCurrentScope(role)

  const activeSupervisors = useMemo(() => users.filter((item) => item.role === 'SUPERVISOR' && item.status === 'active'), [users])
  const fieldWorkerEstates = useMemo(() => {
    if (estateId) return new Set([estateId])
    if (scopeKept && user) return new Set(user.divisionIds.map(divisionEstate).filter((id): id is string => Boolean(id)))
    return new Set<string>()
  }, [estateId, scopeKept, user, divisionEstate])
  const supervisorOptions = useMemo(
    () => activeSupervisors.filter((item) => item.estateIds.some((id) => fieldWorkerEstates.has(id))).map(person),
    [activeSupervisors, fieldWorkerEstates],
  )
  const reportsToOptions = useMemo(() => activeSupervisors.filter((item) => item.id !== user?.id).map(person), [activeSupervisors, user])

  // Changing estate drops divisions and a supervisor that belong to another estate.
  useEffect(() => {
    if (!estateId) return
    const current = getValues('divisionIds')
    const kept = current.filter((id) => divisionEstate(id) === estateId)
    if (kept.length !== current.length) setValue('divisionIds', kept)
    const supervisorId = getValues('supervisorId')
    if (supervisorId && !supervisorOptions.some((option) => option.id === supervisorId)) setValue('supervisorId', '')
  }, [estateId, divisionEstate, getValues, setValue, supervisorOptions])

  const estateDivisions = divisions.filter((division) => division.estateId === estateId)

  function applyRole(next: UserRole | '') {
    for (const [field, value] of Object.entries(clearedForRole(next))) setValue(field as keyof UserDraft, value as never)
    setValue('role', next)
    setPendingRole(null)
    if (isSubmitted) void trigger()
  }

  /** Asks before clearing entered values that the next role does not use. */
  function requestRoleChange(next: UserRole | '') {
    if (next === getValues('role')) return
    const lost = valuesLostOnRoleChange(getValues(), next)
    if (lost.length > 0) setPendingRole({ role: next, lost })
    else applyRole(next)
  }

  function focusFirst(fields: ReadonlyArray<string>) {
    const first = FIELD_ORDER.find((field) => fields.includes(field))
    if (first) setFocus(first)
  }

  function toInput(values: UserDraft): UserInput {
    const details = roleDetailsFromDraft(values)
    if (!values.role || !details) throw new Error('Role is required')
    const scope = scopeKept && user ? { estateIds: user.estateIds, divisionIds: user.divisionIds } : scopeFromDraft(values)
    return {
      fullName: values.fullName,
      email: values.email,
      role: values.role,
      status: values.status,
      scope,
      phone: values.phone,
      employeeId: values.employeeId,
      preferredLanguage: values.preferredLanguage as PreferredLanguage,
      roleDetails: details,
      ...(showPersonal ? { personal: personalFromDraft(values) } : {}),
    }
  }

  function applyServerErrors(error: unknown) {
    const mapped: string[] = []
    for (const [path, message] of Object.entries(fieldErrorsOf(error))) {
      // Estate-level scope errors refer to the estate list in this form.
      const field = path === 'estateId' && level === 'estate' ? 'estateIds' : path
      if ((FIELD_ORDER as readonly string[]).includes(field)) {
        setError(field as UserDraftField, { type: 'server', message })
        mapped.push(field)
      }
    }
    if (mapped.length === 0) setFailure(error)
    else focusFirst(mapped)
  }

  function save(values: UserDraft) {
    setFailure(null)
    const input = toInput(values)
    if (user) {
      updateUser.mutate(
        { ...input, expectedVersion: user.version },
        {
          onSuccess: (saved) => navigate(userPath(saved.id), { state: { userSaved: 'updated' } satisfies UserSavedState }),
          onError: applyServerErrors,
        },
      )
    } else {
      createUser.mutate(input, {
        onSuccess: (saved) => {
          setReview(null)
          navigate(userPath(saved.id), { state: { userSaved: 'created' } satisfies UserSavedState })
        },
        onError: (error) => {
          setReview(null)
          applyServerErrors(error)
        },
      })
    }
  }

  const onSubmit = handleSubmit(
    (values) => (editing ? save(values) : setReview(values)),
    (invalid: FormErrors<UserDraft>) => focusFirst(Object.keys(invalid)),
  )
  const cancelTo = user ? userPath(user.id) : '/admin/users'
  const definition = role ? roleDefinition(role) : null
  const conflict = isAppError(failure) && failure.kind === 'conflict'
  const required = (field: UserDraftField) => isFieldRequired(field, role)

  const estateName = (id: string) => estates.find((estate) => estate.id === id)?.name ?? id
  const userName = (id: string) => users.find((item) => item.id === id)?.fullName ?? id
  const reviewScope = (draft: UserDraft) => {
    if (!draft.role) return '—'
    const draftLevel = scopeLevelFor(draft.role)
    if (draftLevel === 'all_estates') return 'All estates'
    if (draftLevel === 'estate') return draft.estateIds.map(estateName).join(', ')
    const names = draft.divisionIds.map((id) => `${divisions.find((division) => division.id === id)?.name ?? id} (${id})`)
    return `${estateName(draft.estateId)} · ${names.join(', ')}`
  }
  const reviewRoleDetails = (draft: UserDraft) => {
    switch (draft.role) {
      case 'ADMINISTRATOR':
        return [{ label: 'Multi-factor sign-in', value: draft.mfaRequired ? 'Required' : 'Not set' }]
      case 'SUPERVISOR':
        return [
          { label: 'Reports to', value: draft.reportsToId ? userName(draft.reportsToId) : 'No reporting line' },
          { label: 'Office phone', value: draft.officePhone || '—' },
        ]
      case 'DISEASE_EXPERT':
        return [
          { label: 'Registration number', value: draft.registrationNumber },
          { label: 'Institution', value: draft.institution || '—' },
          { label: 'Qualifications', value: draft.qualifications || '—' },
        ]
      case 'FIELD_WORKER':
        return [
          { label: 'Supervisor', value: draft.supervisorId ? userName(draft.supervisorId) : 'No supervisor' },
          { label: 'Mobile number', value: draft.mobileNumber },
        ]
      case 'REPORTING_USER':
        return [{ label: 'Organisation or department', value: draft.organisation || '—' }]
      default:
        return []
    }
  }
  const invitationNote = demo
    ? 'No password is set here. In the live service the user receives an invitation link to set up sign-in; in demonstration mode no invitation is sent.'
    : 'No password is set here. The user receives an invitation link to set up sign-in.'

  return (
    <>
      <PageHeader
        back={{ to: cancelTo, label: user ? 'Back to user' : 'Back to users' }}
        title={user ? 'Edit User' : 'Create User'}
        subtitle={user ? `${user.id} · Changes are saved as an administrative update` : `Add a ${demo ? 'demo ' : ''}account and assign scope`}
        actions={
          <>
            <ButtonLink to={cancelTo} variant="secondary">
              Cancel
            </ButtonLink>
            <Button type="submit" form="user-form" icon="check" loading={editing && mutation.isPending} loadingLabel="Saving…">
              {user ? 'Save changes' : 'Create user'}
            </Button>
          </>
        }
      />
      {user && infoOpen && (
        <Banner tone="info" onDismiss={() => setInfoOpen(false)}>
          Scopes are enforced by the backend. This form only requests the assignment.
        </Banner>
      )}
      {!user && isSubmitted && errors.divisionIds?.message === 'Division is required' && (
        <Banner tone="error">Division is required before the account can be created (SCN-422).</Banner>
      )}
      {failure !== null && (
        <Banner
          tone="error"
          title={conflict ? '409 · Changed by another administrator' : 'The user was not saved'}
          action={
            conflict && user ? (
              <Button variant="secondary" onClick={onReload}>
                Reload latest
              </Button>
            ) : undefined
          }
        >
          {errorMessage(failure)}
        </Banner>
      )}

      <div className={styles.withSide}>
        <Card title="Account details">
          <form id="user-form" className={styles.form} onSubmit={onSubmit} noValidate>
            <div className={styles.formGrid}>
              <TextField label="Full name" required placeholder="e.g. Ishara Kumari" error={errors.fullName?.message} {...register('fullName')} />
              <TextField
                label="Email"
                required
                type="email"
                icon="mail"
                placeholder="name@example.test"
                autoComplete="off"
                error={errors.email?.message}
                {...register('email')}
              />
              <TextField
                label="Phone number"
                required
                type="tel"
                autoComplete="off"
                placeholder="+94771234567 or 0771234567"
                error={errors.phone?.message}
                {...register('phone')}
              />
              <TextField label="Employee / Staff ID" required autoComplete="off" placeholder="e.g. EMP-014" error={errors.employeeId?.message} {...register('employeeId')} />
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <SelectField
                    ref={field.ref}
                    name={field.name}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={(event) => requestRoleChange(event.target.value as UserRole)}
                    label="Role"
                    required
                    placeholder="Select role"
                    options={ROLE_OPTIONS.map((item) => ({ value: item, label: ROLE_LABELS[item] }))}
                    error={errors.role?.message}
                  />
                )}
              />
              <SelectField
                label="Status"
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
                {...register('status')}
              />
              <SelectField
                label="Preferred language"
                required
                placeholder="Select language"
                options={PREFERRED_LANGUAGES}
                error={errors.preferredLanguage?.message}
                {...register('preferredLanguage')}
              />
            </div>

            {showPersonal && <PersonalDetailsFields register={register} errors={errors} today={today} />}

            <h3 className={styles.sectionTitle}>Scope assignment</h3>
            {scopeKept && user ? (
              <Banner tone="info" title={`Current scope: ${scopeLabel(user)}`}>
                This user holds a scope this form cannot show. It is kept unchanged.{' '}
                <Link to={`/admin/users/${user.id}/scope`} className={styles.link}>
                  Manage scope
                </Link>
              </Banner>
            ) : level === 'all_estates' ? (
              <div>
                <p className={styles.idStrong}>All estates</p>
                <p className={styles.caption}>Administrators hold all estates. No estate or division is assigned.</p>
              </div>
            ) : level === 'estate' ? (
              <Controller
                control={control}
                name="estateIds"
                render={({ field, fieldState }) => (
                  <EstateChecklist
                    estates={estates}
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                    isRequired={required('estateIds')}
                    inputRef={field.ref}
                  />
                )}
              />
            ) : (
              <div className={styles.formGrid}>
                <SelectField
                  label="Estate"
                  required
                  placeholder="Select estate"
                  options={estates.map((estate) => ({ value: estate.id, label: estate.name, disabled: estate.status !== 'active' }))}
                  error={errors.estateId?.message}
                  disabled={!role}
                  hint={!role ? 'Select a role first' : undefined}
                  {...register('estateId')}
                />
                {level === 'division' && (
                  <Controller
                    control={control}
                    name="divisionIds"
                    render={({ field, fieldState }) => (
                      <fieldset className={styles.fieldset} aria-describedby={fieldState.error ? 'division-error' : undefined}>
                        <legend className={styles.legend}>
                          <LegendText text="Divisions" isRequired={required('divisionIds')} />
                        </legend>
                        <div className={styles.checkList} aria-invalid={Boolean(fieldState.error) || undefined}>
                          {!estateId ? (
                            <p className={styles.caption}>Select an estate to list divisions</p>
                          ) : estateDivisions.length === 0 ? (
                            <p className={styles.caption}>This estate has no divisions.</p>
                          ) : (
                            estateDivisions.map((division, index) => (
                              <Checkbox
                                key={division.id}
                                ref={index === 0 ? field.ref : undefined}
                                label={`${division.name} (${division.id})`}
                                checked={field.value.includes(division.id)}
                                disabled={division.status !== 'active' && !field.value.includes(division.id)}
                                aria-describedby={fieldState.error ? 'division-error' : undefined}
                                onChange={(event) =>
                                  field.onChange(
                                    event.target.checked
                                      ? [...field.value, division.id].sort()
                                      : field.value.filter((id) => id !== division.id),
                                  )
                                }
                              />
                            ))
                          )}
                        </div>
                        {fieldState.error && (
                          <p id="division-error" className={styles.fieldError} role="alert">
                            {fieldState.error.message}
                          </p>
                        )}
                      </fieldset>
                    )}
                  />
                )}
              </div>
            )}

            <RoleDetailsFields
              register={register}
              errors={errors}
              role={role}
              reportsToOptions={reportsToOptions}
              supervisorOptions={supervisorOptions}
              fieldWorkerEstateId={fieldWorkerEstates.size > 0 ? [...fieldWorkerEstates][0] ?? '' : ''}
            />

            {!user && <p className={styles.caption}>{invitationNote}</p>}
          </form>
        </Card>

        <div className={styles.stack}>
          <Card title="Role permissions preview">
            <p className={definition ? styles.idStrong : styles.muted}>{definition ? ROLE_LABELS[definition.role] : 'Role not selected'}</p>
            {definition && (
              <ul className={styles.permissionList}>
                {definition.permissions.map((code) => (
                  <li key={code}>
                    <Icon name="check" size={14} className={styles.checkIcon} />
                    <span>
                      {permissionLabel(code)} <span className={styles.muted}>({code})</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Access notes">
            <ul className={styles.noteList}>
              <li>Field workers use the mobile app for capture. The web application never creates observations.</li>
              <li>Division scope uses division IDs only. No bush-level identifiers are stored.</li>
            </ul>
          </Card>
        </div>
      </div>

      <RoleChangeDialog
        from={role}
        to={pendingRole ? pendingRole.role : null}
        lost={pendingRole?.lost ?? []}
        onConfirm={() => pendingRole && applyRole(pendingRole.role)}
        onCancel={() => setPendingRole(null)}
      />

      <Modal
        open={review !== null}
        title="Review and create user"
        onClose={() => !createUser.isPending && setReview(null)}
        dismissible={!createUser.isPending}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReview(null)} disabled={createUser.isPending}>
              Back to edit
            </Button>
            <Button icon="check" onClick={() => review && save(review)} loading={createUser.isPending} loadingLabel="Creating…" data-autofocus>
              Create user
            </Button>
          </>
        }
      >
        {review && (
          <div className={styles.stack}>
            <DescriptionList
              columns={2}
              items={[
                { label: 'Name', value: review.fullName },
                { label: 'Email', value: review.email },
                { label: 'Phone number', value: review.phone },
                { label: 'Employee / Staff ID', value: review.employeeId },
                { label: 'Preferred language', value: review.preferredLanguage ? preferredLanguageLabel(review.preferredLanguage) : '—' },
                { label: 'Role', value: review.role ? ROLE_LABELS[review.role] : '—' },
                { label: 'Status', value: <Badge tone={review.status === 'active' ? 'success' : 'neutral'}>{review.status === 'active' ? 'Active' : 'Inactive'}</Badge> },
                { label: 'Scope', value: reviewScope(review) },
                ...reviewRoleDetails(review),
                ...(showPersonal
                  ? [
                      { label: 'NIC', value: review.nic.trim() ? maskNic(review.nic) : 'Not provided' },
                      { label: 'Date of birth', value: review.dateOfBirth || 'Not provided' },
                    ]
                  : []),
              ]}
            />
            <p className={styles.caption}>
              {demo
                ? 'Demonstration data: the account is held in this browser tab only and no invitation is sent.'
                : 'The backend creates the account, applies the scope and sends the invitation link.'}
            </p>
          </div>
        )}
      </Modal>
    </>
  )
}
