import { useSearchParams } from 'react-router'
import { DEFAULT_FILTERS, type Filters } from '../../domain/models'
import { parseFilters, writeFilters } from '../../domain/selectors'

/** Reporting filters live in the URL query string, so they survive refresh, links and Back/Forward. */
export function useFilters() {
  const [params, setParams] = useSearchParams()
  const filters = parseFilters(params)
  // replace:true updates the URL without adding a history entry (used while typing a search).
  const setFilters = (next: Filters, options?: { replace?: boolean }) => setParams(writeFilters(params, next), options)
  const resetFilters = () => setFilters({ ...DEFAULT_FILTERS, statuses: [...DEFAULT_FILTERS.statuses] })
  return { filters, setFilters, resetFilters }
}
