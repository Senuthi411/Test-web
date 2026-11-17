import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { FixtureStore } from '@/fixtures'
import { createBrowserSessionPersistence } from '@/features/identity'
import { AppError } from '@/shared/api'
import { assembleContainer } from './composition/container'
import type { AppConfig } from './composition/config'
import { createFixtureAdapterSet, fixtureClock } from './composition/fixtureAdapters'
import { AppProviders } from './providers/AppProviders'
import { createAppRoutes } from './routing/routes'

const FIXTURE_CONFIG: AppConfig = { dataSource: 'fixtures', apiBaseUrl: '', apiTimeoutMs: 15_000 }
const API_CONFIG: AppConfig = { dataSource: 'api', apiBaseUrl: 'http://localhost:3000/api/v1', apiTimeoutMs: 15_000 }

type AdapterSet = ReturnType<typeof createFixtureAdapterSet>

function renderApp(path: string, options: { config?: AppConfig; prepare?: (adapters: AdapterSet) => void } = {}) {
  createBrowserSessionPersistence().save({
    user: { id: 'USR-001', fullName: 'Anika Perera', email: 'anika.perera@example.test', role: 'ADMINISTRATOR', estateIds: ['EST-001', 'EST-002', 'EST-003'], divisionIds: [] },
    accessToken: null,
    source: options.config?.dataSource === 'api' ? 'api' : 'fixtures',
    signedInAt: '2026-10-21T09:00:00+05:30',
  })
  const store = new FixtureStore({ latencyMs: 0 })
  const persistence = createBrowserSessionPersistence()
  const adapters = createFixtureAdapterSet(() => persistence.load()?.user.id ?? null, store)
  options.prepare?.(adapters)
  const container = assembleContainer(options.config ?? FIXTURE_CONFIG, adapters, fixtureClock, persistence)
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] })
  render(
    <AppProviders container={container}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { router, store }
}

const pending = () => Promise.reject(new AppError('contract_pending', 'Not connected.'))
const button = (name: string) => screen.getByRole('button', { name })

describe('System Settings', { timeout: 30_000 }, () => {
  it('opens on General Settings with six tabs, a demonstration label and nothing to publish yet', async () => {
    renderApp('/admin/settings')
    expect(await screen.findByRole('heading', { name: 'System Settings', level: 1 }, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'General Settings',
      'Feature Center',
      'Business Rules',
      'Workflow Configuration',
      'Maintenance Mode',
      'Configuration History',
    ])
    expect(await screen.findByText('Demonstration mode · UI only', {}, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.getByText(/Version 1 in effect · baseline/)).toBeInTheDocument()
    expect(button('Publish')).toBeDisabled()
    expect(button('Save draft')).toBeDisabled()
    expect(screen.getByLabelText(/Organization name/)).toHaveValue('TeaLeaf Field Scout')
  })

  it('saves a draft, validates, previews and publishes it with a reason as a new audited version', async () => {
    const user = userEvent.setup()
    const { store } = renderApp('/admin/settings')
    const name = await screen.findByLabelText(/Organization name/, {}, { timeout: 10_000 })
    await user.clear(name)
    await user.type(name, 'TeaLeaf Estates')
    expect(screen.getByText(/unsaved changes/)).toBeInTheDocument()
    expect(screen.getByText('Save the draft before publishing.')).toBeInTheDocument()
    await user.click(button('Save draft'))
    expect(await screen.findByText('Draft saved')).toBeInTheDocument()
    expect(await screen.findByText('Ready to publish.')).toBeInTheDocument()

    await user.click(button('Validate'))
    expect(screen.getByText('No problems found')).toBeInTheDocument()
    await user.click(button('Preview changes'))
    const preview = await screen.findByRole('dialog', { name: 'Preview changes' })
    expect(within(preview).getByText('TeaLeaf Estates')).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await user.click(button('Publish'))
    const dialog = await screen.findByRole('dialog', { name: 'Publish version 2?' })
    await user.click(within(dialog).getByRole('button', { name: 'Publish' }))
    expect(await within(dialog).findByText('Enter the reason for this change')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText(/Reason for this change/), 'Company rename')
    await user.click(within(dialog).getByRole('button', { name: 'Publish' }))
    expect(await screen.findByText('Version 2 published')).toBeInTheDocument()
    expect(await screen.findByText(/Version 2 in effect · published by Anika Perera/)).toBeInTheDocument()
    expect(store.read((db) => db.auditEvents.filter((event) => event.kind.startsWith('configuration_')).map((event) => event.kind))).toEqual([
      'configuration_draft_saved',
      'configuration_published',
    ])
  })

  it('keeps protected features read-only and lets Notifications change in the draft', async () => {
    const user = userEvent.setup()
    renderApp('/admin/settings?tab=features')
    const center = await screen.findByRole('region', { name: 'Feature Center' }, { timeout: 10_000 })
    for (const label of ['GPS Validation on', 'Offline Mode on', 'Image Upload on']) expect(within(center).getByRole('switch', { name: label })).toBeDisabled()
    const notifications = within(center).getByRole('switch', { name: 'Notifications off' })
    expect(notifications).toBeEnabled()
    await user.click(notifications)
    expect(within(center).getByRole('switch', { name: 'Notifications on' })).toBeChecked()
    expect(screen.getByText(/1 change: Feature Center from version 1/)).toBeInTheDocument()
  })

  it('shows the three rule templates, blocks Rule A and validates Rule C before it can be published', async () => {
    const user = userEvent.setup()
    renderApp('/admin/settings?tab=rules')
    const ruleA = await screen.findByRole('region', { name: 'Rule A · High Severity Notification' }, { timeout: 10_000 })
    expect(within(ruleA).getByText('Blocked')).toBeInTheDocument()
    expect(within(ruleA).getByRole('switch', { name: /Enable rule/ })).toBeDisabled()
    expect(within(ruleA).getByText(/Observations have no severity field yet/)).toBeInTheDocument()

    const ruleC = screen.getByRole('region', { name: 'Rule C · Pending Review Reminder' })
    const threshold = within(ruleC).getByLabelText(/Reminder threshold/)
    expect(threshold).toHaveValue(null)
    expect(within(ruleC).getByText(/A 48-hour default has been proposed but not approved/)).toBeInTheDocument()
    await user.click(within(ruleC).getByRole('switch', { name: /Enable rule/ }))
    expect(within(ruleC).getByText('Set the reminder threshold before enabling the rule')).toBeInTheDocument()
    expect(within(ruleC).getByText('Turn on Notifications in the Feature Center to send reminders')).toBeInTheDocument()
    await user.type(threshold, '48')
    expect(within(ruleC).getByLabelText(`Preview of Rule C`)).toHaveTextContent('When an observation has waited for review longer than 48 hours, remind Supervisor.')
    await user.click(button('Save draft'))
    expect(await screen.findByText('Draft saved')).toBeInTheDocument()
    // Still invalid: Notifications are off, so the draft cannot be published.
    expect(await screen.findByText('Fix the problems found by validation before publishing.')).toBeInTheDocument()
    expect(button('Publish')).toBeDisabled()
    expect(screen.queryByRole('textbox', { name: /script|query|expression/i })).not.toBeInTheDocument()
  })

  it('shows workflows as protected state machines and never activates maintenance mode', async () => {
    const user = userEvent.setup()
    renderApp('/admin/settings?tab=workflows')
    const review = await screen.findByRole('region', { name: 'Observation review workflow' }, { timeout: 10_000 })
    expect(within(within(review).getByRole('list', { name: 'Observation review states' })).getAllByRole('listitem')).toHaveLength(6)
    expect(within(review).getByLabelText(/Review target \(hours\)/)).toHaveValue(null)
    await user.click(screen.getByRole('tab', { name: 'Maintenance Mode' }))
    const maintenance = await screen.findByRole('region', { name: 'Maintenance mode' })
    expect(within(maintenance).getByText('Off')).toBeInTheDocument()
    expect(within(maintenance).getByRole('button', { name: 'Activate maintenance mode' })).toBeDisabled()
  })

  it('compares versions and rolls back by creating a new version', async () => {
    const user = userEvent.setup()
    const { store } = renderApp('/admin/settings')
    const name = await screen.findByLabelText(/Organization name/, {}, { timeout: 10_000 })
    await user.clear(name)
    await user.type(name, 'TeaLeaf Estates')
    await user.click(button('Save draft'))
    await screen.findByText('Ready to publish.')
    await user.click(button('Publish'))
    const dialog = await screen.findByRole('dialog', { name: 'Publish version 2?' })
    await user.type(within(dialog).getByLabelText(/Reason for this change/), 'Company rename')
    await user.click(within(dialog).getByRole('button', { name: 'Publish' }))
    await screen.findByText('Version 2 published')

    await user.click(screen.getByRole('tab', { name: 'Configuration History' }))
    const versions = await screen.findByRole('table', { name: 'Configuration versions' })
    expect(within(versions).getAllByRole('row')).toHaveLength(3)
    const compare = screen.getByRole('region', { name: 'Compare versions' })
    expect(within(compare).getByText('1 change: General Settings')).toBeInTheDocument()

    await user.click(within(versions).getByRole('button', { name: 'Roll back to version 1' }))
    const confirm = await screen.findByRole('dialog', { name: 'Roll back to version 1?' })
    await user.type(within(confirm).getByLabelText(/Reason/), 'Rename not approved')
    await user.click(within(confirm).getByRole('button', { name: 'Create rollback version' }))
    expect(await screen.findByText('Version 3 created')).toBeInTheDocument()
    expect(await within(screen.getByRole('table', { name: 'Configuration versions' })).findByText('Rollback to version 1')).toBeInTheDocument()
    expect(store.read((db) => db.configurationVersions.map((version) => version.version))).toEqual([1, 2, 3])
  })

  it('shows the configuration as unavailable in API mode, with nothing to save or publish', async () => {
    renderApp('/admin/settings', {
      config: API_CONFIG,
      prepare: (adapters) => {
        adapters.identity.configuration.getConfiguration = pending
      },
    })
    expect(await screen.findByText(/backend configuration contract has not been approved/, {}, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Demonstration mode/)).not.toBeInTheDocument()
  })
})

describe('Audit Logs', { timeout: 30_000 }, () => {
  it('lists the shared audit records read-only, filters them and opens a record’s details', async () => {
    const user = userEvent.setup()
    renderApp('/admin/audit-logs')
    expect(await screen.findByRole('heading', { name: 'Audit Logs', level: 1 }, { timeout: 10_000 })).toBeInTheDocument()
    const table = await screen.findByRole('table', { name: 'Administrative audit log' }, { timeout: 10_000 })
    expect(within(table).getByText('Division reviewed')).toBeInTheDocument()
    expect(within(table).getByText('Device session revoked')).toBeInTheDocument()
    expect(screen.getByText(/4 records · demonstration data/)).toBeInTheDocument()

    await user.click(screen.getByRole('combobox', { name: /^Module:/ }))
    await user.click(within(screen.getByRole('listbox', { name: 'Module' })).getByRole('option', { name: 'Divisions' }))
    expect(screen.getByText(/1 record match the filters \(of 4\)/)).toBeInTheDocument()
    expect(within(table).queryByText('Device session revoked')).not.toBeInTheDocument()
    await user.click(button('Clear filters'))

    await user.type(screen.getByRole('searchbox', { name: 'Search administrative audit log' }), 'Tara')
    expect(within(table).getByText('Scope changed')).toBeInTheDocument()
    await user.click(within(table).getByRole('button', { name: 'View details of record AUD-004' }))
    const dialog = await screen.findByRole('dialog', { name: 'Audit record' })
    expect(within(dialog).getByText('Dr Tara Wijesinghe')).toBeInTheDocument()
    expect(within(dialog).getAllByText('EST-001, EST-002').length).toBeGreaterThan(0)
    // Read-only: no edit or delete of audit records.
    expect(screen.queryByRole('button', { name: /delete|edit/i })).not.toBeInTheDocument()
  })

  it('records configuration actions in the same audit log', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/admin/settings')
    const email = await screen.findByLabelText(/Support e-mail/, {}, { timeout: 10_000 })
    await user.type(email, 'help@example.test')
    await user.click(button('Save draft'))
    await screen.findByText('Draft saved')
    await router.navigate('/admin/audit-logs')
    const table = await screen.findByRole('table', { name: 'Administrative audit log' }, { timeout: 10_000 })
    expect(await within(table).findByText('Configuration draft saved')).toBeInTheDocument()
    expect(within(table).getByText('Configuration draft')).toBeInTheDocument()
  })

  it('shows the audit log as unavailable when its contract is pending', async () => {
    renderApp('/admin/audit-logs', {
      prepare: (adapters) => {
        adapters.identity.auditLog.listAuditLog = pending
      },
    })
    expect(await screen.findByText(/The audit log is not available yet/, {}, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Administrative audit log' })).not.toBeInTheDocument()
  })
})
