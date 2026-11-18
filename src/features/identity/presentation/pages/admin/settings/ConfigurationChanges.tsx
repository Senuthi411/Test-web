import { DataTable } from '@/shared/components'
import { CONFIGURATION_SECTION_LABELS, type ConfigurationChange } from '../../../../domain/configuration'
import styles from '../../../components/identity.module.css'

/** Field-by-field differences between two configuration documents. */
export function ConfigurationChanges({ changes, caption, empty = 'No differences.' }: { changes: readonly ConfigurationChange[]; caption: string; empty?: string }) {
  return (
    <DataTable<ConfigurationChange>
      caption={caption}
      rows={changes}
      rowKey={(change) => change.path}
      empty={<p className={styles.caption}>{empty}</p>}
      columns={[
        { id: 'section', header: 'Section', cell: (change) => <span className={styles.muted}>{CONFIGURATION_SECTION_LABELS[change.section]}</span> },
        { id: 'setting', header: 'Setting', cell: (change) => change.label },
        { id: 'before', header: 'Before', cell: (change) => <span className={styles.muted}>{change.before}</span> },
        { id: 'after', header: 'After', cell: (change) => <span className={styles.idStrong}>{change.after}</span> },
      ]}
    />
  )
}
