import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  clearAccessToken,
  getAccessToken,
  getCurrentUser,
  login as loginRequest,
  register as registerRequest,
  saveAccessToken,
} from '../services/authService.js'
import { connectRealtime, disconnectRealtime, subscribeRealtime } from '../services/realtimeService.js'
import AuthContext from './authContext.js'

function getDashboardPath(role) {
  return `/${role}/dashboard`
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let active = true

    async function restoreSession() {
      if (!getAccessToken()) {
        setStatus('anonymous')
        return
      }

      try {
        const currentUser = await getCurrentUser()
        if (active) {
          setUser(currentUser)
          setStatus('authenticated')
        }
      } catch (error) {
        if (!active) return
        if (error.response?.status === 401) clearAccessToken()
        setUser(null)
        setStatus('anonymous')
      }
    }

    restoreSession()
    return () => {
      active = false
    }
  }, [])

  const establishSession = useCallback((data) => {
    if (!data?.token || !data?.user) {
      throw new Error('The server returned an invalid authentication response.')
    }
    saveAccessToken(data.token)
    setUser(data.user)
    setStatus('authenticated')
    return data.user
  }, [])

  const login = useCallback(async (credentials) => {
    const data = await loginRequest(credentials)
    return establishSession(data)
  }, [establishSession])

  const register = useCallback(async (credentials) => {
    const data = await registerRequest(credentials)
    return establishSession(data)
  }, [establishSession])

  const logout = useCallback(() => {
    clearAccessToken()
    setUser(null)
    setStatus('anonymous')
  }, [])

  useEffect(() => {
    if (status !== 'authenticated' || !user) {
      disconnectRealtime()
      return undefined
    }

    const activeSocket = connectRealtime()
    const unsubscribe = subscribeRealtime('auth:revoked', logout)
    return () => {
      unsubscribe()
      disconnectRealtime(activeSocket)
    }
  }, [logout, status, user])

  const value = useMemo(() => ({
    user,
    status,
    isAuthenticated: status === 'authenticated',
    login,
    register,
    logout,
    getDashboardPath,
  }), [user, status, login, register, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
