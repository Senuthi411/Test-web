import { useState } from 'react'
import { Card, FilterSelect } from '@/shared/components'
import { ROLE_LABELS, type UserRole } from '@/shared/types'
import {
  APPLICATION_ACCESS_LABELS,
  ROLE_CATALOG,
  applicationAccess,
  compareRoles,
  isScopeRestricted,
  permissionLabel,
  roleDefinition,
  scopeSummary,
} from '../../../../domain/roles'
import roleStyles from '../RolesPage.module.css'

const ROLE_OPTIONS = ROLE_CATALOG.map((definition) => ({ value: definition.role, label: ROLE_LABELS[definition.role] }))

function PermissionList({ title, codes }: { title: string; codes: readonly string[] }) {
  return (
    <section className={roleStyles.compareColumn} aria-label={title}>
      <h3 className={roleStyles.compareTitle}>
        {title} <span className={roleStyles.groupCount}>({codes.length})</span>
      </h3>
      {codes.length === 0 ? (
        <p className={roleStyles.muted}>None</p>
      ) : (
        <ul className={roleStyles.compareList}>
          {codes.map((code) => (
            <li key={code}>
              {permissionLabel(code)}
              {isScopeRestricted(code) && <span className={roleStyles.muted}> · within scope</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Two roles side by side, from the same permission data as the matrix. */
export function RoleComparison() {
  const [first, setFirst] = useState<UserRole>('SUPERVISOR')
  const [second, setSecond] = useState<UserRole>('DISEASE_EXPERT')
  const a = roleDefinition(first)
  const b = roleDefinition(second)
  const result = compareRoles(a, b)
  const same = first === second

  return (
    <Card title="Compare roles" aria-label="Compare roles">
      <div className={roleStyles.compareControls}>
        <FilterSelect<UserRole> label="First role" value={first} onChange={setFirst} options={ROLE_OPTIONS} />
        <span className={roleStyles.muted} aria-hidden="true">
          vs
        </span>
        <FilterSelect<UserRole> label="Second role" value={second} onChange={setSecond} options={ROLE_OPTIONS} />
      </div>
      {same ? (
        <p className={roleStyles.muted}>Choose two different roles to compare them.</p>
      ) : (
        <>
          <dl className={roleStyles.compareFacts}>
            <div>
              <dt>Application</dt>
              <dd>
                {ROLE_LABELS[first]}: {APPLICATION_ACCESS_LABELS[applicationAccess(first)]} · {ROLE_LABELS[second]}:{' '}
                {APPLICATION_ACCESS_LABELS[applicationAccess(second)]}
              </dd>
            </div>
            <div>
              <dt>Scope</dt>
              <dd>
                {ROLE_LABELS[first]}: {scopeSummary(first)} · {ROLE_LABELS[second]}: {scopeSummary(second)}
              </dd>
            </div>
          </dl>
          <div className={roleStyles.compareGrid}>
            <PermissionList title={`Only ${ROLE_LABELS[first]}`} codes={result.onlyFirst} />
            <PermissionList title="Shared" codes={result.shared} />
            <PermissionList title={`Only ${ROLE_LABELS[second]}`} codes={result.onlySecond} />
          </div>
        </>
      )}
    </Card>
  )
}
