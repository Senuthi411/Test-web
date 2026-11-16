import { expect, test, type Page } from '@playwright/test'

async function signIn(page: Page) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'User ID' }).fill('USR-001')
  await page.getByLabel('Password', { exact: true }).fill('tealeaf-dev-only')
  await page.getByRole('button', { name: 'Log In', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Administrator Dashboard' })).toBeVisible()
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

const SECTIONS = [
  'Security & access alerts',
  'Pending administrative actions',
  'Users by role',
  'Estate coverage',
  'Recent administrative activity',
  'Account activation summary',
  'Users requiring attention',
]

test('alerts and activity link to working screens, with no temporary access', async ({ page }) => {
  await signIn(page)
  await expect(page.getByText(/temporary access/i)).toHaveCount(0)
  const activity = page.getByRole('region', { name: 'Recent administrative activity' })
  await activity.getByRole('link', { name: 'View access history' }).click()
  await expect(page).toHaveURL(/\/admin\/roles\?tab=history/)
  await expect(page.getByRole('tab', { name: 'Access History', selected: true })).toBeVisible()
  await page.getByRole('link', { name: 'Dashboard' }).first().click()

  const alerts = page.getByRole('region', { name: 'Security & access alerts' })
  await expect(alerts.getByText('Device session revoked')).toBeVisible()
  await alerts.getByRole('link', { name: 'Review device session DS-3012' }).click()
  await expect(page).toHaveURL(/\/admin\/device-sessions\?session=DS-3012/)
})

for (const width of [3840, 1920, 1440, 1024, 768, 430, 375, 320]) {
  test(`dashboard renders every section without page overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await signIn(page)
    for (const name of SECTIONS) await expect(page.getByRole('region', { name, exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Active users' })).toBeVisible()
    await expectNoPageOverflow(page, `/admin at ${width}px`)
    // Action links stay inside the viewport.
    for (const link of [
      page.getByRole('link', { name: 'View access history' }),
      page.getByRole('link', { name: 'Review device session DS-3012' }),
      page.getByRole('link', { name: 'View inactive users' }),
    ]) {
      const box = await link.boundingBox()
      expect(box && box.x >= 0 && box.x + box.width <= width + 1, `link inside viewport at ${width}px`).toBe(true)
    }
    if (width <= 430) {
      await page.getByRole('button', { name: 'Open navigation' }).click()
      await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible()
      await page.keyboard.press('Escape')
    }
    if ([3840, 1440, 768, 375].includes(width)) await page.screenshot({ path: `test-results/dashboard/${width}.png`, fullPage: true })
  })
}
