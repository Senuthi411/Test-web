import { AnalyticsPage } from '../components/AnalyticsPage'
import { BottlenecksView, FreshnessView, ReportingFiltersView } from './OperationsViews'
import { DashboardView, DivisionsView, EstatesView } from './OverviewViews'
import { DiseasesView, ObservationsView, TrendsView } from './StatisticsViews'

/** AN-01 /analytics */
export function AnalyticsDashboardPage() {
  return <AnalyticsPage screen="dashboard" view={DashboardView} />
}

/** AN-02 /analytics/estates */
export function EstateOverviewPage() {
  return <AnalyticsPage screen="estates" view={EstatesView} />
}

/** AN-03 /analytics/divisions */
export function DivisionOverviewPage() {
  return <AnalyticsPage screen="divisions" view={DivisionsView} />
}

/** AN-04 /analytics/observations */
export function ObservationStatisticsPage() {
  return <AnalyticsPage screen="observations" view={ObservationsView} />
}

/** AN-05 /analytics/diseases */
export function DiseaseDistributionPage() {
  return <AnalyticsPage screen="diseases" view={DiseasesView} />
}

/** AN-06 /analytics/suspected-vs-confirmed */
export function SuspectedVsConfirmedPage() {
  return <AnalyticsPage screen="trends" view={TrendsView} />
}

/** AN-07 /analytics/bottlenecks */
export function ReviewBottlenecksPage() {
  return <AnalyticsPage screen="bottlenecks" view={BottlenecksView} />
}

/** AN-08 /analytics/filters */
export function ReportingFiltersPage() {
  return <AnalyticsPage screen="filters" view={ReportingFiltersView} />
}

/** AN-09 /analytics/freshness */
export function DataFreshnessPage() {
  return <AnalyticsPage screen="freshness" view={FreshnessView} />
}
