import { Link } from 'react-router'
import { Badge, Card } from '@/shared/components'
import { unreportedAlertKinds } from '../../../../domain/adminDashboard'
import { useDemoWording, useRelativeTime } from '../../../components/helpers'
import { useSecurityAlerts } from '../../../services/queries'
import { ALERT_KIND_LABELS, SEVERITY, alertAction } from './dashboardLabels'
import { SectionBoundary } from './SectionBoundary'
import styles from './AdminDashboard.module.css'

/**
 * Security & access alerts: only events the source records, never inferred ones.
 * `securityLink`: the Dashboard links to Security & Settings (that page shows the card itself).
 */
export function SecurityAlertsCard({ securityLink = false }: { securityLink?: boolean }) {
  const query = useSecurityAlerts()
  const relative = useRelativeTime()
  const { demo } = useDemoWording()

  return (
    <Card
      title="Security & access alerts"
      aria-label="Security & access alerts"
      className={styles.section}
      action={
        securityLink ? (
          <Link to="/admin/security" className={styles.itemAction}>
            Security &amp; Settings
          </Link>
        ) : undefined
      }
    >
      <SectionBoundary queries={[query]} unavailable="The Identity service does not report security events yet. No alerts are shown until it does.">
        {() => {
          const feed = query.data!
          const unreported = unreportedAlertKinds(feed).map((kind) => ALERT_KIND_LABELS[kind].plural)
          return (
            <>
              {demo && feed.alerts.length > 0 && <p className={styles.note}>Demonstration records, not real incidents.</p>}
              {feed.alerts.length === 0 ? (
                <div className={styles.empty}>
                  <p className={styles.itemTitle}>No security alerts</p>
                  {feed.reportedKinds.length > 0 && (
                    <p className={styles.itemText}>
                      No {feed.reportedKinds.map((kind) => ALERT_KIND_LABELS[kind].plural).join(', ')} need review{demo ? ' in the demonstration data' : ''}.
                    </p>
                  )}
                </div>
              ) : (
                <ul className={styles.items} aria-label="Security alerts">
                  {feed.alerts.map((alert) => {
                    const label = ALERT_KIND_LABELS[alert.kind]
                    const action = alertAction(alert)
                    return (
                      <li key={alert.id} className={styles.item}>
                        <div className={styles.itemMain}>
                          <p className={styles.itemTitle}>
                            {label.title}
                            {alert.severity && <Badge tone={SEVERITY[alert.severity].tone}>{SEVERITY[alert.severity].label}</Badge>}
                          </p>
                          <p className={styles.itemText}>{label.explanation}</p>
                          <p className={styles.itemMeta}>
                            {[
                              alert.employee ? `${alert.employee.fullName} (${alert.employee.id})` : null,
                              alert.sessionId,
                              alert.device,
                              relative(alert.at),
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                        {action && (
                          <Link to={action.to} className={styles.itemAction} aria-label={`${action.label}${alert.sessionId ? ` ${alert.sessionId}` : ''}`}>
                            {action.label}
                          </Link>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
              {unreported.length > 0 && (
                <p className={styles.note}>
                  Not reported by {demo ? 'the demonstration data' : 'the Identity service'}: {unreported.join(', ')}.
                </p>
              )}
            </>
          )
        }}
      </SectionBoundary>
    </Card>
  )
}
