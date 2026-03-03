import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Music, Upload, Home, Video, LogIn, LogOut, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import AuthModal from './AuthModal'

function Layout({ children }) {
  const { user, isAuthenticated, logout } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-ritmo-50 via-creative-50 to-electric-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2 group">
              <div className="w-10 h-10 bg-ritmo-gradient rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                <Music className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-ritmo-600 to-creative-600 bg-clip-text text-transparent">
                Ritmo
              </span>
            </Link>

            {/* Navigation */}
            <nav className="flex items-center space-x-6">
              <Link 
                to="/app" 
                className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:text-ritmo-600 hover:bg-ritmo-50 rounded-lg transition-all duration-300"
              >
                <Home className="w-4 h-4" />
                <span className="font-medium">Biblioteca</span>
              </Link>
              
              <Link 
                to="/upload" 
                className="flex items-center space-x-2 px-6 py-2 bg-ritmo-gradient text-white rounded-full hover:shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                <Upload className="w-4 h-4" />
                <span className="font-medium">Upload</span>
              </Link>

              {/* Auth */}
              {isAuthenticated ? (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 rounded-lg">
                    <User className="w-4 h-4 text-ritmo-600" />
                    <span className="text-sm font-medium text-gray-700 max-w-[140px] truncate">
                      {user?.full_name || user?.email}
                    </span>
                  </div>
                  <button
                    onClick={logout}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-300"
                    title="Sair"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 text-ritmo-600 hover:bg-ritmo-50 rounded-lg transition-all duration-300 font-medium"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Entrar</span>
                </button>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 mt-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-6 h-6 bg-ritmo-gradient rounded-lg flex items-center justify-center">
              <Music className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold">Ritmo</span>
          </div>
          <p className="text-gray-400">
            &copy; 2025 Ritmo. Todos os direitos reservados.
          </p>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        reason="default"
      />
    </div>
  )
}

export default Layout
