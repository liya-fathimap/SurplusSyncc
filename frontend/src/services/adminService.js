import apiClient from './apiClient.js'

function getData(response) {
  return response.data.data
}

export async function getAdminUsers(params = {}) {
  return getData(await apiClient.get('/admin/users', { params }))
}

export async function getAdminUser(userId) {
  return getData(await apiClient.get(`/admin/users/${userId}`))
}

export async function setAdminUserActive(userId, active) {
  return getData(await apiClient.patch(`/admin/users/${userId}/activation`, { active }))
}

export async function setAdminVerification(userId, decision) {
  return getData(await apiClient.patch(`/admin/users/${userId}/verification`, { decision }))
}

export async function getAdminMonitor(type, params = {}) {
  return getData(await apiClient.get(`/admin/${type}`, { params }))
}

export async function getAdminOverview() {
  return getData(await apiClient.get('/analytics/overview'))
}

export async function getAdminDeliveryRoute(deliveryId) {
  return getData(await apiClient.get(`/locations/deliveries/${deliveryId}/route`))
}

export async function getAdminMonthly(months = 12) {
  return getData(await apiClient.get('/analytics/monthly', { params: { months } }))
}

export async function getAdminCategories() {
  return getData(await apiClient.get('/analytics/categories'))
}

export async function getAdminProviderPerformance() {
  return getData(await apiClient.get('/analytics/providers'))
}

export function getAdminApiError(error) {
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
