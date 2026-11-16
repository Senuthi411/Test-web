import { Link } from 'react-router'
import { Card, Timeline } from '@/shared/components'
import { activityLink, useRelativeTime } from '../../../components/helpers'
import { useAdminDashboard } from '../../../services/queries'
import { SectionBoundary } from './SectionBoundary'
import styles from './AdminDashboard.module.css'

/** The newest events of the Identity audit log, with their actor. */
export function AdministrativeActivityCard() {
  const dashboard = useAdminDashboard()
  const relative = useRelativeTime()

  return (
    <Card
      title="Recent administrative activity"
      aria-label="Recent administrative activity"
      className={styles.section}
      action={
        <Link to="/admin/roles?tab=history" className={styles.link}>
          View access history
        </Link>
      }
    >
      <SectionBoundary queries={[dashboard]} unavailable="The Identity service does not provide the audit log yet.">
        {() => {
          const events = dashboard.data!.recentActivity
          return events.length === 0 ? (
            <p className={styles.itemText}>No administrative activity yet.</p>
          ) : (
            <Timeline
              label="Recent administrative activity"
              items={events.map((event, index) => {
                const to = activityLink(event)
                return {
                  id: event.id,
                  state: index === events.length - 1 ? 'open' : 'done',
                  title: to ? (
                    <Link to={to} className={styles.link}>
                      {event.title}
                    </Link>
                  ) : (
                    event.title
                  ),
                  detail: [event.detail, event.actor ? `by ${event.actor.fullName}` : null, relative(event.at)].filter(Boolean).join(' · '),
                }
              })}
            />
          )
        }}
      </SectionBoundary>
    </Card>
  )
}
