/**
 * Analytics domain model (pure TypeScript).
 *
 * Review statuses use the labels shown on the AN screens. Fixture and HTTP adapters map
 * backend identifiers (e.g. `in_review`) to these labels explicitly; see
 * `infrastructure/fixtureAnalyticsAdapter.ts`.
 */
export const STATUSES = ['Submitted', 'Resubmitted', 'In review', 'Verified', 'Flagged', 'Correction requested', 'Referred'] as const
export type ReviewStatus = (typeof STATUSES)[number]

/** Disease names in display order, matching the CASE-07 Disease Catalog. */
export const DISEASES = ['Blister blight', 'Grey blight', 'Brown blight', 'Algal leaf spot'] as const
export type Disease = (typeof DISEASES)[number]

/** CASE-07 catalog identifiers for {@link DISEASES}. */
export const DISEASE_IDS: Readonly<Record<Disease, string>> = {
  'Blister blight': 'DIS-001',
  'Grey blight': 'DIS-002',
  'Brown blight': 'DIS-003',
  'Algal leaf spot': 'DIS-004',
}

export interface Estate {
  id: string
  name: string
}

export interface Division {
  id: string
  name: string
  estateId: string
  /** Optional tie-break for the "top suspected disease" column. */
  topPriority?: Disease
}

export interface Observation {
  id: string
  divisionId: string
  capturedAt: string
  status: ReviewStatus
  suspectedDisease: Disease
  /** Expert diagnosis. Its disease and date are independent of the field-suspected disease. */
  diagnosis?: { id: string; caseId: string; disease: Disease; confirmedAt: string }
  /** Case linked to a referral that is still awaiting diagnosis. */
  awaitingCaseId?: string
  /** A correction for this observation has been resubmitted and awaits approval. */
  correctionApprovalPending?: boolean
}

export interface DatasetFreshness {
  name: string
  updatedAt: string
  frequency: string
  delayed: boolean
}

/** Configured refresh schedule for the analytics snapshot (optional in partial snapshots). */
export interface RefreshSchedule {
  frequency: string
  localTime: string
  timezone: string
}

export interface AnalyticsSnapshot {
  id: string
  /** Data "as of" time (ISO 8601). */
  asOf: string
  /** When dataset freshness was last checked (ISO 8601). */
  checkedAt: string
  /** True when the snapshot comes from synthetic fixture data, never live data. */
  demo: boolean
  estates: Estate[]
  divisions: Division[]
  observations: Observation[]
  datasets: DatasetFreshness[]
  refreshSchedule?: RefreshSchedule
  pendingCorrectionApprovals: number
  awaitingDiagnosisCases: string[]
  unlinkedReferrals: string[]
}

/**
 * Estate/division scope of the signed-in Reporting User (from the shared session).
 * Display only: the backend enforces scope on every request.
 */
export interface AnalyticsScope {
  estateIds: readonly string[]
  /** Omitted or empty: every division of the scoped estates. */
  divisionIds?: readonly string[]
}

/** Time grouping for trend charts. 'auto' picks daily, weekly or monthly from the range length. */
export type Granularity = 'day' | 'week' | 'month'

export interface Filters {
  estate: string
  division: string
  period: '30' | '7' | '90' | 'custom'
  from: string
  to: string
  statuses: ReviewStatus[]
  measure: 'suspected' | 'confirmed' | 'both'
  disease: string
  query: string
  granularity: 'auto' | Granularity
}

export const DEFAULT_FILTERS: Filters = {
  estate: '',
  division: '',
  period: '30',
  from: '',
  to: '',
  statuses: [...STATUSES],
  measure: 'suspected',
  disease: '',
  query: '',
  granularity: 'auto',
}

/** The nine Analytics screens (AN-01 – AN-09). */
export const ANALYTICS_SCREENS = ['dashboard', 'estates', 'divisions', 'observations', 'diseases', 'trends', 'bottlenecks', 'filters', 'freshness'] as const
export type AnalyticsScreen = (typeof ANALYTICS_SCREENS)[number]

/** Route of each screen, as registered in `src/app/routing/screens.ts`. */
export const ANALYTICS_PATHS: Readonly<Record<AnalyticsScreen, string>> = {
  dashboard: '/analytics',
  estates: '/analytics/estates',
  divisions: '/analytics/divisions',
  observations: '/analytics/observations',
  diseases: '/analytics/diseases',
  trends: '/analytics/suspected-vs-confirmed',
  bottlenecks: '/analytics/bottlenecks',
  filters: '/analytics/filters',
  freshness: '/analytics/freshness',
}

/** Figma screen IDs and titles (AN-01 – AN-09). */
export const ANALYTICS_TITLES: Readonly<Record<AnalyticsScreen, { screenId: string; title: string; label: string }>> = {
  dashboard: { screenId: 'AN-01', title: 'Analytics Dashboard', label: 'Analytics Dashboard' },
  estates: { screenId: 'AN-02', title: 'Estate Overview', label: 'Estate Overview' },
  divisions: { screenId: 'AN-03', title: 'Division Overview', label: 'Division Overview' },
  observations: { screenId: 'AN-04', title: 'Observation Statistics', label: 'Observation Statistics' },
  diseases: { screenId: 'AN-05', title: 'Disease Distribution', label: 'Disease Distribution' },
  trends: { screenId: 'AN-06', title: 'Suspected vs Confirmed Disease Trends', label: 'Suspected vs Confirmed' },
  bottlenecks: { screenId: 'AN-07', title: 'Review Bottlenecks', label: 'Review Bottlenecks' },
  filters: { screenId: 'AN-08', title: 'Reporting Filters', label: 'Reporting Filters' },
  freshness: { screenId: 'AN-09', title: 'Data Freshness Information', label: 'Data Freshness' },
}
