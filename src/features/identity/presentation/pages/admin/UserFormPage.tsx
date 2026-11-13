import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form'
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
import type { DivisionSummary, EstateSummary, IdentityUser } from '../../../domain/models'
import { permissionLabel, roleDefinition } from '../../../domain/roles'
import { scopeFromDraft, validateUserDraft, type UserDraft } from '../../../domain/rules'
import { scopeLevelFor } from '../../../domain/scope'
import { QueryBoundary } from '../../components/common'
import { errorMessage, fieldErrorsOf, scopeLabel, useDemoWording, userPath } from '../../components/helpers'
import { useCreateUser, useDivisions, useEstates, useUpdateUser, useUserDetail } from '../../services/queries'
import type { UserSavedState } from './UserDetailPage'
import styles from '../../components/identity.module.css'

const ROLE_OPTIONS: UserRole[] = ['ADMINISTRATOR', 'SUPERVISOR', 'DISEASE_EXPERT', 'FIELD_WORKER', 'REPORTING_USER']

const EMPTY_DRAFT: UserDraft = { fullName: '', email: '', role: '', status: 'active', estateId: '', divisionIds: [] }

/**
 * Whether the form's single-estate fields can show the user's current scope exactly.
 * Supervisors or experts holding several estates (e.g. USR-005) keep their scope here and
 * change it on ID-08, so an edit never silently drops an estate.
 */
function representable(user: IdentityUser, divisions: readonly DivisionSummary[]): UserDraft | null {
  const base = { fullName: user.fullName, email: user.email, role: user.role, status: user.status }
  const level = scopeLevelFor(user.role)
  if (level === 'all_estates') return { ...base, estateId: '', divisionIds: [] }
  if (level === 'estate') return user.estateIds.length === 1 ? { ...base, estateId: user.estateIds[0] ?? '', divisionIds: [] } : null
  const estates = new Set(user.divisionIds.map((id) => divisions.find((division) => division.id === id)?.estateId))
  if (estates.size !== 1) return null
  return { ...base, estateId: [...estates][0] ?? '', divisionIds: [...user.divisionIds] }
}

/** ID-05 Create User (15:712) and ID-06 Edit User (15:891). */
export function UserFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const estates = useEstates()
  const divisions = useDivisions()
  return (
    <div className={styles.page}>
      {mode === 'create' ? (
        <>
          <CreateBreadcrumbs />
          <QueryBoundary query={estates}>
            {(estateList) => (
              <QueryBoundary query={divisions}>{(divisionList) => <UserForm estates={estateList} divisions={divisionList} />}</QueryBoundary>
            )}
          </QueryBoundary>
        </>
      ) : (
        <EditLoader estates={estates} divisions={divisions} />
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

function EditLoader({ estates, divisions }: { estates: ReturnType<typeof useEstates>; divisions: ReturnType<typeof useDivisions> }) {
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
                <UserForm
                  key={`${loaded.user.id}-${reloads}`}
                  user={loaded.user}
                  estates={estateList}
                  divisions={divisionList}
                  onReload={() => void detail.refetch().then((result) => {
                    if (result.isSuccess) setReloads((count) => count + 1)
                  })}
                />
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
  onReload?: () => void
}

function UserForm({ user: loadedUser, estates, divisions, onReload }: UserFormProps) {
  // The draft and expectedVersion must describe the same snapshot, even if queries
  // refresh in the background. Only an explicit reload starts a new edit.
  const [user] = useState(loadedUser)
  const editing = Boolean(user)
  const navigate = useNavigate()
  const { demo } = useDemoWording()
  const createUser = useCreateUser()
  const updateUser = useUpdateUser(user?.id ?? '')
  const mutation = editing ? updateUser : createUser

  const initial = useMemo(() => (user ? representable(user, divisions) : EMPTY_DRAFT), [user, divisions])
  const divisionEstate = useMemo(() => {
    const map = new Map(divisions.map((division) => [division.id, division.estateId]))
    return (id: string) => map.get(id)
  }, [divisions])

  const [infoOpen, setInfoOpen] = useState(true)
  const [review, setReview] = useState<UserDraft | null>(null)
  const [failure, setFailure] = useState<unknown>(null)

  const resolver: Resolver<UserDraft> = (values) => {
    const keepScope = keepsCurrentScope(values)
    const errors = validateUserDraft(keepScope ? { ...values, estateId: 'kept', divisionIds: ['kept'] } : values, (id) =>
      keepScope ? 'kept' : divisionEstate(id),
    )
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
    formState: { errors, isSubmitted },
  } = useForm<UserDraft>({
    resolver,
    defaultValues: initial ?? {
      fullName: user?.fullName ?? '',
      email: user?.email ?? '',
      role: user?.role ?? '',
      status: user?.status ?? 'active',
      estateId: '',
      divisionIds: [],
    },
  })

  const role = useWatch({ control, name: 'role' })
  const estateId = useWatch({ control, name: 'estateId' })
  const level = role ? scopeLevelFor(role) : null

  /** Edit only: the current scope cannot be shown in this form and the scope level is unchanged. */
  function keepsCurrentScope(values: Pick<UserDraft, 'role'>): boolean {
    if (!user || initial) return false
    return Boolean(values.role) && values.role !== '' && scopeLevelFor(values.role) === scopeLevelFor(user.role)
  }
  const scopeKept = keepsCurrentScope({ role })

  // Changing estate drops divisions from another estate.
  useEffect(() => {
    const current = getValues('divisionIds')
    const kept = current.filter((id) => divisionEstate(id) === estateId)
    if (kept.length !== current.length) setValue('divisionIds', kept)
  }, [estateId, divisionEstate, getValues, setValue])

  const estateDivisions = divisions.filter((division) => division.estateId === estateId)

  function toInput(values: UserDraft) {
    if (!values.role) throw new Error('Role is required')
    const scope = scopeKept && user ? { estateIds: user.estateIds, divisionIds: user.divisionIds } : scopeFromDraft(values)
    return { fullName: values.fullName, email: values.email, role: values.role, status: values.status, scope }
  }

  function applyServerErrors(error: unknown) {
    const fieldErrors = fieldErrorsOf(error)
    const known: Array<keyof UserDraft> = ['fullName', 'email', 'role', 'estateId', 'divisionIds']
    let mapped = false
    for (const [path, message] of Object.entries(fieldErrors)) {
      if ((known as string[]).includes(path)) {
        setError(path as keyof UserDraft, { type: 'server', message })
        mapped = true
      }
    }
    if (!mapped) setFailure(error)
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

  const onSubmit = handleSubmit((values) => (editing ? save(values) : setReview(values)))
  const cancelTo = user ? userPath(user.id) : '/admin/users'
  const definition = role ? roleDefinition(role) : null
  const conflict = isAppError(failure) && failure.kind === 'conflict'

  const estateName = (id: string) => estates.find((estate) => estate.id === id)?.name ?? id
  const reviewScope = (draft: UserDraft) => {
    if (!draft.role) return '—'
    const draftLevel = scopeLevelFor(draft.role)
    if (draftLevel === 'all_estates') return 'All estates'
    if (draftLevel === 'estate') return estateName(draft.estateId)
    const names = draft.divisionIds.map((id) => `${divisions.find((division) => division.id === id)?.name ?? id} (${id})`)
    return `${estateName(draft.estateId)} · ${names.join(', ')}`
  }

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
              <SelectField
                label="Role"
                required
                placeholder="Select role"
                options={ROLE_OPTIONS.map((item) => ({ value: item, label: ROLE_LABELS[item] }))}
                error={errors.role?.message}
                {...register('role')}
              />
              <SelectField
                label="Status"
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
                {...register('status')}
              />
            </div>

            <h3 className={styles.sectionTitle}>Scope assignment</h3>
            {scopeKept && user ? (
              <Banner tone="info" title={`Current scope: ${scopeLabel(user)}`}>
                This user holds a scope this form cannot show. It is kept unchanged.{' '}
                <Link to={`/admin/users/${user.id}/scope`} className={styles.link}>
                  Manage scope
                </Link>
              </Banner>
            ) : level === 'all_estates' ? (
              <p className={styles.caption}>Administrators hold all estates. No estate or division is assigned.</p>
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
                        <legend className={styles.legend}>Divisions *</legend>
                        <div className={styles.checkList} aria-invalid={Boolean(fieldState.error) || undefined}>
                          {!estateId ? (
                            <p className={styles.caption}>Select an estate to list divisions</p>
                          ) : estateDivisions.length === 0 ? (
                            <p className={styles.caption}>This estate has no divisions.</p>
                          ) : (
                            estateDivisions.map((division) => (
                              <Checkbox
                                key={division.id}
                                label={`${division.name} (${division.id})`}
                                checked={field.value.includes(division.id)}
                                disabled={division.status !== 'active' && !field.value.includes(division.id)}
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
                { label: 'Role', value: review.role ? ROLE_LABELS[review.role] : '—' },
                { label: 'Status', value: <Badge tone={review.status === 'active' ? 'success' : 'neutral'}>{review.status === 'active' ? 'Active' : 'Inactive'}</Badge> },
                { label: 'Scope', value: reviewScope(review) },
              ]}
            />
            <p className={styles.caption}>
              {demo
                ? 'Demonstration data: the account is held in this browser tab only and no invitation is sent.'
                : 'The backend creates the account and applies the scope.'}
            </p>
          </div>
        )}
      </Modal>
    </>
  )
}
