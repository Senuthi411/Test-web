import { expect, test, type Page } from '@playwright/test'

async function signIn(page: Page) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'User ID' }).fill('USR-001')
  await page.getByLabel('Password', { exact: true }).fill('tealeaf-dev-only')
  await page.getByRole('button', { name: 'Log In', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

async function expectNoPageOverflow(page: Page, label: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), label).toBe(true)
}

test('View details opens one drawer, Escape closes it and focus returns to the row menu', async ({ page }) => {
  await signIn(page)
  await page.goto('/admin/device-sessions')
  const table = page.getByRole('table', { name: 'Device sessions', exact: true })
  await expect(table.getByText('DS-3012')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.getByRole('button', { name: 'Actions for DS-3012' }).click()
  await page.getByRole('menuitem', { name: 'View details' }).click()
  const details = page.getByRole('dialog', { name: 'Session DS-3012' })
  await expect(details).toBeVisible()
  await expect(details.getByText(/Revoked sessions cannot be reactivated and cannot upload/)).toBeVisible()
  await expect(details.getByRole('button', { name: 'Start recovery' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Actions for DS-3012' })).toBeFocused()

  // The backdrop closes it too.
  await page.getByRole('button', { name: 'Actions for DS-3091' }).click()
  await page.getByRole('menuitem', { name: 'View details' }).click()
  await expect(page.getByRole('dialog', { name: 'Session DS-3091' })).toBeVisible()
  await page.mouse.click(10, 300)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

for (const width of [1440, 1024, 768, 430, 375, 320]) {
  test(`device sessions table and drawer at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await signIn(page)
    await page.goto('/admin/device-sessions')
    const table = page.getByRole('table', { name: 'Device sessions', exact: true })
    await expect(table.getByText('DS-3091')).toBeVisible()
    await expectNoPageOverflow(page, `table at ${width}px`)
    const before = await page.getByRole('heading', { name: 'Device Sessions', level: 1 }).boundingBox()

    const trigger = page.getByRole('button', { name: 'Actions for DS-3091' })
    await trigger.scrollIntoViewIfNeeded()
    await trigger.click()
    await page.getByRole('menuitem', { name: 'View details' }).click()
    const details = page.getByRole('dialog', { name: 'Session DS-3091' })
    await expect(details).toBeVisible()
    // Measure after the slide-in animation has finished.
    await details.evaluate((node) => Promise.all(node.getAnimations().map((animation) => animation.finished)))
    const box = (await details.boundingBox())!
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1)
    expect(box.x).toBeGreaterThanOrEqual(0)
    if (width >= 768) expect(box.width).toBeLessThan(width * 0.75)
    else expect(box.width).toBeGreaterThanOrEqual(Math.min(width, 440) - 1)
    for (const name of ['Close session details', 'Revoke session']) {
      const button = (await details.getByRole('button', { name, exact: true }).boundingBox())!
      expect(button.x + button.width, `${name} inside the drawer`).toBeLessThanOrEqual(width + 1)
      expect(button.height, `${name} is large enough to tap`).toBeGreaterThanOrEqual(32)
    }
    // Opening the drawer does not move the page underneath.
    const during = await page.getByRole('heading', { name: 'Device Sessions', level: 1 }).boundingBox()
    expect(during?.x).toBe(before?.x)
    expect(during?.width).toBe(before?.width)
    await page.screenshot({ path: `test-results/device-sessions/${width}-drawer.png` })

    await details.getByRole('button', { name: 'Close session details' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expectNoPageOverflow(page, `after closing at ${width}px`)
    await page.screenshot({ path: `test-results/device-sessions/${width}-table.png` })
  })
}
