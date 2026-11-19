import { Link, useNavigate, useSearchParams } from 'react-router'
import {
  Badge,
  Banner,
  Card,
  DataTable,
  KpiCard,
  PageHeader,
  Tabs,
  tabPanelProps,
  usePageBreadcrumbs,
  type BadgeTone,
  type TabItem,
} from '@/shared/components'
import { ROLE_LABELS } from '@/shared/types'
import { formatDateTime } from '@/shared/utilities/format'
import { SECURITY_EVENT_KINDS } from '../../../domain/auditLog'
import { unreportedAlertKinds, type SecurityAlertKind } from '../../../domain/adminDashboard'
import type { IdentityUser, OpenRecovery } from '../../../domain/models'
import { POLICY_STATUS_LABELS, SECURITY_POLICY_GROUPS, type PolicyStatus, type SecurityPolicy } from '../../../domain/securityPolicies'
import { StatusBadge } from '../../components/common'
import { scopeLabel, useDemoWording, userPath } from '../../components/helpers'
import { useAdminDashboard, useDeviceSessions, useSecurityAlerts, useUsers } from '../../services/queries'
import styles from '../../components/identity.module.css'
import { ALERT_KIND_LABELS } from './dashboard/dashboardLabels'
import { SectionBoundary } from './dashboard/SectionBoundary'
import { SecurityAlertsCard } from './dashboard/SecurityAlertsCard'
import { AuditLogTable } from './audit/AuditLogTable'

type SecurityTab = 'overview' | 'authentication' | 'devices' | 'events'

const SECURITY_TABS: readonly TabItem<SecurityTab>[] = [
  { id: 'overview', label: 'Security Overview' },
  { id: 'authentication', label: 'Authentication Policies' },
  { id: 'devices', label: 'Device Security' },
  { id: 'events', label: 'Security Events' },
]

/** Links to the earlier Security & Settings tabs keep working. */
const LEGACY_TABS: Record<string, SecurityTab> = { mfa: 'authentication', accounts: 'overview', policies: 'authentication', audit: 'events' }

function securityTab(value: string | null): SecurityTab {
  if (SECURITY_TABS.some((tab) => tab.id === value)) return value as SecurityTab
  return (value && LEGACY_TABS[value]) || 'overview'
}

const POLICY_TONES: Record<PolicyStatus, BadgeTone> = { approved: 'success', proposed: 'warning', not_defined: 'neutral' }

const AUTHENTICATION_GROUPS = ['Authentication', 'Account recovery', 'Exceptional access']
const DEVICE_GROUPS = ['Sessions and devices']

/**
 * ID-17 Security Center: security visibility and read-only policy information. Every figure
 * comes from a source that records it; anything a source does not record is said to be
 * "not reported". No security control is offered until its backend contract and
 * enforcement exist, so nothing here can succeed only on screen.
 */
export function SecurityCenterPage() {
  usePageBreadcrumbs([{ label: 'Administration', to: '/admin' }, { label: 'Security Center' }])
  const { demo } = useDemoWording()
  const [params, setParams] = useSearchParams()
  const tab = securityTab(params.get('tab'))

  return (
    <div className={styles.page}>
      <PageHeader
        title="Security Center"
        subtitle={`Account security, authentication and device policies, and security events.${demo ? ' Demonstration data: the backend enforces the real policies.' : ''}`}
      />
      <Tabs
        items={SECURITY_TABS}
        value={tab}
        onChange={(next) => setParams(next === 'overview' ? {} : { tab: next }, { replace: true })}
        label="Security Center sections"
        idBase="security"
      />
      <div {...tabPanelProps('security', tab)} className={styles.stack}>
        {tab === 'overview' && <OverviewTab />}
        {tab === 'authentication' && <AuthenticationTab />}
        {tab === 'devices' && <DeviceSecurityTab />}
        {tab === 'events' && (
          <AuditLogTable
            title="Security events"
            kinds={SECURITY_EVENT_KINDS}
            emptyMessage="Role, scope and account-status changes, device-session revocations and rejected configuration publishes appear here once they are recorded."
            note={
              <>
                The same records as <Link to="/admin/audit-logs" className={styles.link}>Audit Logs</Link>. Sign-in attempts, lockouts and MFA administration are
                not recorded by this audit source yet.
              </>
            }
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------------------

function OverviewTab() {
  const users = useUsers()
  const dashboard = useAdminDashboard()
  const sessions = useDeviceSessions()

  return (
    <>
      <SectionBoundary queries={[users, dashboard, sessions]} unavailable="The Identity service does not provide account and session figures yet, so none are shown.">
        {() => {
          const all = users.data!
          const inactive = all.filter((user) => user.status === 'inactive').length
          const administrators = all.filter((user) => user.role === 'ADMINISTRATOR')
          const activeSessions = sessions.data!.filter((session) => session.status === 'active').length
          const revokedSessions = sessions.data!.filter((session) => session.status === 'revoked').length
          const recoveries = dashboard.data!.openRecoveries.length
          return (
            <div className={styles.kpiRow}>
              <Link to="/admin/users?status=inactive" className={styles.kpiLink}>
                <KpiCard label="Inactive accounts" value={inactive} caption={`of ${all.length} accounts`} icon="users" tone="info" />
              </Link>
              <Link to="/admin/security?tab=authentication" className={styles.kpiLink}>
                <KpiCard label="Administrators covered by MFA policy" value={administrators.length} caption="Enrollment status not reported" icon="lock" tone="purple" />
              </Link>
              <Link to="/admin/security?tab=devices" className={styles.kpiLink}>
                <KpiCard label="Open recovery requests" value={recoveries} caption="Controlled device-session recovery" icon="refresh" tone="warning" />
              </Link>
              <Link to="/admin/device-sessions" className={styles.kpiLink}>
                <KpiCard label="Active device sessions" value={activeSessions} caption={`${revokedSessions} revoked`} icon="phone" tone="success" />
              </Link>
            </div>
          )
        }}
      </SectionBoundary>
      <SecurityAlertsCard />
      <AccountSecuritySection />
    </>
  )
}

// ---------------------------------------------------------------------------------------
// Authentication policies
// ---------------------------------------------------------------------------------------

function AuthenticationTab() {
  return (
    <>
      <PolicyGroups titles={AUTHENTICATION_GROUPS} />
      <AdministratorMfa />
    </>
  )
}

function AdministratorMfa() {
  const users = useUsers()
  const navigate = useNavigate()
  const { demo } = useDemoWording()

  return (
    <>
      <Banner tone="info" title="Administrator accounts must use an authenticator app (TOTP)">
        The backend requires enrollment when an Administrator account is activated and verifies every code at sign-in. This page never shows
        authenticator secrets, setup keys or recovery codes.
      </Banner>
      <Card title="Administrator MFA" aria-label="Administrator MFA" action={<span className={styles.muted}>Read-only</span>}>
        <SectionBoundary queries={[users]} unavailable="Administrator accounts are not available yet: the Identity service is not connected.">
          {() => (
            <DataTable<IdentityUser>
              caption="Administrator accounts and MFA"
              rows={users.data!.filter((user) => user.role === 'ADMINISTRATOR')}
              rowKey={(user) => user.id}
              onRowActivate={(user) => navigate(userPath(user.id))}
              empty={<p className={styles.caption}>No Administrator accounts.</p>}
              columns={[
                {
                  id: 'user',
                  header: 'Administrator',
                  cell: (user) => (
                    <span className={styles.stackTight}>
                      <span>{user.fullName}</span>
                      <span className={styles.muted}>{user.id}</span>
                    </span>
                  ),
                },
                { id: 'status', header: 'Account', cell: (user) => <StatusBadge status={user.status} /> },
                {
                  id: 'requirement',
                  header: 'MFA requirement',
                  cell: (user) =>
                    user.roleDetails.role === 'ADMINISTRATOR' && user.roleDetails.mfaRequired ? 'Required · authenticator app' : <span className={styles.muted}>Not recorded on the account</span>,
                },
                { id: 'enrollment', header: 'Enrollment', cell: () => <span className={styles.muted}>Not reported</span> },
                { id: 'signin', header: 'Last sign-in', cell: (user) => <span className={styles.muted}>{user.lastSignInAt ? formatDateTime(user.lastSignInAt) : 'Never'}</span> },
              ]}
            />
          )}
        </SectionBoundary>
        <p className={styles.caption}>
          Enrollment status is not reported{demo ? ' by the demonstration data' : ''}: the Identity contract does not define it yet.
        </p>
      </Card>
      <Card title="MFA reset and recovery" aria-label="MFA reset and recovery">
        <Banner tone="warning" title="Awaiting backend contract">
          Resetting or recovering an Administrator’s authenticator is not available yet. The approved workflow needs the acting Administrator to
          re-authenticate, sends a one-time code to the account’s verified e-mail address, is verified by the backend and is recorded in the audit
          log. No reset can be started from this screen until that contract exists.
        </Banner>
        <p className={styles.caption}>Your own authenticator and password are managed in My Profile.</p>
      </Card>
    </>
  )
}

// ---------------------------------------------------------------------------------------
// Account security (Security Overview)
// ---------------------------------------------------------------------------------------

/** Alert kinds about accounts (sign-ins and lockouts), reported or not by the source. */
const ACCOUNT_ALERT_KINDS: readonly SecurityAlertKind[] = ['account_locked', 'failed_sign_in']

function AccountSecuritySection() {
  const users = useUsers()
  const alerts = useSecurityAlerts()
  const navigate = useNavigate()
  const { demo } = useDemoWording()

  return (
    <>
      <Card title="Locked accounts and failed sign-ins" aria-label="Locked accounts and failed sign-ins">
        <SectionBoundary queries={[alerts]} unavailable="The Identity service does not report sign-in or lockout events yet. None are shown until it does.">
          {() => {
            const unreported = unreportedAlertKinds(alerts.data!)
            return (
              <ul className={styles.noteList}>
                {ACCOUNT_ALERT_KINDS.map((kind) => {
                  const label = ALERT_KIND_LABELS[kind]
                  const count = alerts.data!.alerts.filter((alert) => alert.kind === kind).length
                  return (
                    <li key={kind}>
                      <strong>{label.title}:</strong>{' '}
                      {unreported.includes(kind) ? `not reported by ${demo ? 'the demonstration data' : 'the Identity service'}` : count === 0 ? 'none recorded' : `${count} recorded`}
                    </li>
                  )
                })}
              </ul>
            )
          }}
        </SectionBoundary>
      </Card>

      <Card title="Inactive account review" aria-label="Inactive account review" action={<Link to="/admin/users?status=inactive" className={styles.link}>Open in User Management</Link>}>
        <SectionBoundary queries={[users]} unavailable="User accounts are not available yet: the Identity service is not connected.">
          {() => (
            <DataTable<IdentityUser>
              caption="Inactive accounts"
              rows={users.data!.filter((user) => user.status === 'inactive')}
              rowKey={(user) => user.id}
              onRowActivate={(user) => navigate(userPath(user.id))}
              empty={<p className={styles.caption}>Every account is active.</p>}
              columns={[
                {
                  id: 'user',
                  header: 'User',
                  cell: (user) => (
                    <span className={styles.stackTight}>
                      <span>{user.fullName}</span>
                      <span className={styles.muted}>{user.id}</span>
                    </span>
                  ),
                },
                { id: 'role', header: 'Role', cell: (user) => ROLE_LABELS[user.role] },
                { id: 'scope', header: 'Scope', cell: (user) => <span className={styles.muted}>{scopeLabel(user)}</span> },
                { id: 'status', header: 'Status', cell: (user) => <StatusBadge status={user.status} /> },
                {
                  id: 'review',
                  header: 'Review',
                  cell: (user) => (
                    <Link to={userPath(user.id)} className={styles.link} onClick={(event) => event.stopPropagation()} aria-label={`Review account of ${user.fullName}`}>
                      Review account
                    </Link>
                  ),
                },
              ]}
            />
          )}
        </SectionBoundary>
        <p className={styles.caption}>Accounts are activated and disabled from the user’s page, with confirmation and an audit record.</p>
      </Card>

    </>
  )
}

// ---------------------------------------------------------------------------------------
// Device security
// ---------------------------------------------------------------------------------------

function DeviceSecurityTab() {
  const dashboard = useAdminDashboard()
  const sessions = useDeviceSessions()
  return (
    <>
      <SectionBoundary queries={[sessions]} unavailable="Device sessions come from an Identity service that is not connected yet, so no figures are shown.">
        {() => {
          const all = sessions.data!
          const count = (status: string) => all.filter((session) => session.status === status).length
          return (
            <div className={styles.kpiRow}>
              <Link to="/admin/device-sessions" className={styles.kpiLink}>
                <KpiCard label="Active device sessions" value={count('active')} caption={`of ${all.length} recorded sessions`} icon="phone" tone="success" />
              </Link>
              <Link to="/admin/device-sessions" className={styles.kpiLink}>
                <KpiCard label="Revoked device sessions" value={count('revoked')} caption="Revoked by an Administrator" icon="lock" tone="warning" />
              </Link>
              <Link to="/admin/device-sessions" className={styles.kpiLink}>
                <KpiCard label="Signed out" value={count('signed_out')} caption="Ended on the device" icon="logout" tone="info" />
              </Link>
            </div>
          )
        }}
      </SectionBoundary>
      <PolicyGroups titles={DEVICE_GROUPS} />
      <Card title="Account recovery requests" aria-label="Account recovery requests">
        <SectionBoundary queries={[dashboard]} unavailable="Recovery requests come from an Identity service that is not connected yet.">
          {() => (
            <DataTable<OpenRecovery>
              caption="Open recovery requests"
              rows={dashboard.data!.openRecoveries}
              rowKey={(recovery) => recovery.id}
              empty={<p className={styles.caption}>No recovery is waiting.</p>}
              columns={[
                { id: 'id', header: 'Request', cell: (recovery) => <span className={styles.idStrong}>{recovery.id}</span> },
                {
                  id: 'employee',
                  header: 'Employee',
                  cell: (recovery) => (
                    <span className={styles.stackTight}>
                      <span>{recovery.employee.fullName}</span>
                      <span className={styles.muted}>
                        {recovery.employee.id} · {ROLE_LABELS[recovery.employee.role]}
                      </span>
                    </span>
                  ),
                },
                { id: 'session', header: 'Device session', cell: (recovery) => recovery.sessionId },
                { id: 'requested', header: 'Requested', cell: (recovery) => <span className={styles.muted}>{formatDateTime(recovery.requestedAt)} · {recovery.requestedBy.fullName}</span> },
                {
                  id: 'continue',
                  header: 'Action',
                  cell: (recovery) => (
                    <Link to={`/admin/device-sessions/${recovery.sessionId}/recovery`} className={styles.link} aria-label={`Continue recovery ${recovery.id}`}>
                      Continue recovery
                    </Link>
                  ),
                },
              ]}
            />
          )}
        </SectionBoundary>
        <p className={styles.caption}>Only controlled device-session recovery is recorded today. Password and MFA recovery requests are not reported yet.</p>
      </Card>
    </>
  )
}

// ---------------------------------------------------------------------------------------
// Policies (read-only)
// ---------------------------------------------------------------------------------------

function PolicyGroups({ titles }: { titles: readonly string[] }) {
  return (
    <>
      <Banner tone="info" title="Read-only policy overview">
        These are the security decisions recorded for the project. The backend enforces them; this screen does not. Policies cannot be edited until
        the policy contracts and their enforcement rules are approved.
      </Banner>
      {SECURITY_POLICY_GROUPS.filter((group) => titles.includes(group.title)).map((group) => (
        <Card key={group.title} title={group.title} aria-label={`${group.title} policies`}>
          <DataTable<SecurityPolicy>
            caption={`${group.title} policies`}
            rows={[...group.policies]}
            rowKey={(policy) => policy.id}
            columns={[
              { id: 'name', header: 'Policy', cell: (policy) => <span className={styles.idStrong}>{policy.name}</span> },
              {
                id: 'status',
                header: 'Status',
                cell: (policy) => (
                  <Badge tone={POLICY_TONES[policy.status]} dot={false}>
                    {POLICY_STATUS_LABELS[policy.status]}
                  </Badge>
                ),
              },
              { id: 'value', header: 'Rule', cell: (policy) => policy.value },
            ]}
          />
        </Card>
      ))}
    </>
  )
}
