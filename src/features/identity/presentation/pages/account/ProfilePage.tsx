import { useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { useNavigate } from 'react-router'
import {
  Avatar,
  Banner,
  Button,
  Card,
  DescriptionList,
  PageHeader,
  PasswordField,
  SelectField,
  TextField,
  Toggle,
  usePageBreadcrumbs,
  useToast,
} from '@/shared/components'
import { ROLE_LABELS } from '@/shared/types'
import type { NotificationPreferenceKey, Profile } from '../../../domain/models'
import { MIN_PASSWORD_LENGTH, validatePasswordChange, type PasswordChangeDraft } from '../../../domain/rules'
import { QueryBoundary, RoleBadge } from '../../components/common'
import { errorMessage, fieldErrorsOf, scopeLabel, useRelativeTime } from '../../components/helpers'
import { useChangePassword, useProfile, useSetNotificationPreference, useUpdateProfile } from '../../services/queries'
import { useCurrentSession, useSession } from '../../session/sessionContext'
import styles from '../../components/identity.module.css'
import profileStyles from './ProfilePage.module.css'

const NOTIFICATIONS: ReadonlyArray<{ key: NotificationPreferenceKey; label: string; description: string }> = [
  { key: 'reviewEscalations', label: 'Review escalations', description: 'Notify when a review needs administrator attention' },
  { key: 'deviceSessionAlerts', label: 'Device session alerts', description: 'Notify when a device session is revoked' },
  { key: 'weeklySummary', label: 'Weekly summary email', description: 'Digest of administrative changes' },
]

/** ID-14 My Profile (Figma 17:934). Every web role can open it. */
export function ProfilePage() {
  usePageBreadcrumbs([{ label: 'Account' }, { label: 'My Profile' }])
  const session = useCurrentSession()
  const { signOut } = useSession()
  const navigate = useNavigate()
  const query = useProfile(session.user.id)
  const [signingOut, setSigningOut] = useState(false)

  async function onSignOut() {
    setSigningOut(true)
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="My Profile"
        subtitle="Manage your personal details, security and notifications"
        actions={
          <Button variant="secondary" icon="logout" onClick={() => void onSignOut()} loading={signingOut} loadingLabel="Signing out…">
            Sign out
          </Button>
        }
      />
      <QueryBoundary query={query}>{(profile) => <ProfileView profile={profile} />}</QueryBoundary>
    </div>
  )
}

function ProfileView({ profile }: { profile: Profile }) {
  const { user } = profile
  const relative = useRelativeTime()
  return (
    <div className={styles.sideFirst}>
      <Card>
        <div className={styles.profileCard}>
          <Avatar name={user.fullName} size={96} />
          <h2 className={styles.profileName}>{user.fullName}</h2>
          <div className={styles.badgeRow}>
            <RoleBadge role={user.role} />
          </div>
          <span className={styles.muted}>{user.email}</span>
          <hr className={styles.divider} />
          <div className={styles.fullWidth}>
            <DescriptionList
              items={[
                { label: 'User ID', value: user.id },
                { label: 'Scope', value: scopeLabel(user) },
                { label: 'Last sign-in', value: relative(user.lastSignInAt) },
              ]}
            />
          </div>
        </div>
      </Card>
      <div className={styles.stack}>
        <PersonalInformation profile={profile} />
        <SecurityCard userId={user.id} />
        <NotificationsCard profile={profile} />
      </div>
    </div>
  )
}

interface PersonalValues {
  fullName: string
  language: Profile['language']
}

function PersonalInformation({ profile }: { profile: Profile }) {
  const { user } = profile
  const toast = useToast()
  const { updateUser } = useSession()
  const update = useUpdateProfile(user.id)
  const [failure, setFailure] = useState<unknown>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<PersonalValues>({
    defaultValues: { fullName: user.fullName, language: profile.language },
  })

  const onSubmit = handleSubmit((values) => {
    setFailure(null)
    update.mutate(values, {
      onSuccess: (saved) => {
        reset({ fullName: saved.user.fullName, language: saved.language })
        updateUser({ fullName: saved.user.fullName })
        toast.show({ tone: 'success', title: 'Personal details saved' })
      },
      onError: setFailure,
    })
  })

  return (
    <Card title="Personal information">
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        {failure !== null && (
          <Banner tone="error" title="Your details were not saved">
            {errorMessage(failure)}
          </Banner>
        )}
        <div className={styles.formGrid}>
          <TextField
            label="Full name"
            required
            autoComplete="name"
            error={errors.fullName?.message}
            {...register('fullName', { validate: (value) => (value.trim() ? true : 'Full name is required') })}
          />
          <TextField label="Email" value={user.email} readOnly hint="Your administrator manages your email address." className={profileStyles.readOnly} />
          <TextField label="Role" value={ROLE_LABELS[user.role]} readOnly className={profileStyles.readOnly} />
          <SelectField label="Language" options={[{ value: 'en', label: 'English' }]} {...register('language')} />
        </div>
        <div className={styles.formActions}>
          <Button type="submit" disabled={!isDirty} loading={update.isPending} loadingLabel="Saving…">
            Save details
          </Button>
        </div>
      </form>
    </Card>
  )
}

const passwordResolver: Resolver<PasswordChangeDraft> = (values) => {
  const errors = Object.entries(validatePasswordChange(values)).filter(([, message]) => message)
  if (errors.length === 0) return { values, errors: {} }
  return { values: {}, errors: Object.fromEntries(errors.map(([field, message]) => [field, { type: 'validation', message }])) }
}

function SecurityCard({ userId }: { userId: string }) {
  const change = useChangePassword(userId)
  const [result, setResult] = useState<{ ok: true } | { ok: false; error: unknown } | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<PasswordChangeDraft>({
    resolver: passwordResolver,
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const onSubmit = handleSubmit((values) => {
    setResult(null)
    change.mutate(
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      {
        onSuccess: () => {
          reset()
          setResult({ ok: true })
        },
        onError: (error) => {
          const fields = fieldErrorsOf(error)
          if (fields.currentPassword) setError('currentPassword', { type: 'server', message: fields.currentPassword })
          else setResult({ ok: false, error })
        },
      },
    )
  })

  return (
    <Card title="Security">
      <form className={styles.form} onSubmit={onSubmit} noValidate aria-label="Change password">
        <div className={styles.formGrid}>
          <PasswordField label="Current password" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />
          <span aria-hidden="true" />
          <PasswordField
            label="New password"
            placeholder={`Minimum ${MIN_PASSWORD_LENGTH} characters`}
            autoComplete="new-password"
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />
          <PasswordField
            label="Confirm password"
            placeholder="Repeat new password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
        </div>
        {result?.ok && (
          <p className={profileStyles.success} role="status">
            Password updated. Use the new password the next time you sign in.
          </p>
        )}
        {result && !result.ok && (
          <Banner tone="error" title="Your password was not changed">
            {errorMessage(result.error)}
          </Banner>
        )}
        <div className={styles.formActions}>
          <Button type="submit" icon="lock" loading={change.isPending} loadingLabel="Updating…">
            Update password
          </Button>
        </div>
      </form>
    </Card>
  )
}

function NotificationsCard({ profile }: { profile: Profile }) {
  const toast = useToast()
  const setPreference = useSetNotificationPreference(profile.user.id)
  const [pendingKey, setPendingKey] = useState<NotificationPreferenceKey | null>(null)

  function onToggle(key: NotificationPreferenceKey, enabled: boolean) {
    setPendingKey(key)
    setPreference.mutate(
      { key, enabled },
      {
        onSuccess: () => toast.show({ tone: 'success', title: 'Notification preference saved' }),
        onError: (error) => toast.show({ tone: 'error', title: 'Preference not saved', message: errorMessage(error) }),
        onSettled: () => setPendingKey(null),
      },
    )
  }

  return (
    <Card title="Notifications">
      <ul className={profileStyles.toggles}>
        {NOTIFICATIONS.map((item) => (
          <li key={item.key}>
            <Toggle
              label={item.label}
              description={item.description}
              checked={profile.notificationPreferences[item.key]}
              disabled={pendingKey !== null}
              onChange={(event) => onToggle(item.key, event.target.checked)}
            />
          </li>
        ))}
      </ul>
    </Card>
  )
}
