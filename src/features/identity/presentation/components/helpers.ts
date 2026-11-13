import { isAppError } from '@/shared/api'
import { useToast } from '@/shared/components'
import { formatRelativeDateTime } from '@/shared/utilities/format'
import type { ActivityEvent, DeviceSessionStatus, ExportKind, IdentityUser, RecordStatus } from '../../domain/models'
import { scopeIdsOf } from '../../domain/scope'
import { useIdentityServices } from '../services/identityServices'
import { useExport } from '../services/queries'

export const RECORD_STATUS_LABEL: Record<RecordStatus, string> = { active: 'Active', inactive: 'Inactive' }

export const SESSION_STATUS_LABEL: Record<DeviceSessionStatus, string> = {
  active: 'Active',
  revoked: 'Revoked',
  signed_out: 'Signed out',
}

/** ID-03 "Scope" column: estate IDs, division IDs, or "All estates" for administrators. */
export function scopeLabel(user: Pick<IdentityUser, 'role' | 'estateIds' | 'divisionIds'>): string {
  if (user.role === 'ADMINISTRATOR') return 'All estates'
  return scopeIdsOf(user).join(', ') || '—'
}

export const userPath = (id: string) => `/admin/users/${id}`
export const estatePath = (id: string) => `/admin/estates/${id}`
export const divisionPath = (id: string) => `/admin/divisions/${id}`

/** Where an activity entry's title links to. */
export function activityLink(event: ActivityEvent): string | undefined {
  if (!event.link) return undefined
  switch (event.link.kind) {
    case 'user':
      return `/admin/users/${event.link.id}`
    case 'session':
      return `/admin/device-sessions?session=${event.link.id}`
    case 'division':
      return `/admin/divisions/${event.link.id}`
    case 'estate':
      return `/admin/estates/${event.link.id}`
  }
}

/** "Today · 07:58" etc. against the app clock (pinned to 21 Oct 2026 in fixture mode). */
export function useRelativeTime(): (value: string | null | undefined) => string {
  const { clock } = useIdentityServices()
  return (value) => (value ? formatRelativeDateTime(value, clock.now()) : '—')
}

/** Wording that differs between demonstration data and live data. */
export function useDemoWording() {
  const { demo } = useIdentityServices()
  return {
    demo,
    /** "demo " in fixture mode, "" otherwise (e.g. "13 demo accounts"). */
    demoWord: demo ? 'demo ' : '',
    /** " (illustrative)" in fixture mode, "" otherwise. */
    illustrative: demo ? ' (illustrative)' : '',
  }
}

/** Export buttons (ID-02, ID-03, ID-07, ID-11). Reports the real outcome only. */
export function useExportAction(kind: ExportKind) {
  const toast = useToast()
  const exportMutation = useExport()
  return {
    pending: exportMutation.isPending,
    run() {
      exportMutation.mutate(kind, {
        onSuccess: (result) =>
          toast.show(
            result.simulated
              ? { tone: 'info', title: 'Export simulated', message: 'Demonstration data: no file is produced in fixture mode.' }
              : { tone: 'success', title: 'Export started' },
          ),
        onError: (error) =>
          toast.show({ tone: 'error', title: 'Export failed', message: isAppError(error) ? error.message : undefined }),
      })
    },
  }
}

/** Text error for a failed mutation. */
export function errorMessage(error: unknown): string {
  return isAppError(error) ? error.message : 'Something went wrong. Try again.'
}

/** Field errors returned by the adapter (validation details), keyed by path. */
export function fieldErrorsOf(error: unknown): Record<string, string> {
  if (!isAppError(error) || error.kind !== 'validation') return {}
  return Object.fromEntries(error.details.map((detail) => [detail.path, detail.message]))
}
