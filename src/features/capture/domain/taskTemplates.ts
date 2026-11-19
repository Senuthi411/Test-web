/**
 * Task categories and the inputs a Supervisor configures for a Task assignment. Categories are
 * frontend configuration: no backend category catalogue exists yet (see
 * docs/api-integration/pending-contracts.md). Tasks have no checklist and no GPS input; GPS may
 * still be captured by the mobile app during fieldwork.
 */
export type RequirementLevel = 'required' | 'optional' | 'not_required'

export const REQUIREMENT_LEVEL_LABEL: Record<RequirementLevel, string> = {
  required: 'Required',
  optional: 'Optional',
  not_required: 'Not required',
}

/** A dynamic input the Field Worker fills in when completing the task. */
export interface TaskField {
  label: string
  required: boolean
}

export interface TaskRequirements {
  fields: TaskField[]
  photos: { level: RequirementLevel; minimum: number }
  completionNotes: RequirementLevel
}

export interface TaskTemplate {
  id: string
  name: string
  instructions: string
  requirements: TaskRequirements
}

export const CUSTOM_TASK = 'custom'

export function emptyRequirements(): TaskRequirements {
  return { fields: [], photos: { level: 'optional', minimum: 1 }, completionNotes: 'optional' }
}

/** Task categories (each pre-fills title, instructions, task inputs and photo requirements). */
export const TASK_TEMPLATES: readonly TaskTemplate[] = [
  {
    id: 'TPL-FERT', name: 'Fertilizer Application',
    instructions: 'Apply the scheduled fertilizer to the selected division. Record the product, quantity and area covered.',
    requirements: { fields: [{ label: 'Fertilizer product', required: true }, { label: 'Quantity applied (kg)', required: true }, { label: 'Area covered (ha)', required: false }], photos: { level: 'required', minimum: 1 }, completionNotes: 'optional' },
  },
  {
    id: 'TPL-PRUNE', name: 'Pruning',
    instructions: 'Prune the scheduled sections of the division to the agreed height and record the rows completed.',
    requirements: { fields: [{ label: 'Rows completed', required: true }], photos: { level: 'optional', minimum: 1 }, completionNotes: 'optional' },
  },
  {
    id: 'TPL-WEED', name: 'Weed Removal',
    instructions: 'Remove weeds from the scheduled sections of the division and record the method used.',
    requirements: { fields: [{ label: 'Method used', required: true }, { label: 'Area cleared (ha)', required: false }], photos: { level: 'optional', minimum: 1 }, completionNotes: 'optional' },
  },
  {
    id: 'TPL-DRAIN', name: 'Drainage Maintenance',
    instructions: 'Clear and check the drains in the division. Report blocked or damaged sections.',
    requirements: { fields: [{ label: 'Drain length cleared (m)', required: true }, { label: 'Damage found', required: false }], photos: { level: 'required', minimum: 1 }, completionNotes: 'required' },
  },
  {
    id: 'TPL-GEN', name: 'General Field Work',
    instructions: 'Carry out the described field work in the division and record what was done.',
    requirements: { fields: [{ label: 'Work completed', required: true }], photos: { level: 'optional', minimum: 1 }, completionNotes: 'required' },
  },
]

export const templateById = (id: string | null | undefined) => TASK_TEMPLATES.find((item) => item.id === id) ?? null

/**
 * The specialised observation form a Field Worker completes for an Inspection assignment in the
 * Capture mobile app (owned by Capture). Shown to the Supervisor; never filled in on the web.
 */
export const INSPECTION_OBSERVATION_SECTIONS: ReadonlyArray<{ section: string; fields: string }> = [
  { section: 'Observation details', fields: 'Observation date & time' },
  { section: 'Location', fields: 'Division, GPS coordinates, location accuracy' },
  { section: 'Disease details', fields: 'Suspected disease' },
  { section: 'Symptoms', fields: 'Observed symptoms' },
  { section: 'Severity', fields: 'Severity level' },
  { section: 'Leaf details', fields: 'Lesion colour, other description' },
  { section: 'Photos', fields: 'Multiple tea leaf photos' },
  { section: 'Additional details', fields: 'Observation notes' },
  { section: 'Submission', fields: 'Review & submit / save draft' },
]

/** Task input names must be filled in and unique; a photo minimum must be between 1 and 20. */
export function requirementErrors(r: TaskRequirements): Record<string, string> {
  const errors: Record<string, string> = {}
  const labels = r.fields.map((field) => field.label.trim().toLowerCase())
  if (labels.some((label) => !label)) errors.fields = 'Fill in or remove empty task inputs'
  else if (new Set(labels).size !== labels.length) errors.fields = 'Task input names must be unique'
  if (r.photos.level !== 'not_required' && (!Number.isInteger(r.photos.minimum) || r.photos.minimum < 1 || r.photos.minimum > 20)) errors.photos = 'Enter a photo minimum between 1 and 20'
  return errors
}

/** "2 required / 1 optional inputs · 1+ photo required · completion notes optional". */
export function requirementSummary(r: TaskRequirements): string {
  return [
    `${r.fields.filter((f) => f.required).length} required / ${r.fields.filter((f) => !f.required).length} optional inputs`,
    r.photos.level === 'not_required' ? 'no photos' : `${r.photos.minimum}+ photo${r.photos.minimum === 1 ? '' : 's'} ${r.photos.level}`,
    `completion notes ${REQUIREMENT_LEVEL_LABEL[r.completionNotes].toLowerCase()}`,
  ].join(' · ')
}
