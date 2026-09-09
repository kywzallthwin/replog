import { expect, test } from '@playwright/test'

test('public layout has no horizontal overflow', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expect(page.getByRole('link', { name: 'Register' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible()
})
