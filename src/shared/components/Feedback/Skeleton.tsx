import type { CSSProperties } from 'react'
import styles from './Feedback.module.css'

export interface SkeletonProps {
  width?: CSSProperties['width']
  height?: CSSProperties['height']
  radius?: CSSProperties['borderRadius']
}

/** Placeholder block for loading states (Figma State/Loading). Hidden from assistive tech. */
export function Skeleton({ width = '100%', height = 14, radius }: SkeletonProps) {
  return <span className={styles.skeleton} style={{ width, height, borderRadius: radius }} aria-hidden="true" />
}

const WIDTHS = ['72%', '56%', '84%', '64%', '48%']

export function TableSkeletonRows({ columns, rows }: { columns: number; rows: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <tr key={rowIndex} className={styles.skeletonRow} aria-hidden="true">
          {Array.from({ length: columns }, (_, columnIndex) => (
            <td key={columnIndex}>
              <Skeleton width={WIDTHS[(rowIndex + columnIndex) % WIDTHS.length]} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
