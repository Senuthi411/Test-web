import type { FixtureDatabase } from './records'

/**
 * Checks referential integrity of the fixture dataset. Returns a list of problems;
 * an empty list means every reference resolves. Run by the test suite.
 */
export function findIntegrityProblems(db: FixtureDatabase): string[] {
  const problems: string[] = []
  const estateIds = new Set(db.estates.map((estate) => estate.id))
  const divisionIds = new Set(db.divisions.map((division) => division.id))
  const userById = new Map(db.users.map((user) => [user.id, user]))
  const diseaseIds = new Set(db.diseases.map((disease) => disease.id))

  const checkUnique = (label: string, ids: string[]) => {
    const seen = new Set<string>()
    for (const id of ids) {
      if (seen.has(id)) problems.push(`Duplicate ${label} id ${id}`)
      seen.add(id)
    }
  }
  checkUnique('estate', db.estates.map((e) => e.id))
  checkUnique('division', db.divisions.map((d) => d.id))
  checkUnique('user', db.users.map((u) => u.id))
  checkUnique('observation', db.observations.map((o) => o.id))
  checkUnique('device session', db.deviceSessions.map((s) => s.id))

  checkUnique('case', db.cases.map((c) => c.id))
  checkUnique('audit event', db.auditEvents.map((e) => e.id))
  checkUnique('user e-mail', db.users.map((u) => u.email))
  checkUnique('employee', db.users.map((u) => u.employeeId.trim().toLowerCase()))
  // Never print a NIC: report the users that share one instead.
  const nicOwners = new Map<string, string>()
  for (const u of db.users) {
    if (!u.nic) continue
    const owner = nicOwners.get(u.nic)
    if (owner) problems.push(`${u.id} and ${owner} share a NIC`)
    else nicOwners.set(u.nic, u.id)
  }

  for (const division of db.divisions) {
    if (!estateIds.has(division.estateId)) {
      problems.push(`${division.id} references unknown estate ${division.estateId}`)
    }
  }

  for (const user of db.users) {
    user.estateIds.forEach((id) => {
      if (!estateIds.has(id)) problems.push(`${user.id} scope references unknown estate ${id}`)
    })
    user.divisionIds.forEach((id) => {
      if (!divisionIds.has(id)) problems.push(`${user.id} scope references unknown division ${id}`)
    })
    if (user.role === 'FIELD_WORKER' && user.estateIds.length > 0) {
      problems.push(`${user.id} is a field worker with estate-level scope`)
    }
    if (user.role !== 'FIELD_WORKER' && user.divisionIds.length > 0) {
      problems.push(`${user.id} has division-level scope but is not a field worker`)
    }
    const details = user.roleDetails
    if (details.role !== user.role) problems.push(`${user.id} role details are for ${details.role}`)
    if (details.role === 'FIELD_WORKER' && details.supervisorId) {
      const supervisor = userById.get(details.supervisorId)
      const workerEstates = new Set(user.divisionIds.map((id) => db.divisions.find((division) => division.id === id)?.estateId))
      if (supervisor?.role !== 'SUPERVISOR' || !supervisor.estateIds.some((id) => workerEstates.has(id))) {
        problems.push(`${user.id} supervisor ${details.supervisorId} is not a Supervisor of the worker's estate`)
      }
    }
    if (details.role === 'SUPERVISOR' && details.reportsToId) {
      if (details.reportsToId === user.id || !userById.has(details.reportsToId)) problems.push(`${user.id} reports to an unknown user`)
    }
  }

  for (const observation of db.observations) {
    if (!divisionIds.has(observation.divisionId)) {
      problems.push(`${observation.id} references unknown division ${observation.divisionId}`)
    }
    if (!diseaseIds.has(observation.suspectedDiseaseId)) {
      problems.push(`${observation.id} references unknown disease ${observation.suspectedDiseaseId}`)
    }
    const worker = userById.get(observation.fieldWorkerId)
    if (worker?.role !== 'FIELD_WORKER') {
      problems.push(`${observation.id} field worker ${observation.fieldWorkerId} is not a field worker`)
    } else if (!worker.divisionIds.includes(observation.divisionId)) {
      problems.push(`${observation.id} captured outside ${worker.id}'s division scope`)
    }
  }

  for (const session of db.deviceSessions) {
    if (!userById.has(session.userId)) {
      problems.push(`${session.id} references unknown user ${session.userId}`)
    }
  }

  const observationById = new Map(db.observations.map((o) => [o.id, o]))
  checkUnique('assignment', db.assignments.map((item) => item.id))
  checkUnique('capture evidence', db.captureEvidence.map((item) => item.observationId))
  for (const item of db.captureEvidence) {
    if (!observationById.has(item.observationId)) problems.push(`Evidence references unknown observation ${item.observationId}`)
    if (!Number.isFinite(item.latitude) || Math.abs(item.latitude) > 90 || !Number.isFinite(item.longitude) || Math.abs(item.longitude) > 180) problems.push(`Invalid coordinates for ${item.observationId}`)
  }
  for (const item of db.assignments) {
    const division = db.divisions.find((row) => row.id === item.divisionId)
    if (!division || division.estateId !== item.estateId) problems.push(`${item.id} has inconsistent estate/division context`)
    if (userById.get(item.createdBy)?.role !== 'SUPERVISOR') problems.push(`${item.id} creator is not a Supervisor`)
    if (item.fieldWorkerId && userById.get(item.fieldWorkerId)?.role !== 'FIELD_WORKER') problems.push(`${item.id} worker is not a Field Worker`)
    if (item.acceptedAt && (!item.fieldWorkerId || item.status === 'draft')) problems.push(`${item.id} is accepted without an assigned Field Worker`)
    for (const id of item.observationIds) {
      const observation = observationById.get(id)
      if (!observation || observation.divisionId !== item.divisionId) problems.push(`${item.id} observation ${id} is outside its division`)
    }
  }
  for (const item of db.cases) {
    const observation = observationById.get(item.observationId)
    if (!observation) problems.push(`${item.id} references unknown observation ${item.observationId}`)
    // An expert-confirmed case may be finalised by the Supervisor afterwards (Verified or Flagged).
    else if (!['referred', 'verified', 'flagged'].includes(observation.reviewStatus)) problems.push(`${item.id} is for ${observation.id}, which was not referred`)
  }

  for (const credential of db.credentials) {
    const owner = userById.get(credential.userId)
    if (!owner) problems.push(`Credential for unknown user ${credential.userId}`)
    else if (owner.email !== credential.email) problems.push(`Credential e-mail for ${owner.id} does not match the user`)
  }

  const sessionIds = new Set(db.deviceSessions.map((s) => s.id))
  for (const event of db.auditEvents) {
    if (!userById.has(event.actorId)) problems.push(`${event.id} actor ${event.actorId} is unknown`)
    if (event.userId && !userById.has(event.userId)) problems.push(`${event.id} references unknown user ${event.userId}`)
    if (event.divisionId && !divisionIds.has(event.divisionId)) problems.push(`${event.id} references unknown division ${event.divisionId}`)
    if (event.sessionId && !sessionIds.has(event.sessionId)) problems.push(`${event.id} references unknown session ${event.sessionId}`)
    event.estateIds.forEach((id) => {
      if (!estateIds.has(id)) problems.push(`${event.id} references unknown estate ${id}`)
    })
  }

  for (const request of db.recoveryRequests) {
    if (!sessionIds.has(request.sessionId)) problems.push(`${request.id} references unknown session ${request.sessionId}`)
  }

  db.dashboardAttentionUserIds.forEach((id) => {
    if (!userById.has(id)) problems.push(`Dashboard attention list references unknown user ${id}`)
  })

  checkReview(db, observationById, userById, divisionIds, problems)
  return problems
}

/** Review records (Phase 5): every reference resolves and statuses agree across records. */
function checkReview(
  db: FixtureDatabase,
  observationById: Map<string, FixtureDatabase['observations'][number]>,
  userById: Map<string, FixtureDatabase['users'][number]>,
  divisionIds: Set<string>,
  problems: string[],
) {
  const unique = (label: string, ids: string[]) => {
    const seen = new Set<string>()
    ids.forEach((id) => {
      if (seen.has(id)) problems.push(`Duplicate ${label} id ${id}`)
      seen.add(id)
    })
  }
  unique('review record', db.reviewRecords.map((r) => r.id))
  unique('review decision', db.reviewDecisions.map((r) => r.id))
  unique('correction', db.corrections.map((r) => r.id))
  unique('referral', db.referrals.map((r) => r.id))
  unique('quarantine item', db.quarantineItems.map((r) => r.id))
  const estateOf = (observationId: string) => db.divisions.find((division) => division.id === observationById.get(observationId)?.divisionId)?.estateId
  for (const record of db.reviewRecords) {
    if (!observationById.has(record.observationId)) problems.push(`${record.id} references unknown observation ${record.observationId}`)
  }
  for (const observation of db.observations) {
    if (!db.reviewRecords.some((record) => record.observationId === observation.id)) problems.push(`${observation.id} has no review record`)
  }
  for (const correction of db.corrections) {
    const observation = observationById.get(correction.observationId)
    if (!observation) problems.push(`${correction.id} references unknown observation ${correction.observationId}`)
    else if (correction.status === 'requested' && observation.reviewStatus !== 'correction_requested') {
      problems.push(`${correction.id} is requested but ${observation.id} is not correction_requested`)
    } else if (['resubmitted', 'approved'].includes(correction.status) && !['resubmitted', 'in_review'].includes(observation.reviewStatus)) {
      problems.push(`${correction.id} has a resubmitted revision but ${observation.id} is neither resubmitted nor in review`)
    }
    if (userById.get(correction.requestedBy)?.role !== 'SUPERVISOR') problems.push(`${correction.id} requester is not a Supervisor`)
    if (correction.status !== 'requested' && correction.revisionId !== null) {
      const revision = db.observationRevisions.find((item) => item.id === correction.revisionId)
      if (!revision || revision.observationId !== correction.observationId || revision.correctionId !== correction.id || revision.number !== correction.requestedRevision) {
        problems.push(`${correction.id} revision ${correction.revisionId} is not a stored revision answering it`)
      }
    }
    if (['resubmitted', 'approved', 'applied'].includes(correction.status) && correction.revisionId === null) problems.push(`${correction.id} is ${correction.status} without a revision`)
  }
  // Revisions: unique IDs, numbered 1, 2, 3… per observation, each correction answered once.
  unique('observation revision', db.observationRevisions.map((r) => r.id))
  for (const observation of db.observations) {
    const stored = db.observationRevisions.filter((item) => item.observationId === observation.id).sort((a, b) => a.number - b.number)
    if (stored.length === 0) continue
    stored.forEach((revision, index) => {
      if (revision.number !== index + 1) problems.push(`${observation.id} revisions are not numbered 1…${stored.length}`)
      if ((revision.number === 1) !== (revision.correctionId === null)) problems.push(`${revision.id} must answer a correction exactly when it is not the original`)
      if (revision.correctionId && db.corrections.find((item) => item.id === revision.correctionId)?.observationId !== observation.id) problems.push(`${revision.id} answers a correction of another observation`)
    })
  }
  for (const observation of db.observations) {
    if (observation.reviewStatus === 'resubmitted' && !db.corrections.some((item) => item.observationId === observation.id && ['resubmitted', 'approved'].includes(item.status))) {
      problems.push(`${observation.id} is resubmitted without an open resubmitted correction`)
    }
  }
  for (const referral of db.referrals) {
    const observation = observationById.get(referral.observationId)
    if (!observation) problems.push(`${referral.id} references unknown observation ${referral.observationId}`)
    // After the expert decision, the Supervisor finalises the referred observation (Verified or Flagged).
    else if (observation.reviewStatus !== 'referred' && !(referral.diagnosis && ['verified', 'flagged'].includes(observation.reviewStatus))) problems.push(`${referral.id} is for ${observation.id}, which is not referred`)
    const expert = userById.get(referral.expertId)
    if (expert?.role !== 'DISEASE_EXPERT') problems.push(`${referral.id} expert ${referral.expertId} is not a Disease Expert`)
    else if (!expert.estateIds.includes(estateOf(referral.observationId) ?? '')) problems.push(`${referral.id} expert is outside the observation's estate`)
    if (referral.caseStatus === 'diagnosed' && !db.cases.some((item) => item.id === referral.caseId && item.observationId === referral.observationId)) {
      problems.push(`${referral.id} is diagnosed but ${referral.caseId} is not an expert-confirmed case`)
    }
    if (referral.linkStatus === 'pending_case_link' && referral.caseId) problems.push(`${referral.id} has a case but is pending case link`)
  }
  for (const item of db.quarantineItems) {
    const division = db.divisions.find((row) => row.id === item.divisionId)
    if (!divisionIds.has(item.divisionId) || division?.estateId !== item.estateId) problems.push(`${item.id} has inconsistent estate/division context`)
  }
  for (const decision of db.reviewDecisions) {
    const decider = userById.get(decision.decidedBy)
    if (decider?.role !== 'SUPERVISOR') problems.push(`${decision.id} decided by a non-Supervisor`)
    else if (!decider.estateIds.includes(decision.estateId)) problems.push(`${decision.id} decided outside the Supervisor's scope`)
    const targetEstate = decision.type === 'quarantine' ? (db.quarantineItems.find((item) => item.id === decision.targetId)?.estateId ?? db.divisionQuarantines?.find((item) => item.id === decision.targetId)?.estateId) : estateOf(decision.targetId)
    if (targetEstate !== decision.estateId) problems.push(`${decision.id} target ${decision.targetId} is not in ${decision.estateId}`)
  }
  for (const detail of db.reviewObservationDetails) {
    if (!observationById.has(detail.observationId)) problems.push(`Review detail references unknown observation ${detail.observationId}`)
  }
  // Replays each observation's recorded decisions through the approved Review transitions
  // (REV-04/05/06/10/11/12 and RevisionApplied) and checks the stored status agrees.
  // A flagged observation may still request a correction; a verified one may still be referred.
  // A resubmitted revision is reviewed exactly like an observation in review.
  const STEP: Record<string, { from: string[]; to: string | null }> = {
    // Referred → Verified/Flagged is the Supervisor finalising a received expert decision.
    verified: { from: ['in_review', 'resubmitted', 'referred'], to: 'verified' },
    flagged: { from: ['in_review', 'resubmitted', 'referred'], to: 'flagged' },
    correction_requested: { from: ['in_review', 'flagged', 'resubmitted'], to: 'correction_requested' },
    referred: { from: ['in_review', 'verified', 'resubmitted'], to: 'referred' },
    correction_approved: { from: ['correction_requested', 'resubmitted'], to: null },
    correction_rejected: { from: ['correction_requested', 'resubmitted'], to: 'correction_requested' },
    revision_applied: { from: ['correction_requested', 'resubmitted'], to: 'in_review' },
    // Lifecycle events recorded in the decision log: starting a review (Submitted or Resubmitted → In Review), the worker's
    // resubmission, the expert's confirmation (the stored status stays Referred; Decision is derived) and End Process (to History).
    review_started: { from: ['in_review', 'resubmitted'], to: 'in_review' },
    resubmitted: { from: ['correction_requested', 'resubmitted'], to: 'resubmitted' },
    expert_decision: { from: ['referred'], to: null },
    process_ended: { from: ['in_review', 'verified', 'flagged', 'referred', 'resubmitted', 'correction_requested'], to: null },
  }
  for (const observation of db.observations) {
    const decisions = db.reviewDecisions.filter((item) => item.type !== 'quarantine' && item.targetId === observation.id)
    if (decisions.length === 0) continue
    let status = 'in_review'
    for (const decision of decisions) {
      const step = STEP[decision.outcome]
      if (!step || !step.from.includes(status)) {
        problems.push(`${decision.id} (${decision.outcome}) is not an approved transition from ${status} for ${observation.id}`)
        break
      }
      status = step.to ?? status
      // The Field Worker's resubmission is a Capture event, not a decision: once the requested
      // correction has a stored revision, the review continues from Resubmitted.
      if (decision.outcome === 'correction_requested' && db.corrections.find((item) => item.id === decision.recordId)?.revisionId) status = 'resubmitted'
      // RevisionApplied is a system event, not a supervisor decision: an approved
      // correction that is now Applied returns the review to in_review at that point.
      if (decision.outcome === 'correction_approved' && db.corrections.find((item) => item.id === decision.recordId)?.status === 'applied') status = 'in_review'
    }
    // Starting the review of a resubmitted revision moves it to In review without a decision.
    const started = (db.reviewRecords.find((item) => item.observationId === observation.id)?.reviewStarts ?? []).length > 0
    if (status === 'resubmitted' && observation.reviewStatus === 'in_review' && started) status = 'in_review'
    if (status !== observation.reviewStatus) problems.push(`${observation.id} is ${observation.reviewStatus} but its decisions lead to ${status}`)
  }
  for (const item of db.captureEvidence) {
    if (!item.imageSource?.attribution) problems.push(`Evidence image for ${item.observationId} has no source attribution`)
    if (item.imageSource?.kind === 'licensed_photo' && (!item.imageSource.license || !item.imageSource.sourceUrl)) problems.push(`Licensed photo for ${item.observationId} lacks licence or source`)
  }

  db.reviewFollowUpObservationIds.forEach((id) => {
    if (observationById.get(id)?.reviewStatus !== 'flagged') problems.push(`Follow-up list entry ${id} is not flagged`)
  })
}
