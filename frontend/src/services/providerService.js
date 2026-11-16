import apiClient from './apiClient.js'

function getData(response) {
  return response.data.data
}

export async function getProviderOverview() {
  return getData(await apiClient.get('/analytics/overview'))
}

export async function getProviderMonthly(months = 12) {
  return getData(await apiClient.get('/analytics/monthly', { params: { months } }))
}

export async function getProviderCategories() {
  return getData(await apiClient.get('/analytics/categories'))
}

export async function getProviderListings(params = {}) {
  return getData(await apiClient.get('/listings/my-listings', { params }))
}

export async function getProviderListing(listingId) {
  return getData(await apiClient.get(`/listings/my-listings/${listingId}`))
}

export async function createProviderListing(listing) {
  return getData(await apiClient.post('/listings', listing))
}

export async function updateProviderListing(listingId, listing) {
  return getData(await apiClient.put(`/listings/${listingId}`, listing))
}

export async function cancelProviderListing(listingId) {
  return getData(await apiClient.delete(`/listings/${listingId}`))
}

export async function getListingRecommendations(listingId) {
  return getData(await apiClient.get(`/listings/${listingId}/recommendations`))
}

export async function getProviderReservations(params = {}) {
  return getData(await apiClient.get('/reservations', { params }))
}

export async function confirmProviderReservation(reservationId, approvedQuantity) {
  return getData(await apiClient.patch(`/reservations/${reservationId}/confirm`, {
    approvedQuantity,
  }))
}

export async function rejectProviderReservation(reservationId) {
  return getData(await apiClient.patch(`/reservations/${reservationId}/reject`))
}

export async function getProviderDeliveries() {
  return getData(await apiClient.get('/deliveries/my-deliveries'))
}

export async function verifyProviderPickup(deliveryId, code) {
  return getData(await apiClient.post(`/deliveries/${deliveryId}/verify-pickup`, { code }))
}

export function getProviderApiError(error) {
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
