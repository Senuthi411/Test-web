import { expect, test, type Page } from '@playwright/test'
test.setTimeout(120_000)

async function signIn(page: Page) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'User ID' }).fill('USR-003')
  await page.getByLabel('Password', { exact: true }).fill('tealeaf-dev-only')
  await page.getByRole('button', { name: 'Log In', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' })
const reviewStatus = (page: Page) => page.getByText('Review status', { exact: true }).locator('..')
const queueRow = (page: Page, id: string) => page.locator('tr', { has: page.getByRole('link', { name: id, exact: true }) })

/** Resubmitted → In Review: the Supervisor starts the review of the new revision (with confirmation). */
async function startReview(page: Page) {
  await expect(reviewStatus(page)).toContainText('Resubmitted')
  await page.getByRole('button', { name: 'Start Review' }).click()
  await page.getByRole('button', { name: 'Confirm Review' }).click()
  await expect(reviewStatus(page)).toContainText('In Review')
  // In Review offers Verify and Flag; Request Correction needs a Flagged observation.
  await expect(page.getByRole('link', { name: 'Verify Observation' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Request Correction' })).toHaveCount(0)
}

/** In Review → Flagged → Correction Requested. Ends on the correction's page, where the worker's resubmission is simulated. */
async function requestCorrection(page: Page, id: string, item: string, message: string) {
  await page.goto(`/review/observations/${id}`)
  await page.getByRole('link', { name: 'Flag Observation' }).click()
  await page.getByRole('textbox', { name: /Explanation/ }).fill('The submitted revision needs a correction.')
  await page.getByRole('button', { name: 'Flag observation' }).click()
  await expect(reviewStatus(page)).toContainText('Flagged')
  await page.getByRole('link', { name: 'Request Correction' }).click()
  await page.getByRole('checkbox', { name: item }).check()
  await page.getByRole('textbox', { name: /Message to field worker/ }).fill(message)
  await page.getByRole('button', { name: 'Send correction request' }).click()
  await expect(page.getByRole('heading', { name: /^Correction COR-/ })).toBeVisible()
}

/** Fixture-only stand-in for the mobile app: the Field Worker resubmits, from the correction's page. */
async function simulateResubmission(page: Page, version: number) {
  await page.getByRole('button', { name: 'Simulate: Field Worker resubmits correction' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Corrected field note' }).fill(`Corrected note for version ${version}`)
  await dialog.getByRole('button', { name: `Resubmit version ${version}` }).click()
  await expect(page.getByRole('link', { name: 'Compare revisions' })).toBeVisible()
}

test('a first-time submission and a resubmission share the Review Queue, compare side by side, and keep their history', async ({ page }) => {
  await signIn(page)
  // 1, 5: Submitted and Resubmitted observations in the same queue; the sidebar is unchanged.
  await nav(page).getByRole('link', { name: 'Observation Review' }).click()
  await expect(nav(page).getByRole('link')).toHaveText(['Dashboard', 'Observation Review', 'Division Quarantine', 'Decision History', 'Fieldwork Assignments', 'My Profile'])
  await expect(queueRow(page, 'OBS-005')).toContainText('Resubmitted')
  await page.getByRole('tab', { name: /Resubmitted/ }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  // The Resubmitted section offers Compare and Review actions (the version is shown on the comparison).
  await expect(page.getByRole('link', { name: /^Compare OBS-005/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Review OBS-005/ })).toBeVisible()

  // 2–3: flag OBS-033 and request a correction (version 1).
  await page.goto('/review/observations/OBS-033')
  await expect(reviewStatus(page)).toContainText('In Review')
  await requestCorrection(page, 'OBS-033', 'Retake a clearer image', 'Please retake a clearer image.')
  await page.goto('/review/queue?status=correction_requested')
  await expect(queueRow(page, 'OBS-033')).toContainText('Correction Requested')

  // 4–5: the Field Worker resubmits (simulated); it appears as Resubmitted, still one row.
  await page.goto('/review/corrections/COR-033')
  await simulateResubmission(page, 2)
  await page.goto('/review/queue?status=resubmitted')
  await expect(queueRow(page, 'OBS-033')).toContainText('Resubmitted')
  await expect(page.getByRole('link', { name: 'OBS-033', exact: true })).toHaveCount(1)

  // 6–9: side-by-side comparison, modified fields highlighted, unchanged fields visible.
  await page.getByRole('link', { name: /^Compare OBS-033/ }).click()
  await expect(page).toHaveURL(/\/review\/observations\/OBS-033\/compare$/)
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
  await page.goto('/review/observations/OBS-033')
  await expect(page.getByRole('link', { name: 'Verify Observation' })).toHaveCount(0)
  await startReview(page)
  await page.goto('/review/queue?status=in_review')
  await expect(queueRow(page, 'OBS-033')).toContainText('In Review')

  // 13–14: request another correction; version 3 is compared with version 2 by default.
  await requestCorrection(page, 'OBS-033', 'Confirm symptom details', 'Please confirm the symptoms.')
  await simulateResubmission(page, 3)
  await page.goto('/review/observations/OBS-033/compare')
  await expect(page.getByRole('region', { name: 'Previous revision: version 2' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Compared revision: version 3' })).toBeVisible()
  // 15: older revisions stay accessible.
  await page.getByRole('button', { name: 'Inspect version 1' }).click()
  await expect(page.getByRole('region', { name: 'Previous revision: version 1' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Revision history' }).locator('tbody tr')).toHaveCount(3)

  // 10: start the review of version 3 and verify it.
  await page.goto('/review/observations/OBS-033')
  await startReview(page)
  await page.getByRole('link', { name: 'Verify Observation' }).click()
  await page.getByRole('button', { name: 'Confirm verification' }).click()
  await expect(page.getByText('OBS-033 verified')).toBeVisible()

  // 16: every decision is in the observation's decision log, on its own revision, with its status change.
  await page.goto('/review/observations/OBS-033')
  const log = page.getByRole('table', { name: 'Decisions on this observation' })
  await expect(log.locator('tbody tr')).toHaveCount(9)
  await expect(log).toContainText('V1 · OBSR-033-1')
  await expect(log).toContainText('V2 · OBSR-033-2')
  await expect(log).toContainText('V3 · OBSR-033-3')
  await expect(log).toContainText('Resubmitted → In Review')
  await expect(log).toContainText('In Review → Verified')

  // 17: revision information in the existing Observation (Capture) revision history.
  await page.goto('/observations/OBS-033/revisions')
  await expect(page.getByRole('table', { name: 'Revisions', exact: true }).locator('tbody tr')).toHaveCount(3)

  // 18: no duplicate observations in the dashboard statistics.
  await nav(page).getByRole('link', { name: 'Dashboard' }).click()
  await expect(page.getByText(/15 observations in your scope/)).toBeVisible()

  // 20: a refresh keeps the revisions and decisions.
  await page.goto('/review/observations/OBS-033')
  await page.reload()
  await expect(reviewStatus(page)).toContainText('Verified')
  await page.goto('/review/observations/OBS-033/compare')
  await page.reload()
  await expect(page.getByRole('table', { name: 'Revision history' }).locator('tbody tr')).toHaveCount(3)
})

test('the Resubmitted queue Compare action opens the version comparison, and the rest of the row still opens the details', async ({ page }) => {
  await signIn(page)
  await page.goto('/review/queue?status=resubmitted')
  const compare = page.getByRole('link', { name: /^Compare OBS-005/ })
  await expect(compare).toBeVisible()
  // The real browser click opens the comparison route, not the observation details.
  await compare.click()
  await expect(page).toHaveURL(/\/review\/observations\/OBS-005\/compare$/)
  await expect(page.getByRole('heading', { name: 'Compare Versions · OBS-005' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Previous revision: version 1' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Compared revision: version 2' })).toBeVisible()
  // Going back, the row's own navigation is unchanged: a click elsewhere in the row opens the details.
  await page.goBack()
  await expect(page).toHaveURL(/\/review\/queue\?status=resubmitted$/)
  await queueRow(page, 'OBS-005').getByRole('cell').nth(1).click()
  await expect(page).toHaveURL(/\/review\/observations\/OBS-005$/)
  await expect(page.getByRole('heading', { name: 'Observation Review · OBS-005' })).toBeVisible()
  // The Review action opens the details once, too.
  await page.goto('/review/queue?status=resubmitted')
  await page.getByRole('link', { name: /^Review OBS-005/ }).click()
  await expect(page).toHaveURL(/\/review\/observations\/OBS-005$/)
})

test('a resubmitted observation can be flagged (rejected) or referred, like any other', async ({ page }) => {
  await signIn(page)
  // Start Review on the Resubmitted observation moves it to In Review.
  await page.goto('/review/queue?status=resubmitted')
  await page.getByRole('link', { name: 'OBS-005', exact: true }).first().click()
  await page.getByRole('button', { name: 'Start Review' }).click()
  await page.getByRole('button', { name: 'Confirm Review' }).click()
  await expect(reviewStatus(page)).toContainText('In Review')
  await expect(page.getByRole('table', { name: 'Decisions on this observation' })).toContainText('Retake clearer image')
  await page.getByRole('link', { name: 'Flag Observation' }).click()
  await page.getByRole('textbox', { name: /Explanation/ }).fill('Revised note still does not match the image')
  await page.getByRole('button', { name: 'Flag observation' }).click()
  await expect(page.getByText('OBS-005 flagged')).toBeVisible()
  await page.goto('/review/observations/OBS-005')
  await expect(page.getByRole('table', { name: 'Decisions on this observation' })).toContainText('V2 · OBSR-005-2')

  // OBS-041: after the resubmission, verify the new revision, then refer it (Refer needs Verified).
  await page.goto('/review/corrections/COR-041')
  await simulateResubmission(page, 2)
  await page.goto('/review/observations/OBS-041')
  await startReview(page)
  await page.getByRole('link', { name: 'Verify Observation' }).click()
  await page.getByRole('button', { name: 'Confirm verification' }).click()
  await expect(page.getByText('OBS-041 verified')).toBeVisible()
  await page.getByRole('link', { name: 'Refer to Expert' }).click()
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
  await expect(page.getByRole('link', { name: 'Compare Versions' })).toHaveCount(0)
  // Only Start Review is offered until the review is started; then the In Review decisions appear.
  for (const name of ['Verify Observation', 'Flag Observation']) await expect(page.getByRole('link', { name })).toHaveCount(0)
  await page.getByRole('button', { name: 'Start Review' }).click()
  await page.getByRole('button', { name: 'Confirm Review' }).click()
  for (const name of ['Verify Observation', 'Flag Observation']) await expect(page.getByRole('link', { name })).toBeVisible()
})

for (const width of [1366, 390]) {
  test(`the revision comparison fits ${width}px without page-level horizontal scroll`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await signIn(page)
    await page.goto('/review/observations/OBS-005/compare')
    await expect(page.getByRole('region', { name: 'Compared revision: version 2' })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })
}
