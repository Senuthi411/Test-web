import { expect, test, type Page } from '@playwright/test'

async function signIn(page: Page) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'User ID' }).fill('USR-001')
  await page.getByLabel('Password', { exact: true }).fill('tealeaf-dev-only')
  await page.getByRole('button', { name: 'Log In', exact: true }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

async function addSecondAdministrator(page: Page) {
  // In-app navigation preserves the existing tab-local fixture repository.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Users', exact: true }).click()
  await page.getByRole('link', { name: 'Create user', exact: true }).click()
  await page.getByLabel('Full name', { exact: false }).fill('Second Administrator')
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('second.admin@example.test')
  await page.getByLabel('Phone number', { exact: false }).fill('0771234567')
  await page.getByLabel('Employee / Staff ID', { exact: false }).fill('EMP-P0')
  await page.getByRole('combobox', { name: 'Preferred language', exact: true }).selectOption('en')
  await page.getByRole('combobox', { name: 'Role', exact: true }).selectOption('ADMINISTRATOR')
  await page.getByRole('button', { name: 'Create user', exact: true }).click()
  await page.getByRole('dialog', { name: 'Review and create user' }).getByRole('button', { name: 'Create user', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/users\/USR-014$/)
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Users', exact: true }).click()
  await page.getByRole('table').getByRole('link', { name: 'Anika Perera', exact: true }).click()
  await page.getByRole('link', { name: 'Edit user', exact: true }).click()
}

test('last active Administrator deactivation reports an error and leaves the account active', async ({ page }) => {
  await signIn(page)
  await page.goto('/admin/users/USR-001/edit')
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('inactive')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText(/At least one active Administrator must remain/)).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/users\/USR-001\/edit$/)
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Users', exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('active')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('heading', { name: 'Anika Perera', exact: true, level: 1 })).toBeVisible()
})

test('allowed self-deactivation removes the session and cannot restore admin access on reload', async ({ page }) => {
  await signIn(page)
  await addSecondAdministrator(page)
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('inactive')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL(/\/login(?:\?|$)/)
  expect(await page.evaluate(() => sessionStorage.getItem('tealeaf.session'))).toBeNull()
  await page.goto('/admin/users')
  await expect(page).toHaveURL(/\/login\?next=/)
})

test('allowed self-demotion removes privileged navigation immediately and clears persisted access', async ({ page }) => {
  await signIn(page)
  await addSecondAdministrator(page)
  await page.getByRole('combobox', { name: 'Role', exact: true }).selectOption('REPORTING_USER')
  const roleDialog = page.getByRole('dialog').getByRole('button', { name: 'Change role', exact: true })
  if (await roleDialog.count()) await roleDialog.click()
  await page.getByRole('checkbox', { name: 'Highland Tea Estate (EST-001)' }).check()
  await page.getByRole('textbox', { name: 'Reason for scope change', exact: false }).fill('P0 role/scope regression')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL(/\/login(?:\?|$)/)
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
  expect(await page.evaluate(() => sessionStorage.getItem('tealeaf.session'))).toBeNull()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible()
})
