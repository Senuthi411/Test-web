import { describe, expect, it } from 'vitest'
import { FixtureStore, createSeedDatabase, type FixtureReviewStatus } from '@/fixtures'
import { isAppError } from '@/shared/api'
import { createAnalyticsUseCases } from './application/analyticsUseCases'
import { CSV_MIME, csvCell, exportFilename, toCsv } from './application/csv'
import { REPORT_TYPES, buildPageExport } from './application/pageExports'
import { freshnessSummary } from './domain/freshness'
import { ANALYTICS_PATHS, ANALYTICS_SCREENS, DEFAULT_FILTERS, STATUSES, type AnalyticsSnapshot, type Filters } from './domain/models'
import { filterError, parseFilters, scopeSnapshot, selectConfirmed, selectObservations, summarize, writeFilters } from './domain/selectors'
import { autoGranularity, buildBuckets, bucketCount, countByBucket, planGranularity, trendSeries } from './domain/timeBuckets'
import { STATUS_MAP, createFixtureAnalyticsAdapter } from './infrastructure/fixtureAnalyticsAdapter'
import { createHttpAnalyticsAdapter } from './infrastructure/httpAnalyticsAdapter'

const f = (over: Partial<Filters> = {}): Filters => ({ ...DEFAULT_FILTERS, statuses: [...DEFAULT_FILTERS.statuses], ...over })
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)
const MAYA = { estateIds: ['EST-001', 'EST-002'], divisionIds: [] }

// Expected values come from raw shared records, so these assertions support both team seeds.
const rawSeed = createSeedDatabase()
const rawRows = (estateId?: string, divisionId?: string) => rawSeed.observations.filter(o => {
  const division = rawSeed.divisions.find(d => d.id === o.divisionId)
  return !!division && MAYA.estateIds.includes(division.estateId) && (!estateId || division.estateId === estateId) && (!divisionId || o.divisionId === divisionId)
})
const rawPending = (rows: typeof rawSeed.observations) => rows.filter(o => ['submitted', 'resubmitted', 'in_review'].includes(o.reviewStatus))
const rawCounts = (rows: typeof rawSeed.observations) => ({
  Submitted: rows.filter(o => o.reviewStatus === 'submitted').length,
  Resubmitted: rows.filter(o => String(o.reviewStatus) === 'resubmitted').length,
  'In review': rows.filter(o => o.reviewStatus === 'in_review').length,
  Verified: rows.filter(o => o.reviewStatus === 'verified').length,
  Flagged: rows.filter(o => o.reviewStatus === 'flagged').length,
  'Correction requested': rows.filter(o => o.reviewStatus === 'correction_requested').length,
  Referred: rows.filter(o => o.reviewStatus === 'referred').length,
})


function setup(actor: string | null = 'USR-013') {
  const store = new FixtureStore({ latencyMs: 0 })
  let current = actor
  const port = createFixtureAnalyticsAdapter(store, { actorId: () => current })
  return { store, port, useCases: createAnalyticsUseCases(port), signIn: (id: string | null) => (current = id) }
}

async function mayaSnapshot(): Promise<AnalyticsSnapshot> {
  return setup().useCases.loadSnapshot(MAYA)
}

/** Minimal RFC 4180 parser for verifying exported CSV. */
function parseCsv(csv: string) {
  expect(csv.startsWith('﻿')).toBe(true)
  const text = csv.slice(1)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\r' && text[i + 1] === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      i++
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

describe('fixture analytics adapter (shared FixtureStore)', () => {
  it('maps every shared review status explicitly to an AN label', () => {
    const shared: (FixtureReviewStatus | 'resubmitted')[] = ['submitted', 'resubmitted', 'in_review', 'verified', 'flagged', 'correction_requested', 'referred']
    expect(Object.keys(STATUS_MAP).sort()).toEqual([...shared].sort())
    expect(shared.map((status) => STATUS_MAP[status])).toEqual([...STATUSES])
    const seen = new Set(createSeedDatabase().observations.map((item) => item.reviewStatus))
    for (const status of seen) expect(STATUS_MAP[status]).toBeDefined()
  })

  it('limits the Reporting User to EST-001 and EST-002 (33 observations, six divisions, no Mist Valley)', async () => {
    const snapshot = await mayaSnapshot()
    expect(snapshot.estates.map((estate) => estate.id)).toEqual(['EST-001', 'EST-002'])
    expect(snapshot.divisions.map((division) => division.id)).toEqual(['DIV-001', 'DIV-002', 'DIV-003', 'DIV-004', 'DIV-005', 'DIV-006'])
    expect(snapshot.observations).toHaveLength(33)
    expect(JSON.stringify(snapshot)).not.toMatch(/EST-003|Mist Valley|DIV-00[789]/)
    expect(snapshot.demo).toBe(true)
  })

  it('reproduces the status, estate and division counts computed from the raw seed', async () => {
    const snapshot = await mayaSnapshot()
    const all = summarize(snapshot.observations)
    expect(all.counts).toEqual(rawCounts(rawRows()))
    const estate = (id: string) => summarize(snapshot.observations.filter((item) => snapshot.divisions.find((division) => division.id === item.divisionId)?.estateId === id))
    expect(estate('EST-001').total).toBe(18)
    expect(estate('EST-001').counts).toEqual(rawCounts(rawRows('EST-001')))
    expect(estate('EST-002').total).toBe(15)
    expect(estate('EST-002').counts).toEqual(rawCounts(rawRows('EST-002')))
    const division = (id: string) => {
      const s = summarize(snapshot.observations.filter((item) => item.divisionId === id))
      return [s.total, s.open, s.verified, s.counts.Flagged]
    }
    const ids = ['DIV-001', 'DIV-002', 'DIV-003', 'DIV-004', 'DIV-005', 'DIV-006']
    expect(ids.map(division)).toEqual(ids.map(id => {
      const rows = rawRows(undefined, id)
      return [rows.length, rawPending(rows).length, rows.filter(o => o.reviewStatus === 'verified').length, rows.filter(o => o.reviewStatus === 'flagged').length]
    }))
    expect(all.flagRate).toBe(18)
    expect(all.verificationRate).toBe(15)
  })

  it('keeps suspected (capture) and confirmed (expert diagnosis) separate', async () => {
    const snapshot = await mayaSnapshot()
    const suspected = selectObservations(snapshot, f())
    const confirmed = selectConfirmed(snapshot, f())
    expect(suspected).toHaveLength(33)
    expect(confirmed.map((item) => [item.diagnosis?.id, item.diagnosis?.caseId, item.diagnosis?.disease])).toEqual([
      ['DIAG-006', 'CASE-006', 'Grey blight'],
      ['DIAG-042', 'CASE-042', 'Grey blight'],
    ])
    // Suspected disease counts come from the field, never from diagnoses.
    expect(['Blister blight', 'Grey blight', 'Brown blight', 'Algal leaf spot'].map((name) => suspected.filter((item) => item.suspectedDisease === name).length)).toEqual([8, 9, 8, 8])
    // A disease filter narrows each measure by its own disease field.
    expect(selectConfirmed(snapshot, f({ disease: 'Grey blight' }))).toHaveLength(2)
    expect(selectConfirmed(snapshot, f({ disease: 'Blister blight' }))).toHaveLength(0)
    const trend = trendSeries(snapshot, f())
    expect(trend.buckets.map((bucket) => bucket.suspected)).toEqual([0, 11, 12, 9, 1])
    expect(trend.buckets.map((bucket) => bucket.confirmed)).toEqual([0, 0, 2, 0, 0])
  })

  it('derives awaiting diagnosis, unlinked referrals and pending correction approvals from shared records', async () => {
    const snapshot = await mayaSnapshot()
    expect(snapshot.awaitingDiagnosisCases.sort()).toEqual(['CASE-011', 'CASE-023', 'CASE-047'])
    expect(snapshot.observations.filter((item) => item.awaitingCaseId).map((item) => item.awaitingCaseId).sort()).toEqual(['CASE-011', 'CASE-023', 'CASE-047'])
    expect(snapshot.unlinkedReferrals).toEqual([])
    expect(snapshot.observations.filter((item) => item.correctionApprovalPending).map((item) => item.id)).toEqual(['OBS-005'])
    expect(snapshot.pendingCorrectionApprovals).toBe(1)
  })

  it('computes bottleneck ages from capture dates to the snapshot date', async () => {
    const snapshot = await mayaSnapshot()
    const csv = buildPageExport('bottlenecks', snapshot, f()).table
    expect(csv.rows).toHaveLength(rawPending(rawRows()).length)
    expect(csv.rows.slice(0, 5).map((row) => `${row[0]}:${row[7]}`)).toEqual(['OBS-019:20', 'OBS-038:20', 'OBS-001:19', 'OBS-002:18', 'OBS-021:18'])
    expect(csv.rows.filter((row) => row[8] === 'yes')).toHaveLength(rawPending(rawRows()).filter(o => (Date.parse(snapshot.asOf.slice(0, 10)) - Date.parse(o.capturedAt.slice(0, 10))) / 86400000 > 7).length)
  })

  it('selects the seven-day window (4 observations) and 15–21 Oct daily buckets', async () => {
    const snapshot = await mayaSnapshot()
    const week = selectObservations(snapshot, f({ period: '7' }))
    expect(week).toHaveLength(4)
    expect(summarize(week).counts).toMatchObject({ Resubmitted: 0, Submitted: 1, 'In review': 2, Verified: 1 })
    expect(trendSeries(snapshot, f({ period: '7' })).buckets.map((bucket) => bucket.suspected)).toEqual([2, 1, 0, 0, 1, 0, 0])
  })

  it('refuses reads without a session or for another role', async () => {
    const { useCases, signIn } = setup(null)
    await expect(useCases.loadSnapshot(MAYA)).rejects.toSatisfy((error) => isAppError(error) && error.kind === 'unauthorized')
    signIn('USR-003')
    await expect(useCases.loadSnapshot(MAYA)).rejects.toSatisfy((error) => isAppError(error) && error.kind === 'forbidden')
  })

  it('applies the session scope again before aggregation (a narrower scope wins)', async () => {
    const snapshot = await setup().useCases.loadSnapshot({ estateIds: ['EST-002'] })
    expect(snapshot.estates.map((estate) => estate.id)).toEqual(['EST-002'])
    expect(snapshot.observations).toHaveLength(15)
    expect(scopeSnapshot(snapshot, { estateIds: ['EST-003'] }).observations).toEqual([])
  })

  it('the HTTP adapter reports contract_pending and sends no request', async () => {
    const http = new Proxy({}, { get: () => () => Promise.reject(new Error('no request expected')) })
    await expect(createHttpAnalyticsAdapter(http as never).readSnapshot()).rejects.toSatisfy((error) => isAppError(error) && error.kind === 'contract_pending')
  })
})

describe('page-specific CSV exports', () => {
  it('builds one dated file per screen, never containing out-of-scope records', async () => {
    const snapshot = await mayaSnapshot()
    for (const screen of ANALYTICS_SCREENS) {
      const file = buildPageExport(screen, snapshot, f())
      expect(file.filename).toBe(`tealeaf-${REPORT_TYPES[screen]}-2026-10-21.csv`)
      expect(file.csv).not.toMatch(/EST-003|Mist Valley/)
      expect(parseCsv(file.csv).length).toBeGreaterThan(1)
    }
  })

  it('Estate Overview totals and Disease Distribution counts match the scoped records', async () => {
    const snapshot = await mayaSnapshot()
    const estates = parseCsv(buildPageExport('estates', snapshot, f()).csv)
    expect(estates.map((row) => row.slice(0, 3))).toEqual([
      ['estate_id', 'estate_name', 'total_observations'],
      ['EST-001', 'Highland Tea Estate', '18'],
      ['EST-002', 'Riverbend Tea Estate', '15'],
      ['', 'Total', '33'],
    ])
    const diseases = parseCsv(buildPageExport('diseases', snapshot, f()).csv)
    const expert = diseases[0].indexOf('expert_confirmed')
    expect(diseases.slice(1).map((row) => [row[1], row[2], row[expert]])).toEqual([
      ['Blister blight', '8', '0'],
      ['Grey blight', '9', '2'],
      ['Brown blight', '8', '0'],
      ['Algal leaf spot', '8', '0'],
    ])
  })

  it('Suspected vs Confirmed exports suspected, confirmed and awaiting counts separately', async () => {
    const snapshot = await mayaSnapshot()
    const rows = parseCsv(buildPageExport('trends', snapshot, f()).csv)
    expect(rows[0]).toEqual(['period_start', 'period_end', 'time_bucket', 'suspected_observations', 'expert_confirmed_diagnoses', 'awaiting_diagnosis'])
    expect(sum(rows.slice(1).map((row) => Number(row[3])))).toBe(33)
    expect(sum(rows.slice(1).map((row) => Number(row[4])))).toBe(2)
    expect(sum(rows.slice(1).map((row) => Number(row[5])))).toBe(3)
  })

  it('labels freshness metadata as demo fixture data', async () => {
    const snapshot = await mayaSnapshot()
    const summary = freshnessSummary(snapshot)
    expect([summary.total, summary.fresh, summary.delayed, summary.delayedNames]).toEqual([4, 3, 1, ['Expert diagnoses']])
    const rows = parseCsv(buildPageExport('freshness', snapshot, f()).csv)
    expect(rows[1].at(-1)).toBe('Demo snapshot metadata (synthetic fixture data)')
  })

  it('CSV cells are quoted and formula-safe; the document uses BOM and CRLF', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell(42)).toBe('42')
    expect(csvCell(null)).toBe('')
    expect(csvCell('=1+1')).not.toBe('=1+1')
    expect(parseCsv(toCsv({ columns: ['a', 'b'], rows: [['x,"y"\nz', 1]] }))).toEqual([
      ['a', 'b'],
      ['x,"y"\nz', '1'],
    ])
    expect(CSV_MIME).toBe('text/csv;charset=utf-8')
    expect(exportFilename('Review Bottlenecks', '2026-10-21T20:00:00+05:30')).toBe('tealeaf-review-bottlenecks-2026-10-21.csv')
  })
})

describe('domain: time buckets, URL filters and routes', () => {
  it('builds Monday–Sunday weeks clipped to the range and calendar months', () => {
    const span = (buckets: { start: string; end: string }[]) => buckets.map((bucket) => `${bucket.start}..${bucket.end}`)
    expect(span(buildBuckets('2026-09-22', '2026-10-21', 'week'))).toEqual([
      '2026-09-22..2026-09-27',
      '2026-09-28..2026-10-04',
      '2026-10-05..2026-10-11',
      '2026-10-12..2026-10-18',
      '2026-10-19..2026-10-21',
    ])
    expect(span(buildBuckets('2028-01-15', '2028-03-10', 'month'))).toEqual(['2028-01-15..2028-01-31', '2028-02-01..2028-02-29', '2028-03-01..2028-03-10'])
    expect(autoGranularity('2026-10-15', '2026-10-21')).toBe('day')
    expect(autoGranularity('2026-09-22', '2026-10-21')).toBe('week')
    expect(autoGranularity('2026-07-24', '2026-10-21')).toBe('month')
    expect(countByBucket(buildBuckets('2026-10-01', '2026-10-07', 'week'), ['2026-09-30', '2026-10-01', '2026-10-04', '2026-10-05', '2026-10-08'])).toEqual([2, 1])
  })

  it('falls back to coarser grouping above the 120-point limit and refuses to chart 322 months', () => {
    expect(bucketCount('2000-01-01', '2026-10-21', 'month')).toBe(322)
    const plan = planGranularity('2000-01-01', '2026-10-21', 'week')
    expect([plan.granularity, plan.reason, plan.chartable]).toEqual(['month', 'bucket-limit', false])
    const daily = planGranularity('2026-07-21', '2026-10-21', 'day')
    expect([daily.granularity, daily.reason]).toEqual(['month', 'daily-limit'])
  })

  it('round-trips filters through the URL and rejects impossible dates', () => {
    const filters = f({ estate: 'EST-001', division: 'DIV-002', period: '7', disease: 'Grey blight', statuses: ['Flagged'], measure: 'both', query: 'north', granularity: 'day' })
    expect(parseFilters(writeFilters(new URLSearchParams(), filters))).toEqual(filters)
    expect(filterError(f({ period: 'custom', from: '2026-02-30', to: '2026-03-01' }))).not.toBe('')
    expect(filterError(f())).toBe('')
  })

  it('registers AN-06 at /analytics/suspected-vs-confirmed', () => {
    expect(ANALYTICS_PATHS.trends).toBe('/analytics/suspected-vs-confirmed')
    expect(Object.values(ANALYTICS_PATHS)).toHaveLength(9)
  })
})
