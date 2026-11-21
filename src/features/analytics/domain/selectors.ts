import { DEFAULT_FILTERS, DISEASES, STATUSES, type AnalyticsScope, type AnalyticsSnapshot, type Filters, type Observation } from './models';

const DAY = 86_400_000;
export function formatSnapshot(value:string){return new Date(value).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Colombo'})+' · '+new Date(value).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Colombo'});}
export const LOCAL_OFFSET = '+05:30';
export function localDate(value: string) { return new Date(new Date(value).getTime() + 330 * 60_000).toISOString().slice(0, 10); }
export function dateRange(filters: Filters, asOf: string): [string, string] {
  if (filters.period === 'custom') return [filters.from, filters.to];
  const end = localDate(asOf);
  const days = Number(filters.period);
  return [new Date(Date.parse(end + 'T00:00:00Z') - (days - 1) * DAY).toISOString().slice(0, 10), end];
}
/** Scope is applied before any aggregation or client-selected filters. The server must also enforce it. */
export function scopeSnapshot(snapshot: AnalyticsSnapshot, scope: AnalyticsScope): AnalyticsSnapshot {
  const estates = snapshot.estates.filter(e => scope.estateIds.includes(e.id));
  const divisions = snapshot.divisions.filter(d => estates.some(e => e.id === d.estateId) && (!scope.divisionIds?.length || scope.divisionIds.includes(d.id)));
  const observations = snapshot.observations.filter(o => divisions.some(d => d.id === o.divisionId));
  const unrestricted = estates.length === snapshot.estates.length && divisions.length === snapshot.divisions.length;
  return { ...snapshot, estates, divisions, observations, pendingCorrectionApprovals: unrestricted ? snapshot.pendingCorrectionApprovals : 0, awaitingDiagnosisCases: unrestricted ? snapshot.awaitingDiagnosisCases : [], unlinkedReferrals: unrestricted ? snapshot.unlinkedReferrals : [] };
}
export function selectObservations(snapshot: AnalyticsSnapshot, filters: Filters): Observation[] {
  const [from, to] = dateRange(filters, snapshot.asOf);
  return snapshot.observations.filter(o => {
    const division = snapshot.divisions.find(d => d.id === o.divisionId);
    const captured = localDate(o.capturedAt);
    return (!filters.estate || division?.estateId === filters.estate) && (!filters.division || o.divisionId === filters.division)
      && (!from || captured >= from) && (!to || captured <= to) && (!filters.disease || o.suspectedDisease === filters.disease)
      && (!filters.query || `${division?.name} ${division?.id}`.toLowerCase().includes(filters.query.toLowerCase()));
  });
}
/**
 * Expert-confirmed diagnoses for the current scope whose diagnosis date (Colombo calendar day) falls in the selected
 * period. A disease selection is matched against the confirmed disease, never the field-suspected one, so the two
 * measures are not mixed. Referrals without a diagnosis are never counted.
 */
export function selectConfirmed(snapshot: AnalyticsSnapshot, filters: Filters): Observation[] {
  const [from, to] = dateRange(filters, snapshot.asOf);
  return selectObservations(snapshot, { ...filters, disease: '', period: 'custom', from: '', to: '' }).filter(o => {
    if (!o.diagnosis || (filters.disease && o.diagnosis.disease !== filters.disease)) return false;
    const confirmed = localDate(o.diagnosis.confirmedAt);
    return (!from || confirmed >= from) && (!to || confirmed <= to);
  });
}
/** The shared Supervisor pending rule: initial submissions and corrected revisions awaiting a decision. */
export function isOpenReviewStatus(status: Observation['status']) {
  return status === 'Submitted' || status === 'Resubmitted' || status === 'In review';
}
export function summarize(observations: Observation[]) {
  const counts = Object.fromEntries(STATUSES.map(s => [s, observations.filter(o => o.status === s).length])) as Record<typeof STATUSES[number], number>;
  const total = observations.length;
  const open = observations.filter(o => isOpenReviewStatus(o.status)).length;
  return { total, counts, open, verified: counts.Verified, reviewed: total - open, confirmed: observations.filter(o => o.diagnosis).length,
    verificationRate: total ? Math.round(counts.Verified / total * 100) : 0, flagRate: total ? Math.round(counts.Flagged / total * 100) : 0 };
}
export function ageDays(observation: Observation, asOf: string) { return Math.max(0, Math.round((Date.parse(localDate(asOf)) - Date.parse(localDate(observation.capturedAt))) / DAY)); }
export function topDisease(rows: Observation[], priority?: string) {
  if (!rows.length) return '—';
  const counts = DISEASES.map(name => ({ name, count: rows.filter(o => o.suspectedDisease === name).length }));
  const max = Math.max(...counts.map(c => c.count));
  const tied = counts.filter(c => c.count === max);
  return (tied.find(c => c.name === priority) || tied[0]).name + (tied.length > 1 ? ' (tie)' : '');
}
export function weeklyCounts(rows: Observation[], asOf: string) {
  const end = new Date(localDate(asOf) + 'T00:00:00Z');
  const monday = new Date(end.getTime() - ((end.getUTCDay() + 6) % 7) * DAY);
  return Array.from({ length: 4 }, (_, i) => {
    const start = new Date(monday.getTime() - (3 - i) * 7 * DAY);
    const stop = new Date(start.getTime() + 7 * DAY);
    const between = (value: string) => { const date = Date.parse(localDate(value)); return date >= start.getTime() && date < stop.getTime(); };
    return { label: start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }), suspected: rows.filter(o => between(o.capturedAt)).length, confirmed: rows.filter(o => o.diagnosis && between(o.diagnosis.confirmedAt)).length };
  });
}
/** Anchor for the 4-week charts: the end of a custom range (never later than the snapshot), otherwise the snapshot date. */
export function chartAnchor(filters: Filters, asOf: string) {
  if (filters.period !== 'custom' || !filters.to || filters.to >= localDate(asOf)) return asOf;
  return `${filters.to}T12:00:00${LOCAL_OFFSET}`;
}
export function isDefaultFilters(filters: Filters) { return filters.estate === '' && filters.division === '' && filters.period === '30' && filters.disease === '' && !filters.query; }
export function parseFilters(search: URLSearchParams): Filters {
  const statuses = search.has('statuses') ? (search.get('statuses') || '').split(',').filter((s): s is Filters['statuses'][number] => STATUSES.includes(s as Filters['statuses'][number])) : [...STATUSES];
  return { ...DEFAULT_FILTERS, estate: search.get('estate') || '', division: search.get('division') || '', period: ['7', '90', 'custom'].includes(search.get('period') || '') ? search.get('period') as Filters['period'] : '30', from: search.get('from') || '', to: search.get('to') || '', statuses, measure: ['confirmed', 'both'].includes(search.get('measure') || '') ? search.get('measure') as Filters['measure'] : 'suspected', disease: DISEASES.includes(search.get('disease') as typeof DISEASES[number]) ? search.get('disease')! : '',query:search.get('query')||'',
    granularity: ['day', 'week', 'month'].includes(search.get('granularity') || '') ? search.get('granularity') as Filters['granularity'] : 'auto' };
}
export function writeFilters(current: URLSearchParams, filters: Filters): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const key of ['estate','division','period','from','to','measure','disease','query','granularity'] as const) {
    const value = filters[key];
    if (value && value !== DEFAULT_FILTERS[key]) next.set(key, value); else next.delete(key);
  }
  if (filters.statuses.length !== STATUSES.length) next.set('statuses', filters.statuses.join(',')); else next.delete('statuses');
  return next;
}
export function filterError(filters: Filters) {
  if (filters.period !== 'custom') return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(filters.from) || !/^\d{4}-\d{2}-\d{2}$/.test(filters.to)) return 'Choose both a start and end date.';
  const valid=(value:string)=>{const date=new Date(value+'T00:00:00Z');return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;};
  if(!valid(filters.from)||!valid(filters.to))return 'Choose valid calendar dates.';
  if (filters.from > filters.to) return 'End date must be on or after the start date.';
  return '';
}
