import apiClient from './apiClient.js'

function getData(response) {
  return response.data.data
}

export async function getVolunteerAvailableTasks() {
  return getData(await apiClient.get('/deliveries/available'))
}

export async function getVolunteerDeliveries() {
  return getData(await apiClient.get('/deliveries/my-deliveries'))
}

export async function getVolunteerTaskRoute(deliveryId) {
  return getData(await apiClient.get(`/locations/deliveries/${deliveryId}/route`))
}

export async function acceptVolunteerTask(deliveryId) {
  return getData(await apiClient.post(`/deliveries/${deliveryId}/accept`))
}

export async function requestVolunteerVerificationQr(deliveryId, stage) {
  return getData(await apiClient.post(`/deliveries/${deliveryId}/verification-qr`, { stage }))
}

export async function markVolunteerDeliveryInTransit(deliveryId) {
  return getData(await apiClient.patch(`/deliveries/${deliveryId}/in-transit`))
}

export async function failVolunteerDelivery(deliveryId, reason) {
  return getData(await apiClient.post(`/deliveries/${deliveryId}/fail`, { reason }))
}

export async function getVolunteerNotifications(params = {}) {
  return getData(await apiClient.get('/notifications', { params }))
}

export async function markVolunteerNotificationRead(notificationId) {
  return getData(await apiClient.patch(`/notifications/${notificationId}/read`))
}

export function getVolunteerApiError(error) {
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
