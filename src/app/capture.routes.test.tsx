import { render, screen, within } from '@testing-library/react'
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
  expect(await screen.findByRole('button', { name: 'Simulate: Field Worker submits observation' })).toBeInTheDocument()
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
  // An Assigned task the Field Worker has not accepted yet (ASG-001's seed records acceptance).
  store.write((db) => { db.assignments[0].status = 'assigned'; db.assignments[0].observationIds = []; db.assignments[0].acceptedAt = null })
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

it('rechecks worker availability on save: a draft cannot be assigned to a worker who became busy meanwhile', async () => {
  const store = renderCapture('/assignments/ASG-004/edit')
  const user = userEvent.setup()
  await user.type(await screen.findByRole('textbox', { name: 'Instructions' }), 'Photograph the north boundary.')
  await user.click(screen.getByRole('radio', { name: /Kasun Perera/ }))
  // Elsewhere, Kasun receives another assignment while this form is open.
  store.write((db) => {
    db.assignments.push({ ...structuredClone(db.assignments.find((a) => a.id === 'ASG-002')!), id: 'ASG-099', divisionId: 'DIV-005', fieldWorkerId: 'USR-014', title: 'Parallel task' })
  })
  await user.click(screen.getByRole('button', { name: 'Assign task' }))
  expect((await screen.findAllByText(/Kasun Perera already has an active assignment \(ASG-099/)).length).toBeGreaterThan(0)
  expect(store.read((db) => db.assignments.find((a) => a.id === 'ASG-004'))).toMatchObject({ status: 'draft', fieldWorkerId: null, version: 1 })
})

it('shows Edit draft and Cancel draft for a Draft', async () => {
  renderCapture('/assignments/ASG-004')
  expect(await screen.findByRole('link', { name: 'Edit draft' })).toHaveAttribute('href', '/assignments/ASG-004/edit')
  expect(screen.getByRole('button', { name: 'Cancel draft' })).toBeInTheDocument()
})

it('creates one Task for several available Field Workers of a division, after a review step', async () => {
  const store = renderCapture('/assignments/new')
  const user = userEvent.setup()
  const workers = await screen.findByRole('group', { name: 'Field Workers in DIV-005' })
  // Only the division's workers are listed; Ravindu Kumara (DIV-006) is not. Hiruni is busy with ASG-003.
  expect(within(workers).getAllByRole('checkbox').map((box) => box.closest('label')?.querySelector('span:not([aria-hidden])')?.textContent ?? box.closest('label')?.textContent)).toHaveLength(4)
  expect(within(workers).getByRole('checkbox', { name: /Hiruni Nadeesha/ })).toBeDisabled()
  expect(within(workers).getByText(/Active assignment: ASG-003 · In progress/)).toBeInTheDocument()
  // The first available worker (Kasun) is preselected.
  expect(screen.getByText('1 selected')).toBeInTheDocument()
  await user.click(within(workers).getByRole('checkbox', { name: /Nethmi Silva/ }))
  await user.click(within(workers).getByRole('checkbox', { name: /Tharindu Jayasuriya/ }))
  expect(screen.getByText('3 selected')).toBeInTheDocument()
  // Changing the division keeps only workers who belong to it.
  await user.click(screen.getByRole('radio', { name: 'DIV-006 · West Terrace' }))
  expect(screen.getByText(/Kasun Perera, Nethmi Silva are not in DIV-006/)).toBeInTheDocument()
  expect(screen.getByText('1 selected')).toBeInTheDocument()
  await user.click(screen.getByRole('radio', { name: 'DIV-005 · East Hills' }))
  await user.click(screen.getByRole('checkbox', { name: /Kasun Perera/ }))
  await user.click(screen.getByRole('checkbox', { name: /Nethmi Silva/ }))
  await user.click(screen.getByRole('button', { name: 'Remove Nethmi Silva' }))
  expect(screen.getByText('2 selected')).toBeInTheDocument()
  // Task type: a category loads its task inputs; no checklist and no GPS input.
  await user.click(screen.getByRole('radio', { name: /^Task/ }))
  await user.selectOptions(screen.getByRole('combobox', { name: 'Task category' }), 'TPL-FERT')
  expect(screen.getByRole('textbox', { name: 'Task title' })).toHaveValue('Fertilizer Application')
  expect(screen.getByRole('textbox', { name: 'Input 1 name' })).toHaveValue('Fertilizer product')
  expect(screen.queryByText(/Checklist/)).not.toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'GPS location' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Review & assign' }))
  const dialog = await screen.findByRole('dialog', { name: 'Review assignment' })
  expect(within(dialog).getByText('Tharindu Jayasuriya, Kasun Perera')).toBeInTheDocument()
  await user.click(within(dialog).getByRole('button', { name: 'Confirm and assign to 2 workers' }))
  expect(await screen.findByRole('heading', { name: /ASG-008 · Fertilizer Application/ })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'ASG-009 · Kasun Perera' })).toBeInTheDocument()
  expect(store.read((db) => db.assignments.filter((a) => a.groupId === 'GRP-ASG-008').map((a) => [a.fieldWorkerId, a.type]))).toEqual([['USR-016', 'task'], ['USR-014', 'task']])
})

it('shows the Inspection observation form, not task inputs, and asks for no GPS coordinates', async () => {
  renderCapture('/assignments/new')
  expect(await screen.findByRole('radio', { name: /^Inspection/ })).toBeChecked()
  const form = screen.getByRole('table', { name: 'Observation form completed by the Field Worker' })
  for (const section of ['Observation details', 'Location', 'Disease details', 'Symptoms', 'Severity', 'Leaf details', 'Photos', 'Additional details', 'Submission']) expect(within(form).getByText(section)).toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: /GPS|Latitude|Longitude/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Add task input' })).not.toBeInTheDocument()
})
