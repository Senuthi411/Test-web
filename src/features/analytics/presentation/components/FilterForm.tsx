import { useId, useState } from 'react'
import { Button, Checkbox, Radio, SelectField } from '@/shared/components'
import { DEFAULT_FILTERS, DISEASES, STATUSES, type AnalyticsSnapshot, type Filters } from '../../domain/models'
import { filterError } from '../../domain/selectors'
import { PERIOD_OPTIONS } from './chartTheme'
import styles from './analytics.module.css'

const MEASURES = [
  ['suspected', 'Suspected (field)'],
  ['confirmed', 'Confirmed (expert)'],
  ['both', 'Show both separately'],
] as const

/**
 * Reporting filter form (AN-08 and the Filters dialog). Changes stay in a draft until
 * applied, so the URL and the report only change on submit.
 */
export function FilterForm({
  snapshot,
  initial,
  onApply,
  onReset,
  full = false,
  formId,
}: {
  snapshot: AnalyticsSnapshot
  initial: Filters
  onApply(filters: Filters): void
  onReset(): void
  full?: boolean
  formId?: string
}) {
  const [draft, setDraft] = useState<Filters>(() => ({ ...initial, statuses: [...initial.statuses] }))
  const [error, setError] = useState('')
  const id = useId()
  const divisions = snapshot.divisions.filter((division) => !draft.estate || division.estateId === draft.estate)

  return (
    <form
      id={formId}
      className={styles.filterForm}
      noValidate
      onReset={(event) => {
        event.preventDefault()
        setDraft({ ...DEFAULT_FILTERS, statuses: [...STATUSES] })
        setError('')
        onReset()
      }}
      onSubmit={(event) => {
        event.preventDefault()
        const message = filterError(draft)
        setError(message)
        if (!message) onApply(draft)
      }}
    >
      <SelectField
        label="Estate"
        value={draft.estate}
        onChange={(event) => setDraft({ ...draft, estate: event.target.value, division: '' })}
        options={[{ value: '', label: `All my estates (${snapshot.estates.length})` }, ...snapshot.estates.map((estate) => ({ value: estate.id, label: estate.name }))]}
      />
      <SelectField
        label="Division"
        disabled={!draft.estate}
        value={draft.division}
        onChange={(event) => setDraft({ ...draft, division: event.target.value })}
        options={[
          { value: '', label: draft.estate ? 'All divisions' : 'All divisions · choose one estate first' },
          ...divisions.map((division) => ({ value: division.id, label: division.name })),
        ]}
      />
      <SelectField
        label="Period"
        value={draft.period}
        onChange={(event) => setDraft({ ...draft, period: event.target.value as Filters['period'] })}
        options={PERIOD_OPTIONS}
      />
      {draft.period === 'custom' && (
        <div className={styles.dateFields}>
          <label>
            From
            <input type="date" value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.target.value })} aria-describedby={error ? id : undefined} />
          </label>
          <label>
            To
            <input type="date" value={draft.to} onChange={(event) => setDraft({ ...draft, to: event.target.value })} aria-describedby={error ? id : undefined} />
          </label>
        </div>
      )}
      <SelectField
        label="Disease"
        value={draft.disease}
        onChange={(event) => setDraft({ ...draft, disease: event.target.value })}
        options={[{ value: '', label: 'All diseases' }, ...DISEASES.map((disease) => ({ value: disease, label: disease }))]}
      />
      {full && (
        <>
          <fieldset className={styles.fieldset}>
            <legend>Review status</legend>
            <div className={styles.statusOptions} style={{ gridTemplateRows: `repeat(${Math.ceil(STATUSES.length / 2)}, auto)` }}>
              {STATUSES.map((status) => (
                <Checkbox
                  key={status}
                  label={status}
                  checked={draft.statuses.includes(status)}
                  onChange={(event) =>
                    setDraft({ ...draft, statuses: event.target.checked ? [...draft.statuses, status] : draft.statuses.filter((item) => item !== status) })
                  }
                />
              ))}
            </div>
            <p className={styles.help}>Show or hide status columns. Totals always include all review statuses.</p>
          </fieldset>
          <fieldset className={styles.fieldset}>
            <legend>Disease measure</legend>
            {MEASURES.map(([measure, label]) => (
              <Radio key={measure} label={label} name={`${id}-measure`} value={measure} checked={draft.measure === measure} onChange={() => setDraft({ ...draft, measure })} />
            ))}
          </fieldset>
        </>
      )}
      {error && (
        <p className={styles.fieldError} id={id} role="alert">
          {error}
        </p>
      )}
      {!full && (
        <div className={styles.buttonRow}>
          <Button type="submit">Apply filters</Button>
          <Button type="reset" variant="secondary">
            Reset filters
          </Button>
        </div>
      )}
    </form>
  )
}
