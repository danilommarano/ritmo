import { useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

// Social provider configs
const PROVIDERS = [
  {
    id: 'google',
    name: 'Google',
    color: 'bg-white hover:bg-gray-100 text-gray-800',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    ),
  },
  {
    id: 'github',
    name: 'GitHub',
    color: 'bg-gray-900 hover:bg-gray-800 text-white',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
    ),
  },
  {
    id: 'facebook',
    name: 'Facebook',
    color: 'bg-[#1877F2] hover:bg-[#166FE5] text-white',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  {
    id: 'apple',
    name: 'Apple',
    color: 'bg-black hover:bg-gray-900 text-white',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
      </svg>
    ),
  },
]

// OAuth popup configuration per provider
const OAUTH_CONFIGS = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'openid email profile',
    responseType: 'token',
    getParams: (clientId) => ({
      client_id: clientId,
      redirect_uri: `${window.location.origin}/auth/callback/google`,
      scope: 'openid email profile',
      response_type: 'token',
      prompt: 'select_account',
    }),
  },
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    getParams: (clientId) => ({
      client_id: clientId,
      redirect_uri: `${window.location.origin}/auth/callback/github`,
      scope: 'user:email',
    }),
  },
  facebook: {
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    getParams: (clientId) => ({
      client_id: clientId,
      redirect_uri: `${window.location.origin}/auth/callback/facebook`,
      scope: 'email,public_profile',
      response_type: 'token',
    }),
  },
  apple: {
    authUrl: 'https://appleid.apple.com/auth/authorize',
    getParams: (clientId) => ({
      client_id: clientId,
      redirect_uri: `${window.location.origin}/auth/callback/apple`,
      scope: 'name email',
      response_type: 'code id_token',
      response_mode: 'fragment',
    }),
  },
}

function AuthModal({ isOpen, onClose, reason = 'export' }) {
  const { socialLogin } = useAuth()
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(null) // provider id being loaded

  if (!isOpen) return null

  const reasonText = {
    export: 'Para exportar seu vídeo, crie uma conta ou faça login.',
    save: 'Para salvar seu projeto, crie uma conta ou faça login.',
    default: 'Crie uma conta ou faça login para continuar.',
  }

  const handleSocialLogin = async (provider) => {
    setError(null)
    setLoading(provider.id)

    try {
      // For Google, use the Google Sign-In library if available
      if (provider.id === 'google' && window.google?.accounts?.oauth2) {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
          scope: 'openid email profile',
          callback: async (response) => {
            if (response.access_token) {
              const result = await socialLogin('google', response.access_token)
              if (result.success) {
                onClose()
              } else {
                setError(result.error)
              }
            }
            setLoading(null)
          },
        })
        tokenClient.requestAccessToken()
        return
      }

      // For other providers, open OAuth popup
      const config = OAUTH_CONFIGS[provider.id]
      if (!config) {
        setError(`Provider ${provider.name} não configurado ainda`)
        setLoading(null)
        return
      }

      const clientId = getClientId(provider.id)
      if (!clientId) {
        setError(`${provider.name} não está configurado. Configure as credenciais OAuth.`)
        setLoading(null)
        return
      }

      const params = config.getParams(clientId)
      const queryString = new URLSearchParams(params).toString()
      const authUrl = `${config.authUrl}?${queryString}`

      // Open popup
      const width = 500
      const height = 600
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2
      const popup = window.open(
        authUrl,
        `${provider.id}_auth`,
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      )

      // Listen for callback
      const handleMessage = async (event) => {
        if (event.origin !== window.location.origin) return

        const { type, access_token, code, error: authError } = event.data || {}

        if (type === `${provider.id}_auth_callback`) {
          window.removeEventListener('message', handleMessage)
          popup?.close()

          if (authError) {
            setError(authError)
            setLoading(null)
            return
          }

          const result = await socialLogin(provider.id, access_token, code)
          if (result.success) {
            onClose()
          } else {
            setError(result.error)
          }
          setLoading(null)
        }
      }

      window.addEventListener('message', handleMessage)

      // Check if popup was closed without completing
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed)
          window.removeEventListener('message', handleMessage)
          setLoading(null)
        }
      }, 1000)
    } catch (err) {
      setError(err.message)
      setLoading(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div>
            <h2 className="text-xl font-bold text-white">Entrar no Ritmo</h2>
            <p className="text-sm text-gray-400 mt-1">
              {reasonText[reason] || reasonText.default}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Social buttons */}
        <div className="px-6 py-6 space-y-3">
          {PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              onClick={() => handleSocialLogin(provider)}
              disabled={loading !== null}
              className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${provider.color} ${
                loading === provider.id ? 'opacity-75' : ''
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading === provider.id ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                provider.icon
              )}
              <span>Continuar com {provider.name}</span>
            </button>
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-6 mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 pb-6">
          <p className="text-xs text-gray-500 text-center">
            Ao continuar, você concorda com nossos{' '}
            <span className="text-blue-400 cursor-pointer hover:underline">Termos de Uso</span>
            {' '}e{' '}
            <span className="text-blue-400 cursor-pointer hover:underline">Política de Privacidade</span>.
          </p>
        </div>
      </div>
    </div>
  )
}

function getClientId(provider) {
  const envMap = {
    google: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    facebook: import.meta.env.VITE_FACEBOOK_APP_ID,
    github: import.meta.env.VITE_GITHUB_CLIENT_ID,
    apple: import.meta.env.VITE_APPLE_CLIENT_ID,
  }
  return envMap[provider] || ''
}

export default AuthModal
