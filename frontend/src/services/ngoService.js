import apiClient from './apiClient.js'

function getData(response) {
  return response.data.data
}

export async function getAvailableListings(params = {}) {
  return getData(await apiClient.get('/listings', {
    params: { availability: 'true', limit: 100, sort: 'deadline_asc', ...params },
  }))
}

export async function getRecommendedListings(params = {}) {
  return getData(await apiClient.get('/listings/recommendations', { params }))
}

export async function getNearbyListings(params) {
  return getData(await apiClient.get('/locations/nearby-listings', { params }))
}

export async function getNearbyProviders(params) {
  return getData(await apiClient.get('/locations/nearby-providers', { params }))
}

export async function getAvailableListing(listingId) {
  return getData(await apiClient.get(`/listings/${listingId}`))
}

export async function getNgoReservations(params = {}) {
  return getData(await apiClient.get('/reservations/my-reservations', { params }))
}

export async function getNgoReservation(reservationId) {
  return getData(await apiClient.get(`/reservations/my-reservations/${reservationId}`))
}

export async function requestFoodReservation({ foodListingId, requestedQuantity, collectionMethod }) {
  return getData(await apiClient.post('/reservations', {
    foodListingId,
    requestedQuantity,
    collectionMethod,
  }))
}

export async function cancelNgoReservation(reservationId) {
  return getData(await apiClient.patch(`/reservations/${reservationId}/cancel`))
}

export async function getNgoDeliveries() {
  return getData(await apiClient.get('/deliveries/my-deliveries'))
}

export async function requestVerificationQr(deliveryId, stage) {
  return getData(await apiClient.post(`/deliveries/${deliveryId}/verification-qr`, { stage }))
}

export async function verifyNgoDelivery(deliveryId, code) {
  return getData(await apiClient.post(`/deliveries/${deliveryId}/verify-delivery`, { code }))
}

export async function getNgoNotifications(params = {}) {
  return getData(await apiClient.get('/notifications', { params }))
}

export async function markNgoNotificationRead(notificationId) {
  return getData(await apiClient.patch(`/notifications/${notificationId}/read`))
}

export async function getNgoOverview() {
  return getData(await apiClient.get('/analytics/overview'))
}

export async function getNgoMonthly(months = 12) {
  return getData(await apiClient.get('/analytics/monthly', { params: { months } }))
}

export async function getNgoCategories() {
  return getData(await apiClient.get('/analytics/categories'))
}

export function getNgoApiError(error) {
  const data = error.response?.data
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors.map(({ message }) => message).join(' ')
  }
  if (typeof data?.message === 'string') return data.message
  if (error.request) {
    return 'Could not reach SurplusSync. Check your connection and try again.'
  }
  return error.message || 'Something went wrong. Please try again.'
}
