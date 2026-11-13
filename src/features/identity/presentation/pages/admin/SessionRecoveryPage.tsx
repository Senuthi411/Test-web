import { useParams } from 'react-router'
import { Badge, Banner, ButtonLink, Card, EmptyState, PageHeader, usePageBreadcrumbs, type BadgeTone } from '@/shared/components'
import { Icon } from '@/shared/design-system'
import { formatDateTime } from '@/shared/utilities/format'
import type { DeviceSession, RecoveryRequest, RecoveryStepStatus } from '../../../domain/models'
import { QueryBoundary } from '../../components/common'
import { useDemoWording } from '../../components/helpers'
import { useDeviceSessions, useRecoveryRequest } from '../../services/queries'
import styles from '../../components/identity.module.css'
import recoveryStyles from './SessionRecoveryPage.module.css'

const STEP_STATUS: Record<RecoveryStepStatus, { label: string; tone: BadgeTone }> = {
  done: { label: 'Done ✓', tone: 'success' },
  pending: { label: 'Pending', tone: 'warning' },
  open: { label: 'Open', tone: 'info' },
  not_issued: { label: 'Not issued', tone: 'neutral' },
  waiting: { label: 'Waiting', tone: 'neutral' },
}

/** Controlled recovery of a revoked device session (Figma 166:972). */
export function SessionRecoveryPage() {
  const { sessionId = '' } = useParams()
  const sessions = useDeviceSessions()
  const recovery = useRecoveryRequest(sessionId)
  usePageBreadcrumbs([{ label: 'Administration', to: '/admin' }, { label: 'Controlled recovery' }])
  return (
    <div className={styles.page}>
      <QueryBoundary query={sessions}>
        {(list) => {
          const session = list.find((item) => item.id === sessionId)
          if (!session) {
            return (
              <Card>
                <EmptyState
                  title="Device session not found"
                  message={`There is no device session ${sessionId}.`}
                  action={
                    <ButtonLink to="/admin/device-sessions" variant="secondary">
                      Back to device sessions
                    </ButtonLink>
                  }
                />
              </Card>
            )
          }
          return <QueryBoundary query={recovery}>{(request) => <RecoveryView session={session} request={request} />}</QueryBoundary>
        }}
      </QueryBoundary>
    </div>
  )
}

function RecoveryView({ session, request }: { session: DeviceSession; request: RecoveryRequest | null }) {
  const { demo } = useDemoWording()
  const revoked = session.revokedAt ? formatDateTime(session.revokedAt).replace(' · ', ' ') : '—'
  const header = (
    <PageHeader
      back={{ to: '/admin/device-sessions', label: 'Back to device sessions' }}
      title={`Controlled recovery · ${session.id}`}
      subtitle={`${session.user.fullName} (${session.user.id}) · ${session.device} · revoked ${revoked} · ${session.revokedReasonCode ?? ''}`}
    />
  )
  if (!request) {
    return (
      <>
        {header}
        <Card>
          <EmptyState
            title="No recovery has been requested"
            message={
              session.status === 'revoked'
                ? 'Start recovery from the device session panel to open an audited recovery ticket.'
                : 'Only revoked sessions enter controlled recovery.'
            }
            action={
              <ButtonLink to={`/admin/device-sessions?session=${session.id}`} variant="secondary">
                Open session
              </ButtonLink>
            }
          />
        </Card>
      </>
    )
  }

  const steps: Array<{ title: string; detail: string }> = [
    { title: 'Authorized Identity Administrator', detail: `${request.requestedBy.fullName} (${request.requestedBy.id}) opened the recovery request` },
    { title: 'Verified Field Worker', detail: `Identity of ${session.user.fullName} must be verified before a ticket proceeds` },
    {
      title: 'Audited recovery ticket',
      detail: `Ticket ${request.id}${demo ? ' (demo)' : ''} recorded with administrator, worker and reason`,
    },
    { title: 'New validated device session', detail: 'Issued only after verification; the revoked session is not reused' },
    { title: 'Revalidation of queued records', detail: 'Each queued record is revalidated against current scope before upload' },
  ]

  return (
    <>
      {header}
      <Banner tone="warning">
        Session {session.id} stays revoked and cannot upload. It is never reactivated: recovery issues a new validated device session after the steps
        below.
      </Banner>
      <div className={styles.withSide}>
        <Card title="Recovery steps">
          <ol className={recoveryStyles.steps}>
            {steps.map((step, index) => {
              const status = request.steps[index] ?? 'waiting'
              return (
                <li key={step.title} className={recoveryStyles.step}>
                  <span className={recoveryStyles.marker} data-done={status === 'done'} aria-hidden="true">
                    {status === 'done' ? <Icon name="check" size={14} /> : index + 1}
                  </span>
                  <span className={recoveryStyles.stepText}>
                    <span className={recoveryStyles.stepTitle}>{step.title}</span>
                    <span className={styles.muted}>{step.detail}</span>
                  </span>
                  <Badge tone={STEP_STATUS[status].tone} dot={false}>
                    {STEP_STATUS[status].label}
                  </Badge>
                </li>
              )
            })}
          </ol>
        </Card>
        <Card title="Unsynced evidence is preserved">
          <p className={styles.muted}>
            Records captured on this device stay held on the device (held_auth). Nothing is purged remotely. Queued records upload only after the new
            session is validated and each record is revalidated.
          </p>
          <p className={recoveryStyles.warning}>
            {demo ? 'Prototype state only. ' : ''}Ticketing, worker verification and session issuance depend on approved backend capabilities.
          </p>
          <div>
            <ButtonLink to="/admin/device-sessions" variant="secondary">
              Back to device sessions
            </ButtonLink>
          </div>
        </Card>
      </div>
    </>
  )
}
