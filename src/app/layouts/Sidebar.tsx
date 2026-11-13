import { Link, NavLink } from 'react-router'
import logoMark from '@/assets/brand/logo-mark.png'
import type { SessionUser } from '@/features/identity'
import { Avatar } from '@/shared/components'
import { Icon } from '@/shared/design-system'
import { ROLE_LABELS } from '@/shared/types'
import { cx } from '@/shared/utilities/classNames'
import type { RoleNavigation } from '../routing/navigation'
import styles from './Sidebar.module.css'

export interface SidebarProps {
  navigation: RoleNavigation
  user: SessionUser
  collapsed: boolean
  /** False when the viewport forces the collapsed form. */
  canToggle: boolean
  onToggle: () => void
  /** Fixture mode: shows the "Demonstration data · UI design only" note. */
  demo: boolean
}

export function Sidebar({ navigation, user, collapsed, canToggle, onToggle, demo }: SidebarProps) {
  const home = navigation.items[0]?.to ?? '/'
  return (
    <aside className={cx(styles.sidebar, collapsed && styles.collapsed)} aria-label="Sidebar">
      <Link to={home} className={styles.brand} aria-label="TeaLeaf Field Scout home">
        <img src={logoMark} alt="" className={styles.logo} />
        {!collapsed && (
          <span className={styles.wordmark}>
            <span className={styles.wordmarkName}>TeaLeaf</span>
            <span className={styles.wordmarkSub}>Field Scout</span>
          </span>
        )}
      </Link>

      {canToggle && (
        <button
          type="button"
          className={styles.toggle}
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          <span className={cx(collapsed && styles.toggleIconFlipped)}>
            <Icon name="left" size={12} />
          </span>
        </button>
      )}

      <nav className={styles.nav} aria-label="Main">
        <p className={styles.section} aria-hidden="true">
          {navigation.section}
        </p>
        <ul className={styles.list}>
          {navigation.items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) => cx(styles.link, isActive && styles.active)}
                aria-label={collapsed ? item.label : undefined}
                title={collapsed ? item.label : undefined}
              >
                <Icon name={item.icon} size={18} />
                {!collapsed && item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className={styles.footer}>
        <div className={styles.userCard} title={collapsed ? `${user.fullName}, ${ROLE_LABELS[user.role]}` : undefined}>
          <Avatar name={user.fullName} size={32} />
          {!collapsed && (
            <span className={styles.userText}>
              <span className={styles.userName}>{user.fullName}</span>
              <span className={styles.userRole}>{ROLE_LABELS[user.role]}</span>
            </span>
          )}
        </div>
        {demo && !collapsed && <p className={styles.demoNote}>Demonstration data · UI design only</p>}
      </div>
    </aside>
  )
}
