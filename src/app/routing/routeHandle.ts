import type { BreadcrumbItem } from '@/shared/components'

/** Route metadata read by the top bar. Pages showing a record refine it with usePageBreadcrumbs. */
export interface RouteHandle {
  breadcrumbs: BreadcrumbItem[]
}
