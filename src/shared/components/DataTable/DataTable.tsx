import type { KeyboardEvent, ReactNode } from 'react'
import { cx } from '@/shared/utilities/classNames'
import { TableSkeletonRows } from '../Feedback/Skeleton'
import styles from './DataTable.module.css'

export interface DataTableColumn<Row> {
  id: string
  /** Header text; the designs show headers in upper case (applied by CSS). */
  header: string
  cell: (row: Row) => ReactNode
  align?: 'start' | 'end'
  /** Optional fixed width, e.g. '20%'. */
  width?: string
  sortable?: boolean
}

export interface DataTableProps<Row> {
  /** Accessible table caption (visually hidden). */
  caption: string
  columns: readonly DataTableColumn<Row>[]
  rows: readonly Row[]
  rowKey: (row: Row) => string
  /** Makes rows activatable by click and Enter, e.g. to open a detail page. */
  onRowActivate?: (row: Row) => void
  /** Accessible label for an activatable row. */
  rowLabel?: (row: Row) => string
  loading?: boolean
  /** Rendered across the table body when there are no rows and not loading. */
  empty?: ReactNode
  sort?: { columnId: string; direction: 'ascending' | 'descending' }
  onSort?: (columnId: string) => void
}

export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  onRowActivate,
  rowLabel,
  loading = false,
  empty,
  sort,
  onSort,
}: DataTableProps<Row>) {
  function onKeyDown(event: KeyboardEvent<HTMLTableRowElement>, row: Row) {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onRowActivate?.(row)
    }
  }

  return (
    <div className={styles.wrapper}>
      <table className={styles.table} aria-busy={loading || undefined}>
        <caption className="tl-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={column.align === 'end' ? styles.alignEnd : undefined}
                aria-sort={column.sortable ? (sort?.columnId === column.id ? sort.direction : 'none') : undefined}
              >
                {column.sortable && onSort ? (
                  <button type="button" className={styles.sortButton} onClick={() => onSort(column.id)}>
                    {column.header}
                    <span aria-hidden="true">{sort?.columnId === column.id ? (sort.direction === 'ascending' ? ' ↑' : ' ↓') : ' ↕'}</span>
                  </button>
                ) : column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <TableSkeletonRows columns={columns.length} rows={5} />
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={styles.emptyCell}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={cx(onRowActivate && styles.clickableRow)}
                tabIndex={onRowActivate ? 0 : undefined}
                aria-label={onRowActivate ? rowLabel?.(row) : undefined}
                onClick={onRowActivate ? () => onRowActivate(row) : undefined}
                onKeyDown={onRowActivate ? (event) => onKeyDown(event, row) : undefined}
              >
                {columns.map((column) => (
                  <td key={column.id} className={column.align === 'end' ? styles.alignEnd : undefined}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
