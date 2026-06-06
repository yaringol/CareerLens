import { createContext, useContext, useState, ReactNode } from 'react'

const TOKEN_KEY = 'auth_token'

export interface AuthUser {
  id: string
  email: string
  role: 'admin' | 'user'
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function apiBase(): string {
  const raw = (import.meta as unknown as { env: Record<string, string> }).env.VITE_API_BASE_URL?.trim()
  if (raw) return raw.replace(/\/$/, '')
  return '/api'
}

function decodeExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

function decodeUser(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (!payload.id || !payload.email || !payload.role) return null
    return { id: payload.id, email: payload.email, role: payload.role }
  } catch {
    return null
  }
}

function isTokenValid(token: string): boolean {
  const exp = decodeExpiry(token)
  if (exp === null) return false
  return exp * 1000 > Date.now()
}

/** Read JWT from localStorage synchronously so protected routes don't flash-redirect to /login. */
function readStoredAuth(): { token: string | null; user: AuthUser | null } {
  const stored = localStorage.getItem(TOKEN_KEY)
  if (stored && isTokenValid(stored)) {
    const decoded = decodeUser(stored)
    if (decoded) return { token: stored, user: decoded }
  }
  if (stored) localStorage.removeItem(TOKEN_KEY)
  return { token: null, user: null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [stored] = useState(readStoredAuth)
  const [user, setUser] = useState<AuthUser | null>(stored.user)
  const [token, setToken] = useState<string | null>(stored.token)

  function storeAuth(jwt: string): void {
    localStorage.setItem(TOKEN_KEY, jwt)
    setToken(jwt)
    const decoded = decodeUser(jwt)
    setUser(decoded)
  }

  async function login(email: string, password: string): Promise<void> {
    const res = await fetch(`${apiBase()}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login failed')
    storeAuth(data.token)
  }

  async function register(email: string, password: string): Promise<void> {
    const res = await fetch(`${apiBase()}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Registration failed')
    storeAuth(data.token)
  }

  function logout(): void {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
