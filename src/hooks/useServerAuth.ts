import { useState, useEffect, useCallback } from 'react'
import { getServerSession, serverLogin, serverRegister, serverLogout, type ServerSession, type ServerApiError } from '../lib/serverApi'

interface ServerAuthState {
  session: ServerSession | null
  isSignedIn: boolean
  loading: boolean
  error: string | null
}

export function useServerAuth() {
  const [state, setState] = useState<ServerAuthState>({
    session: getServerSession(),
    isSignedIn: !!getServerSession(),
    loading: false,
    error: null,
  })

  const refresh = useCallback(() => {
    const session = getServerSession()
    setState((s) => ({ ...s, session, isSignedIn: !!session }))
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'friday-server-session') refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const session = await serverLogin(email, password)
      setState({ session, isSignedIn: true, loading: false, error: null })
      return session
    } catch (e) {
      const msg = (e as ServerApiError).message || 'Login failed'
      setState((s) => ({ ...s, loading: false, error: msg }))
      throw e
    }
  }, [])

  const register = useCallback(async (email: string, password: string, name?: string) => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const session = await serverRegister(email, password, name)
      setState({ session, isSignedIn: true, loading: false, error: null })
      return session
    } catch (e) {
      const msg = (e as ServerApiError).message || 'Registration failed'
      setState((s) => ({ ...s, loading: false, error: msg }))
      throw e
    }
  }, [])

  const logout = useCallback(async () => {
    await serverLogout()
    setState({ session: null, isSignedIn: false, loading: false, error: null })
  }, [])

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }))
  }, [])

  return { ...state, login, register, logout, clearError, refresh }
}
