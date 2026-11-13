import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { useCurrentSession } from '@/features/identity'
import { Modal, PageBreadcrumbsProvider } from '@/shared/components'
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
  const mobile = useMediaQuery('(max-width: 767px)')
  const location = useLocation()
  const [drawerLocation, setDrawerLocation] = useState<string | null>(null)
  const drawerOpen = mobile && drawerLocation === location.key
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(max-width: 767px)')
    const closeOnBreakpointChange = () => setDrawerLocation(null)
    query.addEventListener('change', closeOnBreakpointChange)
    return () => query.removeEventListener('change', closeOnBreakpointChange)
  }, [])
  const navigation = ROLE_NAVIGATION[session.user.role]
  const demo = config.dataSource === 'fixtures'

  return (
    <PageBreadcrumbsProvider>
      <div className={styles.shell}>
        <a href="#main-content" className={styles.skipLink} onClick={(event) => { event.preventDefault(); document.getElementById('main-content')?.focus(); document.getElementById('main-content')?.scrollIntoView() }}>
          Skip to main content
        </a>
        <div className={styles.desktopSidebar}><Sidebar
          navigation={navigation}
          user={session.user}
          collapsed={narrow || collapsedPreference}
          canToggle={!narrow}
          onToggle={() => setCollapsed(!collapsedPreference)}
          demo={demo}
        /></div>
        <div className={styles.column} inert={drawerOpen || undefined}>
          <TopBar user={session.user} searchPlaceholder={navigation.searchPlaceholder} demo={demo} onOpenNavigation={mobile ? () => setDrawerLocation(location.key) : undefined} navigationOpen={drawerOpen} />
          <main id="main-content" className={styles.main} tabIndex={-1}>
            <Outlet />
          </main>
        </div>
        <Modal id="mobile-navigation" open={drawerOpen} title="Navigation" placement="start" onClose={() => setDrawerLocation(null)}>
          <Sidebar navigation={navigation} user={session.user} collapsed={false} canToggle={false} onToggle={() => {}} demo={demo} mobile onNavigate={() => setDrawerLocation(null)} />
        </Modal>
      </div>
    </PageBreadcrumbsProvider>
  )
}
