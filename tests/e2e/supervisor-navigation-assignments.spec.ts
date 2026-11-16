import { expect, test, type Page } from '@playwright/test'
test.setTimeout(60_000)

async function signIn(page: Page) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email or username' }).fill('malini.fernando')
  await page.getByLabel('Password', { exact: true }).fill('tealeaf-dev-only')
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login/)
}
const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' })
const SUPERVISOR_ITEMS = ['Dashboard', 'Review Queue', 'Quarantine Queue', 'Decision History', 'Fieldwork Assignments']

test('every Supervisor page shows the same five sidebar items, with the right one highlighted', async ({ page }) => {
  await signIn(page)
  const pages: Array<[string, string]> = [
    ['/review', 'Dashboard'], ['/review/queue', 'Review Queue'], ['/review/observations/OBS-014', 'Review Queue'],
    ['/review/corrections', 'Review Queue'], ['/review/corrections/COR-005', 'Review Queue'], ['/review/referrals', 'Review Queue'],
    ['/observations/OBS-005/evidence', 'Review Queue'], ['/review/quarantine', 'Quarantine Queue'], ['/review/history', 'Decision History'],
    ['/assignments', 'Fieldwork Assignments'], ['/assignments/ASG-001', 'Fieldwork Assignments'], ['/assignments/new', 'Fieldwork Assignments'],
  ]
  for (const [path, active] of pages) {
    await page.goto(path)
    await expect(page.locator('main h1').first()).toBeVisible()
    await expect(nav(page).getByRole('link')).toHaveText(SUPERVISOR_ITEMS)
    await expect(nav(page).getByRole('link', { name: active })).toHaveClass(/active/)
  }
})

test('Correction Queue, Expert Referrals and Evidence Viewer stay reachable from the review workflow', async ({ page }) => {
  await signIn(page)
  await nav(page).getByRole('link', { name: 'Review Queue' }).click()
  await page.getByRole('link', { name: 'Correction Queue', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Correction Queue' })).toBeVisible()
  await nav(page).getByRole('link', { name: 'Review Queue' }).click()
  await page.getByRole('link', { name: 'Expert Referrals', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Expert Referral Status' })).toBeVisible()
  await page.goto('/review/observations/OBS-014')
  await page.getByRole('link', { name: 'Open evidence viewer' }).click()
  await expect(page.getByRole('heading', { name: 'Observation Evidence Viewer' })).toBeVisible()
})

test('a Draft can be edited and cancelled; changes survive a refresh', async ({ page }) => {
  await signIn(page)
  await page.goto('/assignments/ASG-004')
  await page.getByRole('link', { name: 'Edit draft' }).click()
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Walk Riverbank lower boundary (north)')
  // ASG-004's summary fixture has no instructions; drafts need them, as on the create form.
  await page.getByRole('textbox', { name: 'Instructions', exact: true }).fill('Photograph the north boundary.')
  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(page.getByRole('heading', { name: /ASG-004 · Walk Riverbank lower boundary \(north\)/ })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: /ASG-004 · Walk Riverbank lower boundary \(north\)/ })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel draft' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Cancel draft' }).click()
  await expect(dialog.getByText('Enter a cancellation reason')).toBeVisible()
  await dialog.getByRole('textbox', { name: 'Reason (required)' }).fill('Merged into another survey')
  await dialog.getByRole('button', { name: 'Cancel draft' }).click()
  await expect(page.getByText('Draft cancelled', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancel draft' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /^Edit/ })).toHaveCount(0)
})

test('an Assigned task can be edited until the Field Worker accepts it, then edit and cancel are locked', async ({ page }) => {
  await signIn(page)
  await page.goto('/assignments/ASG-002')
  await expect(page.getByText('Not yet accepted', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Edit / reassign' }).click()
  await page.getByRole('textbox', { name: 'Instructions', exact: true }).fill('Re-photograph the flagged area at noon.')
  await page.getByRole('textbox', { name: 'Reason for change (required)' }).fill('Better light at noon')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Assignment updated', { exact: true })).toBeVisible()
  await expect(page.getByText('Re-photograph the flagged area at noon.')).toBeVisible()

  await page.getByRole('button', { name: 'Simulate: Field Worker accepts task' }).click()
  await expect(page.getByText('This assignment can no longer be modified because the Field Worker has accepted it.')).toBeVisible()
  await expect(page.getByRole('link', { name: /^Edit/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Cancel assignment' })).toHaveCount(0)
  // Alternative entry point: the edit URL is refused too.
  await page.goto('/assignments/ASG-002/edit')
  await expect(page.getByRole('heading', { name: 'Editing unavailable' })).toBeVisible()
})

test('In progress and Completed assignments offer no Edit or Cancel and keep their history', async ({ page }) => {
  await signIn(page)
  for (const id of ['ASG-003', 'ASG-005']) {
    await page.goto(`/assignments/${id}`)
    await expect(page.getByRole('heading', { name: new RegExp(id) })).toBeVisible()
    await expect(page.getByRole('link', { name: /^Edit/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Cancel/ })).toHaveCount(0)
    await page.goto(`/assignments/${id}/edit`)
    await expect(page.getByRole('heading', { name: 'Editing unavailable' })).toBeVisible()
  }
  await page.goto('/assignments/ASG-001')
  await expect(page.getByText('15 Oct 2026 13:40 · Task started in mobile app (simulated)')).toBeVisible()
})
