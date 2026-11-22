import { lazy } from 'react'

const load = () => import('@/features/analytics/pages')
export const AnalyticsDashboardPage = lazy(() => load().then((module) => ({ default: module.AnalyticsDashboardPage })))
export const EstateOverviewPage = lazy(() => load().then((module) => ({ default: module.EstateOverviewPage })))
export const DivisionOverviewPage = lazy(() => load().then((module) => ({ default: module.DivisionOverviewPage })))
export const ObservationStatisticsPage = lazy(() => load().then((module) => ({ default: module.ObservationStatisticsPage })))
export const DiseaseDistributionPage = lazy(() => load().then((module) => ({ default: module.DiseaseDistributionPage })))
export const SuspectedVsConfirmedPage = lazy(() => load().then((module) => ({ default: module.SuspectedVsConfirmedPage })))
export const ReviewBottlenecksPage = lazy(() => load().then((module) => ({ default: module.ReviewBottlenecksPage })))
export const ReportingFiltersPage = lazy(() => load().then((module) => ({ default: module.ReportingFiltersPage })))
export const DataFreshnessPage = lazy(() => load().then((module) => ({ default: module.DataFreshnessPage })))
