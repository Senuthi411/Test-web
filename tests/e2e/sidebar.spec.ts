import { expect, test, type Page } from '@playwright/test'

/** Enterprise sidebar: expanded, collapsed, tablet, mobile drawer and the account menu. */
async function signIn(page: Page, userId = 'USR-001') {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'User ID' }).fill(userId)
  await page.getByLabel('Password', { exact: true }).fill('tealeaf-dev-only')
  await page.getByRole('button', { name: 'Log In', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)

test('expanded and collapsed desktop sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page)
  await page.goto('/admin/users/new')
  const sidebar = page.getByRole('complementary', { name: 'Sidebar' })
  const nav = page.getByRole('navigation', { name: 'Main' })
  await expect(nav.getByRole('link', { name: 'Users' })).toHaveAttribute('aria-current', 'page')
  expect((await sidebar.boundingBox())?.width).toBe(260)
  expect(await noHorizontalScroll(page)).toBe(true)
  await page.screenshot({ path: 'test-results/sidebar/expanded-1440.png' })

  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
  await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(72)
  await nav.getByRole('link', { name: 'Estates' }).hover()
  await expect(sidebar.getByText('Estates', { exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/sidebar/collapsed-1440.png' })

  await page.reload()
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
  await page.getByRole('button', { name: 'Expand sidebar' }).click()
})

test('account menu opens above the profile card and signs out', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page)
  const trigger = page.getByRole('button', { name: 'Account menu for Anika Perera, Administrator' })
  await trigger.click()
  const viewProfile = page.getByRole('link', { name: 'View Profile' })
  await expect(viewProfile).toBeInViewport()
  await page.screenshot({ path: 'test-results/sidebar/account-menu-1440.png' })
  await page.keyboard.press('Escape')
  await expect(viewProfile).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.getByRole('button', { name: 'Sign Out' }).click()
  await expect(page).toHaveURL(/\/login/)
})

test('tablet uses the icon-only sidebar without overlapping content', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 })
  await signIn(page, 'USR-003')
  const sidebar = page.getByRole('complementary', { name: 'Sidebar' })
  expect((await sidebar.boundingBox())?.width).toBe(72)
  const main = await page.locator('main').boundingBox()
  expect(main?.x ?? 0).toBeGreaterThanOrEqual(72)
  expect(await noHorizontalScroll(page)).toBe(true)
  await page.screenshot({ path: 'test-results/sidebar/tablet-820.png' })
})

for (const width of [320, 375, 430]) {
  test(`mobile drawer at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await signIn(page)
    await page.getByRole('button', { name: 'Open navigation' }).click()
    const drawer = page.getByRole('dialog', { name: 'Navigation' })
    await expect(drawer).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Device Sessions' })).toBeVisible()
    // The drawer's own title ("Navigation") is a heading; the navigation inside has none.
    const drawerNav = drawer.getByRole('navigation', { name: 'Main' })
    await expect(drawerNav.getByRole('heading')).toHaveCount(0)
    await expect(drawerNav.getByText('Security & Governance', { exact: true })).toHaveCount(0)
    expect(await noHorizontalScroll(page)).toBe(true)
    if (width === 375) await page.screenshot({ path: 'test-results/sidebar/mobile-drawer-375.png' })
    await drawer.getByRole('link', { name: 'Estates' }).click()
    await expect(drawer).toHaveCount(0)
    await expect(page).toHaveURL(/\/admin\/estates/)
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Navigation' })).toHaveCount(0)
  })
}
