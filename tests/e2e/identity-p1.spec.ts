import { expect, test, type Page } from '@playwright/test'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

async function signIn(page: Page, url = '/login') {
  await page.goto(url)
  await page.getByRole('textbox', { name: 'User ID' }).fill('USR-001')
  await page.getByLabel('Password', { exact: true }).fill('tealeaf-dev-only')
  await page.getByRole('button', { name: 'Log In', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Administrator Dashboard' })).toBeVisible()
}

test('Edit User requires a reason only for a changed scope and records it in Audit Logs', async ({ page }) => {
  await signIn(page)
  await page.goto('/admin/users/USR-003/edit')
  await expect(page.getByRole('textbox', { name: 'Reason for scope change', exact: false })).toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Mist Valley Tea Estate (EST-003)' }).check()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('A reason is required for a privileged scope change')).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/users\/USR-003\/edit$/)
  await page.getByRole('textbox', { name: 'Reason for scope change', exact: false }).fill('Coverage extension for P1')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL(/\/admin\/users\/USR-003$/)
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Audit Logs', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Search administrative audit log' }).fill('Coverage extension for P1')
  const row = page.getByRole('table', { name: 'Administrative audit log' }).getByRole('row').filter({ hasText: 'Scope changed' })
  await expect(row).toHaveCount(1)
  await row.getByRole('button', { name: /View details/ }).click()
  await expect(page.getByRole('dialog', { name: 'Audit record' }).getByText('Coverage extension for P1', { exact: true })).toBeVisible()
})

test('production hash-router attention navigation retains the dashboard route and keyboard focus', async ({ page }) => {
  // Production build is a prerequisite. Serve its files without a development SPA fallback.
  const root = resolve('dist')
  const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' }
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
    const file = resolve(root, pathname.slice('/Test-web/'.length) || 'index.html')
    if (!pathname.startsWith('/Test-web/') || !file.startsWith(root + sep)) { response.writeHead(404).end(); return }
    try { response.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream'); response.end(await readFile(file)) }
    catch { response.writeHead(404).end() }
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  try {
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Production test server did not start')
    const failures: string[] = []
    page.on('pageerror', (error) => failures.push(error.message))
    page.on('response', (response) => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`) })
    await signIn(page, `http://127.0.0.1:${address.port}/Test-web/#/login`)
    const route = page.url()
    await expect(page).toHaveURL(/\/Test-web\/#\/admin$/)
    const attention = page.getByRole('link', { name: /Accounts requiring attention/ })
    await expect(attention).toHaveAttribute('href', /#\/admin#attention$/)
    await attention.click()
    await expect(page).toHaveURL(route)
    await expect(page.locator('#attention')).toBeFocused()
    await expect(page.getByRole('heading', { name: 'Administrator Dashboard' })).toBeVisible()
    await attention.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(route)
    await expect(page.locator('#attention')).toBeFocused()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Administrator Dashboard' })).toBeVisible()
    expect(failures).toEqual([])
  } finally {
    await new Promise<void>((done, reject) => server.close((error) => error ? reject(error) : done()))
  }
})
