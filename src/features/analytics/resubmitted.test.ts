import { describe, expect, it } from 'vitest'
import { FixtureStore, FIXTURE_REFERENCE_DATE } from '@/fixtures'
import { createFixtureAnalyticsAdapter } from './infrastructure/fixtureAnalyticsAdapter'
import { DEFAULT_FILTERS, STATUSES } from './domain/models'
import { ageDays, isOpenReviewStatus, parseFilters, selectObservations, summarize, writeFilters } from './domain/selectors'
import { trendSeries } from './domain/timeBuckets'
import { buildPageExport } from './application/pageExports'
import { statusColors } from './presentation/components/chartTheme'

function setup() {
  const store = new FixtureStore({ latencyMs: 0 })
  // Isolated contract sample only: the shared seed on disk is never edited.
  store.write(db => Object.assign(db.observations.find(o => o.id === 'OBS-005')!, { reviewStatus: 'resubmitted' }))
  const raw = store.read(db => {
    const actor = db.users.find(u => u.id === 'USR-013')!
    const divisions = db.divisions.filter(d => actor.estateIds.includes(d.estateId))
    return db.observations.filter(o => divisions.some(d => d.id === o.divisionId))
  })
  const pending = raw.filter(o => ['submitted', 'resubmitted', 'in_review'].includes(o.reviewStatus))
  const date = (s: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(s))
  const age = (s: string) => (Date.parse(date(FIXTURE_REFERENCE_DATE)) - Date.parse(date(s))) / 86400000
  return { port: createFixtureAnalyticsAdapter(store, { actorId: () => 'USR-013' }), raw, pending, age }
}

describe('Resubmitted observation compatibility', () => {
  it('maps a corrected submission distinctly without duplicating its observation or changing capture time', async () => {
    const { port, raw } = setup(), snapshot = await port.readSnapshot()
    expect(snapshot.observations).toHaveLength(raw.length)
    expect(new Set(snapshot.observations.map(o => o.id)).size).toBe(raw.length)
    expect(snapshot.observations.find(o => o.id === 'OBS-005')).toMatchObject({ status: 'Resubmitted', capturedAt: raw.find(o => o.id === 'OBS-005')!.capturedAt, correctionApprovalPending: true })
    expect(summarize(snapshot.observations).counts.Resubmitted).toBe(1)
  })
  it('agrees with independently counted pending records, capture ages and overdue CSV rows', async () => {
    const { port, raw, pending, age } = setup(), snapshot = await port.readSnapshot(), summary = summarize(snapshot.observations)
    expect(summary.open).toBe(pending.length)
    expect(summary.reviewed).toBe(raw.length - pending.length)
    const csv = buildPageExport('bottlenecks', snapshot, DEFAULT_FILTERS).table
    expect(csv.rows.map(r => r[0]).sort()).toEqual(pending.map(o => o.id).sort())
    expect(csv.rows.filter(r => r[8] === 'yes')).toHaveLength(pending.filter(o => age(o.capturedAt) > 7).length)
    for (const o of snapshot.observations) expect(ageDays(o, snapshot.asOf)).toBe(age(o.capturedAt))
    expect(csv.rows.find(r => r[0] === 'OBS-005')?.slice(5,9)).toEqual(['Resubmitted', '2026-10-06', 15, 'yes'])
  })
  it('uses all three pending states and treats referred/verified/flagged/corrections separately', () => {
    expect(STATUSES.filter(isOpenReviewStatus)).toEqual(['Submitted', 'Resubmitted', 'In review'])
    expect(Object.keys(statusColors).sort()).toEqual([...STATUSES].sort())
    expect(statusColors.Resubmitted).toContain('--tl-teal-stroke')
  })
  it('exports the seventh category in all status-based schemas without leaking estate scope', async () => {
    const { port } = setup(), snapshot = await port.readSnapshot()
    for (const screen of ['dashboard','estates','divisions','observations','diseases','trends','bottlenecks','filters','freshness'] as const) {
      const csv = buildPageExport(screen, snapshot, DEFAULT_FILTERS)
      expect(csv.table.rows.every(r => r.length === csv.table.columns.length)).toBe(true)
      expect(csv.csv.charCodeAt(0)).toBe(0xfeff)
      expect(csv.csv).not.toMatch(/EST-003|Mist Valley|DIV-00[789]/)
      if (['estates','divisions','filters'].includes(screen)) {
        const column = csv.table.columns.indexOf('resubmitted')
        expect(column).toBeGreaterThan(-1)
        expect(csv.table.rows.some(r => r[column] === 1)).toBe(true)
      }
    }
    const statistics = buildPageExport('observations', snapshot, DEFAULT_FILTERS).table
    expect(statistics.rows.some(r => r[0] === 'review_status' && r[1] === 'resubmitted' && r[4] === 1)).toBe(true)
  })
  it('round-trips a Resubmitted filter and preserves explicit older selections', async () => {
    const { port } = setup(), snapshot = await port.readSnapshot()
    const selected = parseFilters(new URLSearchParams('statuses=Resubmitted'))
    expect(selected.statuses).toEqual(['Resubmitted'])
    // Status selection controls preview columns, not the capture-record population.
    expect(selectObservations(snapshot, selected)).toHaveLength(snapshot.observations.length)
    expect(parseFilters(writeFilters(new URLSearchParams(), selected)).statuses).toEqual(['Resubmitted'])
    const old = parseFilters(new URLSearchParams('statuses=Submitted,In+review,Verified,Flagged,Correction+requested,Referred'))
    expect(old.statuses).not.toContain('Resubmitted')
    expect(selectObservations(snapshot, old)).toHaveLength(snapshot.observations.length)
  })
  it('keeps capture trends and actual expert diagnoses independent of resubmission', async () => {
    const { port, raw } = setup(), snapshot = await port.readSnapshot(), trend = trendSeries(snapshot, DEFAULT_FILTERS)
    expect(trend.buckets.reduce((n,b) => n + b.suspected, 0)).toBe(raw.length)
    expect(trend.buckets.reduce((n,b) => n + b.confirmed, 0)).toBe(2)
    expect(selectObservations(snapshot, { ...DEFAULT_FILTERS, period: '7' }).some(o => o.id === 'OBS-005')).toBe(false)
  })
})
