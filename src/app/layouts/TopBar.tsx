import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link, useMatches, useNavigate } from 'react-router'
import { useSession, type SessionUser } from '@/features/identity'
import { Avatar, Breadcrumbs, DemoDataBadge, SearchInput, usePageBreadcrumbOverride, useToast, type BreadcrumbItem } from '@/shared/components'
import { Icon } from '@/shared/design-system'
import { ROLE_LABELS } from '@/shared/types'
import type { RouteHandle } from '../routing/routes'
import styles from './TopBar.module.css'

function isRouteHandle(handle: unknown): handle is RouteHandle {
  return typeof handle === 'object' && handle !== null && Array.isArray((handle as RouteHandle).breadcrumbs)
}

function useBreadcrumbs(): readonly BreadcrumbItem[] {
  const matches = useMatches()
  const override = usePageBreadcrumbOverride()
  if (override) return override
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const handle = matches[index]?.handle
    if (isRouteHandle(handle)) return handle.breadcrumbs
  }
  return []
}

export interface TopBarProps {
  user: SessionUser
  searchPlaceholder: string
  /** Fixture mode: shows the "Demo data" pill. */
  demo: boolean
}

export function TopBar({ user, searchPlaceholder, demo }: TopBarProps) {
  const breadcrumbs = useBreadcrumbs()
  const toast = useToast()

  // Global search and notifications are Phase 8 work. Say so instead of pretending.
  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    toast.show({ tone: 'info', title: 'Search is not available yet', message: 'Global search is scheduled for Phase 8.' })
  }

  return (
    <header className={styles.topBar}>
      <div className={styles.crumbs}>{breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}</div>
      <div className={styles.actions}>
        <form role="search" onSubmit={onSearch}>
          <SearchInput label="Search" placeholder={searchPlaceholder} appearance="pill" className={styles.search} />
        </form>
        {demo && <DemoDataBadge />}
        <button
          type="button"
          className={styles.bell}
          aria-label="Notifications"
          onClick={() =>
            toast.show({ tone: 'info', title: 'Notifications are not available yet', message: 'The notifications panel is scheduled for Phase 8.' })
          }
        >
          <Icon name="bell" size={19} />
        </button>
        <ProfileMenu user={user} />
      </div>
    </header>
  )
}

function ProfileMenu({ user }: { user: SessionUser }) {
  const { signOut } = useSession()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  async function onSignOut() {
    setOpen(false)
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div ref={rootRef} className={styles.profile}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.profileTrigger}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Account menu for ${user.fullName}`}
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar name={user.fullName} size={36} />
        <span className={styles.profileText}>
          <span className={styles.profileName}>{user.fullName}</span>
          <span className={styles.profileRole}>{ROLE_LABELS[user.role]}</span>
        </span>
        <Icon name="down" size={14} />
      </button>
      {open && (
        <div id={menuId} className={styles.menu}>
          <ul className={styles.menuList}>
            <li>
              <Link to="/profile" className={styles.menuItem} onClick={() => setOpen(false)}>
                <Icon name="user" size={16} />
                My Profile
              </Link>
            </li>
            <li>
              <button type="button" className={`${styles.menuItem} ${styles.menuDanger}`} onClick={onSignOut}>
                <Icon name="logout" size={16} />
                Sign out
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
