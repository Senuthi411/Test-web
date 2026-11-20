import { lazy } from 'react'

const load = () => import('@/features/cases/pages')
export const ExpertDashboardPage = lazy(() => load().then((module) => ({ default: module.ExpertDashboardPage })))
export const AssignedCasesPage = lazy(() => load().then((module) => ({ default: module.AssignedCasesPage })))
export const CaseDetailPage = lazy(() => load().then((module) => ({ default: module.CaseDetailPage })))
export const DiseaseCatalogPage = lazy(() => load().then((module) => ({ default: module.DiseaseCatalogPage })))
export const DiseaseDetailPage = lazy(() => load().then((module) => ({ default: module.DiseaseDetailPage })))
export const CaseHistoryPage = lazy(() => load().then((module) => ({ default: module.CaseHistoryPage })))
