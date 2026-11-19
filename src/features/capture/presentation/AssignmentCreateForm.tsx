import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Badge, Banner, Button, ButtonLink, Card, Checkbox, DataTable, DescriptionList, Modal, PageHeader, Radio, SearchInput, SelectField, TextAreaField, TextField, useToast } from '@/shared/components'
import type { CaptureWorkspace } from '../application/ports'
import { ASSIGNMENT_STATUS, ASSIGNMENT_TYPE, activeAssignmentOf, batchErrors, type Assignment, type AssignmentBatchInput, type AssignmentType } from '../domain/assignment'
import { CUSTOM_TASK, INSPECTION_OBSERVATION_SECTIONS, TASK_TEMPLATES, emptyRequirements, requirementSummary, templateById, type TaskRequirements } from '../domain/taskTemplates'
import { useAssignmentActions } from './services'
import { TaskRequirementsEditor, TaskRequirementsView } from './TaskRequirements'
import { failure } from './helpers'
import styles from './capture.module.css'

type Priority = Assignment['priority']

const INSPECTION_TITLE = 'Inspect East Hills block C for suspected blight'
const INSPECTION_INSTRUCTIONS = 'Inspect the reported leaf discolouration in East Hills block C. Photograph affected leaves from three angles and submit one observation per distinct area.'

/** The observation form the Field Worker completes in the Capture mobile app (shown, never filled in here). */
function InspectionObservationForm() {
  return (
    <DataTable
      caption="Observation form completed by the Field Worker"
      rows={[...INSPECTION_OBSERVATION_SECTIONS]}
      rowKey={(row) => row.section}
      columns={[
        { id: 'section', header: 'Section', cell: (row) => row.section },
        { id: 'fields', header: 'Captured by the Field Worker', cell: (row) => row.fields },
      ]}
    />
  )
}

/**
 * ASG-02 Create assignment. The Supervisor first chooses Inspection (the worker submits an
 * observation through the Capture observation workflow) or Task (work with completion
 * evidence), then one division and one or more of its Field Workers. Each selected worker gets
 * a separate assignment. Workers who already hold an active assignment cannot be selected.
 */
export function AssignmentCreateForm({ data }: { data: CaptureWorkspace }) {
  const navigate = useNavigate()
  const actions = useAssignmentActions()
  const toast = useToast()
  // Opened from an expert diagnosis ("Create New Assignment"): the linked division, title and instructions arrive as search parameters and stay editable.
  const [params] = useSearchParams()
  // "Create Quarantine Assignment" opens this form on the Quarantine Assignment template (?quarantine=DQ-001). Only an active quarantine of the data layer counts.
  const quarantineTemplate = data.quarantines.find((row) => row.id === params.get('quarantine'))
  const linked = quarantineTemplate
    ? data.divisions.find((row) => row.id === quarantineTemplate.divisionId && row.status === 'active')
    : data.divisions.find((row) => row.id === params.get('division') && row.status === 'active')
  const template0 = linked ? quarantineTemplate : undefined
  const planText = template0 ? [template0.recommendedAction, template0.followUpDescription && `Follow-up plan: ${template0.followUpDescription}`].filter(Boolean).join('\n\n') : ''
  const preferred = linked ?? data.divisions.find((row) => row.id === 'DIV-005') ?? data.divisions.find((row) => row.status === 'active')
  const activeOf = (workerId: string) => activeAssignmentOf(data.assignments, workerId)
  const eligible = (division: string) => data.workers.filter((worker) => worker.divisionIds.includes(division))
  const [type, setType] = useState<AssignmentType>('inspection')
  const [templateId, setTemplateId] = useState<string>(TASK_TEMPLATES[0].id)
  const [estateId, setEstateId] = useState(preferred?.estateId ?? '')
  const [divisionId, setDivisionId] = useState(preferred?.id ?? '')
  const [workerIds, setWorkerIds] = useState<string[]>(() => eligible(preferred?.id ?? '').filter((worker) => !activeOf(worker.id)).slice(0, 1).map((worker) => worker.id))
  const [search, setSearch] = useState('')
  const [removedNotice, setRemovedNotice] = useState<string | null>(null)
  const [title, setTitle] = useState(template0 ? `Quarantine inspection · ${template0.id} · ${linked?.name ?? ''}` : linked && params.has('title') ? (params.get('title') ?? '') : preferred?.id === 'DIV-005' ? INSPECTION_TITLE : '')
  const [instructions, setInstructions] = useState(template0 ? planText : linked && params.has('instructions') ? (params.get('instructions') ?? '') : preferred?.id === 'DIV-005' ? INSPECTION_INSTRUCTIONS : '')
  const [objective, setObjective] = useState(template0 ? `Inspect and monitor ${linked?.name ?? 'the division'} under Restricted Operations for ${template0.disease?.name ?? 'the confirmed disease'}${template0.severity ? ` (${template0.severity} severity)` : ''}` : '')
  const [inspectionFocus, setInspectionFocus] = useState(template0?.inspectionFocus ?? '')
  const [monitoringWindow, setMonitoringWindow] = useState(template0?.monitoringWindow ?? '')
  const [authorised, setAuthorised] = useState(false)
  const [priority, setPriority] = useState<Priority>('High')
  const [dueDate, setDueDate] = useState('2026-10-28')
  const [requirements, setRequirements] = useState<TaskRequirements>(structuredClone(TASK_TEMPLATES[0].requirements))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [reviewing, setReviewing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const divisions = data.divisions.filter((division) => division.estateId === estateId)
  const division = data.divisions.find((row) => row.id === divisionId)
  const divisionWorkers = eligible(divisionId)
  const term = search.trim().toLowerCase()
  const listed = divisionWorkers.filter((worker) => !term || `${worker.fullName} ${worker.id}`.toLowerCase().includes(term))
  const selected = workerIds.map((id) => data.workers.find((worker) => worker.id === id)!).filter(Boolean)
  const busySelected = selected.filter((worker) => activeOf(worker.id))
  const available = divisionWorkers.filter((worker) => !activeOf(worker.id))
  const template = templateById(templateId)
  const isTask = type === 'task' && !template0
  // Restricted Operations: normal assignments are blocked for the selected division; only the Quarantine Assignment template works.
  const isQuarantine = Boolean(template0) && divisionId === template0?.divisionId
  const restrictedHere = data.quarantines.find((row) => row.divisionId === divisionId)
  const blocked = Boolean(restrictedHere) && !isQuarantine
  const pending = actions.createForWorkers.isPending
  const noun = isTask ? 'Task' : isQuarantine ? 'Quarantine assignment' : 'Inspection'

  function chooseType(next: AssignmentType) {
    setType(next)
    if (next === 'task') {
      const category = templateById(templateId)
      setTitle(category?.name ?? '')
      setInstructions(category?.instructions ?? '')
      setRequirements(structuredClone(category?.requirements ?? emptyRequirements()))
    } else {
      setTitle(divisionId === 'DIV-005' ? INSPECTION_TITLE : '')
      setInstructions(divisionId === 'DIV-005' ? INSPECTION_INSTRUCTIONS : '')
    }
  }

  function chooseCategory(id: string) {
    setTemplateId(id)
    const next = templateById(id)
    if (next) {
      setTitle(next.name)
      setInstructions(next.instructions)
      setRequirements(structuredClone(next.requirements))
    } else {
      setRequirements(emptyRequirements())
    }
  }

  /** A new division keeps only the selected workers who also belong to it. */
  function chooseDivision(id: string) {
    setDivisionId(id)
    const kept = workerIds.filter((workerId) => data.workers.find((worker) => worker.id === workerId)?.divisionIds.includes(id))
    const removed = workerIds.filter((workerId) => !kept.includes(workerId)).map((workerId) => data.workers.find((worker) => worker.id === workerId)?.fullName ?? workerId)
    setWorkerIds(kept)
    setRemovedNotice(removed.length ? `${removed.join(', ')} ${removed.length === 1 ? 'is' : 'are'} not in ${id} and ${removed.length === 1 ? 'was' : 'were'} removed from the selection.` : null)
  }

  const toggle = (id: string, on: boolean) => setWorkerIds((current) => (on ? [...current, id] : current.filter((item) => item !== id)))

  const input = (status: 'draft' | 'assigned'): AssignmentBatchInput => ({
    estateId, divisionId, fieldWorkerIds: workerIds, title, instructions, priority, dueDate, status, type,
    templateId: isTask && templateId !== CUSTOM_TASK ? templateId : null,
    requirements: isTask ? requirements : null,
    quarantine: isQuarantine && template0 ? { quarantineId: template0.id, objective, inspectionFocus, monitoringWindow, authorised } : null,
  })

  function validate(status: 'draft' | 'assigned') {
    if (blocked) {
      setError(`${divisionId} is under Restricted Operations (${restrictedHere?.id}). Normal field assignments are blocked; create a Quarantine Assignment from the quarantine record.`)
      return false
    }
    const problems = batchErrors(input(status))
    if (status === 'assigned' && busySelected.length) problems.fieldWorkerIds = `${busySelected.map((worker) => worker.fullName).join(', ')} already ${busySelected.length === 1 ? 'has' : 'have'} an active assignment. Remove them to continue.`
    setErrors(problems)
    return Object.keys(problems).length === 0
  }

  function create(status: 'draft' | 'assigned') {
    setError(null)
    actions.createForWorkers.mutate(input(status), {
      onSuccess: (created) => {
        setReviewing(false)
        const ids = created.map((item) => item.id).join(', ')
        toast.show({ tone: 'success', title: status === 'draft' ? (created.length === 1 ? 'Draft saved' : `${created.length} drafts saved`) : created.length === 1 ? `${noun} assigned` : `${noun} assigned to ${created.length} Field Workers`, message: ids })
        navigate(status === 'draft' ? '/assignments' : `/assignments/${created[0].id}`)
      },
      onError: (failed) => {
        setError(failure(failed))
        toast.show({ tone: 'error', title: 'Assignment not created', message: failure(failed) })
      },
    })
  }

  return (
    <div className={`${styles.page} ${styles.assignment}`}>
      <PageHeader title={isQuarantine ? 'Create Quarantine Assignment' : 'Create assignment'} subtitle={isQuarantine && template0 ? `${template0.id} · ${linked?.name ?? ''} (${template0.divisionId}) · Restricted Operations` : undefined} actions={<ButtonLink variant="secondary" to="/assignments">Cancel</ButtonLink>} />
      {error && <Banner tone="error">{error}</Banner>}
      {blocked && restrictedHere && (
        <Banner tone="warning" title={`${divisionId} is under Restricted Operations (${restrictedHere.id})`}>
          Why: a quarantine is active on {restrictedHere.divisionId}, so normal field activities are restricted and normal field assignments cannot be created or submitted for it. Only a Supervisor-authorised Quarantine Assignment is allowed.{' '}
          <Link to={`/assignments/new?quarantine=${restrictedHere.id}`}><strong>Create a Quarantine Assignment</strong></Link> instead, or choose a division operating normally.
        </Banner>
      )}
      {isQuarantine && template0 && (
        <Banner tone="info" title={`Quarantine Assignment · ${template0.id}`}>
          This assignment works under the Restricted Operations quarantine of {linked?.name}. <strong>Supervisor authorisation is required:</strong> tick the authorisation box and click Review &amp; assign. Nothing is assigned until you do.
        </Banner>
      )}
      <div className={styles.split}>
        <Card>
          <form className={styles.form} noValidate onSubmit={(event) => { event.preventDefault(); if (validate('assigned')) setReviewing(true) }}>
            {isQuarantine ? (
              <DescriptionList items={[{ label: 'Assignment type', value: 'Quarantine Assignment' }]} />
            ) : (
            <fieldset className={styles.fieldset}>
              <legend>Assignment type</legend>
              <div className={styles.actions}>
                <Radio label="Inspection" description="The Field Worker inspects the division and submits an observation" name="assignment-type" checked={type === 'inspection'} onChange={() => chooseType('inspection')} />
                <Radio label="Task" description="The Field Worker performs work and submits completion evidence" name="assignment-type" checked={type === 'task'} onChange={() => chooseType('task')} />
              </div>
            </fieldset>
            )}

            <h2>1 · {noun} details</h2>
            <DescriptionList items={[{ label: `${noun} ID`, value: 'Generated on save' }]} />
            <TextField label={`${noun} title`} value={title} error={errors.title} onChange={(event) => setTitle(event.target.value)} />
            {isTask && (
              <SelectField
                label="Task category"
                options={[...TASK_TEMPLATES.map((item) => ({ value: item.id, label: item.name })), { value: CUSTOM_TASK, label: 'Custom task' }]}
                value={templateId}
                onChange={(event) => chooseCategory(event.target.value)}
              />
            )}

            <h2>2 · Location</h2>
            <SelectField label="Estate" options={data.estates.map((estate) => ({ value: estate.id, label: `${estate.id} · ${estate.name}` }))} value={estateId} error={errors.estateId} disabled={isQuarantine} onChange={(event) => { setEstateId(event.target.value); chooseDivision('') }} />
            <fieldset className={styles.fieldset}>
              <legend>Division</legend>
              <div className={styles.actions}>
                {divisions.map((item) => (
                  <Radio key={item.id} label={`${item.id} · ${item.name}${item.operationalStatus === 'restricted' ? ' · Restricted Operations' : ''}`} name="division" checked={divisionId === item.id} disabled={item.status !== 'active' || (isQuarantine && item.id !== template0?.divisionId)} onChange={() => chooseDivision(item.id)} />
                ))}
              </div>
              {errors.divisionId && <p role="alert" className={styles.error}>{errors.divisionId}</p>}
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend>3 · Field Workers</legend>
              <div className={styles.toolbar}>
                <Badge tone={selected.length ? 'success' : 'neutral'}>{selected.length} selected</Badge>
                <div className={styles.actions}>
                  <Button variant="ghost" disabled={!available.length || available.every((worker) => workerIds.includes(worker.id))} onClick={() => setWorkerIds(available.map((worker) => worker.id))}>Select all available</Button>
                  <Button variant="ghost" disabled={!selected.length} onClick={() => setWorkerIds([])}>Clear</Button>
                </div>
              </div>
              {removedNotice && <Banner tone="warning" onDismiss={() => setRemovedNotice(null)}>{removedNotice}</Banner>}
              {selected.length > 0 && (
                <ul className={styles.chipList} aria-label="Selected Field Workers">
                  {selected.map((worker) => (
                    <li key={worker.id}>
                      <button type="button" className={styles.workerChip} aria-label={`Remove ${worker.fullName}`} onClick={() => toggle(worker.id, false)}>
                        {worker.fullName} <span aria-hidden="true">×</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {divisionWorkers.length > 3 && <SearchInput label="Search Field Workers" placeholder="Search by name or ID" value={search} onChange={(event) => setSearch(event.target.value)} />}
              {!divisionId ? (
                <p className={styles.muted}>Select a division first.</p>
              ) : divisionWorkers.length === 0 ? (
                <p className={styles.muted}>No Field Workers have scope on {divisionId}.</p>
              ) : (
                <div className={styles.workerList} role="group" aria-label={`Field Workers in ${divisionId}`}>
                  {listed.map((worker) => {
                    const active = activeOf(worker.id)
                    return (
                      <div className={styles.worker} key={worker.id}>
                        <Checkbox
                          label={`${worker.fullName} · ${worker.id}`}
                          description={active ? `Active assignment: ${active.id} · ${ASSIGNMENT_STATUS[active.status]} · ${active.title}` : undefined}
                          checked={workerIds.includes(worker.id)}
                          disabled={Boolean(active) && !workerIds.includes(worker.id)}
                          onChange={(event) => toggle(worker.id, event.target.checked)}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
              {divisionWorkers.some((worker) => activeOf(worker.id)) && <Banner tone="warning">Workers with an Assigned or In progress assignment cannot receive another assignment.</Banner>}
              {errors.fieldWorkerIds && <p role="alert" className={styles.error}>{errors.fieldWorkerIds}</p>}
            </fieldset>

            <h2>4 · {isTask ? 'Work details' : 'Inspection instructions'}</h2>
            {isQuarantine && template0 && (
              <>
                <TextAreaField label="Assignment objective" value={objective} error={errors.objective} onChange={(event) => setObjective(event.target.value)} />
                <TextField label="Inspection focus" value={inspectionFocus} error={errors.inspectionFocus} onChange={(event) => setInspectionFocus(event.target.value)} />
                <TextField label="Monitoring window" value={monitoringWindow} error={errors.monitoringWindow} onChange={(event) => setMonitoringWindow(event.target.value)} />
              </>
            )}
            <TextAreaField label="Supervisor instructions" value={instructions} error={errors.instructions} onChange={(event) => setInstructions(event.target.value)} />
            <div className={styles.equal}>
              <SelectField label="Priority" options={['Low', 'Medium', 'High'].map((value) => ({ value, label: value }))} value={priority} error={errors.priority} onChange={(event) => setPriority(event.target.value as Priority)} />
              <TextField label="Due date" type="date" value={dueDate} error={errors.dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </div>

            {isTask ? (
              <>
                <h2>5 · Task inputs, photos and completion notes</h2>
                <TaskRequirementsEditor value={requirements} onChange={setRequirements} errors={errors} />
              </>
            ) : (
              <>
                <h2>5 · Observation form</h2>
                <InspectionObservationForm />
              </>
            )}

            {isQuarantine && (
              <>
                <Checkbox label="I authorise this Quarantine Assignment under Restricted Operations" description="Required to assign it. Saving a draft does not authorise it." checked={authorised} onChange={(event) => setAuthorised(event.target.checked)} />
                {errors.authorised && <p role="alert" className={styles.error}>{errors.authorised}</p>}
              </>
            )}
            <div className={styles.actions}>
              <Button type="submit" disabled={blocked}>Review &amp; assign</Button>
              <Button variant="secondary" loading={pending && !reviewing} disabled={pending || blocked} onClick={() => { if (validate('draft')) create('draft') }}>Save as draft</Button>
            </div>
          </form>
        </Card>
        <div className={styles.stack}>
          {isQuarantine && template0 && (
            <Card title="Quarantine details">
              <DescriptionList items={[
                { label: 'Quarantine ID', value: template0.id },
                { label: 'Estate', value: data.estates.find((row) => row.id === template0.estateId)?.name ? `${template0.estateId} · ${data.estates.find((row) => row.id === template0.estateId)?.name}` : template0.estateId },
                { label: 'Division', value: `${template0.divisionId} · ${linked?.name ?? ''}` },
                { label: 'Operational status', value: 'Restricted Operations' },
                { label: 'Related disease', value: template0.disease ? `${template0.disease.name} (${template0.disease.id})` : 'Not recorded' },
                { label: 'Severity', value: template0.severity ?? 'Not recorded' },
                { label: 'Linked observation', value: template0.observationId },
                { label: 'Linked case', value: template0.caseId ?? 'Not linked' },
                { label: 'Authorisation', value: authorised ? 'Authorised by you' : 'Required before assigning' },
              ]} />
            </Card>
          )}
          <Card title="Assignment summary">
            <DescriptionList items={[
              { label: 'Type', value: isQuarantine ? 'Quarantine Assignment' : ASSIGNMENT_TYPE[type] },
              ...(isQuarantine && template0 ? [{ label: 'Quarantine', value: template0.id }] : []),
              ...(isTask ? [{ label: 'Category', value: template?.name ?? 'Custom task' }] : []),
              { label: 'Division', value: division ? `${division.id} ${division.name}` : 'Not selected' },
              { label: 'Field Workers', value: selected.length ? selected.map((worker) => worker.fullName).join(', ') : 'Not selected' },
              { label: 'Assignments', value: selected.length > 1 ? `${selected.length} (one per Field Worker)` : selected.length },
              { label: 'Priority', value: priority },
              { label: 'Due date', value: dueDate },
              ...(isTask ? [{ label: 'Requirements', value: requirementSummary(requirements) }] : []),
            ]} />
          </Card>
        </div>
      </div>
      <Modal
        open={reviewing}
        title="Review assignment"
        size="large"
        dismissible={!pending}
        onClose={() => setReviewing(false)}
        footer={
          <>
            <Button variant="secondary" disabled={pending} onClick={() => setReviewing(false)}>Back to edit</Button>
            <Button loading={pending} onClick={() => create('assigned')}>{selected.length > 1 ? `Confirm and assign to ${selected.length} workers` : 'Confirm and assign'}</Button>
          </>
        }
      >
        <DescriptionList items={[
          { label: 'Type', value: isQuarantine ? `Quarantine Assignment · ${template0?.id ?? ''}` : isTask ? `Task · ${template?.name ?? 'Custom task'}` : 'Inspection' },
          { label: 'Title', value: title },
          { label: 'Division', value: division ? `${division.id} ${division.name}` : '' },
          { label: `Field Workers (${selected.length})`, value: selected.map((worker) => worker.fullName).join(', ') },
          { label: 'Priority · due', value: `${priority} · ${dueDate}` },
          { label: 'Instructions', value: instructions },
        ]} />
        {isTask ? <TaskRequirementsView value={requirements} /> : <InspectionObservationForm />}
        {selected.length > 1 && <p className={styles.muted}>Creates {selected.length} separate assignments, one per Field Worker.</p>}
        {error && <Banner tone="error">{error}</Banner>}
      </Modal>
    </div>
  )
}
