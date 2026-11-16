import { Badge, Button, Checkbox, DescriptionList, IconButton, Radio, TextField } from '@/shared/components'
import type { TaskSubmission } from '../domain/assignment'
import { REQUIREMENT_LEVEL_LABEL, type RequirementLevel, type TaskRequirements } from '../domain/taskTemplates'
import { EvidenceImage } from './EvidenceImage'
import { dateTime } from './helpers'
import styles from './capture.module.css'

const LEVELS: RequirementLevel[] = ['required', 'optional', 'not_required']

function LevelChoice({ legend, name, value, onChange }: { legend: string; name: string; value: RequirementLevel; onChange: (value: RequirementLevel) => void }) {
  return (
    <fieldset className={styles.fieldset}>
      <legend>{legend}</legend>
      <div className={styles.actions}>
        {LEVELS.map((level) => (
          <Radio key={level} label={REQUIREMENT_LEVEL_LABEL[level]} name={name} checked={value === level} onChange={() => onChange(level)} />
        ))}
      </div>
    </fieldset>
  )
}

/** Task inputs (dynamic fields), photo and completion-note requirements of a Task assignment. */
export function TaskRequirementsEditor({ value, onChange, errors = {} }: { value: TaskRequirements; onChange: (value: TaskRequirements) => void; errors?: Record<string, string> }) {
  const set = (patch: Partial<TaskRequirements>) => onChange({ ...value, ...patch })
  return (
    <div className={styles.requirements}>
      <fieldset className={styles.fieldset}>
        <legend>Task inputs</legend>
        {value.fields.map((field, index) => (
          <div className={styles.reqRow} key={index}>
            <TextField label={`Input ${index + 1} name`} value={field.label} onChange={(event) => set({ fields: value.fields.map((row, i) => (i === index ? { ...row, label: event.target.value } : row)) })} />
            <Checkbox label="Required" checked={field.required} onChange={(event) => set({ fields: value.fields.map((row, i) => (i === index ? { ...row, required: event.target.checked } : row)) })} />
            <IconButton icon="x" label={`Remove input ${index + 1}`} onClick={() => set({ fields: value.fields.filter((_, i) => i !== index) })} />
          </div>
        ))}
        {errors.fields && <p role="alert" className={styles.error}>{errors.fields}</p>}
        <div><Button variant="ghost" icon="plus" onClick={() => set({ fields: [...value.fields, { label: '', required: false }] })}>Add task input</Button></div>
      </fieldset>
      <LevelChoice legend="Photos" name="photos" value={value.photos.level} onChange={(level) => set({ photos: { ...value.photos, level } })} />
      {value.photos.level !== 'not_required' && (
        <TextField label="Minimum photos" type="number" min={1} max={20} value={String(value.photos.minimum)} error={errors.photos} onChange={(event) => set({ photos: { ...value.photos, minimum: Number(event.target.value) } })} />
      )}
      <LevelChoice legend="Completion notes" name="completionNotes" value={value.completionNotes} onChange={(completionNotes) => set({ completionNotes })} />
    </div>
  )
}

/** Read-only Task requirements on the assignment detail page and in the review dialog. */
export function TaskRequirementsView({ value }: { value: TaskRequirements }) {
  return (
    <DescriptionList
      items={[
        {
          label: 'Task inputs',
          value: value.fields.length ? (
            <ul className={styles.plainList}>
              {value.fields.map((field) => (
                <li key={field.label}>
                  {field.label} <Badge tone={field.required ? 'warning' : 'neutral'}>{field.required ? 'Required' : 'Optional'}</Badge>
                </li>
              ))}
            </ul>
          ) : 'None',
        },
        { label: 'Photos', value: value.photos.level === 'not_required' ? 'Not required' : `${REQUIREMENT_LEVEL_LABEL[value.photos.level]} · at least ${value.photos.minimum}` },
        { label: 'Completion notes', value: REQUIREMENT_LEVEL_LABEL[value.completionNotes] },
      ]}
    />
  )
}

/** The Field Worker's Task submission: outcome, task input responses, photos, notes, GPS and time. */
export function TaskSubmissionView({ submission }: { submission: TaskSubmission }) {
  return (
    <div className={styles.stack}>
      <DescriptionList
        items={[
          { label: 'Submitted', value: dateTime(submission.submittedAt) },
          { label: 'Outcome', value: submission.outcome },
          ...submission.responses.map((response) => ({ label: response.label, value: response.value })),
          { label: 'Completion notes', value: submission.completionNotes ?? 'Not provided' },
          { label: 'GPS (captured in mobile app)', value: submission.gps ? `${submission.gps.latitude.toFixed(3)}, ${submission.gps.longitude.toFixed(3)} · ±${submission.gps.accuracyM} m` : 'Not captured' },
        ]}
      />
      <div className={styles.thumbs} aria-label="Submitted photographs">
        {submission.photoIds.map((id) => (
          <figure key={id} className={styles.thumb}>
            <EvidenceImage thumbnail label={id} altText={`Submitted task photograph ${id} (synthetic illustration)`} />
          </figure>
        ))}
      </div>
    </div>
  )
}
