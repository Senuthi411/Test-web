import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { Icon, type IconName } from '@/shared/design-system'
import { cx } from '@/shared/utilities/classNames'
import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'destructiveOutline' | 'ghost'

interface CommonProps {
  variant?: ButtonVariant
  /** Leading icon (Figma buttons place icons before the label). */
  icon?: IconName
  fullWidth?: boolean
  children: ReactNode
}

export interface ButtonProps extends CommonProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Shows the designed "Working…" loading state and blocks repeat submissions. */
  loading?: boolean
  /** Text shown while loading, e.g. "Signing in…". Defaults to "Working…". */
  loadingLabel?: string
}

function classesFor(variant: ButtonVariant, fullWidth: boolean | undefined, extra?: string) {
  return cx(styles.button, styles[variant], fullWidth && styles.fullWidth, extra)
}

export function Button({
  variant = 'primary',
  icon,
  fullWidth,
  loading = false,
  loadingLabel = 'Working…',
  disabled,
  className,
  children,
  type = 'button',
  onClick,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={classesFor(variant, fullWidth, cx(loading && styles.busy, className))}
      disabled={disabled}
      aria-busy={loading || undefined}
      onClick={loading ? (event) => event.preventDefault() : onClick}
    >
      {loading ? (
        loadingLabel
      ) : (
        <>
          {icon && <Icon name={icon} size={16} />}
          {children}
        </>
      )}
    </button>
  )
}

export interface ButtonLinkProps extends CommonProps, Omit<LinkProps, 'children'> {}

/** A navigation link styled as a button. */
export function ButtonLink({ variant = 'primary', icon, fullWidth, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link {...rest} className={classesFor(variant, fullWidth, className)}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </Link>
  )
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName
  /** Required accessible name. */
  label: string
  appearance?: 'round' | 'plain'
  iconSize?: number
}

export function IconButton({ icon, label, appearance = 'round', iconSize, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      title={label}
      className={cx(appearance === 'round' ? styles.iconButton : styles.plainIconButton, className)}
    >
      <Icon name={icon} size={iconSize ?? (appearance === 'round' ? 19 : 14)} />
    </button>
  )
}
