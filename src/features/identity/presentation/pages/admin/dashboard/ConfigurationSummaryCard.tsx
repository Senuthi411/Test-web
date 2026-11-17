import { Link } from 'react-router'
import { Card, DescriptionList } from '@/shared/components'
import { formatDateTime } from '@/shared/utilities/format'
import { FEATURE_DEFINITIONS, RULE_TEMPLATES, enabledRuleCount } from '../../../../domain/configuration'
import { useConfiguration } from '../../../services/queries'
import { SectionBoundary } from './SectionBoundary'
import styles from './AdminDashboard.module.css'

/** The configuration version in effect, from System Settings. */
export function ConfigurationSummaryCard() {
  const query = useConfiguration()
  return (
    <Card
      title="Configuration summary"
      aria-label="Configuration summary"
      className={styles.section}
      action={
        <Link to="/admin/settings" className={styles.link}>
          System Settings
        </Link>
      }
    >
      <SectionBoundary queries={[query]} unavailable="The configuration service is not connected yet, so no configuration is shown as in effect.">
        {() => {
          const { current, draft } = query.data!
          const featuresOn = FEATURE_DEFINITIONS.filter((feature) => current.document.features[feature.key]).length
          return (
            <DescriptionList
              items={[
                { label: 'Version in effect', value: `Version ${current.version} · ${current.createdBy ? current.createdBy.fullName : 'baseline'} · ${formatDateTime(current.createdAt)}` },
                { label: 'Open draft', value: draft ? `Saved ${formatDateTime(draft.savedAt)}` : 'None' },
                { label: 'Business rules enabled', value: `${enabledRuleCount(current.document)} of ${RULE_TEMPLATES.length}` },
                { label: 'Features on', value: `${featuresOn} of ${FEATURE_DEFINITIONS.length}` },
                { label: 'Maintenance mode', value: 'Off' },
              ]}
            />
          )
        }}
      </SectionBoundary>
      <p className={styles.note}>Configuration is not evaluated by the backend yet; rules and features take effect only once their contracts exist.</p>
    </Card>
  )
}
