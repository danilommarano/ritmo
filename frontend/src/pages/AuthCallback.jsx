import { useEffect } from 'react'
import { useParams } from 'react-router-dom'

/**
 * OAuth callback page. Opened in a popup by AuthModal.
 * Extracts the access_token or code from the URL fragment/query
 * and sends it back to the parent window via postMessage.
 */
function AuthCallback() {
  const { provider } = useParams()

  useEffect(() => {
    // Parse token from URL hash (implicit flow: Google, Facebook)
    const hash = window.location.hash.substring(1)
    const hashParams = new URLSearchParams(hash)
    const accessToken = hashParams.get('access_token')
    const idToken = hashParams.get('id_token')

    // Parse code from URL query (authorization code flow: GitHub, Apple)
    const queryParams = new URLSearchParams(window.location.search)
    const code = queryParams.get('code')
    const error = queryParams.get('error')

    if (window.opener) {
      window.opener.postMessage(
        {
          type: `${provider}_auth_callback`,
          access_token: accessToken,
          id_token: idToken,
          code: code,
          error: error,
        },
        window.location.origin
      )
    }

    // Close popup after a short delay
    setTimeout(() => {
      window.close()
    }, 500)
  }, [provider])

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Autenticando...</p>
      </div>
    </div>
  )
}

export default AuthCallback
