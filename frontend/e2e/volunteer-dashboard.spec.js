import { expect, test } from '@playwright/test'

test('volunteer can review task availability and notifications then safely sign out', async ({ page }) => {
  const email = `volunteer-workspace-${Date.now()}@example.test`
  const password = 'Browser-test-password-123!'

  await page.goto('/register')
  await page.getByLabel(/Full name/).fill('Volunteer Workspace Tester')
  await page.getByLabel(/I am joining as/).selectOption('volunteer')
  await page.getByLabel(/Email address/).fill(email)
  await page.getByLabel(/^Password/).fill(password)
  await page.getByLabel(/Confirm password/).fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByRole('heading', { name: 'The next good handoff starts here.' })).toBeVisible()
  await expect(page.getByText('No active deliveries')).toBeVisible()

  await page.getByRole('link', { name: 'Available tasks' }).click()
  await expect(page.getByRole('heading', { name: 'Available delivery tasks' })).toBeVisible()
  await expect(page.getByText('No available tasks right now')).toBeVisible()

  await page.getByRole('link', { name: 'Notifications' }).click()
  await expect(page.getByRole('heading', { name: 'Volunteer updates' })).toBeVisible()
  await expect(page.getByText('No notifications yet')).toBeVisible()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/volunteer/dashboard')
  await expect(page).toHaveURL(/\/login$/)
})
