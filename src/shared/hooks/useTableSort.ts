import { useState } from 'react'

export type TableSortState = { columnId: string; direction: 'ascending' | 'descending' }

/**
 * Client-side column sorting for DataTable: sorts the whole filtered list before pagination.
 * Until a column is chosen (or `initial` is given) rows keep their original order. Numbers sort
 * numerically; everything else uses a case-insensitive, numeric-aware comparison.
 */
export function useTableSort<Row>(rows: readonly Row[], values: Record<string, (row: Row) => string | number>, initial?: TableSortState) {
  const [sort, setSort] = useState<TableSortState | undefined>(initial)
  const value = sort ? values[sort.columnId] : undefined
  const sorted =
    sort && value
      ? [...rows].sort((a, b) => {
          const first = value(a)
          const second = value(b)
          const result = typeof first === 'number' && typeof second === 'number' ? first - second : String(first).localeCompare(String(second), undefined, { numeric: true, sensitivity: 'base' })
          return sort.direction === 'ascending' ? result : -result
        })
      : rows
  return {
    rows: sorted,
    sort,
    onSort(columnId: string) {
      setSort((previous) => ({ columnId, direction: previous?.columnId === columnId && previous.direction === 'ascending' ? 'descending' : 'ascending' }))
    },
  }
}
