import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useTableSort } from './useTableSort'

const rows = [
  { id: 'USR-010', name: 'beta', count: 3 },
  { id: 'USR-2', name: 'Alpha', count: 12 },
  { id: 'USR-001', name: 'gamma', count: 1 },
] as const

const values = { id: (row: (typeof rows)[number]) => row.id, name: (row: (typeof rows)[number]) => row.name, count: (row: (typeof rows)[number]) => row.count }

describe('useTableSort', () => {
  it('keeps the original order until a column is chosen', () => {
    const { result } = renderHook(() => useTableSort(rows, values))
    expect(result.current.sort).toBeUndefined()
    expect(result.current.rows).toBe(rows)
  })

  it('sorts ascending, then descending on the same column, case-insensitively and numerically', () => {
    const { result } = renderHook(() => useTableSort(rows, values))
    act(() => result.current.onSort('name'))
    expect(result.current.sort).toEqual({ columnId: 'name', direction: 'ascending' })
    expect(result.current.rows.map((row) => row.name)).toEqual(['Alpha', 'beta', 'gamma'])
    act(() => result.current.onSort('name'))
    expect(result.current.rows.map((row) => row.name)).toEqual(['gamma', 'beta', 'Alpha'])
    act(() => result.current.onSort('id'))
    expect(result.current.rows.map((row) => row.id)).toEqual(['USR-001', 'USR-2', 'USR-010'])
  })

  it('compares numbers as numbers and honours an initial sort', () => {
    const { result } = renderHook(() => useTableSort(rows, values, { columnId: 'count', direction: 'descending' }))
    expect(result.current.rows.map((row) => row.count)).toEqual([12, 3, 1])
  })

  it('does not reorder or mutate the input for an unknown column', () => {
    const { result } = renderHook(() => useTableSort(rows, values))
    act(() => result.current.onSort('missing'))
    expect(result.current.rows).toBe(rows)
  })
})
