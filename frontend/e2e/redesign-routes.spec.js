import { expect, test } from '@playwright/test'

const password = 'Browser-test-password-123!'

async function registerRole(page, role, name) {
  const email = `${role}-${Date.now()}@routes.example.test`
  await page.goto('/register')
  await page.getByLabel(/Full name/).fill(name)
  await page.getByLabel(/I am joining as/).selectOption(role)
  if (role === 'provider') await page.getByLabel(/Business name/).fill(`${name} Kitchen`)
  if (role === 'ngo') await page.getByLabel(/Organization name/).fill(`${name} Community`)
  await page.getByLabel(/Email address/).fill(email)
  await page.getByLabel(/^Password/).fill(password)
  await page.getByLabel(/Confirm password/).fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(new RegExp(`/${role}/dashboard$`))
}

async function verifyRoutes(page, paths) {
  for (const path of paths) {
    await page.goto(path)
    await expect(page).toHaveURL(new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
    await expect(
      page.locator('.workspace-main h1, .workspace-main h2, .workspace-main h3, .workspace-main [role="alert"]').first(),
      `The route ${path} should render page content`,
    ).toBeVisible()
  }
}

test('all provider, NGO, volunteer, and admin routes render within their role workspace', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await registerRole(page, 'provider', 'Provider Route Tester')
  await verifyRoutes(page, [
    '/provider/dashboard',
    '/provider/listings/new',
    '/provider/listings',
    '/provider/listings/000000000000000000000001',
    '/provider/reservations',
    '/provider/pickups',
    '/provider/analytics',
    '/provider/profile',
  ])
  await page.getByRole('button', { name: 'Sign out' }).click()

  await registerRole(page, 'ngo', 'NGO Route Tester')
  await verifyRoutes(page, [
    '/ngo/dashboard',
    '/ngo/food',
    '/ngo/food/000000000000000000000001',
    '/ngo/map',
    '/ngo/reservations',
    '/ngo/reservations/000000000000000000000001',
    '/ngo/tracking',
    '/ngo/notifications',
    '/ngo/analytics',
    '/ngo/profile',
  ])
  await page.getByRole('button', { name: 'Sign out' }).click()

  await registerRole(page, 'volunteer', 'Volunteer Route Tester')
  await verifyRoutes(page, [
    '/volunteer/dashboard',
    '/volunteer/tasks',
    '/volunteer/tasks/000000000000000000000001',
    '/volunteer/deliveries',
    '/volunteer/verification',
    '/volunteer/history',
    '/volunteer/notifications',
    '/volunteer/profile',
  ])
  await page.getByRole('button', { name: 'Sign out' }).click()

  await page.goto('/login')
  await page.getByLabel(/Email address/).fill('admin-browser-test@example.test')
  await page.getByLabel(/^Password/).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/admin\/dashboard$/)
  await verifyRoutes(page, [
    '/admin/dashboard',
    '/admin/users',
    '/admin/providers',
    '/admin/ngos',
    '/admin/listings',
    '/admin/reservations',
    '/admin/deliveries',
    '/admin/activity',
    '/admin/analytics',
  ])

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Open workspace navigation' }).click()
  await expect(page.getByRole('navigation', { name: 'Operations control room navigation' })).toBeVisible()
  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(documentWidth).toBeLessThanOrEqual(390)
  expect(pageErrors).toEqual([])
})
