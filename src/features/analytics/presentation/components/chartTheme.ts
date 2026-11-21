import type { ReviewStatus } from '../../domain/models'

/** Disease series colours, in DISEASES order (AN Figma frames). */
export const diseaseColors = ['#2e7d32', '#1f62a3', '#bc7c17', '#7e52cb']
/** Review status colours in STATUSES order: the same palette as REV-01 "Review status distribution". */
export const statusColors: Readonly<Record<ReviewStatus, string>> = {
  Submitted: '#4a86d1',
  Resubmitted: 'var(--tl-teal-stroke, #2c9a8e)',
  'In review': '#7e57c2',
  Verified: '#2e7d32',
  Flagged: '#e04f4f',
  'Correction requested': '#e2a62f',
  Referred: '#7cb342',
}

/** Axis top: the design maximum, or a rounded value with whole-number steps when the data is larger. */
export function axisMax(values: number[], designMax: number) {
  const top = Math.max(0, ...values)
  if (top <= designMax) return designMax
  let step = Math.ceil(top / 5)
  if (step > 10) {
    const magnitude = 10 ** Math.floor(Math.log10(step))
    step = (Math.ceil((step / magnitude) * 2) / 2) * magnitude
  }
  return step * 5
}

export const PERIOD_OPTIONS = [
  { value: '30', label: 'Last 30 days' },
  { value: '7', label: 'Last 7 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom range' },
]
