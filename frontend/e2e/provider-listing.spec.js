import { expect, test } from '@playwright/test'

function localDateTime(hoursFromNow) {
  const date = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

test('publishes a food listing and verifies it is persisted in the provider workspace', async ({ page }) => {
  const email = `provider-${Date.now()}@example.test`
  const password = 'Browser-test-password-123!'
  const listingTitle = `Fresh surplus ${Date.now()}`

  await page.goto('/register')
  await page.getByLabel(/Full name/).fill('Browser Test Provider')
  await page.getByLabel(/I am joining as/).selectOption('provider')
  await page.getByLabel(/Business name/).fill('Browser Test Kitchen')
  await page.getByLabel(/Email address/).fill(email)
  await page.getByLabel(/^Password/).fill(password)
  await page.getByLabel(/Confirm password/).fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page).toHaveURL(/\/provider\/dashboard$/)
  await page.getByRole('main').getByRole('link', { name: 'Create listing' }).click()
  await expect(page.getByRole('heading', { name: 'Create a food listing' })).toBeVisible()

  await page.getByLabel(/Listing title/).fill(listingTitle)
  await page.getByLabel(/Food category/).fill('prepared meals')
  await page.getByLabel(/Total quantity/).fill('12')
  await page.getByLabel(/^Unit/).fill('portions')
  await page.getByLabel(/Preparation time/).fill(localDateTime(-1))
  await page.getByLabel(/Collection deadline/).fill(localDateTime(24))
  await page.getByLabel(/^Description/).fill('Fresh meals ready for safe community pickup.')
  await page.getByLabel(/Storage conditions/).fill('Keep refrigerated.')
  await page.getByLabel(/Allergens/).fill('None')
  await page.getByLabel(/Pickup address/).fill('100 Test Street')
  await page.getByLabel('Longitude').fill('-73.987')
  await page.getByLabel('Latitude').fill('40.758')
  await page.getByRole('button', { name: 'Publish listing' }).click()

  await expect(page).toHaveURL(/\/provider\/listings\/[a-f\d]{24}$/i)
  await expect(page.getByRole('heading', { name: listingTitle })).toBeVisible()
  await expect(page.getByText('12 portions')).toHaveCount(2)

  await page.getByRole('link', { name: /My listings/i }).click()
  await expect(page.getByText(listingTitle)).toBeVisible()
})
