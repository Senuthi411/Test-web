// Page-specific CSV exports. Each builder uses the same scoped snapshot, filters and selectors as its page, so an
// export never contains records the page could not show (estate/division scope is applied before this point).
import { DISEASES, STATUSES, type AnalyticsScreen, type AnalyticsSnapshot, type Filters, type Observation, type ReviewStatus } from '../domain/models';
import { ageDays, dateRange, isOpenReviewStatus, localDate, selectConfirmed, selectObservations, summarize, topDisease } from '../domain/selectors';
import { trendSeries } from '../domain/timeBuckets';
import { NOT_PROVIDED, freshnessSummary } from '../domain/freshness';
import { exportFilename, toCsv, type CsvTable, type CsvValue } from './csv';

export const REPORT_TYPES: Record<AnalyticsScreen, string> = {
  dashboard: 'dashboard-summary', estates: 'estate-overview', divisions: 'division-overview', observations: 'observation-statistics',
  diseases: 'disease-distribution', trends: 'suspected-vs-confirmed-trends', bottlenecks: 'review-bottlenecks',
  filters: 'reporting-filters-preview', freshness: 'data-freshness',
};
export interface PageExport { reportType: string; filename: string; table: CsvTable; csv: string }

/** Open items waiting longer than this many days count as overdue (matches "Waiting over 7 days"). */
export const OVERDUE_DAYS = 7;
const statusKey = (status: ReviewStatus) => status.toLowerCase().replace(/ /g, '_');
/** ISO-8601 local time in Asia/Colombo, e.g. 2026-10-21T10:00+05:30. */
export const colomboDateTime = (value: string) => `${localDate(value)}T${new Date(Date.parse(value) + 330 * 60_000).toISOString().slice(11, 16)}+05:30`;

function context(snapshot: AnalyticsSnapshot, filters: Filters) {
  const [from, to] = dateRange(filters, snapshot.asOf);
  const estateOf = (o: Observation) => snapshot.divisions.find(d => d.id === o.divisionId)?.estateId;
  const estateName = (id?: string) => snapshot.estates.find(e => e.id === id)?.name ?? '';
  const divisionsInView = snapshot.divisions.filter(d => (!filters.estate || d.estateId === filters.estate) && (!filters.division || d.id === filters.division)
    && (!filters.query || `${d.name} ${d.id}`.toLowerCase().includes(filters.query.toLowerCase())));
  return {
    from, to, estateOf, estateName, divisionsInView,
    observations: selectObservations(snapshot, filters), confirmed: selectConfirmed(snapshot, filters),
    estateScope: filters.estate ? estateName(filters.estate) : `All my estates (${snapshot.estates.map(e => e.name).join('; ')})`,
    divisionScope: filters.division ? snapshot.divisions.find(d => d.id === filters.division)?.name ?? '' : 'All divisions',
    periodLabel: filters.period === 'custom' ? 'Custom range' : `Last ${filters.period} days`,
    source: snapshot.demo ? 'Demo snapshot (synthetic fixture data)' : 'Analytics snapshot',
  };
}

function sectionedSummary(snapshot: AnalyticsSnapshot, filters: Filters, kind: 'dashboard' | 'observations'): CsvTable {
  const c = context(snapshot, filters), s = summarize(c.observations), trend = trendSeries(snapshot, filters);
  const rows: CsvValue[][] = [
    ['context', 'snapshot_as_of', '', '', colomboDateTime(snapshot.asOf)],
    ['context', 'data_source', '', '', c.source],
    ['context', 'estate_scope', '', '', c.estateScope],
    ['context', 'division_scope', '', '', c.divisionScope],
    ['context', 'reporting_period', c.from, c.to, c.periodLabel],
    ['context', 'disease_filter', '', '', filters.disease || 'All diseases'],
    ['context', 'division_search', '', '', filters.query],
    ['context', 'time_grouping', '', '', trend.granularity],
  ];
  if (kind === 'dashboard') rows.push(
    ['kpi', 'total_observations', c.from, c.to, s.total], ['kpi', 'verified_observations', c.from, c.to, s.verified],
    ['kpi', 'open_observations', c.from, c.to, s.open], ['kpi', 'confirmed_diagnoses', c.from, c.to, c.confirmed.length]);
  else rows.push(
    ['kpi', 'total_observations', c.from, c.to, s.total], ['kpi', 'reviewed_observations', c.from, c.to, s.reviewed],
    ['kpi', 'open_observations', c.from, c.to, s.open], ['kpi', 'flagged_observations', c.from, c.to, s.counts.Flagged],
    ['kpi', 'flag_rate_percent', c.from, c.to, s.flagRate],
    ...STATUSES.map((status): CsvValue[] => ['review_status', statusKey(status), c.from, c.to, s.counts[status]]));
  rows.push(...trend.buckets.map((b): CsvValue[] => ['observation_trend', `observations_per_${trend.granularity}`, b.start, b.end, b.suspected]));
  if (kind === 'dashboard') rows.push(...DISEASES.map((name): CsvValue[] => ['suspected_disease', name, c.from, c.to, c.observations.filter(o => o.suspectedDisease === name).length]));
  return { columns: ['section', 'metric', 'period_start', 'period_end', 'value'], rows };
}

const builders: Record<AnalyticsScreen, (snapshot: AnalyticsSnapshot, filters: Filters) => CsvTable> = {
  dashboard: (snapshot, filters) => sectionedSummary(snapshot, filters, 'dashboard'),
  observations: (snapshot, filters) => sectionedSummary(snapshot, filters, 'observations'),

  estates(snapshot, filters) {
    const c = context(snapshot, filters);
    const line = (id: string, name: string, rows: Observation[], confirmed: number): CsvValue[] => {
      const s = summarize(rows);
      return [id, name, s.total, ...STATUSES.map(st => s.counts[st]), s.open, confirmed, s.verificationRate, c.from, c.to];
    };
    const estates = snapshot.estates.filter(e => !filters.estate || e.id === filters.estate);
    return { columns: ['estate_id', 'estate_name', 'total_observations', ...STATUSES.map(statusKey), 'open', 'confirmed_diagnoses', 'verification_rate_percent', 'period_start', 'period_end'],
      rows: [...estates.map(e => line(e.id, e.name, c.observations.filter(o => c.estateOf(o) === e.id), c.confirmed.filter(o => c.estateOf(o) === e.id).length)),
        line('', 'Total', c.observations, c.confirmed.length)] };
  },

  divisions(snapshot, filters) {
    const c = context(snapshot, filters);
    return { columns: ['division_id', 'division_name', 'estate_id', 'estate_name', 'total_observations', ...STATUSES.map(statusKey), 'open', 'top_suspected_disease', 'period_start', 'period_end'],
      rows: c.divisionsInView.map(d => { const rows = c.observations.filter(o => o.divisionId === d.id), s = summarize(rows);
        return [d.id, d.name, d.estateId, c.estateName(d.estateId), s.total, ...STATUSES.map(st => s.counts[st]), s.open, topDisease(rows, d.topPriority), c.from, c.to]; }) };
  },

  diseases(snapshot, filters) {
    const c = context(snapshot, filters), estates = snapshot.estates.filter(e => !filters.estate || e.id === filters.estate);
    return { columns: ['disease_id', 'disease_name', 'suspected_total', ...estates.map(e => `suspected_${e.id}`), 'expert_confirmed', 'period_start', 'period_end'],
      rows: DISEASES.map((name, i) => { const suspected = c.observations.filter(o => o.suspectedDisease === name);
        return [`DIS-00${i + 1}`, name, suspected.length, ...estates.map(e => suspected.filter(o => c.estateOf(o) === e.id).length),
          c.confirmed.filter(o => o.diagnosis!.disease === name).length, c.from, c.to]; }) };
  },

  trends(snapshot, filters) {
    const t = trendSeries(snapshot, filters);
    return { columns: ['period_start', 'period_end', 'time_bucket', 'suspected_observations', 'expert_confirmed_diagnoses', 'awaiting_diagnosis'],
      rows: t.buckets.map(b => [b.start, b.end, t.granularity, b.suspected, b.confirmed, b.awaiting]) };
  },

  bottlenecks(snapshot, filters) {
    const c = context(snapshot, filters), asOf = localDate(snapshot.asOf);
    const open = c.observations.filter(o => isOpenReviewStatus(o.status))
      .map(o => ({ o, age: ageDays(o, snapshot.asOf) })).sort((a, b) => b.age - a.age || a.o.id.localeCompare(b.o.id));
    return { columns: ['observation_id', 'estate_id', 'estate_name', 'division_id', 'division_name', 'review_status', 'captured_date', 'age_days', `overdue_over_${OVERDUE_DAYS}_days`, 'age_reference_date'],
      rows: open.map(({ o, age }) => { const d = snapshot.divisions.find(x => x.id === o.divisionId);
        return [o.id, d?.estateId ?? '', c.estateName(d?.estateId), o.divisionId, d?.name ?? '', o.status, localDate(o.capturedAt), age, age > OVERDUE_DAYS ? 'yes' : 'no', asOf]; }) };
  },

  filters(snapshot, filters) {
    const c = context(snapshot, filters);
    const divisions = snapshot.divisions.filter(d => (!filters.estate || d.estateId === filters.estate) && (!filters.division || d.id === filters.division));
    const suspected = filters.measure !== 'confirmed', expert = filters.measure !== 'suspected';
    const shared = [c.estateScope, c.divisionScope, c.from, c.to, filters.disease || 'All diseases', filters.query, filters.measure];
    return { columns: ['estate_filter', 'division_filter', 'period_start', 'period_end', 'disease_filter', 'division_search', 'disease_measure',
      'division_id', 'division_name', 'estate_name', 'total_observations', ...filters.statuses.map(statusKey), ...(suspected ? ['top_suspected_disease'] : []), ...(expert ? ['expert_confirmed'] : [])],
      rows: divisions.map(d => { const rows = c.observations.filter(o => o.divisionId === d.id), s = summarize(rows);
        return [...shared, d.id, d.name, c.estateName(d.estateId), s.total, ...filters.statuses.map(st => s.counts[st]),
          ...(suspected ? [topDisease(rows, d.topPriority)] : []), ...(expert ? [c.confirmed.filter(o => o.divisionId === d.id).length] : [])]; }) };
  },

  freshness(snapshot) {
    const f = freshnessSummary(snapshot);
    const source = f.demo ? 'Demo snapshot metadata (synthetic fixture data)' : 'Snapshot metadata';
    return { columns: ['dataset', 'last_refreshed', 'expected_refresh', 'freshness_status', 'age_hours', 'checked_at', 'data_source'],
      rows: f.rows.map(r => [r.name, r.updatedAt ? colomboDateTime(r.updatedAt) : '', r.frequency || NOT_PROVIDED, r.delayed ? 'delayed' : 'fresh', r.ageHours, colomboDateTime(f.reference), source]) };
  },
};

/** Builds the CSV for the page the user is on. `snapshot` must already be scoped to the session. */
export function buildPageExport(screen: AnalyticsScreen, snapshot: AnalyticsSnapshot, filters: Filters): PageExport {
  const table = builders[screen](snapshot, filters);
  return { reportType: REPORT_TYPES[screen], filename: exportFilename(REPORT_TYPES[screen], snapshot.asOf), table, csv: toCsv(table) };
}
