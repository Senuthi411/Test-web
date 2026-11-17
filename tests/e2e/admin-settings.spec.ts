import { expect, test, type Page } from '@playwright/test'

async function signIn(page: Page, username = 'USR-001') {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'User ID' }).fill(username)
  await page.getByLabel('Password', { exact: true }).fill('tealeaf-dev-only')
  await page.getByRole('button', { name: 'Log In', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

async function expectNoPageOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() =>
    [...document.querySelectorAll('body *')]
      .filter((node) => node.getBoundingClientRect().right > window.innerWidth + 1 && getComputedStyle(node).position !== 'absolute')
      .filter((node) => !node.closest('[role="region"][aria-label$="scroll area"]'))
      .map((node) => ({ tag: node.tagName, class: String(node.className), text: node.textContent?.slice(0, 60) })),
  )
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${label}: ${JSON.stringify(overflow.slice(0, 5))}`).toBe(true)
}

const SETTINGS_TABS = ['General Settings', 'Feature Center', 'Business Rules', 'Workflow Configuration', 'Maintenance Mode', 'Configuration History'] as const

test('administrator navigation: no section headings, every new module reachable from the sidebar', async ({ page }) => {
  await signIn(page)
  const nav = page.getByRole('navigation', { name: 'Main' })
  await expect(nav.getByRole('heading')).toHaveCount(0)
  for (const heading of ['Overview', 'Organization Management', 'Security & Governance', 'Enterprise Configuration', 'Account']) {
    await expect(nav.getByText(heading, { exact: true })).toHaveCount(0)
  }
  for (const [label, heading] of [
    ['Audit Logs', 'Audit Logs'],
    ['System Settings', 'System Settings'],
    ['Security Center', 'Security Center'],
  ] as const) {
    await nav.getByRole('link', { name: label }).click()
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
    await expect(nav.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page')
  }
  await expect(nav.getByRole('link', { name: /Roles|Permissions/ })).toHaveCount(0)
})

test('dashboard quick actions open the screens where the work is done', async ({ page }) => {
  await signIn(page)
  const actions = page.getByRole('region', { name: 'Quick actions' })
  await actions.getByRole('link', { name: 'Add Estate' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/admin\/estates$/)
  await page.goto('/admin')
  await page.getByRole('region', { name: 'Quick actions' }).getByRole('link', { name: 'Audit Logs' }).click()
  await expect(page.getByRole('heading', { name: 'Audit Logs', level: 1 })).toBeVisible()
})

test('System Settings: draft, validate, publish with a reason, then roll back as a new version, all audited', async ({ page }) => {
  await signIn(page)
  await page.goto('/admin/settings')
  await expect(page.getByRole('tab')).toHaveText([...SETTINGS_TABS])
  await expect(page.getByText('Demonstration mode · UI only')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publish' })).toBeDisabled()

  const name = page.getByLabel(/Organization name/)
  await name.fill('TeaLeaf Estates')
  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(page.getByText('Ready to publish.')).toBeVisible()
  await page.getByRole('button', { name: 'Publish' }).click()
  const publish = page.getByRole('dialog', { name: 'Publish version 2?' })
  await publish.getByLabel(/Reason for this change/).fill('Company rename')
  await publish.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByText(/Version 2 in effect · published by Anika Perera/)).toBeVisible()

  await page.getByRole('tab', { name: 'Business Rules' }).click()
  const ruleA = page.getByRole('region', { name: 'Rule A · High Severity Notification' })
  await expect(ruleA.getByRole('switch', { name: /Enable rule/ })).toBeDisabled()

  await page.getByRole('tab', { name: 'Maintenance Mode' }).click()
  await expect(page.getByRole('button', { name: 'Activate maintenance mode' })).toBeDisabled()

  await page.getByRole('tab', { name: 'Configuration History' }).click()
  const versions = page.getByRole('table', { name: 'Configuration versions' })
  await versions.getByRole('button', { name: 'Roll back to version 1' }).click()
  const confirm = page.getByRole('dialog', { name: 'Roll back to version 1?' })
  await confirm.getByLabel(/Reason/).fill('Rename not approved')
  await confirm.getByRole('button', { name: 'Create rollback version' }).click()
  await expect(versions.getByText('Rollback to version 1')).toBeVisible()
  await expect(versions.getByRole('row')).toHaveCount(4)

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Audit Logs' }).click()
  const log = page.getByRole('table', { name: 'Administrative audit log' })
  await expect(log.getByText('Configuration rolled back')).toBeVisible()
  await expect(log.getByText('Configuration published')).toBeVisible()
})

for (const width of [3840, 1920, 1440, 1024, 768, 430, 375, 320]) {
  test(`System Settings and Audit Logs fit at ${width}px`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width, height: 900 })
    await signIn(page)
    await page.goto('/admin/settings')
    await expect(page.getByRole('heading', { name: 'System Settings', level: 1 })).toBeVisible()
    for (const tab of SETTINGS_TABS) {
      const control = page.getByRole('tab', { name: tab, exact: true })
      await control.scrollIntoViewIfNeeded()
      await control.click()
      await expect(control).toHaveAttribute('aria-selected', 'true')
      await expect(page.getByRole('main').locator('[aria-busy="true"]')).toHaveCount(0)
      await expectNoPageOverflow(page, `${tab} at ${width}px`)
    }
    await page.goto('/admin/audit-logs')
    await expect(page.getByRole('table', { name: 'Administrative audit log' })).toBeVisible()
    await expectNoPageOverflow(page, `Audit Logs at ${width}px`)
    await page.goto('/admin')
    await expect(page.getByRole('region', { name: 'Enabled business rules' })).toBeVisible()
    await expectNoPageOverflow(page, `Dashboard at ${width}px`)
    if (width === 1440 || width === 375) await page.screenshot({ path: `test-results/admin/${width}-dashboard.png`, fullPage: true })
  })
}
