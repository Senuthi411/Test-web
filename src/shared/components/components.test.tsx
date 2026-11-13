import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AppError } from '@/shared/api'
import {
  Banner,
  Button,
  ConfirmDialog,
  DataTable,
  ErrorState,
  FilterSelect,
  Modal,
  Pagination,
  PasswordField,
  Tabs,
  TextField,
  ToastProvider,
  useToast,
} from '@/shared/components'

describe('Button', () => {
  it('shows the designed loading state and ignores clicks while busy', async () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Working…' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('Tabs', () => {
  function Harness() {
    const [value, setValue] = useState<'a' | 'b' | 'c'>('a')
    return (
      <Tabs
        label="Status"
        value={value}
        onChange={setValue}
        items={[
          { id: 'a', label: 'All', count: 3 },
          { id: 'b', label: 'Flagged' },
          { id: 'c', label: 'Verified' },
        ]}
      />
    )
  }

  it('supports arrow, Home and End keys with roving focus', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const all = screen.getByRole('tab', { name: /^All/ })
    expect(all).toHaveAttribute('aria-selected', 'true')
    all.focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Flagged' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Flagged' })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Verified' })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: /^All/ })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Verified' })).toHaveAttribute('tabindex', '-1')
  })
})

describe('Modal', () => {
  function Harness({ onClose = () => {} }: { onClose?: () => void }) {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        <Modal
          open={open}
          title="Edit estate"
          onClose={() => {
            onClose()
            setOpen(false)
          }}
          footer={<button>Save</button>}
        >
          <input aria-label="Name" />
        </Modal>
      </>
    )
  }

  it('moves focus in, traps Tab, closes on Escape and restores focus', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open' })
    await user.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Edit estate' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('cannot be dismissed while a confirmed action is pending', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<ConfirmDialog open title="Revoke session?" confirmLabel="Revoke" destructive pending onConfirm={() => {}} onCancel={onCancel} />)
    await user.keyboard('{Escape}')
    expect(onCancel).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Working…' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })
})

describe('Pagination', () => {
  it('summarises the range and pages forward', async () => {
    const onPageChange = vi.fn()
    render(<Pagination page={1} pageSize={10} total={13} onPageChange={onPageChange} itemLabel="demo users" />)
    expect(screen.getByText('Showing 1–10 of 13 demo users')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page')
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })
})

describe('DataTable', () => {
  const columns = [{ id: 'id', header: 'ID', cell: (row: { id: string }) => row.id }]

  it('activates rows with the keyboard', async () => {
    const onRowActivate = vi.fn()
    const user = userEvent.setup()
    render(
      <DataTable caption="Users" columns={columns} rows={[{ id: 'USR-001' }]} rowKey={(row) => row.id} onRowActivate={onRowActivate} rowLabel={(row) => `Open ${row.id}`} />,
    )
    screen.getByRole('row', { name: 'Open USR-001' }).focus()
    await user.keyboard('{Enter}')
    expect(onRowActivate).toHaveBeenCalledWith({ id: 'USR-001' })
  })

  it('renders loading and empty states', () => {
    const { rerender } = render(<DataTable caption="Users" columns={columns} rows={[]} rowKey={(row) => row.id} loading empty="Nothing" />)
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText('Nothing')).not.toBeInTheDocument()
    rerender(<DataTable caption="Users" columns={columns} rows={[]} rowKey={(row) => row.id} empty="Nothing" />)
    expect(screen.getByText('Nothing')).toBeInTheDocument()
  })
})

describe('form fields', () => {
  it('links the label and error message to the input', () => {
    render(<TextField label="Email" error="Enter a valid e-mail address." />)
    const input = screen.getByRole('textbox', { name: 'Email' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Enter a valid e-mail address.')
  })

  it('reveals and hides the password', async () => {
    const user = userEvent.setup()
    render(<PasswordField label="Password" />)
    const input = screen.getByLabelText('Password')
    expect(input).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(input).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('FilterSelect', () => {
  function Harness({ onChange }: { onChange: (value: string) => void }) {
    const [value, setValue] = useState('all')
    return (
      <FilterSelect
        label="Estate"
        value={value}
        onChange={(next) => {
          setValue(next)
          onChange(next)
        }}
        options={[
          { value: 'all', label: 'All' },
          { value: 'EST-001', label: 'Highland Tea Estate' },
          { value: 'EST-002', label: 'Riverbend Tea Estate' },
        ]}
      />
    )
  }

  it('is operable with the keyboard', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onChange={onChange} />)
    const trigger = screen.getByRole('combobox', { name: 'Estate: All' })
    trigger.focus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('listbox', { name: 'Estate' })).toBeInTheDocument()
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenCalledWith('EST-002')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Estate: Riverbend Tea Estate' })).toHaveFocus()
    await user.keyboard('{Enter}{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})

describe('feedback', () => {
  it('announces error banners immediately', () => {
    render(<Banner tone="error" title="Could not save" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save')
  })

  it('shows what failed with a reference and offers retry only when it can help', async () => {
    const onRetry = vi.fn()
    const { rerender } = render(
      <ErrorState error={new AppError('unavailable', 'The service is temporarily unavailable.', { correlationId: 'corr-7' })} onRetry={onRetry} />,
    )
    expect(screen.getByText('Reference: corr-7')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalled()
    rerender(<ErrorState error={new AppError('contract_pending', 'Not connected.')} onRetry={onRetry} />)
    expect(screen.getByRole('heading', { name: 'Not yet available' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  it('auto-dismisses success toasts but keeps error toasts until dismissed', async () => {
    vi.useFakeTimers()
    function Trigger() {
      const toast = useToast()
      return (
        <>
          <button onClick={() => toast.show({ tone: 'success', title: 'User created' })}>ok</button>
          <button onClick={() => toast.show({ tone: 'error', title: 'Save failed' })}>fail</button>
        </>
      )
    }
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    act(() => screen.getByRole('button', { name: 'ok' }).click())
    act(() => screen.getByRole('button', { name: 'fail' }).click())
    expect(screen.getByRole('status')).toHaveTextContent('User created')
    expect(screen.getByRole('alert')).toHaveTextContent('Save failed')
    act(() => vi.advanceTimersByTime(7000))
    expect(screen.queryByText('User created')).not.toBeInTheDocument()
    expect(screen.getByText('Save failed')).toBeInTheDocument()
    act(() => screen.getByRole('button', { name: 'Dismiss notification' }).click())
    expect(screen.queryByText('Save failed')).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})
