import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi, type Credentials, type User } from '../api/auth.ts'
import { AuthContext, type AuthContextValue } from './AuthContext.ts'

const TOKEN_KEY = 'last-lap:token'

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => readToken() !== null)

  useEffect(() => {
    const token = readToken()
    if (!token) return
    let cancelled = false
    authApi
      .me(token)
      .then((restored) => {
        if (!cancelled) setUser(restored)
      })
      .catch(() => {
        writeToken(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (credentials: Credentials) => {
    const { token, user: authorized } = await authApi.login(credentials)
    writeToken(token)
    setUser(authorized)
  }, [])

  const register = useCallback(async (credentials: Credentials) => {
    const { token, user: created } = await authApi.register(credentials)
    writeToken(token)
    setUser(created)
  }, [])

  const logout = useCallback(async () => {
    const token = readToken()
    writeToken(null)
    setUser(null)
    if (token) await authApi.logout(token).catch(() => undefined)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
