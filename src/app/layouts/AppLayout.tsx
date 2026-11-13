import { Outlet } from 'react-router'
import { useCurrentSession } from '@/features/identity'
import { PageBreadcrumbsProvider } from '@/shared/components'
import { useMediaQuery, usePersistentState } from '@/shared/hooks'
import { useContainer } from '../composition/containerContext'
import { ROLE_NAVIGATION } from '../routing/navigation'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import styles from './AppLayout.module.css'

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'

/** Signed-in application shell (Figma: Sidebar + Header masters). */
export function AppLayout() {
  const session = useCurrentSession()
  const { config } = useContainer()
  const [collapsedPreference, setCollapsed] = usePersistentState('tealeaf.sidebarCollapsed', false, isBoolean)
  // Below 1024px the sidebar always uses its collapsed (icon-only) form.
  const narrow = useMediaQuery('(max-width: 1023px)')
  const navigation = ROLE_NAVIGATION[session.user.role]
  const demo = config.dataSource === 'fixtures'

  return (
    <PageBreadcrumbsProvider>
      <div className={styles.shell}>
        <a href="#main-content" className={styles.skipLink}>
          Skip to main content
        </a>
        <Sidebar
          navigation={navigation}
          user={session.user}
          collapsed={narrow || collapsedPreference}
          canToggle={!narrow}
          onToggle={() => setCollapsed(!collapsedPreference)}
          demo={demo}
        />
        <div className={styles.column}>
          <TopBar user={session.user} searchPlaceholder={navigation.searchPlaceholder} demo={demo} />
          <main id="main-content" className={styles.main} tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
    </PageBreadcrumbsProvider>
  )
}
