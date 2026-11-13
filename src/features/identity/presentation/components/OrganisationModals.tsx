import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Banner, Button, ConfirmDialog, Modal, SelectField, TextField, useToast } from '@/shared/components'
import type { DivisionSummary, EstateSummary, RecordStatus } from '../../domain/models'
import { useCreateDivision, useCreateEstate, useUpdateDivision, useUpdateEstate } from '../services/queries'
import { errorMessage, fieldErrorsOf } from './helpers'
import styles from './identity.module.css'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const DIVISION_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Disabled' },
]

const status = z.enum(['active', 'inactive'])

const estateSchema = z.object({
  name: z.string().trim().min(1, 'Estate name is required'),
  region: z.string().trim().min(1, 'Region is required'),
  status,
})

type EstateValues = z.infer<typeof estateSchema>

export interface EstateFormModalProps {
  open: boolean
  /** Edit this estate; omit to add one. */
  estate?: EstateSummary
  onClose: () => void
  onSaved?: (estate: EstateSummary) => void
}

/** ID-09 "Add estate" / "Edit estate" modals, with the status-change confirmation. */
export function EstateFormModal({ open, estate, onClose, onSaved }: EstateFormModalProps) {
  // Re-mount per opening so the form always starts from the record.
  return open ? <EstateForm estate={estate} onClose={onClose} onSaved={onSaved} /> : null
}

function EstateForm({ estate, onClose, onSaved }: Omit<EstateFormModalProps, 'open'>) {
  const toast = useToast()
  const create = useCreateEstate()
  const update = useUpdateEstate()
  const mutation = estate ? update : create
  const [pendingValues, setPendingValues] = useState<EstateValues | null>(null)
  const [failure, setFailure] = useState<unknown>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<EstateValues>({
    resolver: zodResolver(estateSchema),
    defaultValues: { name: estate?.name ?? '', region: estate?.region ?? '', status: estate?.status ?? 'active' },
  })

  function persist(values: EstateValues) {
    setFailure(null)
    const statusChanged = Boolean(estate && estate.status !== values.status)
    const handlers = {
      onSuccess: (saved: EstateSummary) => {
        setPendingValues(null)
        toast.show({ tone: 'success', title: statusChanged ? 'Status change confirmed' : estate ? 'Estate updated' : `Estate ${saved.id} added` })
        onSaved?.(saved)
        onClose()
      },
      onError: (error: unknown) => {
        setPendingValues(null)
        const fields = fieldErrorsOf(error)
        if (fields.name) setError('name', { type: 'server', message: fields.name })
        else setFailure(error)
      },
    }
    if (estate) update.mutate({ id: estate.id, input: values }, handlers)
    else create.mutate(values, handlers)
  }

  const onSubmit = handleSubmit((values) => {
    if (estate && estate.status !== values.status) setPendingValues(values)
    else persist(values)
  })

  return (
    <>
      <Modal
        open={pendingValues === null}
        title={estate ? 'Edit estate' : 'Add estate'}
        description={estate ? `${estate.id} · ${estate.name}` : undefined}
        onClose={onClose}
        dismissible={!mutation.isPending}
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" form="estate-form" loading={mutation.isPending} loadingLabel="Saving…">
              Save
            </Button>
          </>
        }
      >
        <form id="estate-form" className={styles.form} onSubmit={onSubmit} noValidate>
          {failure !== null && (
            <Banner tone="error" title="The estate was not saved">
              {errorMessage(failure)}
            </Banner>
          )}
          <TextField label="Estate name" required placeholder="Enter value" error={errors.name?.message} {...register('name')} />
          <TextField label="Region" required placeholder="Enter value" error={errors.region?.message} {...register('region')} />
          <SelectField label="Status" options={STATUS_OPTIONS} {...register('status')} />
        </form>
      </Modal>
      <ConfirmDialog
        open={pendingValues !== null}
        title="Change estate status?"
        confirmLabel="Confirm status change"
        pending={mutation.isPending}
        onCancel={() => setPendingValues(null)}
        onConfirm={() => pendingValues && persist(pendingValues)}
      >
        <p className={styles.muted}>
          You are changing this estate from {statusLabel(estate?.status)} to {statusLabel(pendingValues?.status)}. Status changes require
          administrator confirmation. Existing observations, evidence and division IDs are not rewritten.
        </p>
      </ConfirmDialog>
    </>
  )
}

const statusLabel = (value: RecordStatus | undefined, inactive = 'Inactive') => (value === 'inactive' ? inactive : 'Active')

const divisionSchema = z.object({
  name: z.string().trim().min(1, 'Division name is required'),
  estateId: z.string().min(1, 'Estate is required'),
  status,
})

type DivisionValues = z.infer<typeof divisionSchema>

export interface DivisionFormModalProps {
  open: boolean
  estates: readonly EstateSummary[]
  /** Edit this division; omit to add one. */
  division?: DivisionSummary
  /** Pre-selected estate when adding from an estate page (ID-10 "Add division"). */
  defaultEstateId?: string
  onClose: () => void
  onSaved?: (division: DivisionSummary) => void
}

/** ID-11 "Add division" and ID-12 "Edit division", with the disable confirmation. */
export function DivisionFormModal({ open, ...props }: DivisionFormModalProps) {
  return open ? <DivisionForm {...props} /> : null
}

function DivisionForm({ estates, division, defaultEstateId, onClose, onSaved }: Omit<DivisionFormModalProps, 'open'>) {
  const toast = useToast()
  const create = useCreateDivision()
  const update = useUpdateDivision()
  const mutation = division ? update : create
  const [pendingValues, setPendingValues] = useState<DivisionValues | null>(null)
  const [failure, setFailure] = useState<unknown>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DivisionValues>({
    resolver: zodResolver(divisionSchema),
    defaultValues: {
      name: division?.name ?? '',
      estateId: division?.estateId ?? defaultEstateId ?? '',
      status: division?.status ?? 'active',
    },
  })

  function persist(values: DivisionValues) {
    setFailure(null)
    const statusChanged = Boolean(division && division.status !== values.status)
    const handlers = {
      onSuccess: (saved: DivisionSummary) => {
        setPendingValues(null)
        toast.show({
          tone: 'success',
          title: statusChanged ? 'Status change confirmed' : division ? 'Division updated' : `Division ${saved.id} added`,
        })
        onSaved?.(saved)
        onClose()
      },
      onError: (error: unknown) => {
        setPendingValues(null)
        const fields = fieldErrorsOf(error)
        if (fields.name) setError('name', { type: 'server', message: fields.name })
        else if (fields.estateId) setError('estateId', { type: 'server', message: fields.estateId })
        else setFailure(error)
      },
    }
    if (division) update.mutate({ id: division.id, input: { name: values.name, status: values.status } }, handlers)
    else create.mutate(values, handlers)
  }

  const onSubmit = handleSubmit((values) => {
    if (division && division.status !== values.status) setPendingValues(values)
    else persist(values)
  })

  return (
    <>
      <Modal
        open={pendingValues === null}
        title={division ? 'Edit division' : 'Add division'}
        description={division ? `${division.id} · ${division.estateName}` : undefined}
        onClose={onClose}
        dismissible={!mutation.isPending}
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" form="division-form" loading={mutation.isPending} loadingLabel="Saving…">
              Save
            </Button>
          </>
        }
      >
        <form id="division-form" className={styles.form} onSubmit={onSubmit} noValidate>
          {failure !== null && (
            <Banner tone="error" title="The division was not saved">
              {errorMessage(failure)}
            </Banner>
          )}
          <TextField label="Division name" required placeholder="Enter value" error={errors.name?.message} {...register('name')} />
          {division ? (
            <TextField
              label="Estate"
              readOnly
              value={division.estateName}
              hint="A division cannot move to another estate; its ID stays attached to existing observations."
            />
          ) : (
            <SelectField
              label="Estate"
              required
              placeholder="Select estate"
              options={estates.map((estate) => ({ value: estate.id, label: estate.name, disabled: estate.status !== 'active' }))}
              error={errors.estateId?.message}
              {...register('estateId')}
            />
          )}
          <SelectField label="Status" options={DIVISION_STATUS_OPTIONS} {...register('status')} />
        </form>
      </Modal>
      <ConfirmDialog
        open={pendingValues !== null}
        title="Change division status?"
        confirmLabel="Confirm status change"
        destructive={pendingValues?.status === 'inactive'}
        pending={mutation.isPending}
        onCancel={() => setPendingValues(null)}
        onConfirm={() => pendingValues && persist(pendingValues)}
      >
        <p className={styles.muted}>
          You are changing this division from {statusLabel(division?.status, 'Disabled')} to {statusLabel(pendingValues?.status, 'Disabled')}.
          {pendingValues?.status === 'inactive'
            ? ' Under the offline precedence rules in Implementation Baseline v3.8, captures made before a division is disabled can still be accepted and marked inactive_at_submission; captures without provable timing go to quarantine for a supervisor decision.'
            : ''}{' '}
          Original evidence and division IDs are never rewritten.
        </p>
      </ConfirmDialog>
    </>
  )
}
