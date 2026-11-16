import { expect, test } from '@playwright/test'

test('registers a volunteer, restores the session, signs out, and rejects invalid login', async ({ page }) => {
  const email = `volunteer-${Date.now()}@example.test`
  const password = 'Browser-test-password-123!'

  await page.goto('/register')
  await page.getByLabel(/Full name/).fill('Browser Test Volunteer')
  await page.getByLabel(/I am joining as/).selectOption('volunteer')
  await page.getByLabel(/Email address/).fill(email)
  await page.getByLabel(/^Password/).fill(password)
  await page.getByLabel(/Confirm password/).fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page).toHaveURL(/\/volunteer\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'The next good handoff starts here.' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'The next good handoff starts here.' })).toBeVisible()
  await expect(page.getByText('Browser Test Volunteer')).toBeVisible()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel(/Email address/).fill(email)
  await page.getByLabel(/^Password/).fill('invalid-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toHaveText('Invalid email or password.')
})
