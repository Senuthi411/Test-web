import { useEffect } from 'react'
import logoMark from '@/assets/brand/logo-mark.png'
import { Badge, Banner, ButtonLink } from '@/shared/components'
import { Icon } from '@/shared/design-system'
import { useIdentityServices } from '../../services/identityServices'
import { useSession } from '../../session/sessionContext'
import styles from './SessionExpiredPage.module.css'

/** ID-16 Session expired (Figma 17:1249). Shown after a 401; nothing is retried automatically. */
export function SessionExpiredPage() {
  const { demo } = useIdentityServices()
  const { state, expire } = useSession()
  useEffect(() => {
    if (state.status === 'signed_in') expire()
  }, [state.status, expire])
  return (
    <div className={styles.page}>
      <main className={styles.card}>
        <div className={styles.brand}>
          <img src={logoMark} alt="" width={52} height={52} className={styles.logo} />
          <span className={styles.wordmark}>
            <span className={styles.name}>
              Tea<span className={styles.leaf}>Leaf</span>
            </span>
            <span className={styles.scout}>Field Scout</span>
          </span>
        </div>
        <span className={styles.clock} aria-hidden="true">
          <Icon name="clock" size={34} />
        </span>
        <Badge tone="warning">401 · Session expired</Badge>
        <h1 className={styles.title}>Your session has expired</h1>
        <p className={styles.text}>Please sign in again.</p>
        <div className={styles.banner}>
          <Banner tone="warning">Changes you had not submitted were not saved.</Banner>
        </div>
        <ButtonLink to="/login" fullWidth className={styles.action}>
          Sign in again
        </ButtonLink>
        {demo && <p className={styles.footer}>Demonstration screen · no real authentication</p>}
      </main>
    </div>
  )
}
