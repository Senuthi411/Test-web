import { Link } from 'react-router'
import { Badge, Card, ErrorState, Skeleton } from '@/shared/components'
import { ROLE_LABELS } from '@/shared/types'
import { APPLICATION_ACCESS_LABELS, ROLE_CATALOG, ROLE_PROFILES, applicationAccess, roleGroups, scopeSummary } from '../../../../domain/roles'
import { isServiceUnavailable } from '../../../components/helpers'
import roleStyles from '../RolesPage.module.css'
import { useRoleCounts, userCountLabel, usersWithRolePath } from './roleUsers'

/** The five fixed system roles: what each is for, where it works and how far it reaches. */
export function RoleOverviewTab() {
  const { users, counts } = useRoleCounts()

  function countText(total: number | undefined, active: number | undefined) {
    if (users.isPending) return <Skeleton width={60} height={14} />
    if (users.isError) return <span className={roleStyles.muted}>{isServiceUnavailable(users.error) ? 'Count not available yet' : 'Count unavailable'}</span>
    if (total === undefined) return null
    return (
      <>
        {userCountLabel(total)}
        {active !== total && <span className={roleStyles.muted}> · {active} active</span>}
      </>
    )
  }

  return (
    <div className={roleStyles.overview}>
      {users.isError && !isServiceUnavailable(users.error) && <ErrorState error={users.error} onRetry={() => void users.refetch()} />}
      <ul className={roleStyles.roleCards} aria-label="System roles">
        {ROLE_CATALOG.map((definition) => {
          const label = ROLE_LABELS[definition.role]
          const count = counts?.[definition.role]
          return (
            <li key={definition.role}>
              <Card className={roleStyles.roleCard} aria-label={`${label} role`}>
                <div className={roleStyles.roleCardHead}>
                  <h3 className={roleStyles.roleName}>{label}</h3>
                  <span className={roleStyles.roleCount}>{countText(count?.total, count?.active)}</span>
                </div>
                <p className={roleStyles.roleText}>{ROLE_PROFILES[definition.role].responsibility}</p>
                <dl className={roleStyles.facts}>
                  <div>
                    <dt>Application</dt>
                    <dd>{APPLICATION_ACCESS_LABELS[applicationAccess(definition.role)]}</dd>
                  </div>
                  <div>
                    <dt>Scope</dt>
                    <dd>{scopeSummary(definition.role)}</dd>
                  </div>
                  <div>
                    <dt>Modules</dt>
                    <dd className={roleStyles.chips}>
                      {roleGroups(definition).map((group) => (
                        <Badge key={group} tone="neutral" dot={false}>
                          {group}
                        </Badge>
                      ))}
                    </dd>
                  </div>
                </dl>
                <div className={roleStyles.roleActions}>
                  <Link to={`/admin/roles/${definition.slug}`} className={roleStyles.action} aria-label={`View details of the ${label} role`}>
                    View details
                  </Link>
                  {counts && (
                    <Link to={usersWithRolePath(definition.role)} className={roleStyles.secondaryAction} aria-label={`View users with the ${label} role`}>
                      View users
                    </Link>
                  )}
                </div>
              </Card>
            </li>
          )
        })}
      </ul>
      <p className={roleStyles.muted}>
        Roles and their permissions are fixed and enforced by the backend. To change what someone can do, change their role or permanent scope in{' '}
        <Link to="/admin/users" className={roleStyles.inlineLink}>
          User Management
        </Link>
        .
      </p>
    </div>
  )
}
