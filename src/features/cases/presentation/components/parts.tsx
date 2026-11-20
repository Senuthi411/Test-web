import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Avatar } from '@/shared/components'
import styles from './cases.module.css'

export function CaseFields({ items }: { items: ReadonlyArray<{ label: string; value: ReactNode }> }) {
  return (
    <dl className={styles.fields}>
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function CasePerson({ name }: { name: string }) {
  return (
    <span className={styles.person}>
      <Avatar name={name} size={28} />
      <span>{name}</span>
    </span>
  )
}

export function CaseIdLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={styles.idLink}>
      {children}
    </Link>
  )
}
