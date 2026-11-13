import { expect, test, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'

// Read the actual route manifest without pulling browser/alias imports into Node's
// Playwright configuration. Fail loudly if its grouping format changes.
const manifest = readFileSync(new URL('../../src/app/routing/screens.ts', import.meta.url), 'utf8')
const groups = [...manifest.matchAll(/base:\s*'([^']+)'[\s\S]*?roles:\s*\[([^\]]+)\][\s\S]*?screens:\s*\[([\s\S]*?)\n\s*\],/g)].map((match) => ({
  base: match[1], roles: [...match[2].matchAll(/'([^']+)'/g)].map((role) => role[1]), screens: [...match[3].matchAll(/\{\s*path:\s*'([^']*)'/g)].map((screen) => ({ path: screen[1] })),
}))
if (groups.length !== 6 || groups.some((group) => !group.screens.length)) throw new Error('Update responsive coverage for the changed route manifest format.')

const accounts: Record<string, string> = { ADMINISTRATOR: 'anika.perera', SUPERVISOR: 'malini.fernando', DISEASE_EXPERT: 'tara.wijesinghe', REPORTING_USER: 'maya.dissanayake' }
const samples: Record<string, string> = { userId: 'USR-005', role: 'supervisor', estateId: 'EST-001', divisionId: 'DIV-001', sessionId: 'DS-3012', observationId: 'OBS-014', correctionId: 'COR-005', quarantineId: 'QUA-002', assignmentId: 'ASG-001', caseId: 'CASE-018', diseaseId: 'DIS-001', referralId: 'REF-014' }
function sample(path: string) { return path.replace(/:([A-Za-z]+)/g, (_, key: string) => samples[key]) }
async function signIn(page: Page, account = 'anika.perera') {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.getByRole('textbox', { name: 'Email or username' }).fill(account)
  await page.getByLabel('Password', { exact: true }).fill('tealeaf-dev-only')
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.locator('h1')).toBeVisible()
}

test('desktop collapse persists and a mobile drawer stays closed after resizing', async ({ page }) => {
  await signIn(page)
  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
  await page.getByRole('button', { name: 'Expand sidebar' }).click()
  await page.setViewportSize({ width: 375, height: 800 })
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible()
  await page.setViewportSize({ width: 1024, height: 900 })
  await expect(page.getByRole('dialog', { name: 'Navigation' })).toHaveCount(0)
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
  await page.setViewportSize({ width: 375, height: 800 })
  await expect(page.getByRole('dialog', { name: 'Navigation' })).toHaveCount(0)
})
async function layout(page: Page) {
  return page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll('body *')].filter((node) => {
      const box = node.getBoundingClientRect()
      return box.width > 0 && box.right > innerWidth + 1 && !node.closest('table, [role="tablist"]') && getComputedStyle(node).position !== 'absolute'
    }).slice(0, 8).map((node) => ({ tag: node.tagName, class: String(node.className), text: node.textContent?.slice(0, 60) })),
  }))
}

for (const width of [320, 375, 430, 768, 1024, 1280, 1440, 1920, 3840]) {
  test(`route-by-route responsive audit ${width}px`, async ({ browser }) => {
    test.setTimeout(300_000)
    const records = []
    const errors: string[] = []
    await mkdir('test-results/responsive', { recursive: true })
    for (const role of Object.keys(accounts)) {
      const context = await browser.newContext({ viewport: { width, height: width === 3840 ? 2160 : 900 } })
      const page = await context.newPage()
      page.on('pageerror', (error) => errors.push(error.message))
      await signIn(page, accounts[role])
      const paths = groups.filter((group) => group.roles.includes(role)).flatMap((group) => group.screens.map((screen) => sample(`${group.base}${screen.path ? '/' + screen.path : ''}`)))
      if (role === 'ADMINISTRATOR') paths.push('/profile', '/forbidden')
      if (role === 'SUPERVISOR') paths.push('/observations/OBS-005/revisions', '/observations/OBS-005/compare', '/observations/OBS-005/original?state=unavailable', ...[2, 3, 4, 5, 6, 7].map((n) => `/assignments/ASG-00${n}`), '/review/observations/OBS-999', '/assignments/ASG-999')
      for (const path of paths) {
        await page.goto(path, { waitUntil: 'domcontentloaded' })
        await expect(page.locator('h1, main h2').first()).toBeVisible()
        await expect(page.locator('table[aria-busy="true"]')).toHaveCount(0)
        const result = await layout(page)
        records.push({ role, path, ...result })
        await writeFile(`test-results/responsive/routes-${width}.json`, JSON.stringify(records, null, 2))
        if ([320, 768, 1440, 3840].includes(width) && ['/admin', '/admin/users', '/review', '/observations/OBS-014/evidence', '/assignments/new', '/profile'].includes(path)) await page.screenshot({ path: `test-results/responsive/${width}-${path.slice(1).replaceAll('/', '-')}.png`, fullPage: true })
      }
      if (role === 'ADMINISTRATOR') {
        for (const path of ['/login', '/session-expired']) {
          await page.goto(path)
          await expect(page.locator('h1')).toBeVisible()
          records.push({ role: 'public', path, ...await layout(page) })
        }
      }
      await context.close()
    }
    await writeFile(`test-results/responsive/routes-${width}.json`, JSON.stringify(records, null, 2))
    expect(errors).toEqual([])
    expect(records.filter((record) => record.scroll > record.width + 1)).toEqual([])
  })
}

for (const width of [320, 375, 430]) {
  test(`mobile navigation, filters, forms and dialogs at ${width}px`, async ({ page }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width, height: 700 })
    await signIn(page)
    const menu = page.getByRole('button', { name: 'Open navigation' })
    await menu.click()
    const drawer = page.getByRole('dialog', { name: 'Navigation' })
    await expect(drawer).toBeVisible()
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
    await expect(drawer.getByRole('link', { name: 'Review Queue' })).toHaveCount(0)
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab')
      expect(await drawer.evaluate((node) => node.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(drawer).toHaveCount(0)
    await expect(menu).toBeFocused()
    await menu.click()
    await page.mouse.click(width - 5, 100)
    await expect(drawer).toHaveCount(0)
    await menu.click()
    await drawer.getByRole('link', { name: 'Users', exact: true }).click()
    await expect(drawer).toHaveCount(0)
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
    const filter = page.getByRole('combobox', { name: /Role:/ })
    await filter.click()
    const list = page.getByRole('listbox', { name: 'Role' })
    const box = await list.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(width)
    await page.keyboard.press('Escape')
    const actions = page.getByRole('button', { name: 'Actions for Anika Perera' })
    await actions.click()
    const rowMenu = page.getByRole('menu', { name: 'Actions for Anika Perera' })
    await expect(rowMenu).toBeVisible()
    const rowBox = await rowMenu.boundingBox()
    expect(rowBox!.x).toBeGreaterThanOrEqual(0)
    expect(rowBox!.x + rowBox!.width).toBeLessThanOrEqual(width)
    await page.keyboard.press('Escape')
    await page.goto('/admin/users/new')
    await expect(page.getByRole('textbox', { name: /Full name/i })).toBeVisible()
    await page.getByRole('button', { name: /Create user/i }).click()
    await expect(page.getByText('Full name is required')).toBeVisible()
    expect((await layout(page)).scroll).toBeLessThanOrEqual(width + 1)
    await page.goto('/admin/device-sessions?session=DS-3091')
    await page.getByRole('button', { name: 'Revoke session', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const dialogBox = await dialog.boundingBox()
    expect(dialogBox!.width).toBeLessThanOrEqual(width - 16)
    expect(dialogBox!.height).toBeLessThanOrEqual(700 - 16)
    await page.keyboard.press('Escape')
    await page.goto('/admin/users/new')
    await page.getByRole('textbox', { name: /Full name/i }).fill('Responsive Test Admin')
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill('responsive.test@example.test')
    await page.getByRole('combobox', { name: 'Role', exact: true }).selectOption('ADMINISTRATOR')
    await page.setViewportSize({ width, height: 480 })
    await page.getByRole('button', { name: 'Create user', exact: true }).click()
    const review = page.getByRole('dialog', { name: 'Review and create user' })
    await expect(review).toBeVisible()
    const shortBox = await review.boundingBox()
    expect(shortBox!.height).toBeLessThanOrEqual(480 - 16)
    const confirm = review.getByRole('button', { name: 'Create user', exact: true })
    await confirm.scrollIntoViewIfNeeded()
    await expect(confirm).toBeVisible()
    await page.keyboard.press('Escape')
  })
}

test('320px assignment editing, evidence controls and correction approval remain usable', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 320, height: 700 })
  await signIn(page, 'malini.fernando')
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('dialog', { name: 'Navigation' }).getByRole('link', { name: 'Fieldwork Assignments' }).click()
  await page.getByRole('link', { name: 'Create assignment', exact: true }).click()
  await page.getByRole('button', { name: 'Assign task', exact: true }).click()
  await page.getByRole('link', { name: 'Edit / reassign' }).click()
  await page.getByRole('textbox', { name: 'Reason for change (required)' }).fill('Task details clarified after site walk')
  expect((await layout(page)).scroll).toBeLessThanOrEqual(320)
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await page.getByRole('button', { name: 'Cancel assignment', exact: true }).click()
  const cancel = page.getByRole('dialog', { name: /Cancel ASG-/ })
  expect((await cancel.boundingBox())!.width).toBeLessThanOrEqual(288)
  await cancel.getByRole('button', { name: 'Keep assignment' }).click()
  await page.getByRole('button', { name: 'Simulate: Field Worker starts task' }).click()
  await page.getByRole('button', { name: 'Simulate: mobile submission received' }).click()
  await page.getByRole('link', { name: 'Open evidence viewer', exact: true }).click()
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect(page.getByLabel('Zoom level')).toHaveText('125%')
  await page.getByRole('button', { name: 'Expand image' }).click()
  expect((await page.getByRole('dialog').boundingBox())!.width).toBeLessThanOrEqual(288)
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Back to assignment', exact: true }).click()
  await page.getByRole('button', { name: 'Accept & mark completed' }).click()
  await expect(page.getByText(/The observation review decision remains separate and unchanged/)).toBeVisible()
  expect((await layout(page)).scroll).toBeLessThanOrEqual(320)
  await page.goto('/review/corrections/COR-005/approve')
  await page.getByRole('checkbox', { name: 'I compared the original and revised data' }).check()
  await page.getByRole('checkbox', { name: 'Original evidence is unchanged' }).check()
  await page.getByRole('button', { name: 'Confirm approval' }).click()
  await expect(page.getByText('Approved — waiting for RevisionApplied')).toBeVisible()
  expect((await layout(page)).scroll).toBeLessThanOrEqual(320)
  await page.screenshot({ path: 'test-results/responsive/320-correction-workflow.png', fullPage: true })
})
