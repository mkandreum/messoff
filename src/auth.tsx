import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User } from './types'
import { api, ApiError } from './lib/api'

type AuthValue = {
  user: User | null
  loading: boolean
  bootError: string | null
  notice: string | null
  clearNotice: () => void
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  logoutAll: () => Promise<void>
  updateProfile: (patch: { name?: string }) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  deleteAccount: (password: string) => Promise<void>
  setUser: (user: User | null) => void
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [bootError, setBootError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const setUser = useCallback((next: User | null) => {
    setUserState(next)
  }, [])

  useEffect(() => {
    const bootTheme = localStorage.getItem('pulso.theme')
    if (bootTheme === 'night' || bootTheme === 'paper') {
      document.documentElement.dataset.theme = bootTheme
    }
  }, [])

  useEffect(() => {
    const onUnauthorized = () => {
      setUserState(null)
      setNotice('Tu sesión ha caducado. Vuelve a entrar.')
    }
    window.addEventListener('pulso:unauthorized', onUnauthorized)
    return () => window.removeEventListener('pulso:unauthorized', onUnauthorized)
  }, [])

  useEffect(() => {
    let alive = true
    api<{ user: User }>('/auth/me')
      .then((data) => {
        if (alive) setUserState(data.user)
      })
      .catch((error: unknown) => {
        if (!alive) return
        if (error instanceof ApiError && error.status === 401) return
        setBootError(
          error instanceof ApiError
            ? error.message
            : 'No se pudo comprobar la sesión.',
        )
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ user: User }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    setUserState(data.user)
    setNotice(null)
    setBootError(null)
  }, [])

  const register = useCallback(async (name: string, email: string, password: string) => {
    const data = await api<{ user: User }>('/auth/register', {
      method: 'POST',
      body: { name, email, password },
    })
    setUserState(data.user)
    setNotice(null)
    setBootError(null)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' })
    } catch {
      /* la sesión local se cierra igualmente */
    }
    setUserState(null)
    setNotice(null)
    setBootError(null)
  }, [])

  const logoutAll = useCallback(async () => {
    await api('/auth/logout-all', { method: 'POST' })
    setUserState(null)
  }, [])

  const updateProfile = useCallback(async (patch: { name?: string }) => {
    const data = await api<{ user: User }>('/auth/me', {
      method: 'PATCH',
      body: patch,
    })
    setUserState(data.user)
  }, [])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const data = await api<{ user: User }>('/auth/password', {
      method: 'PATCH',
      body: { currentPassword, newPassword },
    })
    setUserState(data.user)
  }, [])

  const deleteAccount = useCallback(async (password: string) => {
    await api('/auth/delete', { method: 'POST', body: { password } })
    setUserState(null)
  }, [])

  const value: AuthValue = {
    user,
    loading,
    bootError,
    notice,
    clearNotice: () => setNotice(null),
    login,
    register,
    logout,
    logoutAll,
    updateProfile,
    changePassword,
    deleteAccount,
    setUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return context
}
