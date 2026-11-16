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

test('permission matrix search, temporary access request (pending approval) and access history', async ({ page }) => {
  await signIn(page)
  await page.goto('/admin/roles')
  await page.getByRole('searchbox', { name: 'Search permissions' }).fill('quarantine')
  await expect(page.getByText('1 permission matches')).toBeVisible()
  await page.getByRole('table', { name: 'Permission matrix', exact: true }).getByText('Decide quarantine').click()
  await expect(page.getByText('No · core role permission, read-only')).toBeVisible()

  await page.getByRole('tab', { name: 'Temporary Access' }).click()
  await expect(page).toHaveURL(/tab=temporary/)
  await expect(page.getByText('No temporary access')).toBeVisible()
  await page.getByRole('button', { name: 'Request temporary access' }).click()
  const dialog = page.getByRole('dialog', { name: 'Request temporary access' })
  await dialog.getByLabel('Employee').selectOption('USR-003')
  await dialog.getByRole('checkbox', { name: 'Mist Valley Tea Estate (EST-003)' }).check({ force: true })
  await dialog.getByLabel('Expiry').fill('2026-10-24T17:00')
  await dialog.getByLabel('Business reason').fill('Harvest cover')
  await expect(dialog.getByRole('region', { name: 'Access impact preview' })).toContainText('EST-003')
  await dialog.getByRole('button', { name: 'Submit request' }).click()
  await expect(page.getByText(/Status: Pending approval/)).toBeVisible()
  const grants = page.getByRole('table', { name: 'Temporary access grants' })
  await expect(grants.getByText('Pending approval')).toBeVisible()
  await expect(grants.getByText('Active', { exact: true })).toHaveCount(0)

  await grants.getByRole('button', { name: /Cancel TAG-001/ }).click()
  const confirm = page.getByRole('dialog', { name: 'Cancel temporary access?' })
  await confirm.getByLabel('Reason').fill('No longer needed')
  await confirm.getByRole('button', { name: 'Cancel grant' }).click()
  await expect(grants.getByText('Cancelled')).toBeVisible()

  await page.getByRole('tab', { name: 'Access History' }).click()
  const history = page.getByRole('table', { name: 'Access history' })
  await expect(history.getByText('Temporary access cancelled')).toBeVisible()
  await expect(history.getByText('Temporary access requested')).toBeVisible()
})

for (const width of [390, 1440]) {
  test(`Roles & Permissions tabs render without page overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await signIn(page)
    for (const tab of ['', '?tab=temporary', '?tab=history']) {
      await page.goto(`/admin/roles${tab}`)
      await expect(page.locator('h1')).toBeVisible()
      await expect(page.getByRole('tabpanel')).toBeVisible()
      await expectNoPageOverflow(page, `/admin/roles${tab}`)
    }
    await page.goto('/admin/roles?tab=temporary')
    await page.getByRole('button', { name: 'Request temporary access' }).click()
    await page.getByRole('dialog', { name: 'Request temporary access' }).getByLabel('Employee').selectOption('USR-007')
    await expectNoPageOverflow(page, 'request form')
  })
}
