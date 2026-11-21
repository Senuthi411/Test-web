import { useMediaQuery } from '@/shared/hooks'

/**
 * Phone layout (below 600px), matching the Review module's single-column breakpoint:
 * - the "Group by" FilterSelect moves from the card header into the card body;
 * - per-division charts become the shared BarList (as on REV-01 "Pending by division"),
 *   because six vertical columns cannot carry readable division names at that width.
 */
export function useCompactLayout(): boolean {
  return useMediaQuery('(max-width: 599px)')
}
