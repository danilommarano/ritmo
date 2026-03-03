import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Play, Edit, Clock, Video, Upload, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

function VideoLibrary() {
  const { authFetch } = useAuth()
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const formatDuration = (seconds) => {
    if (!seconds) return ''
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  useEffect(() => {
    fetchVideos()
  }, [])

  const fetchVideos = async () => {
    try {
      const response = await authFetch('/api/videos/videos/')
      if (!response.ok) {
        throw new Error('Falha ao carregar vídeos')
      }
      const data = await response.json()
      // A API retorna um objeto paginado com {count, next, previous, results}
      setVideos(data.results || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-96 flex items-center justify-center">
        <div className="flex items-center space-x-3 text-ritmo-600">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-lg font-medium">Carregando vídeos...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-96 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <Video className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">Erro ao carregar vídeos</h3>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={fetchVideos}
            className="px-6 py-2 bg-ritmo-gradient text-white rounded-full hover:shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Biblioteca de Vídeos
            </h1>
            <p className="text-xl text-gray-600">
              Gerencie seus vídeos e crie ritmos incríveis
            </p>
          </div>
          <Link 
            to="/upload"
            className="flex items-center space-x-2 px-6 py-3 bg-ritmo-gradient text-white rounded-full hover:shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            <Upload className="w-5 h-5" />
            <span className="font-medium">Novo Vídeo</span>
          </Link>
        </div>
      </div>

      {/* Content */}
      {videos.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-24 h-24 bg-gradient-to-br from-ritmo-100 to-creative-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Video className="w-12 h-12 text-ritmo-600" />
          </div>
          <h3 className="text-2xl font-semibold text-gray-900 mb-4">
            Nenhum vídeo ainda
          </h3>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Comece fazendo upload do seu primeiro vídeo para criar ritmos incríveis
          </p>
          <Link 
            to="/upload"
            className="inline-flex items-center space-x-2 px-8 py-4 bg-ritmo-gradient text-white rounded-full hover:shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            <Upload className="w-5 h-5" />
            <span className="font-medium">Fazer Upload</span>
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {videos.map((video) => (
            <div 
              key={video.id} 
              className="group bg-white rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-gradient-to-br from-ritmo-100 to-creative-100 overflow-hidden">
                {video.thumbnail ? (
                  <img 
                    src={video.thumbnail} 
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Video className="w-12 h-12 text-ritmo-600" />
                  </div>
                )}
                
                {/* Play overlay */}
                <Link 
                  to={`/video/${video.id}`}
                  className="absolute inset-0 bg-black/0 hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300"
                >
                  <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform duration-300">
                    <Play className="w-8 h-8 text-ritmo-600 ml-1" />
                  </div>
                </Link>

                {/* Duration badge */}
                {video.duration && (
                  <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/70 text-white text-sm rounded-lg flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatDuration(video.duration)}</span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2">
                  {video.title}
                </h3>
                {video.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {video.description}
                  </p>
                )}

                {/* Actions */}
                <div className="flex space-x-3">
                  <Link 
                    to={`/video/${video.id}`}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 border-2 border-ritmo-300 text-ritmo-700 rounded-full hover:bg-ritmo-50 transition-all duration-300"
                  >
                    <Play className="w-4 h-4" />
                    <span className="font-medium">Assistir</span>
                  </Link>
                  <Link 
                    to={`/editor/${video.id}`}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-creative-gradient text-white rounded-full hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                  >
                    <Edit className="w-4 h-4" />
                    <span className="font-medium">Editar</span>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default VideoLibrary
