// Date bucketing for trend charts and exports.
// All dates are Asia/Colombo calendar dates (YYYY-MM-DD, see localDate). Ranges are inclusive at both ends,
// matching dateRange() and selectObservations(). Weeks run Monday–Sunday. Weeks and months are clipped to the
// selected range, so a partial first or last bucket covers only the selected days; no in-range date is dropped.
import type { AnalyticsSnapshot, Filters, Granularity } from './models';
import { dateRange, localDate, selectConfirmed, selectObservations } from './selectors';

const DAY = 86_400_000;
/** Longest range (in days) for which a daily view is offered. */
export const MAX_DAILY_DAYS = 92;
/**
 * Most buckets one chart renders. Every bucket adds a bar or point, a tooltip, an axis label and a data-table row,
 * so rendering cost grows with the bucket count (26 years weekly = 1,400 buckets took ~0.6–0.8 s of main-thread
 * work). 120 keeps 92 days daily, ~2.3 years weekly and 10 years monthly. Longer views fall back to a coarser
 * grouping; if monthly is still above the limit the chart shows a message instead (totals and CSV are unaffected).
 */
export const MAX_CHART_BUCKETS = 120;

export interface TimeBucket { start: string; end: string; label: string }
export interface TrendBucket extends TimeBucket { suspected: number; confirmed: number; awaiting: number }

const toTime = (date: string) => Date.parse(date + 'T00:00:00Z');
const toDate = (time: number) => new Date(time).toISOString().slice(0, 10);
const addDays = (date: string, days: number) => toDate(toTime(date) + days * DAY);

/** Number of calendar days in an inclusive range. */
export function rangeDays(from: string, to: string) { return Math.round((toTime(to) - toTime(from)) / DAY) + 1; }

/** Daily up to 14 days, weekly up to 62 days, monthly beyond (7 → daily, 30 → weekly, 90 → monthly). */
export function autoGranularity(from: string, to: string): Granularity {
  const days = rangeDays(from, to);
  return days <= 14 ? 'day' : days <= 62 ? 'week' : 'month';
}
/** Weeks (Monday-based) since 1970-01-05; 1970-01-01 was a Thursday. */
const weekIndex = (date: string) => Math.floor((toTime(date) / DAY + 3) / 7);
/** Number of buckets buildBuckets() would produce, computed without building them. */
export function bucketCount(from: string, to: string, granularity: Granularity) {
  if (!from || !to || from > to) return 0;
  if (granularity === 'day') return rangeDays(from, to);
  if (granularity === 'week') return weekIndex(to) - weekIndex(from) + 1;
  return (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7)) + 1;
}
/** Groupings a user can choose for the range: daily only up to 92 days, and none above MAX_CHART_BUCKETS. */
export function allowedGranularities(from: string, to: string): Granularity[] {
  return (['day', 'week', 'month'] as const).filter(g => (g !== 'day' || rangeDays(from, to) <= MAX_DAILY_DAYS) && bucketCount(from, to, g) <= MAX_CHART_BUCKETS);
}
export type FallbackReason = 'none' | 'daily-limit' | 'bucket-limit';
export interface TrendPlan {
  /** Grouping asked for (URL or automatic choice) and the grouping actually used. */
  requested: Granularity; granularity: Granularity; reason: FallbackReason;
  /** Buckets the requested grouping would have needed, and buckets used. */
  requestedCount: number; count: number;
  /** False when even monthly needs more than MAX_CHART_BUCKETS buckets: the chart is replaced by a message. */
  chartable: boolean;
}
/** Picks the grouping for a range: the request when possible, otherwise a coarser one, explaining why. */
export function planGranularity(from: string, to: string, requested: Filters['granularity']): TrendPlan {
  const asked: Granularity = requested === 'auto' ? autoGranularity(from, to) : requested;
  let granularity = asked, reason: FallbackReason = 'none';
  if (granularity === 'day' && rangeDays(from, to) > MAX_DAILY_DAYS) { granularity = autoGranularity(from, to); reason = 'daily-limit'; }
  while (granularity !== 'month' && bucketCount(from, to, granularity) > MAX_CHART_BUCKETS) { granularity = granularity === 'day' ? 'week' : 'month'; if (reason === 'none') reason = 'bucket-limit'; }
  const count = bucketCount(from, to, granularity);
  return { requested: asked, granularity, reason, requestedCount: bucketCount(from, to, asked), count, chartable: count <= MAX_CHART_BUCKETS };
}
/** The grouping actually used for the range (see planGranularity). */
export function resolveGranularity(from: string, to: string, requested: Filters['granularity']): Granularity {
  return planGranularity(from, to, requested).granularity;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
/** en-GB date text (same output as toLocaleDateString), with formatters cached because creating them is slow. */
const short = (date: string, options: Intl.DateTimeFormatOptions) => {
  const key = JSON.stringify(options); let format = formatters.get(key);
  if (!format) { format = new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }); formatters.set(key, format); }
  return format.format(toTime(date));
};

/** Consecutive, non-overlapping buckets that exactly cover [from, to]. */
export function buildBuckets(from: string, to: string, granularity: Granularity): TimeBucket[] {
  if (!from || !to || from > to) return [];
  const buckets: TimeBucket[] = [];
  // Day/week labels repeat every year, so add a 2-digit year when the range crosses a calendar year.
  const yearly = from.slice(0, 4) !== to.slice(0, 4);
  let start = from;
  while (start <= to) {
    let natural: string;
    if (granularity === 'day') natural = start;
    else if (granularity === 'week') { const weekday = (new Date(toTime(start)).getUTCDay() + 6) % 7; natural = addDays(start, 6 - weekday); }
    else { const d = new Date(toTime(start)); natural = toDate(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)); }
    const end = natural < to ? natural : to;
    const label = granularity === 'month' ? short(start, { month: 'short', year: 'numeric' }) : short(start, { day: '2-digit', month: 'short', ...(yearly ? { year: '2-digit' } : {}) });
    buckets.push({ start, end, label });
    start = addDays(end, 1);
  }
  return buckets;
}

/** Counts how many of the given calendar dates fall in each bucket. Dates outside every bucket are ignored. */
export function countByBucket(buckets: TimeBucket[], dates: string[]) {
  const counts = buckets.map(() => 0);
  for (const date of dates) { const index = buckets.findIndex(b => date >= b.start && date <= b.end); if (index >= 0) counts[index]++; }
  return counts;
}

/**
 * Suspected observations by capture date, expert-confirmed diagnoses by diagnosis date, and observations awaiting
 * a diagnosis by capture date, for the selected scope, filters and range. The three measures are never combined.
 */
export function trendSeries(snapshot: AnalyticsSnapshot, filters: Filters) {
  const [from, to] = dateRange(filters, snapshot.asOf);
  const plan = planGranularity(from, to, filters.granularity), granularity = plan.granularity;
  // Buckets always cover the full period (they also feed the CSV), even when the chart itself is not drawn.
  const buckets = buildBuckets(from, to, granularity);
  const observations = selectObservations(snapshot, filters);
  const suspected = countByBucket(buckets, observations.map(o => localDate(o.capturedAt)));
  const confirmed = countByBucket(buckets, selectConfirmed(snapshot, filters).map(o => localDate(o.diagnosis!.confirmedAt)));
  const awaiting = countByBucket(buckets, observations.filter(o => o.awaitingCaseId).map(o => localDate(o.capturedAt)));
  return { from, to, granularity, plan, buckets: buckets.map((b, i): TrendBucket => ({ ...b, suspected: suspected[i], confirmed: confirmed[i], awaiting: awaiting[i] })) };
}
export const granularityNoun: Record<Granularity, string> = { day: 'day', week: 'week', month: 'month' };
const longDate = (date: string) => short(date, { day: '2-digit', month: 'short', year: 'numeric' });
/** Full bucket range for data tables and tooltips, e.g. "22 Sept 2026 – 27 Sept 2026". */
export function bucketRangeLabel(bucket: TimeBucket) { return bucket.start === bucket.end ? longDate(bucket.start) : `${longDate(bucket.start)} – ${longDate(bucket.end)}`; }
