import { expect, test } from '@playwright/test'

/**
 * Phase 2 smoke test: the shell, guards and fixture-mode labelling in a real browser.
 * The supervisor session is seeded to isolate shell checks from sign-in workflows.
 */
const supervisorSession = {
  user: {
    id: 'USR-003',
    fullName: 'Malini Fernando',
    email: 'malini.fernando@example.test',
    role: 'SUPERVISOR',
    estateIds: ['EST-002'],
    divisionIds: [],
  },
  accessToken: null,
  source: 'fixtures',
  signedInAt: '2026-10-21T09:00:00+05:30',
}

test('signed-out visitors are sent to the login page', async ({ page }) => {
  await page.goto('/review/queue')
  await expect(page).toHaveURL(/\/login\?next=%2Freview%2Fqueue$/)
  await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible()
})

test('a supervisor sees the review shell in fixture mode', async ({ page }) => {
  await page.addInitScript((session) => {
    window.sessionStorage.setItem('tealeaf.session', JSON.stringify(session))
  }, supervisorSession)

  await page.goto('/')
  await expect(page).toHaveURL(/\/review$/)
  const nav = page.getByRole('navigation', { name: 'Main' })
  await expect(nav.getByRole('link', { name: 'Review Queue' })).toBeVisible()
  await expect(page.getByText('Demo data', { exact: true })).toBeVisible()
  await expect(page.getByText('Demonstration data · UI design only')).toBeVisible()

  await nav.getByRole('link', { name: 'Review Queue' }).click()
  await expect(page).toHaveURL(/\/review\/queue$/)
  await expect(page.getByRole('heading', { name: 'Observation Review Queue' })).toBeVisible()

  await page.goto('/analytics')
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible()
})
