import { io } from 'socket.io-client'
import apiClient from './apiClient.js'
import { getAccessToken } from './authService.js'

const eventListeners = new Map()
const forwardedEvents = [
  'auth:revoked',
  'delivery:available',
  'delivery:updated',
  'notification:new',
  'reservation:updated',
]
let socket

function dispatchRealtimeEvent(eventName, payload) {
  for (const listener of eventListeners.get(eventName) || []) {
    listener(payload)
  }
}

export function connectRealtime() {
  const token = getAccessToken()
  if (!token) return null
  if (socket?.auth?.token === token) return socket

  if (socket) disconnectRealtime(socket)
  const apiOrigin = new URL(
    apiClient.defaults.baseURL,
    globalThis.location?.origin || 'http://localhost:5173',
  ).origin
  socket = io(import.meta.env.VITE_SOCKET_URL || apiOrigin, {
    autoConnect: false,
    auth: { token },
    reconnection: true,
  })

  for (const eventName of forwardedEvents) {
    socket.on(eventName, (payload) => dispatchRealtimeEvent(eventName, payload))
  }
  socket.on('connect_error', (error) => {
    if (/invalid or expired authentication token|user account is unavailable/i.test(error.message)) {
      dispatchRealtimeEvent('auth:revoked')
    }
  })
  socket.connect()
  return socket
}

export function disconnectRealtime(target = socket) {
  if (!target) return
  target.disconnect()
  if (socket === target) socket = undefined
}

export function subscribeRealtime(eventName, listener) {
  if (!eventListeners.has(eventName)) eventListeners.set(eventName, new Set())
  eventListeners.get(eventName).add(listener)
  return () => {
    const listeners = eventListeners.get(eventName)
    if (!listeners) return
    listeners.delete(listener)
    if (listeners.size === 0) eventListeners.delete(eventName)
  }
}
