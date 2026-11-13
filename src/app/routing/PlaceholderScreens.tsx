import { useParams } from 'react-router'
import { Banner, ButtonLink, Card, EmptyState, PageHeader } from '@/shared/components'
import type { ScreenDefinition } from './screens'
import styles from './PlaceholderScreens.module.css'

/**
 * Stand-in for a Figma screen that is scheduled for a later phase. It states plainly that
 * the screen is not built yet and shows no data, so nothing here can be mistaken for a
 * working feature.
 */
export function ScreenPending({ screen }: { screen: ScreenDefinition }) {
  const params = useParams()
  const paramEntries = Object.entries(params).filter(([key]) => key !== '*')
  return (
    <div className={styles.page}>
      <PageHeader title={screen.title} subtitle={`Figma screen ${screen.screenId}`} />
      <Banner tone="info" title="Screen not built yet">
        {screen.screenId} {screen.title} is scheduled for Phase {screen.phase}. The route, navigation and
        access guard are in place; the screen itself is not implemented.
      </Banner>
      {paramEntries.length > 0 && (
        <Card title="Route parameters" titleLevel={2}>
          <dl className={styles.meta}>
            {paramEntries.map(([key, value]) => (
              <div key={key} className={styles.metaItem}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </div>
  )
}

export function NotFoundScreen() {
  return (
    <div className={styles.page}>
      <Card>
        <EmptyState
          icon="search"
          title="Page not found"
          message="This address does not match any page in TeaLeaf Field Scout."
          action={
            <ButtonLink to="/" variant="secondary">
              Go to my dashboard
            </ButtonLink>
          }
        />
      </Card>
    </div>
  )
}
