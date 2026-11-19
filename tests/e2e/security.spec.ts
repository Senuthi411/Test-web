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
      .map((node) => ({ tag: node.tagName, class: node.className, text: node.textContent?.slice(0, 60) })),
  )
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${label}: ${JSON.stringify(overflow)}`).toBe(true)
}

const TABS = ['Security Overview', 'Authentication Policies', 'Device Security', 'Security Events'] as const

test('Security Center opens from the sidebar and the Dashboard, and every tab is read-only', async ({ page }) => {
  await signIn(page)
  await page.getByRole('region', { name: 'Security & access alerts' }).getByRole('link', { name: 'Security Center' }).click()
  await expect(page).toHaveURL(/\/admin\/security$/)
  await page.goto('/admin')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Security Center' }).click()
  await expect(page.getByRole('heading', { name: 'Security Center', level: 1 })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Security Center' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('tab')).toHaveText([...TABS])
  const mfaPolicy = page.getByRole('region', { name: 'Administrators covered by MFA policy' })
  await expect(mfaPolicy).toBeVisible()
  await expect(mfaPolicy).toContainText('Enrollment status not reported')

  await page.getByRole('tab', { name: 'Authentication Policies' }).click()
  await expect(page).toHaveURL(/\?tab=authentication$/)
  await expect(page.getByRole('table', { name: 'Administrator accounts and MFA' })).toBeVisible()
  await expect(page.getByText('Awaiting backend contract')).toBeVisible()
  await expect(page.getByRole('main').getByRole('button', { name: /reset|recover/i })).toHaveCount(0)
  await expect(page.getByRole('main').getByRole('textbox')).toHaveCount(0)

  await page.getByRole('tab', { name: 'Device Security' }).click()
  await expect(page.getByRole('row', { name: /Offline session validity/ })).toContainText('Proposed · not approved')

  await page.getByRole('tab', { name: 'Security Events' }).click()
  const events = page.getByRole('table', { name: 'Security events' })
  await expect(events.getByText('Device session revoked')).toBeVisible()
  await events.getByRole('button', { name: 'View details of record AUD-003' }).click()
  await expect(page.getByRole('dialog', { name: 'Audit record' }).getByText('DEVICE_SESSION_REVOKED', { exact: true })).toBeVisible()
})

test('a Supervisor is denied the Security Center and does not see it in the sidebar', async ({ page }) => {
  await signIn(page, 'USR-003')
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Security Center' })).toHaveCount(0)
  await page.goto('/admin/security')
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible()
})

for (const width of [3840, 1920, 1440, 1280, 1024, 768, 430, 375, 320]) {
  test(`Security Center tabs fit at ${width}px`, async ({ page }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width, height: 900 })
    await signIn(page)
    await page.goto('/admin/security')
    await expect(page.getByRole('heading', { name: 'Security Center', level: 1 })).toBeVisible()
    for (const tab of TABS) {
      const control = page.getByRole('tab', { name: tab, exact: true })
      await control.scrollIntoViewIfNeeded()
      await control.click()
      await expect(control).toHaveAttribute('aria-selected', 'true')
      await expect(page.getByRole('main').locator('[aria-busy="true"]')).toHaveCount(0)
      await expectNoPageOverflow(page, `${tab} at ${width}px`)
    }
    await page.getByRole('tab', { name: 'Authentication Policies', exact: true }).click()
    await expect(page.getByText('Read-only policy overview')).toBeVisible()
    await page.screenshot({ path: `test-results/security/${width}-policies.png`, fullPage: true })
  })
}
