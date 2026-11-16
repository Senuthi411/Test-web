import { useState, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { ActionMenu, Badge, Banner, Button, ButtonLink, Card, DataTable, DescriptionList, EmptyState, FilterSelect, Modal, PageHeader, Radio, SearchInput, SelectField, Tabs, TextAreaField, TextField, usePageBreadcrumbs, useToast, type ActionMenuItem } from '@/shared/components'
import type { CaptureWorkspace } from '../application/ports'
import {
  ASSIGNMENT_STATUS, ASSIGNMENT_TYPE, activeAssignmentOf, assignmentErrors, assignmentType, busyMessage, canCancelAssignment, canSimulateWorkerAcceptance, completionBlock,
  editLock, isAcceptedByWorker, isAssignmentSummary, type Assignment, type AssignmentInput, type AssignmentStatus,
} from '../domain/assignment'
import { INSPECTION_OBSERVATION_SECTIONS, templateById, type TaskRequirements } from '../domain/taskTemplates'
import type { CaptureObservation } from '../domain/observation'
import { AssignmentCreateForm } from './AssignmentCreateForm'
import { TaskRequirementsEditor, TaskRequirementsView, TaskSubmissionView } from './TaskRequirements'
import { EvidenceImage } from './EvidenceImage'
import { useAssignmentActions, useWorkspace } from './services'
import { Boundary, Status } from './common'
import { dateTime, failure, observationPath } from './helpers'
import styles from './capture.module.css'

const LIFECYCLE: AssignmentStatus[] = ['draft', 'assigned', 'in_progress', 'submitted', 'completed']
const shortDate = (value: string | null | undefined) => (value ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo' }).format(new Date(value.length === 10 ? `${value}T12:00:00+05:30` : value)) : '—')
const reviewLabel = (status: string) => status.replaceAll('_', ' ')

/** The actions each status allows (shown in the list menu and on the detail page). */
function statusActions(a: Assignment): ActionMenuItem[] {
  const view = { id: 'view', label: 'View details', icon: 'eye' as const, to: `/assignments/${a.id}` }
  if (a.archivedAt) return [view, { id: 'history', label: 'View history', icon: 'history' as const, to: '/review/history?section=assignments' }]
  switch (a.status) {
    case 'draft': return [{ id: 'edit', label: 'Edit draft', icon: 'edit', to: `/assignments/${a.id}/edit` }, { id: 'submit', label: 'Submit assignment', icon: 'send', to: `/assignments/${a.id}` }, { id: 'cancel', label: 'Cancel draft', icon: 'x', to: `/assignments/${a.id}` }]
    case 'assigned': return canCancelAssignment(a) ? [view, { id: 'cancel', label: 'Cancel assignment', icon: 'x', to: `/assignments/${a.id}` }] : [view]
    case 'in_progress': return [{ id: 'progress', label: 'View progress', icon: 'history', to: `/assignments/${a.id}` }, view]
    case 'submitted': return [{ id: 'evidence', label: 'View submitted evidence', icon: 'image', to: `/assignments/${a.id}#submission` }, { id: 'review', label: 'Review submission', icon: 'eye', to: `/assignments/${a.id}#submission` }, { id: 'complete', label: 'Complete assignment', icon: 'check', to: `/assignments/${a.id}#submission` }]
    case 'completed': return [view, { id: 'history', label: 'View history', icon: 'history', to: `/assignments/${a.id}#activity` }]
    default: return [view]
  }
}

function hasSubmission(a: Assignment) {
  return assignmentType(a) === 'task' ? Boolean(a.submission) : a.observationIds.length > 0
}

export function AssignmentsPage() {
  const query = useWorkspace()
  usePageBreadcrumbs([{ label: 'Capture', to: '/observations' }, { label: 'Fieldwork Assignments' }])
  return <Boundary query={query}>{(data) => <AssignmentList data={data} />}</Boundary>
}

/** One Assignment Management interface for every status; archived assignments are in History. */
function AssignmentList({ data }: { data: CaptureWorkspace }) {
  const [status, setStatus] = useState<AssignmentStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'inspection' | 'task'>('all')
  const [divisionFilter, setDivisionFilter] = useState('all')
  const [workerFilter, setWorkerFilter] = useState('all')
  const [search, setSearch] = useState('')
  const actions = useAssignmentActions()
  const toast = useToast()
  const navigate = useNavigate()
  const term = search.trim().toLowerCase()
  const active = data.assignments.filter((row) => !row.archivedAt)
  const inFilters = (row: Assignment) => (typeFilter === 'all' || assignmentType(row) === typeFilter) && (divisionFilter === 'all' || row.divisionId === divisionFilter) && (workerFilter === 'all' || row.fieldWorkerId === workerFilter) && (!term || `${row.id} ${row.title}`.toLowerCase().includes(term))
  const filtered = active.filter(inFilters)
  const rows = filtered.filter((row) => status === 'all' || row.status === status)
  const division = (id: string) => data.divisions.find((row) => row.id === id)?.name ?? id
  const worker = (id: string | null) => data.workers.find((row) => row.id === id)?.fullName ?? 'Not assigned'
  const archived = data.assignments.length - active.length
  return <div className={styles.page}>
    <PageHeader title="Fieldwork Assignments" subtitle={`${data.estates.map((estate) => `${estate.name} (${estate.id})`).join(', ')} · ${active.length} active assignments${archived ? ` · ${archived} in Assignment History` : ''}`} actions={<ButtonLink to="/assignments/new">Create assignment</ButtonLink>} />
    <Tabs label="Assignment status" idBase="assignment-status" value={status} onChange={setStatus} items={[
      { id: 'all' as const, label: `All ${filtered.length}` }, ...(['draft', 'assigned', 'in_progress', 'submitted', 'completed', 'cancelled', 'reassigned'] as const).map((id) => ({ id, label: `${ASSIGNMENT_STATUS[id]} ${filtered.filter((row) => row.status === id).length}` })),
    ]} />
    <Card><div className={styles.filterBar}>
      <SearchInput label="Search assignments" placeholder="Search by assignment ID or title" width={320} value={search} onChange={(event) => setSearch(event.target.value)} />
      <FilterSelect<'all' | 'inspection' | 'task'> label="Type" value={typeFilter} onChange={setTypeFilter} options={[{ value: 'all', label: 'All' }, { value: 'inspection', label: 'Inspection' }, { value: 'task', label: 'Task' }]} />
      <FilterSelect label="Division" value={divisionFilter} onChange={setDivisionFilter} options={[{ value: 'all', label: 'All' }, ...data.divisions.map((row) => ({ value: row.id, label: `${row.id} ${row.name}` }))]} />
      <FilterSelect label="Field worker" value={workerFilter} onChange={setWorkerFilter} options={[{ value: 'all', label: 'All' }, ...data.workers.map((row) => ({ value: row.id, label: row.fullName }))]} />
      <Button variant="ghost" icon="refresh" disabled={!term && typeFilter === 'all' && divisionFilter === 'all' && workerFilter === 'all'} onClick={() => { setSearch(''); setTypeFilter('all'); setDivisionFilter('all'); setWorkerFilter('all') }}>Reset filters</Button>
    </div><DataTable<Assignment> caption="Fieldwork assignments" rows={rows} rowKey={(row) => row.id} onRowActivate={(row) => navigate(`/assignments/${row.id}`)} empty={<EmptyState title="No assignments in this status" message="Change the status tab or filters." />} columns={[
      { id: 'title', header: 'Title', cell: (row) => row.title },
      { id: 'type', header: 'Type', cell: (row) => <span>{ASSIGNMENT_TYPE[assignmentType(row)]}{assignmentType(row) === 'task' && templateById(row.templateId) ? ` · ${templateById(row.templateId)!.name}` : ''}</span> },
      { id: 'id', header: 'Assignment', cell: (row) => row.id },
      { id: 'division', header: 'Division', cell: (row) => `${row.divisionId} ${division(row.divisionId)}` }, { id: 'worker', header: 'Field worker', cell: (row) => worker(row.fieldWorkerId) },
      { id: 'created', header: 'Created', cell: (row) => shortDate(row.createdAt) },
      { id: 'due', header: 'Due', cell: (row) => shortDate(row.dueDate) },
      { id: 'status', header: 'Status', cell: (row) => <Status value={row.status} /> },
      { id: 'submission', header: 'Submission', cell: (row) => hasSubmission(row) ? <Badge tone="success">{assignmentType(row) === 'task' ? 'Evidence received' : row.observationIds.join(', ')}</Badge> : '—' },
      { id: 'actions', header: 'Actions', align: 'end', width: '56px', cell: (row) => <ActionMenu label={`Actions for ${row.id}`} items={statusActions(row)} /> },
    ]} /></Card>
    <Banner tone="info" action={<Button variant="secondary" loading={actions.reset.isPending} onClick={() => actions.reset.mutate(undefined, { onSuccess: () => toast.show({ tone: 'success', title: 'Assignment demo restored' }), onError: (error) => toast.show({ tone: 'error', title: 'Restore failed', message: failure(error) }) })}>Restore demo state</Button>}>Demo data</Banner>
  </div>
}

export function AssignmentCreatePage() {
  const query = useWorkspace()
  usePageBreadcrumbs([{ label: 'Capture', to: '/observations' }, { label: 'Fieldwork Assignments', to: '/assignments' }, { label: 'Create assignment' }])
  return <Boundary query={query}>{(data) => <AssignmentCreateForm data={data} />}</Boundary>
}

export function AssignmentEditPage() {
  const query = useWorkspace()
  const { assignmentId = '' } = useParams()
  usePageBreadcrumbs([{ label: 'Capture', to: '/observations' }, { label: 'Fieldwork Assignments', to: '/assignments' }, { label: assignmentId, to: `/assignments/${assignmentId}` }, { label: 'Edit' }])
  return <Boundary query={query}>{(data) => {
    const assignment = data.assignments.find((row) => row.id === assignmentId)
    if (!assignment) return <EmptyState title="Assignment unavailable" message="The assignment does not exist in your current estate scope." action={<ButtonLink to="/assignments">Back to list</ButtonLink>} />
    // Direct URL entry point: the same rule as the detail page and the data layer (only a Draft is editable).
    const lock = editLock(assignment)
    if (lock) return <EmptyState title="Editing unavailable" message={lock} action={<ButtonLink to={`/assignments/${assignment.id}`}>Back to assignment</ButtonLink>} />
    return <DraftForm key={assignment.id} data={data} assignment={assignment} />
  }}</Boundary>
}

/** Edit a Draft: keep it as a draft or assign it to an eligible, available Field Worker. */
function DraftForm({ data, assignment }: { data: CaptureWorkspace; assignment: Assignment }) {
  const navigate = useNavigate()
  const actions = useAssignmentActions()
  const toast = useToast()
  const [editVersion] = useState(assignment.version)
  const isTask = assignmentType(assignment) === 'task'
  const { register, control, getValues, setValue, setError, clearErrors, formState: { errors } } = useForm<AssignmentInput & { reason: string }>({ defaultValues: { estateId: assignment.estateId, divisionId: assignment.divisionId, fieldWorkerId: assignment.fieldWorkerId, title: assignment.title, instructions: assignment.instructions ?? '', priority: assignment.priority, dueDate: assignment.dueDate, status: 'draft', reason: '' } })
  const values = useWatch({ control })
  const [error, setFailure] = useState<string | null>(null)
  const [requirements, setRequirements] = useState<TaskRequirements | null>(assignment.requirements ?? null)
  const [requirementProblems, setRequirementProblems] = useState<Record<string, string>>({})
  function save(status: 'draft' | 'assigned') {
    clearErrors(); setFailure(null)
    const { reason, ...fields } = getValues()
    const input = { ...fields, status, type: assignmentType(assignment), requirements: isTask ? requirements : null, templateId: assignment.templateId ?? null }
    const problems = assignmentErrors(input)
    const busy = status === 'assigned' ? activeAssignmentOf(data.assignments, input.fieldWorkerId, assignment.id) : undefined
    if (busy) problems.fieldWorkerId = busyMessage(data.workers.find((row) => row.id === input.fieldWorkerId)?.fullName ?? '', busy)
    setRequirementProblems(problems)
    if (Object.keys(problems).length) {
      for (const [key, message] of Object.entries(problems)) setError(key as keyof AssignmentInput, { type: 'validation', message })
      return
    }
    // The data layer rechecks the latest status, version and worker availability before saving.
    actions.edit.mutate({ id: assignment.id, values: { ...input, reason }, version: editVersion }, {
      onSuccess: (saved) => {
        toast.show({ tone: 'success', title: status === 'assigned' ? 'Draft assigned' : 'Draft updated' })
        navigate(`/assignments/${saved.id}`)
      },
      onError: (failed) => { setFailure(failure(failed)); toast.show({ tone: 'error', title: 'Changes not saved', message: failure(failed) }) },
    })
  }
  const divisionWorkers = data.workers.filter((worker) => worker.divisionIds.includes(values.divisionId ?? ''))
  return <div className={`${styles.page} ${styles.assignment}`}><PageHeader title={`Edit draft ${assignment.id}`} subtitle={ASSIGNMENT_TYPE[assignmentType(assignment)]} actions={<ButtonLink variant="secondary" to={`/assignments/${assignment.id}`}>Cancel</ButtonLink>} />
    {error && <Banner tone="error" action={<ButtonLink variant="secondary" to={`/assignments/${assignment.id}`}>Back to latest assignment</ButtonLink>}>{error}</Banner>}
    <div className={styles.assignmentForm}><Card><form className={styles.form} onSubmit={(event) => { event.preventDefault(); save('assigned') }} noValidate>
      <h2>1 · Location</h2><SelectField label="Estate" options={data.estates.map((estate) => ({ value: estate.id, label: `${estate.id} · ${estate.name}` }))} error={errors.estateId?.message} {...register('estateId', { onChange: () => { setValue('divisionId', ''); setValue('fieldWorkerId', null) } })} />
      <fieldset className={styles.fieldset}><legend>Division</legend><div className={styles.actions}>{data.divisions.filter((division) => division.estateId === values.estateId).map((division) => <Radio key={division.id} label={`${division.id} · ${division.name}`} name="division" checked={values.divisionId === division.id} disabled={division.status !== 'active'} onChange={() => { setValue('divisionId', division.id); setValue('fieldWorkerId', null) }} />)}</div>{errors.divisionId && <p role="alert" className={styles.error}>{errors.divisionId.message}</p>}</fieldset>
      <fieldset className={styles.fieldset}><legend>2 · Field Worker</legend>
        {divisionWorkers.map((worker) => {
          const busy = activeAssignmentOf(data.assignments, worker.id, assignment.id)
          return <div className={styles.worker} key={worker.id}><Radio label={`${worker.fullName} · ${worker.id}`} description={busy ? `Active assignment: ${busy.id} · ${ASSIGNMENT_STATUS[busy.status]}` : undefined} name="worker" checked={values.fieldWorkerId === worker.id} disabled={Boolean(busy)} onChange={() => setValue('fieldWorkerId', worker.id)} /></div>
        })}
        {errors.fieldWorkerId && <p role="alert" className={styles.error}>{errors.fieldWorkerId.message}</p>}
      </fieldset>
      <h2>3 · Details</h2><TextField label="Title" error={errors.title?.message} {...register('title')} /><TextAreaField label="Instructions" error={errors.instructions?.message} {...register('instructions')} />
      <div className={styles.equal}><fieldset className={styles.fieldset}><legend>Priority</legend><div className={styles.actions}>{(['Low', 'Medium', 'High'] as const).map((priority) => <Radio key={priority} label={priority} name="priority" checked={values.priority === priority} onChange={() => setValue('priority', priority)} />)}</div></fieldset><TextField label="Due date" type="date" error={errors.dueDate?.message} {...register('dueDate')} /></div>
      {isTask && requirements && <><h2>4 · Task inputs, photos and completion notes</h2><TaskRequirementsEditor value={requirements} onChange={setRequirements} errors={requirementProblems} /></>}
      <div className={styles.actions}><Button type="submit" loading={actions.edit.isPending}>Assign task</Button><Button variant="secondary" disabled={actions.edit.isPending} onClick={() => save('draft')}>Save draft</Button><ButtonLink variant="secondary" to={`/assignments/${assignment.id}`}>Discard</ButtonLink></div>
    </form></Card></div>
  </div>
}

export function AssignmentDetailPage() {
  const query = useWorkspace()
  const { assignmentId = '' } = useParams()
  usePageBreadcrumbs([{ label: 'Capture', to: '/observations' }, { label: 'Fieldwork Assignments', to: '/assignments' }, { label: assignmentId }])
  return <Boundary query={query}>{(data) => {
    const assignment = data.assignments.find((row) => row.id === assignmentId)
    if (!assignment) return <EmptyState title="Assignment unavailable" message="The assignment does not exist in your current estate scope." action={<ButtonLink to="/assignments">Back to list</ButtonLink>} />
    return <AssignmentDetail key={assignment.id} data={data} assignment={assignment} />
  }}</Boundary>
}

function assignmentFacts(data: CaptureWorkspace, a: Assignment) {
  const division = data.divisions.find((row) => row.id === a.divisionId)
  const estate = data.estates.find((row) => row.id === a.estateId)
  const worker = data.workers.find((row) => row.id === a.fieldWorkerId)
  return [
    { label: 'Assignment ID', value: a.id }, { label: 'Type', value: `${ASSIGNMENT_TYPE[assignmentType(a)]}${assignmentType(a) === 'task' ? ` · ${templateById(a.templateId)?.name ?? 'Custom task'}` : ''}` },
    { label: 'Estate', value: `${a.estateId} · ${estate?.name ?? ''}` },
    { label: 'Division', value: `${a.divisionId} · ${division?.name ?? ''}` }, { label: 'Field Worker', value: worker ? `${worker.fullName} (${worker.id})` : a.fieldWorkerId ?? 'Not assigned' },
    { label: 'Assigned by', value: a.createdBy === data.actor.id ? `${data.actor.fullName} (${a.createdBy}) · Supervisor` : a.createdBy },
    { label: 'Priority', value: <Badge tone={a.priority === 'High' ? 'danger' : a.priority === 'Medium' ? 'warning' : 'neutral'}>{a.priority}</Badge> },
    { label: 'Created', value: shortDate(a.createdAt) }, { label: 'Due date', value: shortDate(a.dueDate) },
    ...(a.status === 'draft' ? [] : [{ label: 'Worker acceptance', value: isAcceptedByWorker(a) ? (a.acceptedAt ? `Accepted in mobile app · ${shortDate(a.acceptedAt)}` : 'Accepted (fieldwork started)') : 'Not yet accepted' }]),
    ...(a.submittedAt ? [{ label: 'Submitted (Done)', value: dateTime(a.submittedAt) }] : []),
    ...(a.completedAt ? [{ label: 'Completed', value: dateTime(a.completedAt) }] : []),
    ...(a.archivedAt ? [{ label: 'Moved to Assignment History', value: dateTime(a.archivedAt) }] : []),
    { label: 'Instructions', value: a.instructions ?? 'Not specified in this summary fixture' },
  ]
}

/** Draft: Edit, Cancel and Submit. Assigned (not accepted): Cancel. Others: no change actions. */
function ModifyActions({ a, onError }: { a: Assignment; onError: (message: string) => void }) {
  const toast = useToast()
  const actions = useAssignmentActions()
  const [open, setOpen] = useState(false)
  const [version, setVersion] = useState(a.version)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  if (a.archivedAt || !canCancelAssignment(a)) return null
  const draft = a.status === 'draft'
  function cancel() {
    if (!reason.trim()) { setReasonError('Enter a cancellation reason'); return }
    setReasonError(null); setCancelError(null)
    actions.cancel.mutate({ id: a.id, reason, version }, {
      onSuccess: () => { setOpen(false); toast.show({ tone: 'success', title: draft ? 'Draft cancelled' : 'Assignment cancelled', message: `${a.id} is kept with its history and marked Cancelled.` }) },
      onError: (error) => { setCancelError(failure(error)); onError(failure(error)); toast.show({ tone: 'error', title: 'Cancellation failed', message: failure(error) }) },
    })
  }
  function submit() {
    actions.submit.mutate({ id: a.id, version: a.version }, {
      onSuccess: () => toast.show({ tone: 'success', title: `${a.id} assigned`, message: 'The Field Worker receives it in the mobile app.' }),
      onError: (error) => { onError(failure(error)); toast.show({ tone: 'error', title: 'Draft not submitted', message: failure(error) }) },
    })
  }
  return <>
    <Button variant="destructiveOutline" onClick={() => { setVersion(a.version); setReason(''); setReasonError(null); setCancelError(null); setOpen(true) }}>{draft ? 'Cancel draft' : 'Cancel assignment'}</Button>
    {draft && <ButtonLink variant="secondary" to={`/assignments/${a.id}/edit`}>Edit draft</ButtonLink>}
    {draft && <Button loading={actions.submit.isPending} onClick={submit}>Submit assignment</Button>}
    <Modal open={open} title={`Cancel ${a.id}?`} description={draft ? 'The draft is marked Cancelled. The record and its history are kept.' : 'The Field Worker will no longer see this assignment. The record and its history are kept.'} dismissible={!actions.cancel.isPending} onClose={() => setOpen(false)} size="medium" footer={<><Button variant="secondary" disabled={actions.cancel.isPending} onClick={() => setOpen(false)}>Keep assignment</Button><Button variant="destructiveOutline" loading={actions.cancel.isPending} onClick={cancel}>{draft ? 'Cancel draft' : 'Cancel assignment'}</Button></>}>
      <TextField label="Reason (required)" value={reason} error={reasonError ?? undefined} onChange={(event) => setReason(event.target.value)} />
      {cancelError && <Banner tone="error">{cancelError} Close this dialog and reload the latest assignment before retrying.</Banner>}
    </Modal>
  </>
}

/** Mobile-app stand-ins: the Field Worker accepts, starts and submits the assignment. */
function Simulations({ a, onError }: { a: Assignment; onError: (message: string) => void }) {
  const actions = useAssignmentActions()
  const toast = useToast()
  if (a.archivedAt || isAssignmentSummary(a.id)) return null
  const inspection = assignmentType(a) === 'inspection'
  const run = (action: 'accept' | 'start' | 'submit', done: string) => actions.simulate.mutate({ id: a.id, action, version: a.version }, { onSuccess: () => toast.show({ tone: 'info', title: done }), onError: (error) => onError(failure(error)) })
  const buttons: ReactNode[] = []
  if (canSimulateWorkerAcceptance(a)) buttons.push(<Button key="accept" variant="secondary" loading={actions.simulate.isPending} onClick={() => run('accept', `${a.id} accepted by the Field Worker`)}>Simulate: Field Worker accepts task</Button>)
  if (a.status === 'assigned' && a.fieldWorkerId) buttons.push(<Button key="start" variant="secondary" loading={actions.simulate.isPending} onClick={() => run('start', `${a.id} started`)}>Simulate: Field Worker starts task</Button>)
  if (a.status === 'in_progress') buttons.push(<Button key="submit" variant="secondary" loading={actions.simulate.isPending} onClick={() => run('submit', inspection ? 'Observation received — the assignment is Done' : 'Task evidence received — the assignment is Done')}>{inspection ? 'Simulate: Field Worker submits observation' : 'Simulate: Field Worker submits task evidence'}</Button>)
  if (!buttons.length) return null
  return <div className={styles.simulation}><Badge tone="warning">Prototype simulation</Badge><div className={styles.actions}>{buttons}</div></div>
}

/** Inspection submission: the linked observation(s), their review status and evidence. */
function InspectionSubmission({ a, observations }: { a: Assignment; observations: CaptureObservation[] }) {
  if (!observations.length) return <p className={styles.muted}>No observation submitted yet.</p>
  return <div className={styles.stack}>{observations.map((o) => (
    <div key={o.id} className={styles.equal}>
      <div>{o.evidence ? <EvidenceImage label={`${o.evidence.imageId} · ${o.id}`} altText={o.evidence.altText} /> : <p className={styles.muted}>No photograph in this fixture.</p>}</div>
      <DescriptionList items={[
        { label: 'Observation', value: <Link className={styles.link} to={`/review/observations/${o.id}`}>{o.id}</Link> },
        { label: 'Observation review status', value: <Badge tone={['verified', 'flagged'].includes(o.reviewStatus) ? 'success' : 'warning'}>{reviewLabel(o.reviewStatus)}</Badge> },
        { label: 'Captured', value: dateTime(o.capturedAt) },
        { label: 'Suspected disease', value: `${o.suspectedDisease.name} (${o.suspectedDisease.id}) · suspected` },
        { label: 'GPS', value: o.evidence ? `${o.evidence.latitude.toFixed(3)}, ${o.evidence.longitude.toFixed(3)} · ±${o.gpsAccuracyM} m` : `±${o.gpsAccuracyM} m` },
        { label: 'Worker notes', value: o.evidence?.note ?? o.revisions.at(-1)?.note ?? 'Not provided' },
        { label: 'Evidence', value: <span className={styles.actions}><Link className={styles.link} to={observationPath(o.id, 'evidence') + `?assignment=${encodeURIComponent(a.id)}`}>Open evidence viewer</Link><Link className={styles.link} to={`/review/observations/${o.id}`}>Open in Supervisor Review</Link></span> },
      ]} />
    </div>
  ))}</div>
}

/** Complete assignment (Done → Completed) after reviewing the submitted evidence. */
function CompleteAction({ a, block, onError }: { a: Assignment; block: string | null; onError: (message: string) => void }) {
  const actions = useAssignmentActions()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  if (a.status !== 'submitted') return null
  return <>
    <Button icon="check" disabled={Boolean(block)} onClick={() => setOpen(true)}>Complete assignment</Button>
    <Modal open={open} title={`Complete ${a.id}?`} size="medium" dismissible={!actions.accept.isPending} onClose={() => setOpen(false)} footer={<><Button variant="secondary" disabled={actions.accept.isPending} onClick={() => setOpen(false)}>Back to evidence</Button><Button loading={actions.accept.isPending} onClick={() => actions.accept.mutate({ id: a.id, version: a.version }, { onSuccess: () => { setOpen(false); toast.show({ tone: 'success', title: 'Assignment completed', message: `${a.id} moves to Assignment History 24 hours after completion.` }) }, onError: (error) => { setOpen(false); onError(failure(error)) } })}>Complete assignment</Button></>}>
      <p>I reviewed the submitted {assignmentType(a) === 'task' ? 'task evidence' : 'observation and its review outcome'} for {a.id}.</p>
    </Modal>
  </>
}

function AssignmentDetail({ data, assignment: a }: { data: CaptureWorkspace; assignment: Assignment }) {
  const workspace = useWorkspace()
  const [error, setError] = useState<string | null>(null)
  const division = data.divisions.find((row) => row.id === a.divisionId)
  const worker = data.workers.find((row) => row.id === a.fieldWorkerId)
  const observations = data.observations.filter((row) => a.observationIds.includes(row.id))
  const cancelled = a.status === 'cancelled'
  const summary = isAssignmentSummary(a.id)
  const block = a.status === 'submitted' ? completionBlock(a, (id) => data.observations.find((row) => row.id === id)?.reviewStatus) : null
  const stage = LIFECYCLE.indexOf(a.status)
  const steps = cancelled ? ['Draft', 'Assigned', 'Cancelled'] : LIFECYCLE.map((status) => ASSIGNMENT_STATUS[status])
  const showSubmission = ['submitted', 'completed'].includes(a.status) && !summary
  return <div className={`${styles.page} ${styles.assignment}`}><PageHeader title={`${a.id} · ${a.title}`} subtitle={`${ASSIGNMENT_TYPE[assignmentType(a)]} · ${a.estateId} · ${a.divisionId} ${division?.name ?? ''}`} actions={<div className={styles.actions}>
    {a.archivedAt && <Badge tone="neutral">Assignment History · read-only</Badge>}
    <ModifyActions a={a} onError={setError} />
    {!a.archivedAt && <CompleteAction a={a} block={block} onError={setError} />}
    <ButtonLink variant="secondary" to={a.archivedAt ? '/review/history?section=assignments' : '/assignments'}>{a.archivedAt ? 'Back to history' : 'Back to list'}</ButtonLink>
  </div>} />
    {a.status === 'assigned' && canCancelAssignment(a) && <Banner tone="info">Not yet accepted by {worker?.fullName ?? 'the Field Worker'}.</Banner>}
    {block && <Banner tone="warning">{block}</Banner>}
    {cancelled && <Banner tone="error">{a.activity.at(-1)}</Banner>}
    {error && <Banner tone="error">{error}<Button variant="secondary" loading={workspace.isFetching} onClick={() => void workspace.refetch().then((result) => { if (result.isSuccess) setError(null) })}>Reload latest assignment</Button></Banner>}
    {a.status !== 'reassigned' && <Card><ol className={styles.steps} aria-label="Assignment lifecycle">{steps.map((label, index) => <li key={label} data-active={cancelled || index <= stage} data-cancelled={cancelled && index === 2} aria-current={(cancelled ? index === 2 : index === stage) ? 'step' : undefined}><span className={styles.stepNumber}>{cancelled && index === 2 ? '×' : (a.status === 'completed' || cancelled || index < stage) ? '✓' : index + 1}</span>{label}</li>)}</ol></Card>}
    <div className={styles.equal}>
      <Card title="Assignment details"><DescriptionList items={assignmentFacts(data, a)} /></Card>
      <div className={styles.stack}>
        {assignmentType(a) === 'task' && a.requirements && <Card title="Task inputs and photos"><TaskRequirementsView value={a.requirements} /></Card>}
        {assignmentType(a) === 'inspection' && <Card title="Observation form"><DataTable caption="Observation form completed by the Field Worker" rows={[...INSPECTION_OBSERVATION_SECTIONS]} rowKey={(row) => row.section} columns={[{ id: 'section', header: 'Section', cell: (row) => row.section }, { id: 'fields', header: 'Captured', cell: (row) => row.fields }]} /></Card>}
        <GroupCard data={data} a={a} />
      </div>
    </div>
    {showSubmission && <section id="submission"><Card title={assignmentType(a) === 'task' ? 'Submitted task evidence' : 'Submitted observation'}>
      {assignmentType(a) === 'task' ? (a.submission ? <TaskSubmissionView submission={a.submission} /> : <p className={styles.muted}>No task submission has been received.</p>) : <InspectionSubmission a={a} observations={observations} />}
    </Card></section>}
    <section id="activity"><Card title="Activity">{a.activity.length ? a.activity.map((item, index) => <p className={styles.muted} key={index}>{item}</p>) : <p className={styles.muted}>No activity recorded in this summary fixture.</p>}</Card></section>
    <Simulations a={a} onError={setError} />
  </div>
}

/** The other per-worker assignments created for the same task. */
function GroupCard({ data, a }: { data: CaptureWorkspace; a: Assignment }) {
  const siblings = a.groupId ? data.assignments.filter((row) => row.groupId === a.groupId && row.id !== a.id) : []
  if (!siblings.length) return null
  const name = (id: string | null) => data.workers.find((row) => row.id === id)?.fullName ?? 'Not assigned'
  return <Card title="Assigned together with"><span className={styles.actions}>{siblings.map((row) => <Link key={row.id} className={styles.link} to={`/assignments/${row.id}`}>{row.id} · {name(row.fieldWorkerId)}</Link>)}</span></Card>
}

/** Read-only Assignment History (archived 24 hours after completion), shown in the History page. */
export function AssignmentHistorySection() {
  const query = useWorkspace()
  return <Boundary query={query}>{(data) => {
    const rows = data.assignments.filter((row) => row.archivedAt)
    const division = (id: string) => data.divisions.find((row) => row.id === id)?.name ?? id
    const worker = (id: string | null) => data.workers.find((row) => row.id === id)?.fullName ?? 'Not assigned'
    return <DataTable<Assignment> caption="Assignment history" rows={rows} rowKey={(row) => row.id}
      empty={<EmptyState title="No archived assignments" message="Completed assignments move here 24 hours after completion." icon="history" />}
      columns={[
        { id: 'id', header: 'Assignment', cell: (row) => <Link className={styles.link} to={`/assignments/${row.id}`}>{row.id}</Link> },
        { id: 'type', header: 'Type', cell: (row) => ASSIGNMENT_TYPE[assignmentType(row)] },
        { id: 'title', header: 'Title', cell: (row) => row.title },
        { id: 'division', header: 'Division', cell: (row) => division(row.divisionId) },
        { id: 'worker', header: 'Assigned worker', cell: (row) => worker(row.fieldWorkerId) },
        { id: 'status', header: 'Final status', cell: (row) => <Status value={row.status} /> },
        { id: 'completed', header: 'Completed', cell: (row) => (row.completedAt ? dateTime(row.completedAt) : '—') },
        { id: 'archived', header: 'Archived', cell: (row) => (row.archivedAt ? dateTime(row.archivedAt) : '—') },
        { id: 'linked', header: 'Linked observation', cell: (row) => (row.observationIds.length ? row.observationIds.map((id) => <Link key={id} className={styles.link} to={`/review/observations/${id}`}>{id}</Link>) : '—') },
      ]} />
  }}</Boundary>
}
