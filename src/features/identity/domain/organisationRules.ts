import type { RecordStatus } from './models'

/** ID-10: inactive estates cannot accept new divisions. Existing divisions remain editable. */
export function divisionCreationError(parentStatus: RecordStatus | undefined): string | undefined {
  if (!parentStatus) return 'Select an existing estate'
  return parentStatus === 'inactive' ? 'New divisions cannot be added to an inactive estate' : undefined
}
