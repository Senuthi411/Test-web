import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useSession, type ProfileSectionState, type SessionUser } from '@/features/identity'
import { Avatar } from '@/shared/components'
import { Icon } from '@/shared/design-system'
import { ROLE_LABELS } from '@/shared/types'
import { cx } from '@/shared/utilities/classNames'
import styles from './Sidebar.module.css'

export interface SidebarAccountMenuProps {
  user: SessionUser
  collapsed: boolean
  onNavigate?: () => void
}

/**
 * The signed-in employee's card at the foot of the sidebar, with a compact account menu.
 * The menu is closed by default and closes on outside interaction, Escape, navigation and
 * sign-out. It reads the user from the session; nothing here is hard-coded.
 */
export function SidebarAccountMenu({ user, collapsed, onNavigate }: SidebarAccountMenuProps) {
  const { signOut } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  // Tied to the location it was opened on, so any navigation closes it.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === location.key
  const [signingOut, setSigningOut] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const securityLabelId = useId()
  const securityNoteId = useId()
  const role = ROLE_LABELS[user.role]

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpenOn(null)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpenOn(null)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  async function onSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setOpenOn(null)
      setSigningOut(false)
    }
    onNavigate?.()
    navigate('/login', { replace: true })
  }

  function close() {
    setOpenOn(null)
    onNavigate?.()
  }

  return (
    <div ref={rootRef} className={styles.account}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.accountTrigger}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Account menu for ${user.fullName}, ${role}`}
        title={collapsed ? `${user.fullName} · ${role}` : undefined}
        onClick={() => setOpenOn(open ? null : location.key)}
      >
        <span className={styles.avatarWrap}>
          <Avatar name={user.fullName} size={collapsed ? 40 : 42} />
        </span>
        {!collapsed && (
          <>
            <span className={styles.accountText}>
              <span className={styles.accountName}>{user.fullName}</span>
              <span className={styles.accountRole}>{role}</span>
            </span>
            <span className={cx(styles.accountChevron, open && styles.accountChevronOpen)}>
              <Icon name="down" size={18} />
            </span>
          </>
        )}
      </button>

      {open && (
        <div id={menuId} className={cx(styles.accountMenu, collapsed && styles.accountMenuSide)}>
          {collapsed && (
            <p className={styles.accountMenuHeader}>
              <span className={styles.accountName}>{user.fullName}</span>
              <span className={styles.accountRole}>{role}</span>
            </p>
          )}
          <ul className={styles.accountList}>
            <li>
              <Link to="/profile" className={styles.accountItem} onClick={close}>
                <Icon name="user" size={18} />
                View Profile
              </Link>
            </li>
            <li>
              {/* No MFA management screen or contract exists yet: shown, but not operable. */}
              <button type="button" className={styles.accountItem} aria-disabled="true" aria-labelledby={securityLabelId} aria-describedby={securityNoteId}>
                <Icon name="shield" size={18} />
                <span className={styles.accountItemText}>
                  <span id={securityLabelId}>Security Settings (MFA)</span>
                  <span id={securityNoteId} className={styles.accountItemNote}>
                    Not available yet
                  </span>
                </span>
              </button>
            </li>
            <li>
              <Link to="/profile" state={{ section: 'security' } satisfies ProfileSectionState} className={styles.accountItem} onClick={close}>
                <Icon name="lock" size={18} />
                Change Password
              </Link>
            </li>
            <li className={styles.accountSeparator} role="presentation" />
            <li>
              <button
                type="button"
                className={cx(styles.accountItem, styles.accountDanger)}
                onClick={() => void onSignOut()}
                disabled={signingOut}
              >
                <Icon name="logout" size={18} />
                {signingOut ? 'Signing out…' : 'Sign Out'}
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
