import { expect, test } from '@playwright/test'

/**
 * AUTH-02 – AUTH-08 screens that render without a backend: each fits the viewport with
 * no horizontal scrolling, and the recovery request reports that the service is not
 * connected instead of pretending a code was sent.
 */
const SCREENS = [
  { path: '/forgot-password', heading: 'Forgot Password?' },
  { path: '/login/verify', heading: 'Verify Your Identity' },
  { path: '/login/mfa-setup', heading: 'Set Up Two-Factor Authentication' },
  { path: '/forgot-password/verify', heading: 'Verify Your Email' },
  { path: '/forgot-password/reset', heading: 'Create a New Password' },
  { path: '/activate', heading: 'Activation link required' },
  { path: '/session-expired', heading: 'Your session has expired' },
]

for (const width of [320, 375, 430, 768, 1440, 3840]) {
  test(`authentication screens fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 3840 ? 2160 : 800 })
    for (const screen of SCREENS) {
      await page.goto(screen.path)
      await expect(page.getByRole('heading', { name: screen.heading })).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      expect(overflow, screen.path).toBeLessThanOrEqual(0)
      // The login page's card: centred, with the logo as the only image (no plantation background).
      await expect(page.locator('img'), screen.path).toHaveCount(1)
      const card = await page.getByRole('main').boundingBox()
      if (!card) throw new Error(`missing card on ${screen.path}`)
      expect(Math.abs(card.x + card.width / 2 - width / 2), screen.path).toBeLessThan(2)
    }
  })
}

test('forgot password is keyboard operable in visual order', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/forgot-password')
  const userId = page.getByRole('textbox', { name: /User ID/ })
  await userId.focus()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Continue' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Back to Log In' })).toBeFocused()
  await userId.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Enter your User ID', { exact: true })).toBeVisible()
})

test('authentication screens stay reachable at 200% desktop zoom equivalent', async ({ page }) => {
  // Browser zoom halves the CSS viewport: 1280 x 720 physical pixels at 200%.
  await page.setViewportSize({ width: 640, height: 360 })
  for (const [path, control] of [
    ['/forgot-password', page.getByRole('link', { name: 'Back to Log In' })],
    ['/session-expired', page.getByRole('link', { name: 'Sign in again' })],
  ] as const) {
    await page.goto(path)
    await control.scrollIntoViewIfNeeded()
    await expect(control).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(640)
  }
})

test('the recovery request reports the unconnected service and keeps the User ID out of the URL', async ({ page }) => {
  await page.goto('/forgot-password')
  await page.getByRole('textbox', { name: /User ID/ }).fill('USR-003')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('Password reset service unavailable')).toBeVisible()
  await expect(page).toHaveURL(/\/forgot-password$/)
})

test('the activation token is removed from the address bar', async ({ page }) => {
  await page.goto('/activate?token=invite-abc')
  await expect(page.getByText('Account activation service unavailable')).toBeVisible()
  expect(page.url()).not.toContain('invite-abc')
})
