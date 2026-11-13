import { useState } from 'react'

/** Sort the full filtered dataset before pagination; keep the original fixture order initially. */
export function useIdentityTableSort<Row>(rows: readonly Row[], values: Record<string, (row: Row) => string | number>) {
  const [sort, setSort] = useState<{ columnId: string; direction: 'ascending' | 'descending' }>()
  const value = sort ? values[sort.columnId] : undefined
  const sorted = sort && value ? [...rows].sort((a, b) => {
    const first = value(a)
    const second = value(b)
    const result = typeof first === 'number' && typeof second === 'number' ? first - second : String(first).localeCompare(String(second), undefined, { numeric: true, sensitivity: 'base' })
    return sort.direction === 'ascending' ? result : -result
  }) : rows
  return {
    rows: sorted,
    sort,
    onSort(columnId: string) {
      setSort((previous) => ({ columnId, direction: previous?.columnId === columnId && previous.direction === 'ascending' ? 'descending' : 'ascending' }))
    },
  }
}
