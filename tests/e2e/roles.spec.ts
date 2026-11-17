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

async function pickFilter(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: new RegExp(`^${label}:`) }).click()
  await page.getByRole('listbox', { name: label }).getByRole('option', { name: option, exact: true }).click()
}

test('two tabs, no per-role pages: old role links open the matrix', async ({ page }) => {
  await signIn(page)
  await page.goto('/admin/roles')
  await expect(page.getByRole('tab', { name: 'Permission Matrix', selected: true })).toBeVisible()
  await expect(page.getByRole('tab')).toHaveText(['Permission Matrix', 'Access History'])
  await expect(page.getByRole('tab', { name: /Overview|Temporary/ })).toHaveCount(0)
  await expect(page.getByRole('list', { name: 'System roles' })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Compare roles' })).toHaveCount(0)
  await expect(page.getByRole('table', { name: 'Permission matrix', exact: true }).getByRole('link')).toHaveCount(0)

  await page.goto('/admin/roles/supervisor')
  await expect(page).toHaveURL(/\/admin\/roles$/)
  await expect(page.getByRole('tab', { name: 'Permission Matrix', selected: true })).toBeVisible()
})

test('read-only permission matrix: modules, search, module filter and details', async ({ page }) => {
  await signIn(page)
  await page.goto('/admin/roles?tab=matrix')
  const matrix = page.getByRole('table', { name: 'Permission matrix', exact: true })
  await expect(matrix).toBeVisible()
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  for (const module of ['Identity', 'Capture', 'Review', 'Cases', 'Analytics', 'Configuration', 'Security']) {
    await expect(matrix.getByRole('button', { name: new RegExp(`^${module}\\s*\\(`) })).toBeVisible()
  }

  await matrix.getByRole('button', { name: /^Review\s*\(/ }).click()
  await expect(matrix.getByRole('button', { name: /Decide quarantine/ })).toHaveCount(0)
  await matrix.getByRole('button', { name: /^Review\s*\(/ }).press('Enter')
  await expect(matrix.getByRole('button', { name: /Decide quarantine/ })).toBeVisible()

  await page.getByRole('searchbox', { name: 'Search permissions' }).fill('quarantine')
  await expect(page.getByText('1 permission matches')).toBeVisible()
  await matrix.getByRole('button', { name: /Decide quarantine/ }).click()
  const details = page.getByRole('region', { name: 'Permission details' })
  await expect(details.getByText('No · core role permission, read-only')).toBeVisible()
  await expect(matrix.getByRole('img', { name: 'Scope-dependent for Supervisor' })).toBeVisible()
  await expect(matrix.getByRole('img', { name: 'Denied for Field worker' })).toBeVisible()

  await page.getByRole('searchbox', { name: 'Search permissions' }).fill('')
  await pickFilter(page, 'Module', 'Security')
  await expect(page.getByText('3 permissions match')).toBeVisible()
  await expect(matrix.getByRole('img', { name: 'Allowed for Administrator' })).toHaveCount(3)
})

test('access history lists identity events and filters them', async ({ page }) => {
  await signIn(page)
  await page.goto('/admin/roles?tab=history')
  const history = page.getByRole('table', { name: 'Access history', exact: true })
  await expect(history.getByText('Device access revoked')).toBeVisible()
  await expect(history.getByText(/Temporary access/)).toHaveCount(0)
  await pickFilter(page, 'Event type', 'Permanent scope changed')
  await expect(history.getByText('Device access revoked')).toHaveCount(0)
  await expect(history.getByText('Permanent scope changed')).toBeVisible()
})

for (const width of [3840, 1920, 1440, 1024, 768, 430, 375, 320]) {
  test(`Roles & Permissions tabs render without page overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await signIn(page)
    for (const path of ['/admin/roles', '/admin/roles?tab=matrix', '/admin/roles?tab=history']) {
      await page.goto(path)
      await expect(page.locator('h1')).toBeVisible()
      await expectNoPageOverflow(page, `${path} at ${width}px`)
    }
    // The matrix scrolls inside its own area on small screens.
    await page.goto('/admin/roles?tab=matrix')
    await expect(page.getByRole('region', { name: 'Permission matrix scroll area' })).toBeVisible()
    await page.screenshot({ path: `test-results/roles-matrix-${width}.png`, fullPage: false })
  })
}
