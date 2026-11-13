import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, it } from 'vitest'
import { FixtureStore } from '@/fixtures'
import { createBrowserSessionPersistence } from '@/features/identity'
import { assembleContainer } from './composition/container'
import { createFixtureAdapterSet, fixtureClock } from './composition/fixtureAdapters'
import { AppProviders } from './providers/AppProviders'
import { createAppRoutes } from './routing/routes'

function renderCapture(path: string, highland = false) {
  const store = new FixtureStore({ latencyMs: 0 })
  const persistence = createBrowserSessionPersistence()
  persistence.save({ user: { id: highland ? 'USR-002' : 'USR-003', fullName: highland ? 'Nimal Silva' : 'Malini Fernando', email: 'supervisor@example.test', role: 'SUPERVISOR', estateIds: [highland ? 'EST-001' : 'EST-002'], divisionIds: [] }, source: 'fixtures', accessToken: null, signedInAt: '2026-10-21T09:00:00+05:30' }, false)
  const adapters = createFixtureAdapterSet(() => persistence.load()?.user.id ?? null, store)
  const container = assembleContainer({ dataSource: 'fixtures', apiBaseUrl: '', apiTimeoutMs: 15000 }, adapters, fixtureClock, persistence)
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] })
  render(<AppProviders container={container}><RouterProvider router={router} /></AppProviders>)
  return store
}

it('shows Capture query errors and recovers through the shared retry control', async () => {
  const store = renderCapture('/observations/OBS-005/metadata')
  store.failNext('conflict')
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('heading', { name: 'Capture Metadata' })).toBeInTheDocument()
  expect(screen.getByText('SYNC-005 · acknowledged')).toBeInTheDocument()
})

it('shows an empty assignment list rather than leaking Riverbend rows to Highland', async () => {
  renderCapture('/assignments', true)
  expect(await screen.findByText('No assignments in this status')).toBeInTheDocument()
  expect(screen.queryByText('ASG-001')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Create assignment' })).toBeInTheDocument()
})

it('keeps unspecified GPS and evidence data unavailable instead of inferring coordinates', async () => {
  renderCapture('/observations/OBS-023/gps')
  expect(await screen.findByText('Coordinates unavailable')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Copy coordinates' })).toBeDisabled()
  expect(screen.queryByText('6.980')).not.toBeInTheDocument()
})

it('offers record reload after a failed simulation and permits a fresh retry', async () => {
  const store = renderCapture('/assignments/ASG-001')
  store.write((db) => {
    const assignment = db.assignments.find((row) => row.id === 'ASG-001')!
    assignment.status = 'assigned'
    assignment.observationIds = []
  })
  const user = userEvent.setup()
  const start = await screen.findByRole('button', { name: 'Simulate: Field Worker starts task' })
  store.failNext('conflict')
  await user.click(start)
  await user.click(await screen.findByRole('button', { name: 'Reload latest assignment' }))
  await user.click(await screen.findByRole('button', { name: 'Simulate: Field Worker starts task' }))
  expect(await screen.findByRole('button', { name: 'Simulate: mobile submission received' })).toBeInTheDocument()
})

it('does not fabricate a receipt identifier or revision for the OBS-014 PDF variant', async () => {
  renderCapture('/observations/OBS-014/metadata')
  expect(await screen.findByRole('heading', { name: 'Capture Metadata' })).toBeInTheDocument()
  expect(screen.getAllByText('Not specified')).toHaveLength(2)
  expect(screen.queryByText(/undefined/)).not.toBeInTheDocument()
  expect(screen.getByText('IMG-014')).toBeInTheDocument()
})

it('keeps the required cancellation reason and error feedback in the dialog on failure', async () => {
  const store = renderCapture('/assignments/ASG-001')
  store.write((db) => { db.assignments[0].status = 'assigned'; db.assignments[0].observationIds = [] })
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Cancel assignment' }))
  await user.type(screen.getByRole('textbox', { name: 'Reason (required)' }), 'Duplicate of a planned survey')
  store.failNext('conflict')
  const buttons = screen.getAllByRole('button', { name: 'Cancel assignment' })
  await user.click(buttons[buttons.length - 1])
  expect(await screen.findByText(/Close this dialog and reload the latest assignment/)).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Reason (required)' })).toHaveValue('Duplicate of a planned survey')
  expect(store.read((db) => db.assignments[0].status)).toBe('assigned')
  await user.click(screen.getByRole('button', { name: 'Keep assignment' }))
  await user.click(screen.getByRole('button', { name: 'Reload latest assignment' }))
  expect(await screen.findByRole('button', { name: 'Simulate: Field Worker starts task' })).toBeInTheDocument()
})
