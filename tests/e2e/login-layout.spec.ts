import { expect, test } from '@playwright/test'

for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768], [1280, 720], [390, 844]]) {
  test(`login layout at ${width} x ${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    }))
    console.log(JSON.stringify({ viewport: [width, height], ...dimensions }))
    expect(dimensions.width).toBeLessThanOrEqual(width)
    if (width >= 1024) expect(dimensions.height).toBeLessThanOrEqual(height)
    for (const control of [page.getByRole('textbox', { name: 'Email or username' }), page.getByLabel('Password', { exact: true }), page.getByRole('button', { name: 'Forgot password?' })]) {
      await control.scrollIntoViewIfNeeded()
      await expect(control).toBeInViewport()
    }
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await expect(page.getByText('Enter your email or username')).toBeVisible()
    await expect(page.getByText('Enter your password')).toBeVisible()
    await page.getByRole('button', { name: 'Sign In', exact: true }).scrollIntoViewIfNeeded()
    await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeInViewport()
  })
}

test('login remains scrollable and controls reachable at 200% desktop zoom equivalent', async ({ page }) => {
  // Browser zoom halves the CSS viewport: 1280 x 720 physical pixels at 200%.
  await page.setViewportSize({ width: 640, height: 360 })
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible()
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await expect(page.getByText('Enter your email or username')).toBeVisible()
  await expect(page.getByText('Enter your password')).toBeVisible()
  await page.getByRole('button', { name: 'Sign In', exact: true }).scrollIntoViewIfNeeded()
  await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(640)
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(360)
  await page.getByText('Development accounts (fixture mode only)', { exact: true }).click()
  const lastAccount = page.getByRole('button', { name: /^Use Reporting User/ })
  await lastAccount.scrollIntoViewIfNeeded()
  await expect(lastAccount).toBeInViewport()
})
