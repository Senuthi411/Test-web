import { useState } from 'react'

type SortState = { columnId: string; direction: 'ascending' | 'descending' }

/** Sorts the whole filtered list before pagination; the initial order is the record order. */
export function useTableSort<Row>(rows: readonly Row[], values: Record<string, (row: Row) => string | number>, initial?: SortState) {
  const [sort, setSort] = useState<SortState | undefined>(initial)
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
