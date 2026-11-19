import { expect, test, type Page } from '@playwright/test'
test.setTimeout(90_000)

async function signIn(page: Page, user = 'USR-003') {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'User ID' }).fill(user)
  await page.getByLabel('Password', { exact: true }).fill('tealeaf-dev-only')
  await page.getByRole('button', { name: 'Log In', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' })

test('review decisions, correction lifecycle and history stay consistent across modules', async ({ page }) => {
  await signIn(page)
  await expect(page).toHaveURL(/\/review$/)
  await expect(page.getByRole('heading', { name: 'Supervisor Dashboard' })).toBeVisible()

  // REV-02 → REV-03 → REV-06: flag OBS-033 (In Review), then request a correction (Flagged only).
  await nav(page).getByRole('link', { name: 'Observation Review' }).click()
  await page.getByRole('tab', { name: /In Review/ }).click()
  await page.getByRole('link', { name: 'OBS-033', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Observation Review · OBS-033' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Request Correction' })).toHaveCount(0) // not offered until Flagged
  await page.getByRole('link', { name: 'Flag Observation' }).click()
  await page.getByRole('textbox', { name: /Explanation/ }).fill('The leaf is out of focus.')
  await page.getByRole('button', { name: 'Flag observation' }).click()
  await expect(page.getByText('Review status', { exact: true }).locator('..')).toContainText('Flagged')
  await page.getByRole('link', { name: 'Request Correction' }).click()
  await page.getByRole('checkbox', { name: 'Retake a clearer image' }).check()
  await page.getByRole('textbox', { name: /Message to field worker/ }).fill('Please retake a clearer image.')
  await page.getByRole('button', { name: 'Send correction request' }).click()
  await expect(page.getByRole('heading', { name: 'Correction COR-033' })).toBeVisible()
  await expect(page.getByText('No revision submitted yet.')).toBeVisible()

  // REV-08 → REV-09 → REV-10: approve COR-005, then the simulated RevisionApplied event.
  // The Correction Queue has no sidebar item or button on Observation Review; it opens by its route.
  await page.goto('/review/corrections')
  await page.getByRole('link', { name: 'COR-005', exact: true }).click()
  await page.getByRole('link', { name: 'Compare revisions' }).click()
  await expect(page.getByRole('heading', { name: 'Original vs Revised' })).toBeVisible()
  await page.getByRole('link', { name: 'Approve', exact: true }).click()
  await page.getByRole('checkbox', { name: 'I compared the original and revised data' }).check()
  await page.getByRole('checkbox', { name: 'Original evidence is unchanged' }).check()
  await page.getByRole('button', { name: 'Confirm approval' }).click()
  await expect(page.getByText('Approved — waiting for RevisionApplied')).toBeVisible()
  await page.getByRole('button', { name: 'Simulate RevisionApplied event' }).click()
  await expect(page.getByRole('heading', { name: 'Correction COR-005' })).toBeVisible()
  await expect(page.getByText('OBS-005 · East Hills (DIV-005) · Applied')).toBeVisible()

  // REV-17: the decisions are recorded on the observation's decision log; History lists only ended processes.
  await page.goto('/review/observations/OBS-033')
  const log = page.getByRole('table', { name: 'Decisions on this observation' })
  await expect(log).toContainText('Flagged')
  await expect(log).toContainText('Correction')
  await nav(page).getByRole('link', { name: 'Decision History' }).click()
  await expect(page.getByRole('heading', { name: 'Review and Decision History' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Observation History' })).toBeVisible()
  await nav(page).getByRole('link', { name: 'Fieldwork Assignments' }).click()
  await expect(page.getByRole('row', { name: /ASG-001/ })).toContainText('Done')

  // Cross-module evidence link.
  await nav(page).getByRole('link', { name: 'Observation Review' }).click()
  await page.getByRole('link', { name: 'OBS-014', exact: true }).click()
  await page.getByRole('link', { name: 'Open evidence viewer' }).click()
  await expect(page).toHaveURL(/\/observations\/OBS-014\/evidence\?from=review$/)
  // Back returns to the same observation's review page.
  await page.getByRole('link', { name: 'Back to observation review' }).click()
  await expect(page.getByRole('heading', { name: 'Observation Review · OBS-014' })).toBeVisible()
})

test('referral and keyboard-only verification', async ({ page }) => {
  await signIn(page)
  await page.goto('/review/observations/OBS-014')
  const verify = page.getByRole('link', { name: 'Verify observation' })
  await verify.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Verify Observation' })).toBeVisible()
  for (const box of await page.getByRole('checkbox').all()) {
    await box.focus()
    await page.keyboard.press('Space')
  }
  await page.getByRole('button', { name: 'Confirm verification' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('OBS-014 verified')).toBeVisible()
  // A verified observation can only be referred to an expert.
  await expect(page.getByRole('link', { name: 'Refer to expert' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Verify observation' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Flag observation' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Request correction' })).toHaveCount(0)
})

test('Start Review moves a Submitted observation to In Review, and status persists across refresh', async ({ page }) => {
  await signIn(page)
  await page.goto('/review/queue?status=submitted')
  await page.getByRole('link', { name: 'OBS-013', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Observation Review · OBS-013' })).toBeVisible()
  // Opening does not claim it: only Start Review is offered, and it needs a confirmation.
  await expect(page.getByText('Review status', { exact: true }).locator('..')).toContainText('Submitted')
  for (const name of ['Verify Observation', 'Flag Observation', 'Request Correction', 'Refer to Expert']) {
    await expect(page.getByRole('link', { name })).toHaveCount(0)
  }
  await page.getByRole('button', { name: 'Start Review' }).click()
  await page.getByRole('button', { name: 'Confirm Review' }).click()
  await expect(page.getByText('Review status', { exact: true }).locator('..')).toContainText('In Review')
  // In Review offers Verify and Flag only; Request Correction and Refer need Flagged / Verified.
  for (const name of ['Verify Observation', 'Flag Observation']) await expect(page.getByRole('link', { name })).toBeVisible()
  for (const name of ['Request Correction', 'Refer to Expert']) await expect(page.getByRole('link', { name })).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('Review status', { exact: true }).locator('..')).toContainText('In Review')
  await page.goto('/review/queue')
  await expect(page.locator('tr', { has: page.getByRole('link', { name: 'OBS-013', exact: true }) })).toContainText('In Review')
})

test('referral creates a pending case link, never a case', async ({ page }) => {
  await signIn(page)
  // Referral is only offered once an observation is Verified (OBS-015).
  await page.goto('/review/observations/OBS-015/refer')
  await page.getByRole('textbox', { name: /Referral note/ }).fill('Expert confirmation needed')
  await page.getByRole('button', { name: 'Send referral' }).click()
  await expect(page.getByText('Referral REF-015 sent', { exact: true })).toBeVisible()
  await expect(page.getByRole('row', { name: /REF-015/ })).toContainText('Pending case link')
  await expect(page.getByRole('row', { name: /REF-015/ })).toContainText('Not yet created')
})

test('Review is denied to administrators', async ({ page }) => {
  await signIn(page, 'USR-001')
  await page.goto('/review/queue')
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible()
})

test('Review data is limited to the supervisor estate scope', async ({ page }) => {
  await signIn(page, 'USR-002')
  await page.goto('/review/corrections/COR-005')
  await expect(page.getByText('Correction unavailable')).toBeVisible()
  // Division Quarantine lists only the divisions of the supervisor's own estate.
  await page.goto('/review/quarantine')
  await expect(page.getByText('North Ridge (DIV-001)')).toBeVisible()
  await expect(page.getByText('East Hills (DIV-005)')).toHaveCount(0)
  await expect(page.getByText('West Terrace (DIV-006)')).toHaveCount(0)
})

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
]

const SCREENS: Array<[string, string]> = [
  ['/review', 'Supervisor Dashboard'],
  ['/review/queue', 'Observation Review'],
  ['/review/observations/OBS-014', 'Observation Review · OBS-014'],
  ['/review/observations/OBS-014/verify', 'Verify Observation'],
  ['/review/corrections', 'Correction Queue'],
  ['/review/corrections/COR-005', 'Correction COR-005'],
  ['/review/corrections/COR-005/compare', 'Original vs Revised'],
  ['/review/referrals', 'Expert Referral Status'],
  ['/review/quarantine/QUA-002', 'Quarantine Record QUA-002'],
  ['/review/history', 'Review and Decision History'],
]

for (const viewport of VIEWPORTS) {
  test(`Review screens fit ${viewport.width}×${viewport.height} without page-level horizontal scroll`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await signIn(page)
    for (const [path, heading] of SCREENS) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(1)
    }
  })
}
