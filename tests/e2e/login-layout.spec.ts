import { expect, test } from '@playwright/test'

const VIEWPORTS: ReadonlyArray<[number, number]> = [
  [320, 640],
  [375, 812],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1280, 720],
  [1366, 768],
  [1440, 900],
  [1920, 1080],
  [3840, 2160],
]

for (const [width, height] of VIEWPORTS) {
  test(`login layout at ${width} x ${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    }))
    expect(dimensions.width).toBeLessThanOrEqual(width)
    if (width >= 1024) expect(dimensions.height).toBeLessThanOrEqual(height)

    // Desktop: introduction on the left, card on the right. Below 1024px: one centred column,
    // and on phones the description and feature list give way to the form.
    const card = await page.getByRole('form', { name: 'Log in' }).locator('..').boundingBox()
    const intro = page.getByRole('region', { name: 'Tea Estate Health Monitoring' })
    const introBox = await intro.boundingBox()
    if (!card || !introBox) throw new Error('missing card or introduction box')
    await expect(page.getByRole('img')).toHaveCount(0) // logo images are decorative (alt="")
    if (width >= 1024) {
      expect(card.x).toBeGreaterThanOrEqual(introBox.x + introBox.width - 1)
      expect(card.x + card.width).toBeLessThanOrEqual(width)
    } else {
      expect(Math.abs(card.x + card.width / 2 - width / 2)).toBeLessThan(2)
      expect(card.y).toBeGreaterThan(introBox.y)
    }
    const features = intro.getByRole('list')
    if (width < 768) await expect(features).toBeHidden()
    else await expect(features).toBeVisible()

    const logIn = page.getByRole('button', { name: 'Log In', exact: true })
    for (const control of [
      page.getByRole('textbox', { name: 'User ID' }),
      page.getByLabel('Password', { exact: true }),
      page.getByRole('checkbox', { name: 'Remember User ID' }),
      page.getByRole('link', { name: 'Forgot password?' }),
      logIn,
    ]) {
      await control.scrollIntoViewIfNeeded()
      await expect(control).toBeInViewport()
    }

    // Full-width button at every size, comfortable to tap.
    const button = await logIn.boundingBox()
    const form = await page.getByRole('form', { name: 'Log in' }).boundingBox()
    if (!button || !form) throw new Error('missing layout boxes')
    expect(button.width).toBeGreaterThan(form.width - 2)
    expect(button.height).toBeGreaterThanOrEqual(44)

    await logIn.click()
    await expect(page.getByText('Enter your User ID')).toBeVisible()
    await expect(page.getByText('Enter your password')).toBeVisible()
    await logIn.scrollIntoViewIfNeeded()
    await expect(logIn).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  })
}

test('login is keyboard operable in visual order', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/login')
  const userId = page.getByRole('textbox', { name: 'User ID' })
  await userId.focus()
  const order: string[] = []
  for (let step = 0; step < 5; step += 1) {
    await page.keyboard.press('Tab')
    order.push(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim() ?? ''))
  }
  expect(order).toEqual(['', 'Show password', '', 'Forgot password?', 'Log In'])
  await expect(page.getByRole('button', { name: 'Log In', exact: true })).toBeFocused()

  await userId.fill('USR-001')
  await page.getByLabel('Password', { exact: true }).fill('tealeaf-dev-only')
  await page.getByLabel('Password', { exact: true }).press('Enter')
  await expect(page).toHaveURL(/\/admin$/)
})

test('login remains scrollable and controls reachable at 200% desktop zoom equivalent', async ({ page }) => {
  // Browser zoom halves the CSS viewport: 1280 x 720 physical pixels at 200%.
  await page.setViewportSize({ width: 640, height: 360 })
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible()
  await page.getByRole('button', { name: 'Log In', exact: true }).click()
  await expect(page.getByText('Enter your User ID')).toBeVisible()
  await expect(page.getByText('Enter your password')).toBeVisible()
  const secure = page.getByText('Authorized company personnel only')
  await secure.scrollIntoViewIfNeeded()
  await expect(secure).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(640)
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(360)
})
