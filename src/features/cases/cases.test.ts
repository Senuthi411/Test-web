import { describe, expect, it } from 'vitest'
import { FixtureStore, findIntegrityProblems, type FixtureDatabase } from '@/fixtures'
import { fixedClock } from '@/shared/utilities/clock'
import { createCasesUseCases } from './application/casesUseCases'
import {
  canTransitionCase,
  computeCatalogDiseaseDiff,
  nextCaseStatus,
  validatePublishCatalogVersion,
  validateRecordCaseDiagnosis,
  validateSaveCatalogDraft,
} from './domain/rules'
import { createFixtureCasesAdapter } from './infrastructure/fixtureCasesAdapter'

const clock = fixedClock('2026-10-21T10:00:00+05:30')

function setupCases(initialActorId: string | null = 'USR-005') {
  const store = new FixtureStore({ latencyMs: 0 })
  let actorId = initialActorId
  const port = createCasesUseCases(
    createFixtureCasesAdapter(store, {
      clock,
      actorId: () => actorId,
    }),
  )
  return {
    store,
    port,
    asActor: (id: string | null) => {
      actorId = id
    },
  }
}

describe('Cases domain rules & state machine (Member 4)', () => {
  it('enforces valid case lifecycle transitions and rejects invalid transitions', () => {
    expect(nextCaseStatus('pending_link', 'linkCase')).toBe('awaiting_diagnosis')
    expect(nextCaseStatus('awaiting_diagnosis', 'recordDiagnosis')).toBe('diagnosed')
    expect(nextCaseStatus('awaiting_diagnosis', 'recordDiagnosisAndClose')).toBe('closed')
    expect(nextCaseStatus('diagnosed', 'closeCase')).toBe('closed')

    // Invalid transitions
    expect(canTransitionCase('pending_link', 'recordDiagnosis')).toBe(false)
    expect(canTransitionCase('diagnosed', 'recordDiagnosis')).toBe(false)
    expect(canTransitionCase('closed', 'closeCase')).toBe(false)
    expect(canTransitionCase('closed', 'recordDiagnosis')).toBe(false)
  })

  it('validates Record Diagnosis required fields', () => {
    const errors = validateRecordCaseDiagnosis({
      diseaseId: '',
      severity: 'High',
      symptomsConfirmed: [],
      clinicalFindings: 'short',
      reasoning: '',
      recommendedAction: '',
      followUpPriority: 'P1',
      followUpDescription: '',
      monitoringWindow: '',
      inspectionFocus: '',
      closeCase: false,
    })
    expect(errors.diseaseId).toBeDefined()
    expect(errors.symptomsConfirmed).toBeDefined()
    expect(errors.clinicalFindings).toBeDefined()
    expect(errors.reasoning).toBeDefined()
    expect(errors.recommendedAction).toBeDefined()
  })

  it('computes field-by-field catalog diffs between CURRENT v2 and NEW DRAFT v3', () => {
    const diffs = computeCatalogDiseaseDiff(
      {
        name: 'Grey blight',
        pathogen: 'Pestalotiopsis theae',
        category: 'Fungal',
        summary: 'Old summary',
        diagnosticCriteria: 'Old criteria',
        differentialDiagnosis: 'Same diff',
        treatmentGuidance: 'Old guidance',
        symptomIds: ['SYM-002', 'SYM-003'],
      },
      {
        name: 'Grey blight',
        pathogen: 'Pestalotiopsis theae',
        category: 'Fungal',
        summary: 'Updated v3 summary',
        diagnosticCriteria: 'Updated v3 criteria',
        differentialDiagnosis: 'Same diff',
        treatmentGuidance: 'Old guidance',
        symptomIds: ['SYM-002', 'SYM-003', 'SYM-007'],
      },
    )

    const changedFields = diffs.filter((d) => d.changed).map((d) => d.field)
    expect(changedFields).toEqual(['summary', 'diagnosticCriteria', 'symptomIds'])
  })

  it('validates catalog draft saving and version publication', () => {
    const draftErrors = validateSaveCatalogDraft({
      name: '',
      pathogen: '',
      category: 'Fungal',
      summary: '',
      diagnosticCriteria: '',
      differentialDiagnosis: '',
      treatmentGuidance: '',
      symptomIds: [],
      note: '',
    })
    expect(Object.keys(draftErrors)).toContain('name')
    expect(Object.keys(draftErrors)).toContain('symptomIds')

    const pubErrors = validatePublishCatalogVersion({
      releaseNotes: '',
      confirmPinnedUnchanged: false,
    })
    expect(pubErrors.releaseNotes).toBeDefined()
    expect(pubErrors.confirmPinnedUnchanged).toBeDefined()
  })
})

describe('FixtureCasesAdapter & cross-module FixtureStore synchronization', () => {
  it('scopes workspace cases strictly to Dr Tara Wijesinghe (EST-001, EST-002) and blocks EST-003 (403)', async () => {
    const { port } = setupCases('USR-005')
    const workspace = await port.getWorkspace()
    expect(workspace.actor.fullName).toBe('Dr Tara Wijesinghe')
    expect(workspace.estates.map((e) => e.id)).toEqual(['EST-001', 'EST-002'])
    expect(workspace.kpis.awaitingDiagnosisCount).toBe(3) // CASE-011, CASE-023, CASE-047
    expect(workspace.kpis.diagnosedCount).toBe(2) // CASE-006, CASE-042
    expect(workspace.kpis.pendingLinkCount).toBe(1) // REF-099

    // Out-of-scope Mist Valley (EST-003) case CASE-091 returns 403 forbidden
    await expect(port.getCase('CASE-091')).rejects.toMatchObject({ kind: 'forbidden' })
    // Unknown case CASE-999 returns 404 not_found
    await expect(port.getCase('CASE-999')).rejects.toMatchObject({ kind: 'not_found' })
  })

  it('links pending referral REF-099 to CASE-099 (pending_link -> awaiting_diagnosis)', async () => {
    const { port } = setupCases('USR-005')
    const linked = await port.linkPendingReferral('REF-099', {
      expectedVersion: 1,
      idempotencyKey: 'link-ref-099-key',
    })
    expect(linked.caseId).toBe('CASE-099')
    expect(linked.status).toBe('awaiting_diagnosis')
  })

  it('records an official expert diagnosis for CASE-023, pins Catalog v2, and keeps FixtureStore integrity valid', async () => {
    const { port, store } = setupCases('USR-005')
    const before = await port.getCase('CASE-023')
    expect(before.status).toBe('awaiting_diagnosis')
    expect(before.suspectedDisease.id).toBe('DIS-003')
    expect(before.confirmedDisease).toBeNull()

    const diagnosed = await port.recordDiagnosis(
      'CASE-023',
      {
        diseaseId: 'DIS-003',
        severity: 'High',
        symptomsConfirmed: ['Reddish-brown coalescing marginal lesions', 'Interveinal chlorosis & yellow margin halo'],
        clinicalFindings: 'Official final revision V2 confirms Colletotrichum reddish-brown marginal necrosis.',
        reasoning: 'Matches Catalog v2 DIS-003 criteria; lacks concentric black acervuli of Grey blight.',
        recommendedAction: 'Remove infected foliage during skiffing and apply copper fungicide across East Hills block B.',
        followUpPriority: 'P1',
        followUpDescription: 'Re-inspect East Hills DIV-005 in 7 days.',
        monitoringWindow: '7 days',
        inspectionFocus: 'Terrace 2 shaded rows',
        closeCase: false,
      },
      { expectedVersion: before.version, idempotencyKey: 'diag-case-023-key' },
    )

    expect(diagnosed.status).toBe('diagnosed')
    expect(diagnosed.confirmedDisease?.id).toBe('DIS-003')
    expect(diagnosed.diagnosis?.catalogVersionPinned).toBe(2)

    // Publishing Catalog v3 afterwards must NOT change CASE-023's pinned catalogVersionPinned (remains v2)
    const afterPublish = await port.publishCatalogVersion(
      {
        releaseNotes: 'Publish Catalog v3 with DIS-005 and updated DIS-002 criteria.',
        confirmPinnedUnchanged: true,
      },
      { expectedVersion: 2, idempotencyKey: 'pub-v3-key' },
    )
    expect(afterPublish.kpis.activeCatalogVersion).toBe(3)
    const reloadedCase = await port.getCase('CASE-023')
    expect(reloadedCase.diagnosis?.catalogVersionPinned).toBe(2)

    // Closing CASE-023 transitions diagnosed -> closed
    const closed = await port.closeCase('CASE-023', {
      expectedVersion: reloadedCase.version,
      idempotencyKey: 'close-case-023-key',
    })
    expect(closed.status).toBe('closed')
    expect(closed.diagnosis?.caseStatus).toBe('Closed')

    // Shared FixtureStore referential integrity check passes with 0 problems
    expect(findIntegrityProblems(store.read((db) => db) as FixtureDatabase)).toEqual([])
  })

  it('supports Advisory AI Assistant queries and Degraded Mode local catalog fallback without mutating case status', async () => {
    const { port } = setupCases('USR-005')
    const thread = await port.sendAiPrompt({
      threadId: 'AI-THR-001',
      prompt: 'Give degraded mode criteria for Grey blight DIS-002',
      contextCaseId: 'CASE-023',
      contextDiseaseId: 'DIS-002',
      simulateDegradedMode: true,
    })
    const lastMessage = thread.messages[thread.messages.length - 1]
    expect(lastMessage.role).toBe('assistant')
    expect(lastMessage.isDegradedFallback).toBe(true)
    expect(lastMessage.citations.length).toBeGreaterThan(0)

    // Case status remains awaiting_diagnosis (AI is strictly advisory)
    const case023 = await port.getCase('CASE-023')
    expect(case023.status).toBe('awaiting_diagnosis')
  })
})
