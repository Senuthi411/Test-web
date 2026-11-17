import { Icon } from '@/shared/design-system'
import type { PermissionCellState } from '../../../../domain/roles'
import roleStyles from '../RolesPage.module.css'

const PERMISSION_STATE_LABELS: Record<PermissionCellState, string> = {
  allowed: 'Allowed',
  scoped: 'Scope-dependent',
  not_allowed: 'Denied',
}

/** A read-only permission state: icon and text, never colour alone. */
export function PermissionState({ state, role, compact = false }: { state: PermissionCellState; role?: string; compact?: boolean }) {
  const label = PERMISSION_STATE_LABELS[state]
  const name = role ? `${label} for ${role}` : label
  return (
    <span className={roleStyles.state} data-state={state} role="img" aria-label={name} title={name}>
      {state === 'not_allowed' ? <span aria-hidden="true">—</span> : <Icon name="check" size={15} />}
      {state === 'scoped' && <span aria-hidden="true">{compact ? 'Scoped' : 'Scope-dependent'}</span>}
      {state === 'allowed' && !compact && <span aria-hidden="true">Allowed</span>}
    </span>
  )
}

/** Legend for the permission matrix. */
export function PermissionLegend() {
  return (
    <ul className={roleStyles.legend} aria-label="Permission legend">
      <li>
        <PermissionState state="allowed" compact /> Allowed, not limited by estate or division
      </li>
      <li>
        <PermissionState state="scoped" compact /> Scope-dependent: allowed only within the holder’s assigned scope or own records
      </li>
      <li>
        <PermissionState state="not_allowed" compact /> Denied
      </li>
    </ul>
  )
}
