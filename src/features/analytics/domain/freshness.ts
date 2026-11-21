// Dataset freshness summary shared by the Data Freshness page and its CSV export, so both always agree.
// Ages are measured from the snapshot's own check time (checkedAt, falling back to asOf), never the computer clock.
import type { AnalyticsSnapshot, RefreshSchedule } from './models';

export interface FreshnessRow { name: string; updatedAt: string; frequency: string; delayed: boolean; ageHours: number | null; ageLabel: string }
export interface FreshnessSummary {
  rows: FreshnessRow[]; total: number; fresh: number; delayed: number; delayedNames: string[];
  /** Plain-language warning when one or more datasets are delayed; empty when all are fresh or there is no metadata. */
  warning: string; schedule: RefreshSchedule | null; reference: string; demo: boolean; hasMetadata: boolean;
}
export const NOT_PROVIDED = 'Not provided';
const HOUR = 3_600_000;
export const isDemoSnapshot = (snapshot: AnalyticsSnapshot) => snapshot.demo;

export function formatAge(hours: number) { return hours >= 24 ? `${Math.floor(hours / 24)} d ${hours % 24} h` : `${hours} h`; }

export function freshnessSummary(snapshot: AnalyticsSnapshot): FreshnessSummary {
  const reference = snapshot.checkedAt || snapshot.asOf, referenceTime = Date.parse(reference);
  const rows = (snapshot.datasets ?? []).map((d): FreshnessRow => {
    const updated = d.updatedAt ? Date.parse(d.updatedAt) : NaN;
    const ageHours = Number.isFinite(updated) && Number.isFinite(referenceTime) ? Math.max(0, Math.floor((referenceTime - updated) / HOUR)) : null;
    return { name: d.name || 'Unnamed dataset', updatedAt: d.updatedAt || '', frequency: d.frequency || '', delayed: !!d.delayed, ageHours, ageLabel: ageHours === null ? 'Unknown' : formatAge(ageHours) };
  });
  const delayedRows = rows.filter(r => r.delayed), delayedNames = delayedRows.map(r => r.name);
  const warning = delayedRows.length === 0 ? ''
    : delayedRows.length === 1 ? `One dataset (${delayedNames[0]}) is older than expected. Its figures may be missing recent results.`
    : `${delayedRows.length} datasets are older than expected (${delayedNames.join(', ')}). Their figures may be missing recent results.`;
  return { rows, total: rows.length, fresh: rows.length - delayedRows.length, delayed: delayedRows.length, delayedNames, warning,
    schedule: snapshot.refreshSchedule ?? null, reference, demo: isDemoSnapshot(snapshot), hasMetadata: rows.length > 0 };
}
