import { Badge, ButtonLink, Card } from '@/shared/components'
import { Icon } from '@/shared/design-system'
import { ROLE_LABELS } from '@/shared/types'
import { ROLE_HOME_PATH } from '../../../domain/roleHome'
import { useSession } from '../../session/sessionContext'
import styles from './AccessDeniedPage.module.css'

/**
 * ID-15 Access denied (403). There is no ID-15 frame in Figma; this follows the visual
 * language of the review-specific 403 state (GS-09, 31:1431): an error banner with a lock
 * and a "Need access?" card. Rendered in place, so the URL the user asked for is kept.
 */
export function AccessDeniedPage() {
  const { state } = useSession()
  const role = state.status === 'signed_in' ? state.session.user.role : null
  return (
    <div className={styles.page}>
      <Card className={styles.card}>
        <div className={styles.banner} role="alert">
          <span className={styles.lock} aria-hidden="true">
            <Icon name="lock" size={22} />
          </span>
          <div>
            <Badge tone="danger">403 · Access denied</Badge>
            <h1 className={styles.title}>Access denied</h1>
            <p className={styles.text}>
              {role
                ? `Your role (${ROLE_LABELS[role]}) does not have access to this page.`
                : 'You do not have access to this page.'}{' '}
              Nothing was changed.
            </p>
          </div>
        </div>
        <div className={styles.help}>
          <h2 className={styles.helpTitle}>Need access?</h2>
          <p className={styles.text}>
            Ask an administrator to update your role or estate scope. Access is checked by the backend on every request.
          </p>
        </div>
        <div>
          <ButtonLink to={role ? ROLE_HOME_PATH[role] : '/'} variant="secondary" icon="home">
            Back to my dashboard
          </ButtonLink>
        </div>
      </Card>
    </div>
  )
}
