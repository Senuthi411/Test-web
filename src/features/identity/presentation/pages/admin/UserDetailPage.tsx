import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import {
  Avatar,
  Banner,
  ButtonLink,
  Card,
  DataTable,
  DescriptionList,
  PageHeader,
  Tabs,
  Timeline,
  tabPanelProps,
  usePageBreadcrumbs,
} from '@/shared/components'
import { ROLE_LABELS } from '@/shared/types'
import { formatIsoDate } from '@/shared/utilities/format'
import type { DeviceSession, UserDetail } from '../../../domain/models'
import { roleDefinition } from '../../../domain/roles'
import { shortEstateName } from '../../../domain/scope'
import { QueryBoundary, RoleBadge, SessionStatusBadge, StatusBadge } from '../../components/common'
import { activityLink, divisionPath, estatePath, useDemoWording, useRelativeTime } from '../../components/helpers'
import { useUserDetail } from '../../services/queries'
import styles from '../../components/identity.module.css'

type TabId = 'overview' | 'scope' | 'sessions' | 'activity'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'scope', label: 'Scope assignments' },
  { id: 'sessions', label: 'Device sessions' },
  { id: 'activity', label: 'Activity' },
] as const

/** Navigation state set by the create and edit forms, so the outcome is announced here. */
export interface UserSavedState {
  userSaved?: 'created' | 'updated' | 'scope'
}

function estateValue(detail: UserDetail): string {
  if (detail.user.role === 'ADMINISTRATOR') return `All estates (${detail.estates.length})`
  if (detail.user.role === 'FIELD_WORKER') return detail.estates.map((estate) => estate.name).join(', ') || '—'
  return detail.estates.map((estate) => shortEstateName(estate.name)).join(', ') || '—'
}

/** ID-04 User Detail (Figma 15:459 and the per-user variants). */
export function UserDetailPage() {
  const { userId = '' } = useParams()
  const query = useUserDetail(userId)
  usePageBreadcrumbs(
    query.data
      ? [
          { label: 'Administration', to: '/admin' },
          { label: 'Users', to: '/admin/users' },
          { label: query.data.user.fullName },
        ]
      : null,
  )
  return (
    <div className={styles.page}>
      <QueryBoundary query={query}>{(detail) => <UserDetailView detail={detail} />}</QueryBoundary>
    </div>
  )
}

function UserDetailView({ detail }: { detail: UserDetail }) {
  const { user } = detail
  const [tab, setTab] = useState<TabId>('overview')
  const location = useLocation()
  const navigate = useNavigate()
  const saved = (location.state as UserSavedState | null)?.userSaved
  const [showSaved, setShowSaved] = useState(Boolean(saved))
  const relative = useRelativeTime()
  const { demo, illustrative } = useDemoWording()
  const definition = roleDefinition(user.role)
  const isFieldWorker = user.role === 'FIELD_WORKER'
  const created = user.createdAt ? `${formatIsoDate(user.createdAt)}${demo ? ' (demo)' : ''}` : '—'

  const savedMessage =
    saved === 'created'
      ? `${user.fullName} (${user.id}) was created with the scope shown below.`
      : saved === 'scope'
        ? `The scope of ${user.fullName} was updated.`
        : `The changes to ${user.fullName} were saved.`

  const overview = (
    <Card title="Account information">
      <DescriptionList
        columns={3}
        items={[
          { label: 'Full name', value: user.fullName },
          { label: 'Role', value: ROLE_LABELS[user.role] },
          { label: 'Status', value: <StatusBadge status={user.status} /> },
          isFieldWorker
            ? { label: 'Primary estate', value: detail.estates[0] ? `${detail.estates[0].id} ${shortEstateName(detail.estates[0].name)}` : '—' }
            : {
                label: 'Estate scope',
                value: detail.estates.map((estate) => `${estate.id} ${shortEstateName(estate.name)}`).join(', ') || '—',
              },
          { label: isFieldWorker ? 'Capture permissions' : 'Permissions', value: definition.permissionSummary },
          { label: isFieldWorker ? 'Last device session' : 'Last sign-in', value: relative(user.lastSignInAt) },
        ]}
      />
    </Card>
  )

  const scopeCard = (
    <Card
      title="Scope assignments"
      action={
        user.role !== 'ADMINISTRATOR' ? (
          <Link to={`/admin/users/${user.id}/scope`} className={styles.link}>
            Manage scopes
          </Link>
        ) : undefined
      }
    >
      {isFieldWorker ? (
        <DataTable
          caption="Division scope"
          rows={detail.divisions}
          rowKey={(division) => division.id}
          onRowActivate={(division) => navigate(divisionPath(division.id))}
          empty={<p className={styles.caption}>No divisions are assigned.</p>}
          columns={[
            { id: 'division', header: 'Division', cell: (division) => <span className={styles.idStrong}>{division.name}</span> },
            { id: 'id', header: 'Division ID', cell: (division) => division.id },
            { id: 'estate', header: 'Estate', cell: (division) => division.estateName },
            { id: 'assigned', header: 'Assigned', cell: () => (user.scopeAssignedAt ? formatIsoDate(user.scopeAssignedAt) : '—') },
            { id: 'status', header: 'Status', cell: (division) => <StatusBadge status={division.status} /> },
          ]}
        />
      ) : (
        <DataTable
          caption="Estate scope"
          rows={detail.estates}
          rowKey={(estate) => estate.id}
          onRowActivate={(estate) => navigate(estatePath(estate.id))}
          empty={<p className={styles.caption}>No estates are assigned.</p>}
          columns={[
            { id: 'estate', header: 'Estate', cell: (estate) => <span className={styles.idStrong}>{estate.name}</span> },
            { id: 'id', header: 'Estate ID', cell: (estate) => estate.id },
            { id: 'region', header: 'Region', cell: (estate) => estate.region },
            { id: 'assigned', header: 'Assigned', cell: () => (user.scopeAssignedAt ? formatIsoDate(user.scopeAssignedAt) : '—') },
            { id: 'status', header: 'Status', cell: (estate) => <StatusBadge status={estate.status} /> },
          ]}
        />
      )}
    </Card>
  )

  const sessionsCard = (
    <Card
      title={`Recent device sessions${illustrative}`}
      action={
        <Link to={`/admin/device-sessions?user=${user.id}`} className={styles.link}>
          All sessions
        </Link>
      }
    >
      <DataTable<DeviceSession>
        caption="Device sessions"
        rows={detail.deviceSessions}
        rowKey={(session) => session.id}
        onRowActivate={(session) => navigate(`/admin/device-sessions?session=${session.id}`)}
        empty={
          <p className={styles.caption}>
            {isFieldWorker
              ? `No device sessions yet — ${user.id} has not signed in. Sessions appear after the first mobile sign-in.`
              : 'No device sessions are listed for this user. Field Workers sign in on the mobile app.'}
          </p>
        }
        columns={[
          { id: 'session', header: 'Session', cell: (session) => <span className={styles.idStrong}>{session.id}</span> },
          { id: 'device', header: 'Device', cell: (session) => session.device },
          { id: 'seen', header: 'Last seen', cell: (session) => relative(session.lastSeenAt) },
          { id: 'status', header: 'Status', cell: (session) => <SessionStatusBadge status={session.status} /> },
        ]}
      />
    </Card>
  )

  const activityCard = (
    <Card title={`Recent activity — ${user.fullName}${illustrative}`}>
      {detail.activity.length === 0 ? (
        <p className={styles.caption}>No activity is recorded for this user.</p>
      ) : (
        <Timeline
          label={`Recent activity for ${user.fullName}`}
          items={detail.activity.map((event, index) => {
            const to = activityLink(event)
            return {
              id: event.id,
              state: index === detail.activity.length - 1 ? 'open' : 'done',
              title: to ? (
                <Link to={to} className={styles.link}>
                  {event.title}
                </Link>
              ) : (
                event.title
              ),
              detail: [event.detail, relative(event.at)].filter(Boolean).join(' · '),
            }
          })}
        />
      )}
    </Card>
  )

  return (
    <>
      <PageHeader
        back={{ to: '/admin/users', label: 'Back to users' }}
        title={user.fullName}
        subtitle={`${user.id} · ${ROLE_LABELS[user.role]} · ${user.email}`}
        actions={
          <>
            <ButtonLink to={`/admin/device-sessions?user=${user.id}`} variant="destructiveOutline" icon="lock">
              Revoke sessions
            </ButtonLink>
            <ButtonLink to={`/admin/users/${user.id}/edit`} icon="edit">
              Edit user
            </ButtonLink>
          </>
        }
      />
      {showSaved && (
        <Banner tone="success" title={saved === 'created' ? 'User created' : 'Changes saved'} onDismiss={() => setShowSaved(false)}>
          {savedMessage}
          {demo && ' The change is held in this browser tab only (demonstration data).'}
        </Banner>
      )}
      <div className={styles.sideFirst}>
        <Card>
          <div className={styles.profileCard}>
            <Avatar name={user.fullName} size={88} />
            <h2 className={styles.profileName}>{user.fullName}</h2>
            <div className={styles.badgeRow}>
              <RoleBadge role={user.role} />
              <StatusBadge status={user.status} />
            </div>
            <hr className={styles.divider} />
            <div className={styles.fullWidth}>
              <DescriptionList
                items={[
                  { label: 'User ID', value: user.id },
                  { label: 'Email', value: user.email },
                  { label: 'Estate', value: estateValue(detail) },
                  isFieldWorker
                    ? { label: 'Mobile sync', value: 'Separate from review status' }
                    : { label: 'Scope type', value: user.role === 'ADMINISTRATOR' ? 'All estates' : 'Estate-level scope' },
                  { label: 'Created', value: created },
                ]}
              />
            </div>
          </div>
        </Card>
        <div className={styles.stack}>
          <Tabs items={TABS} value={tab} onChange={setTab} label="User sections" idBase="user-detail" />
          <div {...tabPanelProps('user-detail', tab)} className={styles.stack}>
            {tab === 'overview' && (
              <>
                {overview}
                {scopeCard}
                {sessionsCard}
              </>
            )}
            {tab === 'scope' && scopeCard}
            {tab === 'sessions' && sessionsCard}
            {tab === 'activity' && activityCard}
          </div>
        </div>
      </div>
    </>
  )
}
