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
]

for (const width of [320, 375, 430, 768, 1440]) {
  test(`authentication screens fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    for (const screen of SCREENS) {
      await page.goto(screen.path)
      await expect(page.getByRole('heading', { name: screen.heading })).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      expect(overflow, screen.path).toBeLessThanOrEqual(0)
    }
  })
}

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
