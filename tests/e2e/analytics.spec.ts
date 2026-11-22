import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
test.setTimeout(120_000)

async function signIn(page: Page, user = 'USR-013') {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'User ID' }).fill(user)
  await page.getByLabel('Password', { exact: true }).fill('tealeaf-dev-only')
  await page.getByRole('button', { name: 'Log In', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' })

/** Heading shown and snapshot loaded (Export enabled). */
async function ready(page: Page, title: string) {
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Export' })).toBeEnabled()
}

const SCREENS: Array<[string, string, string, string]> = [
  ['Analytics Dashboard', '/analytics', 'Analytics Dashboard', 'dashboard-summary'],
  ['Estate Overview', '/analytics/estates', 'Estate Overview', 'estate-overview'],
  ['Division Overview', '/analytics/divisions', 'Division Overview', 'division-overview'],
  ['Observation Statistics', '/analytics/observations', 'Observation Statistics', 'observation-statistics'],
  ['Disease Distribution', '/analytics/diseases', 'Disease Distribution', 'disease-distribution'],
  ['Suspected vs Confirmed', '/analytics/suspected-vs-confirmed', 'Suspected vs Confirmed Disease Trends', 'suspected-vs-confirmed-trends'],
  ['Review Bottlenecks', '/analytics/bottlenecks', 'Review Bottlenecks', 'review-bottlenecks'],
  ['Reporting Filters', '/analytics/filters', 'Reporting Filters', 'reporting-filters-preview'],
  ['Data Freshness', '/analytics/freshness', 'Data Freshness Information', 'data-freshness'],
]

test('the Test-web server is under test (shared shell, fixture mode)', async ({ page, baseURL }) => {
  const response = await page.goto('/login')
  expect(response?.ok()).toBe(true)
  // Test-web's own login screen and package title, not the standalone analytics app.
  await expect(page.getByRole('button', { name: 'Log In', exact: true })).toBeVisible()
  const html = await (await page.request.get(`${baseURL}/`)).text()
  expect(html).toContain('/src/main.tsx')
  await signIn(page)
  await expect(page).toHaveURL(/\/analytics$/)
  await expect(page.getByText('Demo data', { exact: true })).toBeVisible()
})

test('all nine AN screens open from the shared sidebar and export their own CSV within estate scope', async ({ page }) => {
  await signIn(page)
  for (const [link, path, title, reportType] of SCREENS) {
    await nav(page).getByRole('link', { name: link, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, '\\/')}$`))
    await ready(page, title)
    await expect(page.getByText(/Mist Valley|EST-003/)).toHaveCount(0)

    await page.getByRole('button', { name: 'Export' }).click()
    const dialog = page.getByRole('dialog', { name: 'Export report' })
    await expect(dialog.getByText(`File: tealeaf-${reportType}-2026-10-21.csv`)).toBeVisible()
    const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: /Download CSV/ }).click()])
    expect(download.suggestedFilename()).toBe(`tealeaf-${reportType}-2026-10-21.csv`)
    const csv = await readFile((await download.path()) as string, 'utf8')
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).not.toMatch(/EST-003|Mist Valley/)
    if (reportType === 'estate-overview') expect(csv).toContain('"","Total",33,')
    if (reportType === 'suspected-vs-confirmed-trends') expect(csv.split('\r\n')[0]).toContain('expert_confirmed_diagnoses')
    // Toasts from the previous screen can still be on screen; check the newest one.
    await expect(page.getByText('Report downloaded as CSV.').last()).toBeVisible()
  }
})

test('AN-01 KPIs and the confirmed card link to /analytics/suspected-vs-confirmed with filters kept', async ({ page }) => {
  await signIn(page)
  await page.goto('/analytics?disease=Grey+blight')
  await ready(page, 'Analytics Dashboard')
  const confirmed = page.getByRole('link', { name: /Confirmed diagnoses/ })
  await expect(confirmed).toContainText('2')
  await expect(confirmed).toContainText('Expert-confirmed as Grey blight')
  await confirmed.click()
  await expect(page).toHaveURL(/\/analytics\/suspected-vs-confirmed\?disease=Grey\+blight$/)
  await ready(page, 'Suspected vs Confirmed Disease Trends')
  await expect(page.getByRole('table', { name: 'Confirmed expert diagnoses' }).getByRole('row')).toHaveCount(3)
  await page.reload()
  await ready(page, 'Suspected vs Confirmed Disease Trends')
  await expect(page.getByText(/Filtered report · .* · Grey blight/)).toBeVisible()
})

test('keyboard: filters dialog, chart time grouping and bottleneck detail', async ({ page }) => {
  await signIn(page)
  await page.goto('/analytics/observations')
  await ready(page, 'Observation Statistics')
  await page.getByRole('button', { name: 'Filters' }).focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Reporting filters' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Estate').selectOption('EST-001')
  await dialog.getByLabel('Period').selectOption('7')
  await dialog.getByRole('button', { name: 'Apply filters' }).press('Enter')
  await expect(page).toHaveURL(/estate=EST-001/)
  await expect(page).toHaveURL(/period=7/)
  await expect(page.getByRole('region', { name: 'Total observations' })).toHaveText(/^Total observations\s*1\s*Captured in the selected period$/)

  // Shared FilterSelect (select-only combobox): open with Enter, choose with the keyboard.
  const grouping = page.getByRole('combobox', { name: /^Group by:/ })
  await grouping.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('listbox', { name: 'Group by' })).toBeVisible()
  // Options: "Auto (daily)" (selected), "Daily", "Weekly". Arrow down once, then choose.
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('option', { name: 'Daily', exact: true })).toHaveAttribute('data-active', 'true')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/granularity=day/)
  await expect(grouping).toHaveAccessibleName('Group by: Daily')

  await page.goto('/analytics/bottlenecks')
  await ready(page, 'Review Bottlenecks')
  await page.getByRole('button', { name: 'OBS-019', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'OBS-019' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'OBS-019' })).toHaveCount(0)
})

test('a forged out-of-scope estate is refused, and the supervisor keeps Review but not Analytics', async ({ page }) => {
  await signIn(page)
  await page.goto('/analytics/estates?estate=EST-003')
  await expect(page.getByText(/outside your reporting scope/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Export' })).toBeDisabled()

  await page.context().clearCookies()
  await page.evaluate(() => {
    window.sessionStorage.clear()
    window.localStorage.clear()
  })
  await signIn(page, 'USR-003')
  await expect(page).toHaveURL(/\/review$/)
  await nav(page).getByRole('link', { name: 'Observation Review', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Observation Review', exact: true })).toBeVisible()
  await page.goto('/analytics/suspected-vs-confirmed')
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible()
})
