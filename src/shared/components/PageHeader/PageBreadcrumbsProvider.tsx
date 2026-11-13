import { useMemo, useState, type ReactNode } from 'react'
import type { BreadcrumbItem } from './PageHeader'
import { PageBreadcrumbsContext, type PageBreadcrumbsApi } from './pageBreadcrumbs'

export function PageBreadcrumbsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<readonly BreadcrumbItem[] | null>(null)
  const value = useMemo<PageBreadcrumbsApi>(() => ({ items, set: setItems }), [items])
  return <PageBreadcrumbsContext.Provider value={value}>{children}</PageBreadcrumbsContext.Provider>
}
