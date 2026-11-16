import type {
  FixtureCorrection,
  FixtureDatabase,
  FixtureObservation,
  FixtureQuarantineItem,
  FixtureReferral,
  FixtureReviewDecision,
  FixtureStore,
  FixtureUser,
} from '@/fixtures'
import { latestRevisionOf, projectRevision, revisionIdOf, revisionsOf } from '@/fixtures'
import { revisionDifferences } from '@/features/capture'
import { AppError } from '@/shared/api'
import type { Clock } from '@/shared/utilities/clock'
import type { DecisionResult, ReviewPort } from '../application/ports'
import type {
  Correction,
  DecisionMeta,
  ObservationReview,
  PersonRef,
  QuarantineItem,
  Referral,
  ReviewDecision,
  ReviewObservation,
  ReviewWorkspace,
} from '../domain/models'
import { DECISION_OUTCOME_LABEL, REVIEW_STATUS_LABEL, type ReviewStatus } from '../domain/models'
import {
  RESULTING_STATUS,
  allowedDecisions,
  canApplyRevision,
  canApproveCorrection,
  isFinalReviewStatus,
  observationArchivedAt,
  canDecide,
  canRejectCorrection,
  canResubmit,
  canStartReview,
  type ObservationDecision,
} from '../domain/rules'

const DECISION_LABEL: Record<ObservationDecision, string> = {
  verify: 'Verify observation',
  flag: 'Flag observation',
  requestCorrection: 'Request correction',
  refer: 'Refer to expert',
}

/** REV-03 "Decision pending" detail, listing only the decisions the status allows. */
function pendingDetail(decisions: readonly ObservationDecision[]): string {
  if (decisions.length === 1) return DECISION_LABEL[decisions[0]]
  return 'Verify, flag, request correction or refer'
}

type Db = FixtureDatabase
type ReadDb = Readonly<FixtureDatabase>

export interface FixtureReviewOptions {
  clock: Clock
  actorId: () => string | null
}

/** "2026-10-21T10:00:00+05:30" for the fixture clock's instant, in Sri Lanka time. */
function localIso(date: Date): string {
  const local = new Date(date.getTime() + 5.5 * 3600 * 1000)
  return `${local.toISOString().slice(0, 19)}+05:30`
}

const person = (db: ReadDb, id: string): PersonRef => {
  const user = db.users.find((item) => item.id === id)
  return { id, fullName: user?.fullName ?? id }
}

/**
 * Fixture Review adapter on the shared FixtureStore. It enforces, on every call:
 * an active Supervisor session; the Supervisor's stored estate scope (out-of-scope and
 * missing records give the same not_found); the explicit transitions in domain/rules;
 * optimistic versions (409 conflict); and idempotency keys (a repeated key returns the
 * first result and never applies a decision twice). It never changes Capture evidence
 * or assignment records.
 */
export function createFixtureReviewAdapter(store: FixtureStore, options: FixtureReviewOptions): ReviewPort {
  const now = () => localIso(options.clock.now())

  const actorOf = (db: ReadDb): FixtureUser => {
    const id = options.actorId()
    if (!id) throw new AppError('unauthorized', 'Sign in to review observations.')
    const actor = db.users.find((user) => user.id === id)
    if (!actor || actor.status !== 'active' || actor.role !== 'SUPERVISOR') throw new AppError('forbidden', 'Only Supervisors can use the Review module.')
    return actor
  }

  const estateOfDivision = (db: ReadDb, divisionId: string) => db.divisions.find((item) => item.id === divisionId)?.estateId ?? null
  const inScope = (actor: FixtureUser, estateId: string | null) => estateId !== null && actor.estateIds.includes(estateId)

  /**
   * Review status as the Supervisor sees it. A Referred observation whose expert referral has a
   * diagnosis is shown as Decision (the expert decision is available); this is derived, not stored.
   */
  const effectiveStatus = (db: ReadDb, observation: FixtureObservation): ReviewStatus =>
    observation.reviewStatus === 'referred' && db.referrals.some((item) => item.observationId === observation.id && item.caseStatus === 'diagnosed' && item.diagnosis)
      ? 'decision'
      : observation.reviewStatus

  /** The final decision's time for a Verified or Flagged observation (the last decision recorded on it). */
  const finalisedAtOf = (db: ReadDb, observation: FixtureObservation): string | null => {
    if (!isFinalReviewStatus(observation.reviewStatus)) return null
    const times = db.reviewDecisions.filter((item) => item.targetId === observation.id && item.type !== 'quarantine').map((item) => item.decidedAt)
    const instant = (iso: string) => new Date(iso.includes('T') ? iso : `${iso}T12:00:00+05:30`).getTime()
    return times.sort((a, b) => instant(a) - instant(b)).at(-1) ?? observation.capturedAt
  }

  const projectObservation = (db: ReadDb, observation: FixtureObservation): ReviewObservation => {
    const division = db.divisions.find((item) => item.id === observation.divisionId)
    const estate = db.estates.find((item) => item.id === division?.estateId)
    const disease = db.diseases.find((item) => item.id === observation.suspectedDiseaseId)
    if (!division || !estate || !disease) throw new AppError('contract_mismatch', 'The observation has incomplete related records.')
    return {
      id: observation.id,
      estate: { id: estate.id, name: estate.name },
      division: { id: division.id, name: division.name },
      fieldWorker: person(db, observation.fieldWorkerId),
      suspectedDisease: { id: disease.id, name: disease.name },
      capturedAt: observation.capturedAt,
      reviewStatus: effectiveStatus(db, observation),
      gpsAccuracyM: observation.gpsAccuracyM,
      catalogVersion: observation.catalogVersion,
      revisionNumber: latestRevisionOf(db, observation.id).number,
      assignmentId: db.assignments.find((item) => item.observationIds.includes(observation.id))?.id ?? null,
      finalisedAt: finalisedAtOf(db, observation),
      archivedAt: observationArchivedAt(finalisedAtOf(db, observation), now()),
    }
  }

  const scopedObservation = (db: ReadDb, actor: FixtureUser, observationId: string) => {
    const observation = db.observations.find((item) => item.id === observationId)
    if (!observation || !inScope(actor, estateOfDivision(db, observation.divisionId))) {
      throw new AppError('not_found', 'This observation is unavailable in your estate scope.')
    }
    return observation
  }

  const projectCorrection = (db: ReadDb, item: FixtureCorrection): Correction => {
    const observation = db.observations.find((row) => row.id === item.observationId)!
    const evidence = db.captureEvidence.find((row) => row.observationId === item.observationId)
    // The Field Worker's revision answering this correction, compared with the revision before it.
    const stored = item.revisionId ? db.observationRevisions.find((row) => row.id === item.revisionId) : undefined
    const previous = stored ? revisionsOf(db, item.observationId).find((row) => row.number === stored.number - 1) : undefined
    const revision = stored
      ? {
          id: stored.id,
          number: stored.number,
          submittedAt: stored.submittedAt,
          changes: previous
            ? revisionDifferences(projectRevision(db, previous), projectRevision(db, stored)).filter((row) => row.changed).map(({ field, before, after }) => ({ field, before, after }))
            : [],
        }
      : null
    return {
      id: item.id,
      observation: projectObservation(db, observation),
      requestedBy: person(db, item.requestedBy),
      requestedAt: item.requestedAt,
      requestedRevision: item.requestedRevision,
      items: [...item.items],
      message: item.message,
      status: item.status,
      version: item.version,
      revision,
      appliedRevision: item.status === 'applied' ? item.requestedRevision : null,
      approvedAt: item.approvedAt,
      appliedAt: item.appliedAt,
      rejection: item.rejection ? { at: item.rejection.at, by: person(db, item.rejection.by), reason: item.rejection.reason, message: item.rejection.message } : null,
      evidenceImageId: evidence?.imageId ?? null,
    }
  }

  const projectReferral = (db: ReadDb, item: FixtureReferral): Referral => {
    const disease = item.diagnosis ? db.diseases.find((row) => row.id === item.diagnosis?.diseaseId) : undefined
    return {
      id: item.id,
      observation: projectObservation(db, db.observations.find((row) => row.id === item.observationId)!),
      expert: person(db, item.expertId),
      referredBy: person(db, item.referredBy),
      referredAt: item.referredAt,
      note: item.note,
      linkStatus: item.linkStatus,
      caseId: item.caseId,
      caseCreatedAt: item.caseCreatedAt,
      caseStatus: item.caseStatus,
      diagnosis: item.diagnosis && disease ? { id: item.diagnosis.id, disease: { id: disease.id, name: disease.name }, at: item.diagnosis.at, statement: item.diagnosis.statement } : null,
    }
  }

  const projectQuarantine = (db: ReadDb, item: FixtureQuarantineItem): QuarantineItem => {
    const estate = db.estates.find((row) => row.id === item.estateId)!
    const division = db.divisions.find((row) => row.id === item.divisionId)!
    return {
      id: item.id,
      deviceObservationId: item.deviceObservationId,
      estate: { id: estate.id, name: estate.name },
      division: { id: division.id, name: division.name },
      capturedAt: item.capturedAt,
      quarantinedAt: item.quarantinedAt,
      reason: item.reason,
      state: item.state,
      ingestReceipt: item.ingestReceipt,
      decision: item.decision ? { id: item.decision.id, outcome: item.decision.outcome, by: person(db, item.decision.by), at: item.decision.at, reason: item.decision.reason } : null,
    }
  }

  const projectDecision = (db: ReadDb, item: FixtureReviewDecision): ReviewDecision => {
    const referral = item.type === 'referral' ? db.referrals.find((row) => row.id === item.recordId) : undefined
    return {
      id: item.id,
      type: item.type,
      outcome: item.outcome,
      recordId: item.recordId,
      targetId: item.targetId,
      decidedBy: person(db, item.decidedBy),
      decidedAt: item.decidedAt,
      // REV-17 shows "Linked to CASE-006" for linked referrals.
      note: referral?.linkStatus === 'linked' && referral.caseId ? `Linked to ${referral.caseId}` : item.note,
      // Seeded decisions predate every resubmission, so they were made on revision 1.
      revision: item.type === 'quarantine' ? null : { id: item.revisionId ?? revisionIdOf(item.targetId, item.revisionNumber ?? 1), number: item.revisionNumber ?? 1 },
      divisionId: item.type === 'quarantine'
        ? db.quarantineItems.find((row) => row.id === item.targetId)?.divisionId ?? null
        : db.observations.find((row) => row.id === item.targetId)?.divisionId ?? null,
    }
  }

  const nextId = (ids: string[], prefix: string) => {
    const max = Math.max(0, ...ids.filter((id) => id.startsWith(prefix)).map((id) => Number(id.slice(prefix.length)) || 0))
    return `${prefix}${String(max + 1).padStart(3, '0')}`
  }

  /** A repeated idempotency key returns the original outcome without re-applying it. */
  const replay = (db: ReadDb, actor: FixtureUser, key: string): DecisionResult | null => {
    const previous = db.reviewDecisions.find((item) => item.idempotencyKey === key && item.decidedBy === actor.id)
    if (!previous) return null
    const correction = db.corrections.find((row) => row.id === previous.recordId)
    const referral = db.referrals.find((row) => row.id === previous.recordId)
    return {
      decision: projectDecision(db, previous),
      ...(correction ? { correction: projectCorrection(db, correction) } : {}),
      ...(referral ? { referral: projectReferral(db, referral) } : {}),
    }
  }

  const recordDecision = (db: Db, actor: FixtureUser, estateId: string, entry: Omit<FixtureReviewDecision, 'id' | 'decidedBy' | 'decidedAt' | 'estateId' | 'provenance' | 'revisionId' | 'revisionNumber'>) => {
    // Every observation decision is recorded against the revision being reviewed: the latest one.
    const revision = entry.type === 'quarantine' ? null : latestRevisionOf(db, entry.targetId)
    const decision: FixtureReviewDecision = {
      ...entry,
      revisionId: revision?.id ?? null,
      revisionNumber: revision?.number ?? null,
      id: nextId(db.reviewDecisions.map((item) => item.id), 'DEC-'),
      decidedBy: actor.id,
      decidedAt: now(),
      estateId,
      provenance: 'fixture-assigned',
    }
    db.reviewDecisions.push(decision)
    return decision
  }

  /** The correction whose resubmitted revision is waiting for review, if any. */
  const openCorrectionOf = (db: Db, observationId: string) =>
    db.corrections.find((item) => item.observationId === observationId && (item.status === 'resubmitted' || item.status === 'approved'))

  /** Shared preamble for the four observation decisions (REV-04/05/06/12). */
  const observationDecision = (observationId: string, decisionKind: ObservationDecision, meta: DecisionMeta, apply: (db: Db, actor: FixtureUser, observation: FixtureObservation, estateId: string) => DecisionResult) =>
    store.run(() =>
      store.write((db) => {
        const actor = actorOf(db)
        const observation = scopedObservation(db, actor, observationId)
        const replayed = replay(db, actor, meta.idempotencyKey)
        if (replayed) return replayed
        const record = db.reviewRecords.find((item) => item.observationId === observation.id)
        if (!record) throw new AppError('contract_mismatch', 'The review record for this observation is unavailable.')
        if (record.version !== meta.expectedVersion) throw new AppError('conflict', 'Another reviewer changed this record. Refresh before deciding.')
        const status = effectiveStatus(db, observation)
        if (!canDecide(status, decisionKind)) {
          throw new AppError('conflict', `This decision is not available while the observation is ${REVIEW_STATUS_LABEL[status]}.`)
        }
        const estateId = estateOfDivision(db, observation.divisionId)!
        // A decision on a resubmitted revision (now In review) is the review of that corrected revision.
        const answered = openCorrectionOf(db, observation.id)
        const result = apply(db, actor, observation, estateId)
        if (answered) {
          // The revision already reached the server as a new revision, so it is the reviewed
          // (applied) revision from now on; the correction request is complete.
          answered.status = 'applied'
          answered.approvedAt ??= now()
          answered.approvedBy ??= actor.id
          answered.appliedAt = now()
          answered.version += 1
        }
        record.version += 1
        return result
      }),
    )

  const scopedCorrection = (db: ReadDb, actor: FixtureUser, correctionId: string) => {
    const correction = db.corrections.find((item) => item.id === correctionId)
    const observation = db.observations.find((item) => item.id === correction?.observationId)
    if (!correction || !observation || !inScope(actor, estateOfDivision(db, observation.divisionId))) {
      throw new AppError('not_found', 'This correction is unavailable in your estate scope.')
    }
    return { correction, observation }
  }

  const correctionDecision = (correctionId: string, meta: DecisionMeta, apply: (db: Db, actor: FixtureUser, correction: FixtureCorrection, estateId: string) => DecisionResult) =>
    store.run(() =>
      store.write((db) => {
        const actor = actorOf(db)
        const { correction, observation } = scopedCorrection(db, actor, correctionId)
        const replayed = replay(db, actor, meta.idempotencyKey)
        if (replayed) return replayed
        if (correction.version !== meta.expectedVersion) throw new AppError('conflict', 'This correction changed. Refresh before deciding.')
        const result = apply(db, actor, correction, estateOfDivision(db, observation.divisionId)!)
        correction.version += 1
        return { ...result, correction: projectCorrection(db, correction) }
      }),
    )

  /** REV-03 record, with a history that ends in the decisions the current status allows. */
  const projectReview = (db: ReadDb, observation: FixtureObservation): ObservationReview => {
    const record = db.reviewRecords.find((item) => item.observationId === observation.id)
    if (!record) throw new AppError('contract_mismatch', 'The review record for this observation is unavailable.')
    const evidence = db.captureEvidence.find((item) => item.observationId === observation.id)
    const estateId = estateOfDivision(db, observation.divisionId)
    const correction = [...db.corrections].reverse().find((item) => item.observationId === observation.id)
    const referral = db.referrals.find((item) => item.observationId === observation.id)
    const decisions = db.reviewDecisions.filter((item) => item.targetId === observation.id)
    const revisions = revisionsOf(db, observation.id)
    const latest = revisions[revisions.length - 1]
    const corrected = revisions.length > 1
    const history: ObservationReview['history'] = [
      { id: 'submitted', title: 'Submitted', at: observation.capturedAt.slice(0, 10), by: null, detail: corrected ? 'received from mobile · version 1' : 'received from mobile', state: 'done' },
    ]
    if (record.claimedBy && record.claimedAt) {
      history.push({ id: 'claimed', title: 'Claimed for review', at: record.claimedAt, by: person(db, record.claimedBy).fullName, detail: null, state: 'done' })
    }
    // Decisions and resubmitted revisions, in the order they happened.
    const events: ObservationReview['history'] = [
      ...decisions.map((decision) => ({
        id: decision.id, title: decisionTitle(decision.outcome), at: decision.decidedAt, by: person(db, decision.decidedBy).fullName,
        detail: corrected ? `on version ${decision.revisionNumber ?? 1}` : null, state: 'done' as const,
      })),
      ...revisions.slice(1).map((revision) => ({
        id: revision.id, title: `Version ${revision.number} resubmitted`, at: revision.submittedAt, by: person(db, revision.submittedBy).fullName,
        detail: `${revision.id} · received from mobile`, state: 'done' as const,
      })),
    ]
    for (const start of record.reviewStarts ?? []) {
      events.push({ id: `start-${start.revisionNumber}-${start.at}`, title: `Review started on version ${start.revisionNumber}`, at: start.at, by: person(db, start.by).fullName, detail: null, state: 'done' })
    }
    history.push(...events.sort((a, b) => (a.at ?? '').localeCompare(b.at ?? '')))
    const status = effectiveStatus(db, observation)
    if (canDecide(status)) {
      history.push({ id: 'pending', title: 'Decision pending', at: null, by: null, detail: pendingDetail(allowedDecisions(status)), state: 'open' })
    }
    return {
      observation: projectObservation(db, observation),
      reviewId: record.id,
      version: record.version,
      evidence: evidence
        ? { imageId: evidence.imageId, altText: evidence.altText, imageSource: { ...evidence.imageSource }, latitude: evidence.latitude, longitude: evidence.longitude, receivedAt: evidence.receivedAt }
        : null,
      // The Observation card shows what the latest revision says.
      symptoms: [...latest.values.symptoms],
      fieldNote: latest.values.note,
      history,
      nextRevisionNumber: latest.number + 1,
      correctionId: correction?.id ?? null,
      referralId: referral?.id ?? null,
      experts: db.users
        .filter((user) => user.role === 'DISEASE_EXPERT' && user.status === 'active' && estateId !== null && user.estateIds.includes(estateId))
        .map((user) => ({
          id: user.id,
          fullName: user.fullName,
          estateIds: [...user.estateIds],
          awaitingCaseIds: db.referrals
            .filter((item) => item.expertId === user.id && item.caseStatus === 'awaiting_diagnosis' && item.caseId)
            .map((item) => item.caseId!)
            .sort(),
        })),
      revisions: revisions.map((revision, index) => {
        const on = decisions.filter((item) => (item.revisionNumber ?? 1) === revision.number)
        const last = on[on.length - 1]
        return {
          ...projectRevision(db, revision),
          statusLabel: index === revisions.length - 1 ? REVIEW_STATUS_LABEL[status] : last ? DECISION_OUTCOME_LABEL[last.outcome] : 'Superseded',
          decisions: on.map((item) => ({ id: item.id, outcome: item.outcome, decidedAt: item.decidedAt, decidedBy: person(db, item.decidedBy).fullName, note: projectDecision(db, item).note })),
        }
      }),
      expertDecision: (() => {
        const decided = db.referrals.find((item) => item.observationId === observation.id && item.diagnosis)
        const disease = decided?.diagnosis ? db.diseases.find((item) => item.id === decided.diagnosis!.diseaseId) : undefined
        return decided?.diagnosis
          ? { referralId: decided.id, caseId: decided.caseId, expert: person(db, decided.expertId).fullName, disease: disease ? `${disease.name} (${disease.id})` : decided.diagnosis.diseaseId, statement: decided.diagnosis.statement, decidedAt: decided.diagnosis.at }
          : null
      })(),
      requests: db.corrections
        .filter((item) => item.observationId === observation.id)
        .map((item) => ({
          correctionId: item.id, onRevision: item.requestedRevision - 1, requestedRevision: item.requestedRevision, requestedBy: person(db, item.requestedBy).fullName,
          requestedAt: item.requestedAt, items: [...item.items], message: item.message, status: item.status, version: item.version,
        })),
    }
  }

  return {
    getWorkspace(signal) {
      return store.run(
        () =>
          store.read((db): ReviewWorkspace => {
            const actor = actorOf(db)
            const divisions = db.divisions.filter((item) => actor.estateIds.includes(item.estateId))
            const divisionIds = new Set(divisions.map((item) => item.id))
            const observations = db.observations.filter((item) => divisionIds.has(item.divisionId))
            const observationIds = new Set(observations.map((item) => item.id))
            return {
              actor: { id: actor.id, fullName: actor.fullName },
              estates: db.estates.filter((item) => actor.estateIds.includes(item.id)).map(({ id, name }) => ({ id, name })),
              divisions: divisions.map(({ id, name, estateId }) => ({ id, name, estateId })),
              observations: observations.map((item) => projectObservation(db, item)),
              corrections: db.corrections.filter((item) => observationIds.has(item.observationId)).map((item) => projectCorrection(db, item)),
              referrals: db.referrals.filter((item) => observationIds.has(item.observationId)).map((item) => projectReferral(db, item)),
              // Scoped to the signed-in Supervisor, as REV-14's banner says production must be.
              quarantine: db.quarantineItems.filter((item) => actor.estateIds.includes(item.estateId)).map((item) => projectQuarantine(db, item)),
              decisions: db.reviewDecisions
                .filter((item) => actor.estateIds.includes(item.estateId))
                .map((item) => projectDecision(db, item))
                .sort((a, b) => (a.decidedAt.slice(0, 10) === b.decidedAt.slice(0, 10) ? b.id.localeCompare(a.id) : b.decidedAt.localeCompare(a.decidedAt))),
              followUpObservationIds: db.reviewFollowUpObservationIds.filter((id) => observationIds.has(id)),
            }
          }),
        signal,
      )
    },

    getObservationReview(observationId, signal) {
      return store.run(
        () =>
          store.read((db): ObservationReview => {
            const actor = actorOf(db)
            return projectReview(db, scopedObservation(db, actor, observationId))
          }),
        signal,
      )
    },

    claim(observationId) {
      return store.run(() =>
        store.write((db): ObservationReview => {
          const actor = actorOf(db)
          const observation = scopedObservation(db, actor, observationId)
          const record = db.reviewRecords.find((item) => item.observationId === observation.id)
          if (!record) throw new AppError('contract_mismatch', 'The review record for this observation is unavailable.')
          // Submitted moves to In review when opened; Resubmitted when the Supervisor starts the
          // review of the new revision. Any other status is returned unchanged.
          if (observation.reviewStatus === 'submitted') {
            observation.reviewStatus = 'in_review'
            record.claimedBy = actor.id
            record.claimedAt = now()
            record.version += 1
          } else if (canStartReview(observation.reviewStatus)) {
            observation.reviewStatus = 'in_review'
            record.reviewStarts = [...(record.reviewStarts ?? []), { revisionNumber: latestRevisionOf(db, observation.id).number, at: now(), by: actor.id }]
            record.version += 1
          }
          return projectReview(db, observation)
        }),
      )
    },

    verify(observationId, input, meta) {
      return observationDecision(observationId, 'verify', meta, (db, actor, observation, estateId) => {
        observation.reviewStatus = RESULTING_STATUS.verify
        const decision = recordDecision(db, actor, estateId, {
          type: 'verification', outcome: 'verified', recordId: observation.id.replace('OBS-', 'REV-'), targetId: observation.id,
          note: input.note || null, idempotencyKey: meta.idempotencyKey,
        })
        return { decision: projectDecision(db, decision) }
      })
    },

    flag(observationId, input, meta) {
      return observationDecision(observationId, 'flag', meta, (db, actor, observation, estateId) => {
        observation.reviewStatus = RESULTING_STATUS.flag
        // "Flagging marks a concern for follow up" (REV-05).
        if (!db.reviewFollowUpObservationIds.includes(observation.id)) db.reviewFollowUpObservationIds.push(observation.id)
        const decision = recordDecision(db, actor, estateId, {
          type: 'flag', outcome: 'flagged', recordId: observation.id.replace('OBS-', 'REV-'), targetId: observation.id,
          note: input.explanation, idempotencyKey: meta.idempotencyKey,
          details: { reason: input.reason, category: input.category, notifyFieldWorker: input.notifyFieldWorker },
        })
        return { decision: projectDecision(db, decision) }
      })
    },

    requestCorrection(observationId, input, meta) {
      return observationDecision(observationId, 'requestCorrection', meta, (db, actor, observation, estateId) => {
        // The correction answered by a resubmitted revision is completed by this decision, so only
        // another still-open request blocks a new one.
        const answered = openCorrectionOf(db, observation.id)
        if (db.corrections.some((item) => item !== answered && item.observationId === observation.id && ['requested', 'resubmitted', 'approved'].includes(item.status))) {
          throw new AppError('conflict', 'An open correction already exists for this observation.')
        }
        const base = observation.id.replace('OBS-', 'COR-')
        const id = db.corrections.some((item) => item.id === base) ? nextId(db.corrections.map((item) => item.id), `${base}-`) : base
        const correction: FixtureCorrection = {
          // The next revision is built from the latest submitted one.
          id, observationId: observation.id, requestedBy: actor.id, requestedAt: now(), requestedRevision: latestRevisionOf(db, observation.id).number + 1,
          items: [...input.items], message: input.message, status: 'requested', version: 1, revisionId: null,
          approvedAt: null, approvedBy: null, appliedAt: null, rejection: null, provenance: 'fixture-assigned',
        }
        db.corrections.push(correction)
        observation.reviewStatus = RESULTING_STATUS.requestCorrection
        // Requesting a correction is the follow-up to a flag: the open correction replaces the flag's attention item.
        db.reviewFollowUpObservationIds = db.reviewFollowUpObservationIds.filter((id) => id !== observation.id)
        const decision = recordDecision(db, actor, estateId, {
          type: 'correction', outcome: 'correction_requested', recordId: id, targetId: observation.id, note: input.message, idempotencyKey: meta.idempotencyKey,
        })
        return { decision: projectDecision(db, decision), correction: projectCorrection(db, correction) }
      })
    },

    refer(observationId, input, meta) {
      return observationDecision(observationId, 'refer', meta, (db, actor, observation, estateId) => {
        const expert = db.users.find((user) => user.id === input.expertId)
        if (!expert || expert.role !== 'DISEASE_EXPERT' || expert.status !== 'active' || !expert.estateIds.includes(estateId)) {
          throw new AppError('validation', 'The selected disease expert does not cover this estate.', { details: [{ path: 'expertId', message: 'Select a disease expert for this estate' }] })
        }
        const base = observation.id.replace('OBS-', 'REF-')
        const id = db.referrals.some((item) => item.id === base) ? nextId(db.referrals.map((item) => item.id), `${base}-`) : base
        // REV-12/REV-13: a referral starts as "Pending case link". No case is created here.
        const referral: FixtureReferral = {
          id, observationId: observation.id, expertId: expert.id, referredBy: actor.id, referredAt: now(), note: input.note,
          linkStatus: 'pending_case_link', caseId: null, caseCreatedAt: null, caseStatus: null, diagnosis: null, provenance: 'fixture-assigned',
        }
        db.referrals.push(referral)
        observation.reviewStatus = RESULTING_STATUS.refer
        const decision = recordDecision(db, actor, estateId, {
          type: 'referral', outcome: 'referred', recordId: id, targetId: observation.id, note: input.note, idempotencyKey: meta.idempotencyKey,
        })
        return { decision: projectDecision(db, decision), referral: projectReferral(db, referral) }
      })
    },

    approveCorrection(correctionId, input, meta) {
      return correctionDecision(correctionId, meta, (db, actor, correction, estateId) => {
        if (!canApproveCorrection(correction.status)) throw new AppError('conflict', 'Only a resubmitted revision can be approved.')
        // "Approval is not application": the review stays correction_requested (REV-10).
        correction.status = 'approved'
        correction.approvedAt = now()
        correction.approvedBy = actor.id
        const decision = recordDecision(db, actor, estateId, {
          type: 'correction', outcome: 'correction_approved', recordId: correction.id, targetId: correction.observationId, note: input.note || null, idempotencyKey: meta.idempotencyKey,
        })
        return { decision: projectDecision(db, decision) }
      })
    },

    rejectCorrection(correctionId, input, meta) {
      return correctionDecision(correctionId, meta, (db, actor, correction, estateId) => {
        if (!canRejectCorrection(correction.status)) throw new AppError('conflict', 'This correction can no longer be rejected.')
        // "Rejecting leaves the original observation and evidence unchanged" (REV-11). A rejected
        // resubmission returns the observation to Correction requested; the revision stays in its history.
        const observation = db.observations.find((item) => item.id === correction.observationId)
        if (observation?.reviewStatus === 'resubmitted') observation.reviewStatus = 'correction_requested'
        correction.status = 'rejected'
        correction.rejection = { at: now(), by: actor.id, reason: input.reason, message: input.message, notifyFieldWorker: input.notifyFieldWorker }
        const decision = recordDecision(db, actor, estateId, {
          type: 'correction', outcome: 'correction_rejected', recordId: correction.id, targetId: correction.observationId, note: input.reason, idempotencyKey: meta.idempotencyKey,
          details: { message: input.message, notifyFieldWorker: input.notifyFieldWorker },
        })
        return { decision: projectDecision(db, decision) }
      })
    },

    exportList() {
      return store.run(() =>
        store.read((db) => {
          actorOf(db)
          return { simulated: true }
        }),
      )
    },

    simulateRevisionApplied(correctionId, expectedVersion) {
      return store.run(() =>
        store.write((db) => {
          const actor = actorOf(db)
          const { correction, observation } = scopedCorrection(db, actor, correctionId)
          if (correction.version !== expectedVersion) throw new AppError('conflict', 'This correction changed. Refresh before continuing.')
          if (!canApplyRevision(correction.status)) throw new AppError('conflict', 'RevisionApplied can only follow an approved correction.')
          if (!['correction_requested', 'resubmitted', 'in_review'].includes(observation.reviewStatus)) throw new AppError('contract_mismatch', 'The observation is not awaiting this correction.')
          correction.status = 'applied'
          correction.appliedAt = now()
          correction.version += 1
          // "Only then does review return to in_review" (REV-06).
          observation.reviewStatus = 'in_review'
          const record = db.reviewRecords.find((item) => item.observationId === observation.id)
          if (record) record.version += 1
          return projectCorrection(db, correction)
        }),
      )
    },

    simulateResubmission(correctionId, input, expectedVersion) {
      return store.run(() =>
        store.write((db) => {
          const actor = actorOf(db)
          const { correction, observation } = scopedCorrection(db, actor, correctionId)
          if (correction.version !== expectedVersion) throw new AppError('conflict', 'This correction changed. Refresh before continuing.')
          if (!canResubmit(correction.status, observation.reviewStatus)) throw new AppError('conflict', 'Only a requested correction can be resubmitted.')
          const revisions = revisionsOf(db, observation.id)
          const latest = revisions[revisions.length - 1]
          if (correction.requestedRevision !== latest.number + 1) throw new AppError('contract_mismatch', 'The correction does not follow the latest revision.')
          const record = db.reviewRecords.find((item) => item.observationId === observation.id)
          if (!record) throw new AppError('contract_mismatch', 'The review record for this observation is unavailable.')
          // Keep the original submission as stored, so revision 1 can never change afterwards.
          if (!db.observationRevisions.some((item) => item.observationId === observation.id && item.number === 1)) {
            db.observationRevisions.push({ ...structuredClone(revisions[0]), provenance: 'fixture-assigned' })
          }
          // The new revision starts from the latest one; unchanged information is preserved.
          const number = latest.number + 1
          const base = (latest.values.imageId ?? observation.id.replace('OBS-', 'IMG-')).replace(/-V\d+$/, '')
          db.observationRevisions.push({
            id: revisionIdOf(observation.id, number), observationId: observation.id, number, submittedAt: now(), submittedBy: observation.fieldWorkerId,
            correctionId: correction.id,
            values: { ...structuredClone(latest.values), note: input.note, imageId: input.retakePhoto ? `${base}-V${number}` : latest.values.imageId },
            provenance: 'fixture-assigned',
          })
          correction.status = 'resubmitted'
          correction.revisionId = revisionIdOf(observation.id, number)
          correction.version += 1
          observation.reviewStatus = 'resubmitted'
          record.version += 1
          return projectCorrection(db, correction)
        }),
      )
    },
  }
}

function decisionTitle(outcome: FixtureReviewDecision['outcome']): string {
  const titles: Record<FixtureReviewDecision['outcome'], string> = {
    verified: 'Verified',
    flagged: 'Flagged',
    correction_requested: 'Correction requested',
    correction_approved: 'Correction approved',
    correction_rejected: 'Correction rejected',
    revision_applied: 'RevisionApplied',
    referred: 'Referred to expert',
    released: 'Released',
  }
  return titles[outcome]
}
