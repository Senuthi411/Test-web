import { expect, test, type Page } from '@playwright/test'
test.setTimeout(120_000)

async function signIn(page: Page) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email or username' }).fill('malini.fernando')
  await page.getByLabel('Password', { exact: true }).fill('tealeaf-dev-only')
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' })
const reviewStatus = (page: Page) => page.getByText('Review status', { exact: true }).locator('..')

/** Resubmitted → In review: the Supervisor starts the review of the new revision. */
async function startReview(page: Page) {
  await expect(reviewStatus(page)).toContainText('Resubmitted')
  await page.getByRole('button', { name: 'Start review' }).click()
  await expect(reviewStatus(page)).toContainText('In review')
  await expect(page.getByRole('link', { name: 'Request correction' })).toBeVisible()
}
const queueRow = (page: Page, id: string) => page.locator('tr', { has: page.getByRole('link', { name: id, exact: true }) })

async function requestCorrection(page: Page, id: string, item: string, message: string) {
  await page.goto(`/review/observations/${id}`)
  await page.getByRole('link', { name: 'Request correction' }).click()
  await page.getByRole('checkbox', { name: item }).check()
  await page.getByRole('textbox', { name: /Message to field worker/ }).fill(message)
  await page.getByRole('button', { name: 'Send correction request' }).click()
  await expect(page.getByRole('heading', { name: /^Correction COR-/ })).toBeVisible()
}

async function simulateResubmission(page: Page, id: string, version: number) {
  await page.goto(`/review/observations/${id}`)
  await page.getByRole('button', { name: 'Simulate: Field Worker resubmits correction' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Corrected field note' }).fill(`Corrected note for version ${version}`)
  await dialog.getByRole('button', { name: `Resubmit version ${version}` }).click()
  await expect(page.getByText(`Reviewing version ${version} · ${id.replace('OBS-', 'OBSR-')}-${version}`)).toBeVisible()
}

test('a first-time submission and a resubmission share the Review Queue, compare side by side, and keep their history', async ({ page }) => {
  await signIn(page)
  // 1, 5: Submitted and Resubmitted observations in the same queue; the sidebar is unchanged.
  await nav(page).getByRole('link', { name: 'Review Queue' }).click()
  await expect(nav(page).getByRole('link')).toHaveText(['Dashboard', 'Review Queue', 'Quarantine Queue', 'Decision History', 'Fieldwork Assignments'])
  await expect(queueRow(page, 'OBS-005')).toContainText('Resubmitted')
  await expect(queueRow(page, 'OBS-005')).toContainText('V2')
  await page.getByRole('tab', { name: /Resubmitted/ }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)

  // 2–3: request a correction on OBS-033 (version 1).
  await requestCorrection(page, 'OBS-033', 'Retake a clearer image', 'Please retake a clearer image.')
  await page.goto('/review/queue?status=correction_requested')
  await expect(queueRow(page, 'OBS-033')).toContainText('Correction requested')

  // 4–5: the Field Worker resubmits (simulated); it appears as Resubmitted, still one row.
  await simulateResubmission(page, 'OBS-033', 2)
  await page.goto('/review/queue?status=resubmitted')
  await expect(queueRow(page, 'OBS-033')).toContainText('Resubmitted')
  await expect(queueRow(page, 'OBS-033')).toContainText('V2')
  await expect(page.getByRole('link', { name: 'OBS-033', exact: true })).toHaveCount(1)

  // 6–9: side-by-side comparison, modified fields highlighted, unchanged fields visible.
  await page.getByRole('link', { name: 'OBS-033', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Previous revision: version 1' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Compared revision: version 2' })).toContainText('Currently reviewing')
  await expect(page.locator('tr', { has: page.getByRole('rowheader', { name: 'Photograph' }) })).toContainText('Changed')
  await expect(page.locator('tr', { has: page.getByRole('rowheader', { name: 'Field notes' }) })).toContainText('Changed')
  await expect(page.locator('tr', { has: page.getByRole('rowheader', { name: 'Suspected disease' }) })).toContainText('No change')
  await expect(page.getByRole('region', { name: /Correction request COR-033/ })).toContainText('Correction requested on version 1')
  await page.getByRole('button', { name: 'View larger photo' }).click()
  await expect(page.getByRole('dialog', { name: /Version 2 photograph/ })).toBeVisible()
  await page.keyboard.press('Escape')
  // Opening did not change the status; starting the review does.
  await expect(page.getByRole('link', { name: 'Verify observation' })).toHaveCount(0)
  await startReview(page)
  await page.goto('/review/queue?status=in_review')
  await expect(queueRow(page, 'OBS-033')).toContainText('V2 · resubmission')

  // 13–14: request another correction; version 3 is compared with version 2 by default.
  await requestCorrection(page, 'OBS-033', 'Confirm symptom details', 'Please confirm the symptoms.')
  await simulateResubmission(page, 'OBS-033', 3)
  await expect(page.getByRole('region', { name: 'Previous revision: version 2' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Compared revision: version 3' })).toBeVisible()
  // 15: older revisions stay accessible.
  await page.getByRole('button', { name: 'Inspect version 1' }).click()
  await expect(page.getByRole('region', { name: 'Previous revision: version 1' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Revision history' }).locator('tbody tr')).toHaveCount(3)

  // 10: start the review of version 3 and verify it.
  await startReview(page)
  await page.getByRole('link', { name: 'Verify observation' }).click()
  await expect(page.getByRole('heading', { name: 'Verification checklist' })).toBeVisible()
  for (const box of await page.getByRole('checkbox').all()) await box.check()
  await page.getByRole('button', { name: 'Confirm verification' }).click()
  await expect(page.getByText('OBS-033 verified')).toBeVisible()

  // 16: every decision is in the existing Decision History, on its own revision.
  await nav(page).getByRole('link', { name: 'Decision History' }).click()
  await page.getByRole('searchbox', { name: 'Search decisions' }).fill('OBS-033')
  const history = page.getByRole('table', { name: 'Decision history' })
  await expect(history.locator('tbody tr')).toHaveCount(3)
  await expect(history).toContainText('V1 · OBSR-033-1')
  await expect(history).toContainText('V2 · OBSR-033-2')
  await expect(history).toContainText('V3 · OBSR-033-3')

  // 17: revision information in the existing Observation (Capture) revision history.
  await page.goto('/observations/OBS-033/revisions')
  await expect(page.getByRole('table', { name: 'Revisions', exact: true }).locator('tbody tr')).toHaveCount(3)

  // 18: no duplicate observations in the dashboard statistics.
  await nav(page).getByRole('link', { name: 'Dashboard' }).click()
  await expect(page.getByText(/15 observations in your scope/)).toBeVisible()

  // 20: a refresh keeps the revisions and decisions.
  await page.goto('/review/observations/OBS-033')
  await page.reload()
  await expect(page.getByText('Review status', { exact: true }).locator('..')).toContainText('Verified')
  await expect(page.getByRole('table', { name: 'Revision history' }).locator('tbody tr')).toHaveCount(3)
})

test('a resubmitted observation can be flagged (rejected) or referred, like any other', async ({ page }) => {
  await signIn(page)
  // The queue's Start review action opens the review and moves Resubmitted to In review.
  await page.goto('/review/queue?status=resubmitted')
  await page.getByRole('button', { name: 'Actions for OBS-005' }).click()
  await page.getByRole('menuitem', { name: 'Start review' }).click()
  await expect(reviewStatus(page)).toContainText('In review')
  await expect(page.getByRole('table', { name: 'Decisions on this observation' })).toContainText('Retake clearer image')
  await page.getByRole('link', { name: 'Flag observation' }).click()
  await page.getByRole('textbox', { name: /Explanation/ }).fill('Revised note still does not match the image')
  await page.getByRole('button', { name: 'Flag observation' }).click()
  await expect(page.getByText('OBS-005 flagged')).toBeVisible()
  await page.goto('/review/history')
  await expect(page.locator('tr', { hasText: 'OBS-005' }).first()).toContainText('V2 · OBSR-005-2')

  await page.goto('/review/observations/OBS-041')
  await simulateResubmission(page, 'OBS-041', 2)
  await startReview(page)
  await page.getByRole('link', { name: 'Refer to expert' }).click()
  await page.getByRole('textbox', { name: /Referral note/ }).fill('Expert confirmation needed for the corrected revision')
  await page.getByRole('button', { name: 'Send referral' }).click()
  await expect(page.getByText('Referral REF-041 sent', { exact: true })).toBeVisible()
})

test('a normal submitted observation keeps the existing review without a comparison', async ({ page }) => {
  await signIn(page)
  await page.goto('/review/queue?status=submitted')
  await page.getByRole('link', { name: 'OBS-013', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Observation Review · OBS-013' })).toBeVisible()
  await expect(page.getByText('Revision comparison')).toHaveCount(0)
  for (const name of ['Verify observation', 'Flag observation', 'Request correction', 'Refer to expert']) {
    await expect(page.getByRole('link', { name })).toBeVisible()
  }
})

for (const width of [1366, 390]) {
  test(`the revision comparison fits ${width}px without page-level horizontal scroll`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await signIn(page)
    await page.goto('/review/observations/OBS-005')
    await expect(page.getByRole('region', { name: 'Compared revision: version 2' })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })
}
