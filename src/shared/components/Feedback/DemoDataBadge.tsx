import styles from './Feedback.module.css'

/**
 * Top-bar "Demo data" pill (warning tone with a dot). Render it only in fixture mode so
 * synthetic data is never presented as live.
 */
export function DemoDataBadge() {
  return (
    <span className={styles.demoBadge} title="Synthetic fixture data. Nothing here comes from a live backend.">
      <span className={styles.demoDot} aria-hidden="true" />
      Demo data
    </span>
  )
}
