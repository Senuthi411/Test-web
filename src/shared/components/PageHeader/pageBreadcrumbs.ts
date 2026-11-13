import { createContext, useContext, useEffect } from 'react'
import type { BreadcrumbItem } from './PageHeader'

export interface PageBreadcrumbsApi {
  /** Breadcrumbs set by the current page, or null to use the route's static ones. */
  items: readonly BreadcrumbItem[] | null
  set(items: readonly BreadcrumbItem[] | null): void
}

export const PageBreadcrumbsContext = createContext<PageBreadcrumbsApi | null>(null)

/** Read by the top bar. */
export function usePageBreadcrumbOverride(): readonly BreadcrumbItem[] | null {
  return useContext(PageBreadcrumbsContext)?.items ?? null
}

/**
 * Lets a page name the record it shows in the top-bar breadcrumbs, e.g.
 * "Administration › Users › Hiruni Nadeesha" (ID-04). Pass null while loading.
 */
export function usePageBreadcrumbs(items: readonly BreadcrumbItem[] | null): void {
  const api = useContext(PageBreadcrumbsContext)
  const key = items ? JSON.stringify(items) : null
  const set = api?.set
  useEffect(() => {
    if (!set) return
    set(key ? (JSON.parse(key) as BreadcrumbItem[]) : null)
    return () => set(null)
  }, [set, key])
}
