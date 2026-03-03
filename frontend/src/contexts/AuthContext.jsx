import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

const API_BASE = '/api'

// Generate or retrieve a persistent anonymous session key
function getSessionKey() {
  let key = localStorage.getItem('ritmo_session_key')
  if (!key) {
    key = crypto.randomUUID()
    localStorage.setItem('ritmo_session_key', key)
  }
  return key
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tokens, setTokens] = useState(() => {
    const stored = localStorage.getItem('ritmo_tokens')
    return stored ? JSON.parse(stored) : null
  })
  const sessionKey = getSessionKey()

  // Save tokens to localStorage whenever they change
  useEffect(() => {
    if (tokens) {
      localStorage.setItem('ritmo_tokens', JSON.stringify(tokens))
    } else {
      localStorage.removeItem('ritmo_tokens')
    }
  }, [tokens])

  // Fetch current user on mount or when tokens change
  const fetchUser = useCallback(async () => {
    if (!tokens?.access) {
      setUser(null)
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`${API_BASE}/auth/user/`, {
        headers: { 'Authorization': `Bearer ${tokens.access}` },
      })
      if (res.ok) {
        const data = await res.json()
        setUser(data)
      } else if (res.status === 401) {
        // Try refresh
        const refreshed = await refreshToken()
        if (!refreshed) {
          setTokens(null)
          setUser(null)
        }
      }
    } catch (err) {
      console.error('Failed to fetch user:', err)
    } finally {
      setLoading(false)
    }
  }, [tokens?.access])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  // Refresh the access token
  const refreshToken = useCallback(async () => {
    if (!tokens?.refresh) return false
    
    try {
      const res = await fetch(`${API_BASE}/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: tokens.refresh }),
      })
      if (res.ok) {
        const data = await res.json()
        setTokens(prev => ({ ...prev, access: data.access }))
        return true
      }
    } catch (err) {
      console.error('Token refresh failed:', err)
    }
    return false
  }, [tokens?.refresh])

  // Login with social provider (sends access_token to backend)
  const socialLogin = useCallback(async (provider, accessToken, code) => {
    try {
      const body = {}
      if (accessToken) body.access_token = accessToken
      if (code) body.code = code

      const res = await fetch(`${API_BASE}/auth/social/${provider}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detail || errorData.non_field_errors?.[0] || `Login failed (${res.status})`)
      }

      const data = await res.json()
      setTokens({ access: data.access, refresh: data.refresh })

      // After login, claim any anonymous videos
      await claimAnonymousVideos(data.access)

      // Fetch user
      const userRes = await fetch(`${API_BASE}/auth/user/`, {
        headers: { 'Authorization': `Bearer ${data.access}` },
      })
      if (userRes.ok) {
        setUser(await userRes.json())
      }

      return { success: true }
    } catch (err) {
      console.error(`Social login (${provider}) failed:`, err)
      return { success: false, error: err.message }
    }
  }, [sessionKey])

  // Magic link: request code
  const requestMagicLink = useCallback(async (email) => {
    try {
      const res = await fetch(`${API_BASE}/auth/magic-link/request/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao enviar codigo')
      }
      return { success: true, message: data.message }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }, [])

  // Magic link: verify code
  const verifyMagicLink = useCallback(async (email, code) => {
    try {
      const res = await fetch(`${API_BASE}/auth/magic-link/verify/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Codigo invalido')
      }

      setTokens({ access: data.access, refresh: data.refresh })

      // After login, claim any anonymous videos
      await claimAnonymousVideos(data.access)

      // Fetch full user
      const userRes = await fetch(`${API_BASE}/auth/user/`, {
        headers: { 'Authorization': `Bearer ${data.access}` },
      })
      if (userRes.ok) {
        setUser(await userRes.json())
      } else {
        setUser(data.user)
      }

      return { success: true, created: data.created }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }, [sessionKey])

  // Claim anonymous videos after login
  const claimAnonymousVideos = useCallback(async (accessToken) => {
    try {
      const res = await fetch(`${API_BASE}/auth/claim-videos/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ session_key: sessionKey }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.claimed > 0) {
          console.log(`Claimed ${data.claimed} anonymous video(s)`)
        }
      }
    } catch (err) {
      console.error('Failed to claim videos:', err)
    }
  }, [sessionKey])

  // Logout
  const logout = useCallback(async () => {
    try {
      if (tokens?.access) {
        await fetch(`${API_BASE}/auth/logout/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokens.access}`,
          },
        })
      }
    } catch (err) {
      // Ignore logout errors
    }
    setTokens(null)
    setUser(null)
  }, [tokens?.access])

  // Get headers for API requests (includes auth or session key)
  const getAuthHeaders = useCallback(() => {
    const headers = {}
    if (tokens?.access) {
      headers['Authorization'] = `Bearer ${tokens.access}`
    } else {
      headers['X-Session-Key'] = sessionKey
    }
    return headers
  }, [tokens?.access, sessionKey])

  // Make an authenticated fetch request
  const authFetch = useCallback(async (url, options = {}) => {
    const headers = {
      ...getAuthHeaders(),
      ...options.headers,
    }
    
    const res = await fetch(url, { ...options, headers })
    
    // If 401, try refresh and retry once
    if (res.status === 401 && tokens?.refresh) {
      const refreshed = await refreshToken()
      if (refreshed) {
        const newHeaders = {
          ...options.headers,
          'Authorization': `Bearer ${tokens.access}`,
        }
        return fetch(url, { ...options, headers: newHeaders })
      }
    }
    
    return res
  }, [getAuthHeaders, tokens, refreshToken])

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    tokens,
    sessionKey,
    socialLogin,
    requestMagicLink,
    verifyMagicLink,
    logout,
    getAuthHeaders,
    authFetch,
    refreshUser: fetchUser,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
