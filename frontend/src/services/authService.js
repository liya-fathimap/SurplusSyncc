import apiClient, { TOKEN_KEY } from './apiClient.js'

export function getAccessToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function saveAccessToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearAccessToken() {
  sessionStorage.removeItem(TOKEN_KEY)
}

export async function register(credentials) {
  const response = await apiClient.post('/auth/register', credentials)
  return response.data.data
}

export async function login(credentials) {
  const response = await apiClient.post('/auth/login', credentials)
  return response.data.data
}

export async function getCurrentUser() {
  const response = await apiClient.get('/auth/me')
  return response.data.data.user
}

export function getApiErrorMessage(error) {
  const data = error.response?.data
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors.map(({ message }) => message).join(' ')
  }
  if (typeof data?.message === 'string') return data.message
  if (error.request) {
    return 'Could not reach SurplusSync. Check that the backend is running and try again.'
  }
  return 'Something went wrong. Please try again.'
}
