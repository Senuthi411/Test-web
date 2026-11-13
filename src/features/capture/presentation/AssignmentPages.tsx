import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { Badge, Banner, Button, ButtonLink, Card, DataTable, DescriptionList, EmptyState, Modal, PageHeader, Radio, SelectField, Tabs, TextAreaField, TextField, usePageBreadcrumbs, useToast } from '@/shared/components'
import type { CaptureWorkspace } from '../application/ports'
import { ASSIGNMENT_STATUS, assignmentErrors, canEditAssignment, isAssignmentSummary, type Assignment, type AssignmentInput, type AssignmentStatus } from '../domain/assignment'
import { useAssignmentActions, useWorkspace } from './services'
import { Boundary, Status } from './common'
import { dateTime, failure, observationPath } from './helpers'
import styles from './capture.module.css'

export function AssignmentsPage() {
  const query = useWorkspace()
  usePageBreadcrumbs([{ label: 'Capture', to: '/observations' }, { label: 'Fieldwork Assignments' }])
  return <Boundary query={query}>{(data) => <AssignmentList data={data} />}</Boundary>
}
function AssignmentList({ data }: { data: CaptureWorkspace }) {
  const [status, setStatus] = useState<AssignmentStatus | 'all'>('all')
  const actions = useAssignmentActions()
  const toast = useToast()
  const navigate = useNavigate()
  const rows = data.assignments.filter((row) => status === 'all' || row.status === status)
  const division = (id: string) => data.divisions.find((row) => row.id === id)?.name ?? id
  const worker = (id: string | null) => data.workers.find((row) => row.id === id)?.fullName ?? 'Not assigned'
  return <div className={styles.page}>
    <PageHeader title="Fieldwork Assignments" subtitle={`${data.estates.map((estate) => `${estate.name} (${estate.id})`).join(', ')} · ${data.assignments.length} assignments in your scope · Wed 21 Oct 2026`} actions={<ButtonLink to="/assignments/new">Create assignment</ButtonLink>} />
    <Tabs label="Assignment status" idBase="assignment-status" value={status} onChange={setStatus} items={[
      { id: 'all' as const, label: `All ${data.assignments.length}` }, ...Object.entries(ASSIGNMENT_STATUS).map(([id, label]) => ({ id: id as AssignmentStatus, label: `${label} ${data.assignments.filter((row) => row.status === id).length}` })),
    ]} />
    <Card><DataTable<Assignment> caption="Fieldwork assignments" rows={rows} rowKey={(row) => row.id} onRowActivate={(row) => navigate(`/assignments/${row.id}`)} empty={<EmptyState title="No assignments in this status" message="Choose another status tab or create an assignment in your scope." />} columns={[
      { id: 'id', header: 'Assignment', cell: (row) => row.id }, { id: 'title', header: 'Title', cell: (row) => row.title },
      { id: 'division', header: 'Division', cell: (row) => `${row.divisionId} ${division(row.divisionId)}` }, { id: 'worker', header: 'Field worker', cell: (row) => worker(row.fieldWorkerId) },
      { id: 'priority', header: 'Priority', cell: (row) => <Badge tone={row.priority === 'High' ? 'danger' : row.priority === 'Medium' ? 'warning' : 'neutral'}>{row.priority}</Badge> },
      { id: 'due', header: 'Due', cell: (row) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(row.dueDate)) },
      { id: 'status', header: 'Status', cell: (row) => <Status value={row.status} /> }, { id: 'observations', header: 'Observations', cell: (row) => row.observationIds.length ? row.observationIds.map((id) => <Link key={id} to={observationPath(id)} onClick={(event) => event.stopPropagation()}>{id}</Link>) : '—' },
    ]} /></Card>
    <Banner tone="info" action={<Button variant="secondary" loading={actions.reset.isPending} onClick={() => actions.reset.mutate(undefined, { onSuccess: () => toast.show({ tone: 'success', title: 'Assignment demo restored' }), onError: (error) => toast.show({ tone: 'error', title: 'Restore failed', message: failure(error) }) })}>Restore demo state</Button>}>Field Workers complete assignments in the separate mobile app; this web view manages assignments and views submitted evidence only. ASG-001 has the full lifecycle journey. ASG-002 to ASG-007 are read-only summary records in this prototype.</Banner>
  </div>
}

export function AssignmentCreatePage() {
  const query = useWorkspace()
  usePageBreadcrumbs([{ label: 'Capture', to: '/observations' }, { label: 'Fieldwork Assignments', to: '/assignments' }, { label: 'Create assignment' }])
  return <Boundary query={query}>{(data) => <AssignmentForm data={data} />}</Boundary>
}
export function AssignmentEditPage() {
  const query = useWorkspace()
  const { assignmentId = '' } = useParams()
  usePageBreadcrumbs([{ label: 'Capture', to: '/observations' }, { label: 'Fieldwork Assignments', to: '/assignments' }, { label: assignmentId, to: `/assignments/${assignmentId}` }, { label: 'Edit / reassign' }])
  return <Boundary query={query}>{(data) => {
    const assignment = data.assignments.find((row) => row.id === assignmentId)
    if (!assignment) return <EmptyState title="Assignment unavailable" message="The assignment does not exist in your current estate scope." action={<ButtonLink to="/assignments">Back to list</ButtonLink>} />
    if (!canEditAssignment(assignment)) return <EmptyState title="Editing unavailable" message="This prototype supports editing assigned tasks before fieldwork starts. Summary records are read-only." action={<ButtonLink to={`/assignments/${assignment.id}`}>Back to assignment</ButtonLink>} />
    return <AssignmentForm key={assignment.id} data={data} assignment={assignment} />
  }}</Boundary>
}
function AssignmentForm({ data, assignment }: { data: CaptureWorkspace; assignment?: Assignment }) {
  const navigate = useNavigate()
  const actions = useAssignmentActions()
  const toast = useToast()
  const [editVersion] = useState(assignment?.version)
  const preferred = data.divisions.find((row) => row.id === 'DIV-005') ?? data.divisions.find((row) => row.status === 'active')
  const { register, control, getValues, setValue, setError, clearErrors, formState: { errors } } = useForm<AssignmentInput & { reason: string }>({ defaultValues: assignment ? { estateId: assignment.estateId, divisionId: assignment.divisionId, fieldWorkerId: assignment.fieldWorkerId, title: assignment.title, instructions: assignment.instructions ?? '', priority: assignment.priority, dueDate: assignment.dueDate, status: 'assigned', reason: '' } : { reason: '',
    estateId: preferred?.estateId ?? '', divisionId: preferred?.id ?? '', fieldWorkerId: data.workers.find((worker) => worker.divisionIds.includes(preferred?.id ?? ''))?.id ?? null,
    title: preferred?.id === 'DIV-005' ? 'Inspect East Hills block C for suspected blight' : '', instructions: preferred?.id === 'DIV-005' ? 'Inspect the reported leaf discolouration in East Hills block C. Photograph affected leaves from three angles and submit one observation per distinct area. Record location at division level only.' : '', priority: 'High', dueDate: '2026-10-16', status: 'assigned',
  } })
  const values = useWatch({ control })
  const [error, setFailure] = useState<string | null>(null)
  const chosenDivision = data.divisions.find((row) => row.id === values.divisionId)
  const chosenWorker = data.workers.find((row) => row.id === values.fieldWorkerId)
  function save(status: 'draft' | 'assigned') {
    clearErrors(); setFailure(null)
    const { reason, ...fields } = getValues()
    const input = { ...fields, status }
    const problems = assignmentErrors(input)
    if (Object.keys(problems).length) {
      for (const [key, message] of Object.entries(problems)) setError(key as keyof AssignmentInput, { type: 'validation', message })
      return
    }
    if (assignment) {
      if (!reason.trim()) { setError('reason', { type: 'validation', message: 'Enter a reason for change' }); return }
      actions.edit.mutate({ id: assignment.id, values: { ...input, reason }, version: editVersion! }, {
        onSuccess: (saved) => { toast.show({ tone: 'success', title: 'Assignment updated' }); navigate(`/assignments/${saved.id}`) },
        onError: (error) => setFailure(failure(error)),
      })
      return
    }
    actions.create.mutate(input, { onSuccess: (saved) => {
      toast.show({ tone: 'success', title: status === 'draft' ? 'Draft saved' : 'Task assigned', message: `${saved.id} is held in this browser tab only.` })
      navigate(status === 'draft' ? '/assignments' : `/assignments/${saved.id}`)
    }, onError: (error) => setFailure(failure(error)) })
  }
  return <div className={`${styles.page} ${styles.assignment}`}><PageHeader title={assignment ? `Edit / reassign ${assignment.id}` : "Create assignment"} subtitle={assignment ? "Change task details or reassign to another eligible Field Worker" : "Assign fieldwork to an eligible Field Worker in your scope"} actions={<ButtonLink variant="secondary" to={assignment ? `/assignments/${assignment.id}` : "/assignments"}>Cancel</ButtonLink>} />
    {error && <Banner tone="error" action={assignment && <ButtonLink variant="secondary" to={`/assignments/${assignment.id}`}>Back to latest assignment</ButtonLink>}>{error}</Banner>}
    <div className={assignment ? styles.assignmentForm : styles.split}><Card><form className={styles.form} onSubmit={(event) => { event.preventDefault(); save('assigned') }} noValidate>
      <h2>1 · Location</h2><SelectField label="Estate" options={data.estates.map((estate) => ({ value: estate.id, label: `${estate.id} · ${estate.name}` }))} error={errors.estateId?.message} {...register('estateId', { onChange: () => { setValue('divisionId', ''); setValue('fieldWorkerId', null) } })} />
      <fieldset className={styles.fieldset}><legend>Division</legend><div className={styles.actions}>{data.divisions.filter((division) => division.estateId === values.estateId).map((division) => <Radio key={division.id} label={`${division.id} · ${division.name}`} name="division" checked={values.divisionId === division.id} disabled={division.status !== 'active'} onChange={() => { setValue('divisionId', division.id); setValue('fieldWorkerId', null) }} />)}</div>{errors.divisionId && <p role="alert" className={styles.error}>{errors.divisionId.message}</p>}</fieldset>
      <fieldset className={styles.fieldset}><legend>2 · Field Worker</legend><p className={styles.muted}>Only Field Workers with active scope on the selected division are eligible (scope is managed by an Administrator in Identity).</p>
        {data.workers.map((worker) => <div className={styles.worker} key={worker.id}><Radio label={`${worker.fullName} · ${worker.id}`} description={`Scope: ${worker.divisionIds.join(', ')}${worker.divisionIds.includes(values.divisionId ?? '') ? ' · Eligible' : ' · Not in division scope'}`} name="worker" checked={values.fieldWorkerId === worker.id} disabled={!worker.divisionIds.includes(values.divisionId ?? '')} onChange={() => setValue('fieldWorkerId', worker.id)} /></div>)}
        {errors.fieldWorkerId && <p role="alert" className={styles.error}>{errors.fieldWorkerId.message}</p>}
        {assignment && <p className={styles.scopeWarning}>{data.workers.some((worker) => worker.id !== assignment.fieldWorkerId && worker.divisionIds.includes(values.divisionId ?? '')) ? 'Reassignment outcome is not specified: changing the worker cannot be saved until replacement assignment rules are approved.' : `Reassignment unavailable: no other Field Worker has ${values.divisionId || 'the selected division'} scope. An Administrator must grant scope in Identity first. Ineligible workers cannot be selected.`}</p>}
      </fieldset>
      <h2>3 · Task</h2><TextField label="Title" error={errors.title?.message} {...register('title')} /><TextAreaField label="Instructions" error={errors.instructions?.message} {...register('instructions')} />
      <div className={styles.equal}>{assignment ? <fieldset className={styles.fieldset}><legend>Priority</legend><div className={styles.actions}>{(['Low', 'Medium', 'High'] as const).map((priority) => <Radio key={priority} label={priority} name="priority" checked={values.priority === priority} onChange={() => setValue('priority', priority)} />)}</div></fieldset> : <SelectField label="Priority" options={['Low', 'Medium', 'High'].map((value) => ({ value, label: value }))} error={errors.priority?.message} {...register('priority')} />}<TextField label="Due date" type="date" error={errors.dueDate?.message} {...register('dueDate')} /></div>
      {assignment && <TextField label="Reason for change (required)" error={errors.reason?.message} {...register('reason')} />}
      <div className={styles.actions}><Button type="submit" loading={actions.create.isPending || actions.edit.isPending}>{assignment ? 'Save changes' : 'Assign task'}</Button>{assignment ? <ButtonLink variant="secondary" to={`/assignments/${assignment.id}`}>Discard</ButtonLink> : <Button variant="secondary" disabled={actions.create.isPending} onClick={() => save('draft')}>Save as draft</Button>}</div>
    </form></Card><div className={styles.stack}><Card title="Assignment summary"><DescriptionList items={[{ label: 'ID', value: assignment?.id ?? 'Generated on save' }, { label: 'Status', value: <Status value={assignment?.status ?? "draft"} /> }, { label: 'Estate', value: data.estates.find((estate) => estate.id === values.estateId)?.name ?? 'Not selected' }, { label: 'Division', value: chosenDivision ? `${chosenDivision.id} ${chosenDivision.name}` : 'Not selected' }, { label: 'Field Worker', value: chosenWorker?.fullName ?? 'Not selected' }, { label: 'Priority', value: values.priority }, { label: 'Due date', value: values.dueDate }, { label: 'Created by', value: `${data.actor.fullName} (${data.actor.id})` }]} /></Card><Card title="How this works"><p>Assigned tasks appear in the Field Worker’s mobile app.</p><p>Field work is captured and submitted in the mobile app, not on the web.</p><p>Submitting does not complete the task: acceptance follows evidence review.</p><p>Observations stay linked through Estate → Division only.</p></Card></div></div>
  </div>
}

export function AssignmentDetailPage() {
  const query = useWorkspace()
  const { assignmentId = '' } = useParams()
  usePageBreadcrumbs([{ label: 'Capture', to: '/observations' }, { label: 'Fieldwork Assignments', to: '/assignments' }, { label: assignmentId }])
  return <Boundary query={query}>{(data) => {
    const assignment = data.assignments.find((row) => row.id === assignmentId)
    if (!assignment) return <EmptyState title="Assignment unavailable" message="The assignment does not exist in your current estate scope." action={<ButtonLink to="/assignments">Back to list</ButtonLink>} />
    if (isAssignmentSummary(assignment.id) || assignment.status === 'draft') return <AssignmentSummary data={data} assignment={assignment} />
    return <AssignmentDetail data={data} assignment={assignment} />
  }}</Boundary>
}
const summaryText: Record<AssignmentStatus, string> = {
  draft: 'Draft only. No Field Worker has been assigned, so nothing is visible in the mobile app.',
  assigned: 'Waiting for the Field Worker to start in the mobile app.',
  in_progress: 'The Field Worker is working in the mobile app. No observation has been submitted yet.',
  submitted: 'Fieldwork submitted; awaiting Supervisor acceptance.',
  completed: 'Completed. The linked observation OBS-024 is handled in Supervisor Review.',
  reassigned: 'Reassigned. The replacement assignment is not modelled in this prototype.',
  cancelled: 'Cancelled. The Field Worker no longer sees this task in the mobile app.',
}
function assignmentFacts(data: CaptureWorkspace, a: Assignment) {
  const division = data.divisions.find((row) => row.id === a.divisionId)
  const estate = data.estates.find((row) => row.id === a.estateId)
  const worker = data.workers.find((row) => row.id === a.fieldWorkerId)
  return [
    { label: 'Assignment ID', value: a.id }, { label: 'Estate', value: `${a.estateId} \u00b7 ${estate?.name ?? ''}` },
    { label: 'Division', value: `${a.divisionId} \u00b7 ${division?.name ?? ''}` }, { label: 'Field Worker', value: worker ? `${worker.fullName} (${worker.id})` : a.fieldWorkerId ?? 'Not assigned' },
    { label: 'Assigned by', value: a.createdBy === data.actor.id ? `${data.actor.fullName} (${a.createdBy}) \u00b7 Supervisor` : a.createdBy },
    { label: 'Priority', value: <Badge tone={a.priority === 'High' ? 'danger' : a.priority === 'Medium' ? 'warning' : 'neutral'}>{a.priority}</Badge> }, { label: 'Due date', value: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(a.dueDate)) },
  ]
}
function stepDate(a: Assignment, label: string) {
  if (label === 'Draft' || label === 'Assigned') return a.createdAt ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(a.createdAt)) : ''
  const phrase = label === 'In progress' ? 'Task started' : label === 'Submitted' ? 'received from mobile app' : label === 'Completed' ? 'Accepted and completed' : 'Cancelled by'
  return a.activity.findLast((item) => item.includes(phrase))?.match(/^\d{1,2} [A-Z][a-z]{2} \d{4}/)?.[0] ?? ''
}
function AssignmentSummary({ data, assignment: a }: { data: CaptureWorkspace; assignment: Assignment }) {
  return <div className={`${styles.page} ${styles.assignment}`}>
    <PageHeader title={`${a.id} \u00b7 ${a.title}`} subtitle={`Fieldwork assignment \u00b7 ${a.estateId} \u00b7 ${a.divisionId} ${data.divisions.find((d) => d.id === a.divisionId)?.name ?? ''}`} actions={<ButtonLink variant="secondary" to="/assignments">Back to list</ButtonLink>} />
    <Banner tone="info">Summary record. Full lifecycle history, progress and evidence are modelled only for ASG-001 in this prototype.</Banner>
    <div className={styles.equal}><Card title="Assignment details"><DescriptionList items={[...assignmentFacts(data, a), { label: 'Status', value: <Status value={a.status} /> }, { label: 'Linked observations', value: a.observationIds.length ? a.observationIds.join(', ') : '—' }]} /></Card><Card title="Status"><strong>{ASSIGNMENT_STATUS[a.status]}</strong><p className={styles.muted}>{summaryText[a.status]}</p></Card></div>
  </div>
}
function AssignmentDetail({ data, assignment: a }: { data: CaptureWorkspace; assignment: Assignment }) {
  const workspace = useWorkspace()
  const toast = useToast()
  const actions = useAssignmentActions()
  const [error, setError] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelVersion, setCancelVersion] = useState(a.version)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const division = data.divisions.find((row) => row.id === a.divisionId)
  const worker = data.workers.find((row) => row.id === a.fieldWorkerId)
  const stage = a.status === 'assigned' ? 1 : a.status === 'in_progress' ? 2 : a.status === 'completed' ? 4 : 3
  const observations = data.observations.filter((row) => a.observationIds.includes(row.id))
  const cancelled = a.status === 'cancelled'
  const completed = a.status === 'completed'
  const progressTitle = cancelled ? 'Cancelled' : completed ? 'Completed' : a.status === 'assigned' ? 'Not started' : a.status === 'in_progress' ? 'In progress' : 'Fieldwork submitted - awaiting your acceptance'
  const progressText = cancelled ? 'The Field Worker no longer sees this task in the mobile app.' : completed ? 'Supervisor accepted the submitted fieldwork.' : a.status === 'assigned' ? `Waiting for ${worker?.fullName ?? 'the Field Worker'} to open the task in the mobile app.` : a.status === 'in_progress' ? 'The task was started in the mobile app. No observation has been submitted yet.' : `${observations.length} observation received from the mobile app.`
  const steps = cancelled ? ['Draft', 'Assigned', 'Cancelled'] : ['Draft', 'Assigned', 'In progress', 'Submitted', 'Completed']
  function cancel() {
    if (!reason.trim()) { setReasonError('Enter a cancellation reason'); return }
    setReasonError(null); setCancelError(null)
    actions.cancel.mutate({ id: a.id, reason, version: cancelVersion }, {
      onSuccess: () => { setCancelOpen(false); toast.show({ tone: 'success', title: 'Assignment cancelled' }) },
      onError: (error) => { setCancelError(failure(error)); setError(failure(error)) },
    })
  }
  return <div className={`${styles.page} ${styles.assignment}`}><PageHeader title={`${a.id} \u00b7 ${a.title}`} subtitle={`Fieldwork assignment \u00b7 ${a.estateId} \u00b7 ${a.divisionId} ${division?.name ?? ''}${a.createdAt ? ` \u00b7 created ${a.createdAt}` : ''}`} actions={<div className={styles.actions}>
    {canEditAssignment(a) && <><Button variant="destructiveOutline" onClick={() => { setCancelVersion(a.version); setReason(''); setReasonError(null); setCancelError(null); setCancelOpen(true) }}>Cancel assignment</Button><ButtonLink variant="secondary" to={`/assignments/${a.id}/edit`}>Edit / reassign</ButtonLink></>}
    {a.status === 'submitted' && <Button loading={actions.accept.isPending} onClick={() => { setError(null); actions.accept.mutate({ id: a.id, version: a.version }, { onSuccess: () => toast.show({ tone: 'success', title: 'Assignment accepted and completed' }), onError: (error) => setError(failure(error)) }) }}>Accept &amp; mark completed</Button>}<ButtonLink variant="secondary" to="/assignments">Back to list</ButtonLink>
  </div>} />
    {a.status === 'submitted' && <Banner tone="info">Submitted is not completed. Review the submitted evidence, then accept the assignment. Verifying or flagging OBS-014 is a separate decision made in Supervisor Review.</Banner>}
    {completed && <Banner tone="success">{a.activity.at(-1)}. The observation review decision remains separate and unchanged.</Banner>}
    {cancelled && <Banner tone="error">Cancelled before fieldwork started. {a.activity.at(-1)}</Banner>}
    {error && <Banner tone="error">{error}<Button variant="secondary" loading={workspace.isFetching} onClick={() => void workspace.refetch().then((result) => { if (result.isSuccess) setError(null) })}>Reload latest assignment</Button></Banner>}
    <Card><ol className={styles.steps} aria-label="Assignment lifecycle">{steps.map((label, index) => <li key={label} data-active={cancelled || index <= stage} data-cancelled={cancelled && index === 2} aria-current={(cancelled ? index === 2 : index === stage) ? 'step' : undefined}><span className={styles.stepNumber}>{cancelled && index === 2 ? '\u00d7' : (completed || cancelled || index < stage) ? '\u2713' : index + 1}</span>{label}<small className={styles.muted}>{(cancelled || index <= stage) && stepDate(a, label)}</small></li>)}</ol></Card>
    <div className={styles.equal}><Card title="Assignment details"><DescriptionList items={[...assignmentFacts(data, a), { label: 'Instructions', value: a.instructions ?? 'Not specified in this summary fixture' }]} /></Card><Card title="Progress"><strong>{progressTitle}</strong><progress className={styles.progress} aria-label="Assignment progress" max={100} value={cancelled || a.status === 'assigned' ? 0 : a.status === 'in_progress' ? 30 : 100} /><p className={styles.muted}>{progressText}</p><h3>Activity</h3>{a.activity.map((item, index) => <p className={styles.muted} key={index}>{item}</p>)}</Card></div>
    <Card title="Submitted observations">{observations.length ? <DataTable caption="Submitted observations" rows={observations} rowKey={(row) => row.id} columns={[{ id: 'id', header: 'Observation', cell: (row) => <Link to={observationPath(row.id, 'evidence') + `?assignment=${encodeURIComponent(a.id)}`}>{row.id}</Link> }, { id: 'division', header: 'Division', cell: (row) => `${row.division.id} ${row.division.name}` }, { id: 'disease', header: 'Suspected disease', cell: (row) => `${row.suspectedDisease.name} \u00b7 suspected` }, { id: 'captured', header: 'Captured', cell: (row) => dateTime(row.capturedAt) }, { id: 'gps', header: 'GPS', cell: (row) => `\u00b1${row.gpsAccuracyM} m` }, { id: 'review', header: 'Review status', cell: (row) => row.reviewStatus.replaceAll('_', ' ') }, { id: 'evidence', header: 'Evidence', cell: (row) => <ButtonLink variant="secondary" to={observationPath(row.id, 'evidence') + `?assignment=${encodeURIComponent(a.id)}`}>Open evidence viewer</ButtonLink> }, { id: 'reviewLink', header: 'Review', cell: (row) => <ButtonLink variant="secondary" to={`/review/observations/${row.id}`}>Open in Supervisor Review</ButtonLink> }]} /> : <p className={styles.muted}>No observations submitted yet. Submissions arrive from the Field Worker&#8217;s mobile app and appear here linked to this assignment.</p>}</Card>
    {['assigned', 'in_progress'].includes(a.status) && a.divisionId === 'DIV-005' && a.fieldWorkerId === 'USR-009' && <div className={styles.simulation}><Badge tone="warning">Prototype simulation</Badge><p className={styles.muted}>Mobile work is external. Simulate {a.status === 'assigned' ? 'the Field Worker starting this task' : 'the mobile submission arriving as existing OBS-014'}.</p><Button variant="secondary" loading={actions.simulate.isPending} onClick={() => { setError(null); actions.simulate.mutate({ id: a.id, action: a.status === 'assigned' ? 'start' : 'submit', version: a.version }, { onError: (error) => setError(failure(error)) }) }}>{a.status === 'assigned' ? 'Simulate: Field Worker starts task' : 'Simulate: mobile submission received'}</Button></div>}
    <Modal open={cancelOpen} title={`Cancel ${a.id}?`} description="The Field Worker will no longer see this task in the mobile app. Cancelling does not delete the assignment record, and no evidence has been submitted for it." dismissible={!actions.cancel.isPending} onClose={() => setCancelOpen(false)} size="medium" footer={<><Button variant="secondary" disabled={actions.cancel.isPending} onClick={() => setCancelOpen(false)}>Keep assignment</Button><Button variant="destructiveOutline" loading={actions.cancel.isPending} onClick={cancel}>Cancel assignment</Button></>}>
      <TextField label="Reason (required)" value={reason} error={reasonError ?? undefined} onChange={(event) => setReason(event.target.value)} />
      {cancelError && <Banner tone="error">{cancelError} Close this dialog and reload the latest assignment before retrying.</Banner>}
    </Modal>
  </div>
}
