import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, sep, extname } from 'node:path'
import { chromium, expect } from '@playwright/test'

// Serve exactly like project Pages: no SPA fallback for unknown pathname URLs.
const root = resolve('dist')
const prefix = '/Test-web/'
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' }
const server = process.env.PAGES_URL ? null : createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname
  const relative = path.slice(prefix.length) || 'index.html'
  const file = resolve(root, relative)
  if (!path.startsWith(prefix) || !file.startsWith(root + sep)) { res.writeHead(404).end(); return }
  try { res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream'); res.end(await readFile(file)) }
  catch { res.writeHead(404).end() }
})
if (server) await new Promise((done) => server.listen(4388, '127.0.0.1', done))
const base = process.env.PAGES_URL ?? 'http://127.0.0.1:4388/Test-web/'
const browser = await chromium.launch()
const failures = []
try {
  for (const [username, destination] of [['anika.perera', 'Users'], ['malini.fernando', 'Evidence Viewer']]) {
    const context = await browser.newContext()
    const page = await context.newPage()
    page.on('pageerror', (error) => failures.push(error.message))
    page.on('response', (response) => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`) })
    page.on('requestfailed', (request) => failures.push(request.url()))
    page.on('request', (request) => { if (/\/api\//.test(request.url())) failures.push(`Unexpected backend call: ${request.url()}`) })
    await page.goto(base)
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible()
    assert.match(page.url(), /\/Test-web\/#\/login/)
    await page.getByRole('textbox', { name: 'Email or username' }).fill(username)
    await page.getByLabel('Password', { exact: true }).fill('tealeaf-dev-only')
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: destination, exact: true }).click()
    await expect(page.locator('h1')).toBeVisible()
    const route = page.url()
    await page.reload()
    await expect(page.locator('h1')).toBeVisible()
    assert.equal(page.url(), route)
    assert.match(route, /\/Test-web\/#\/(?:admin\/users|observations\/OBS-005\/evidence)/)
    await page.evaluate(() => document.fonts.ready)
    await expect.poll(() => page.locator('img').evaluateAll((images) => images.every((img) => img.complete && img.naturalWidth > 0))).toBe(true)
    await page.screenshot({ path: `test-results/pages-${process.env.PAGES_URL ? 'live' : 'local'}-${username}.png`, fullPage: true })
    await context.close()
  }
  assert.deepEqual(failures, [])
  console.log(`Pages smoke passed: ${base}; fixture sign-in, navigation, refresh, images and JS/CSS; no backend requests.`)
} finally {
  await browser.close()
  if (server) await new Promise((done) => server.close(done))
}
