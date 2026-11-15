import { useState, type FocusEvent, type MouseEvent } from 'react'
import { Link, NavLink } from 'react-router'
import logoMark from '@/assets/brand/logo-mark.png'
import type { SessionUser } from '@/features/identity'
import { Icon } from '@/shared/design-system'
import { cx } from '@/shared/utilities/classNames'
import type { RoleNavigation } from '../routing/navigation'
import { SidebarAccountMenu } from './SidebarAccountMenu'
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
  mobile?: boolean
  onNavigate?: () => void
}

interface Tooltip {
  label: string
  top: number
  left: number
}

/**
 * Application sidebar: brand, role navigation grouped by section, and the signed-in
 * employee's account menu. Expanded (260 px) or icon-only (72 px) with tooltips; inside the
 * mobile drawer it is always expanded.
 */
export function Sidebar({ navigation, user, collapsed, canToggle, onToggle, demo, mobile = false, onNavigate }: SidebarProps) {
  const home = navigation.groups[0]?.items[0]?.to ?? '/'
  // One tooltip for the icon-only form. It is fixed-positioned so the scrolling nav never clips it.
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)

  function showTooltip(label: string) {
    return (event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
      if (!collapsed) return
      const box = event.currentTarget.getBoundingClientRect()
      setTooltip({ label, top: box.top + box.height / 2, left: box.right + 12 })
    }
  }
  const hideTooltip = () => setTooltip(null)

  return (
    <aside className={cx(styles.sidebar, collapsed && styles.collapsed, mobile && styles.mobile)} aria-label="Sidebar">
      <div className={styles.header}>
        <Link to={home} className={styles.brand} aria-label="TeaLeaf Field Scout home" onClick={onNavigate}>
          <img src={logoMark} alt="" width={44} height={44} className={styles.logo} />
          {!collapsed && (
            <span className={styles.wordmark}>
              <span className={styles.wordmarkName}>
                Tea<span className={styles.wordmarkLeaf}>Leaf</span>
              </span>
              <span className={styles.wordmarkSub}>Field Scout</span>
            </span>
          )}
        </Link>
        {canToggle && (
          <button
            type="button"
            className={styles.toggle}
            onClick={() => {
              hideTooltip()
              onToggle()
            }}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            onMouseEnter={showTooltip('Expand sidebar')}
            onMouseLeave={hideTooltip}
            onFocus={showTooltip('Expand sidebar')}
            onBlur={hideTooltip}
          >
            <span className={cx(styles.toggleIcon, collapsed && styles.toggleIconFlipped)}>
              <Icon name="chevronsLeft" size={20} />
            </span>
          </button>
        )}
      </div>

      <nav className={styles.nav} aria-label="Main" onScroll={hideTooltip}>
        {navigation.groups.map((group, index) => (
          <div key={group.label} className={styles.group}>
            {collapsed ? (
              index > 0 && <hr className={styles.groupDivider} aria-hidden="true" />
            ) : (
              <p className={styles.section} aria-hidden="true">
                {group.label}
              </p>
            )}
            <ul className={styles.list} aria-label={group.label}>
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={() => {
                      hideTooltip()
                      onNavigate?.()
                    }}
                    className={({ isActive }) => cx(styles.link, isActive && styles.active)}
                    aria-label={collapsed ? item.label : undefined}
                    onMouseEnter={showTooltip(item.label)}
                    onMouseLeave={hideTooltip}
                    onFocus={showTooltip(item.label)}
                    onBlur={hideTooltip}
                  >
                    <Icon name={item.icon} size={22} />
                    {!collapsed && <span className={styles.linkLabel}>{item.label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className={styles.footer}>
        <SidebarAccountMenu user={user} collapsed={collapsed} onNavigate={onNavigate} />
        {demo && !collapsed && (
          <p className={styles.demoNote}>
            <Icon name="info" size={16} />
            Demonstration data · UI design only
          </p>
        )}
      </div>

      {collapsed && tooltip && (
        <span className={styles.tooltip} style={{ top: tooltip.top, left: tooltip.left }} aria-hidden="true">
          {tooltip.label}
        </span>
      )}
    </aside>
  )
}
