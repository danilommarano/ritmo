import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Play, Edit, Clock, Calendar, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

function VideoPlayer() {
  const { id } = useParams()
  const { authFetch } = useAuth()
  const [video, setVideo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchVideo()
  }, [id])

  const fetchVideo = async () => {
    try {
      const response = await authFetch(`/api/videos/videos/${id}/`)
      if (!response.ok) {
        throw new Error('Vídeo não encontrado')
      }
      const data = await response.json()
      setVideo(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds) => {
    if (!seconds) return ''
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="min-h-96 flex items-center justify-center">
        <div className="flex items-center space-x-3 text-ritmo-600">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-lg font-medium">Carregando vídeo...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-96 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">Erro ao carregar vídeo</h3>
          <p className="text-gray-600">{error}</p>
          <Link 
            to="/app"
            className="inline-flex items-center space-x-2 px-6 py-2 bg-ritmo-gradient text-white rounded-full hover:shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para biblioteca</span>
          </Link>
        </div>
      </div>
    )
  }

  if (!video) {
    return (
      <div className="min-h-96 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
            <Play className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">Vídeo não encontrado</h3>
          <p className="text-gray-600">O vídeo que você está procurando não existe ou foi removido.</p>
          <Link 
            to="/app"
            className="inline-flex items-center space-x-2 px-6 py-2 bg-ritmo-gradient text-white rounded-full hover:shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para biblioteca</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/app"
          className="flex items-center space-x-2 text-gray-600 hover:text-ritmo-600 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Biblioteca</span>
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Video Player */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="aspect-video bg-black">
              <video
                controls
                autoPlay
                className="w-full h-full"
                src={video.file_url}
              >
                Seu navegador não suporta a reprodução de vídeos.
              </video>
            </div>
          </div>
        </div>

        {/* Video Details */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              {video.title}
            </h1>
            
            {video.description && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">Descrição</h3>
                <p className="text-gray-600 leading-relaxed">
                  {video.description}
                </p>
              </div>
            )}

            {/* Metadata */}
            <div className="space-y-3 mb-6">
              <h3 className="font-semibold text-gray-900">Informações</h3>
              
              {video.duration && (
                <div className="flex items-center space-x-2 text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Duração: {formatDuration(video.duration)}</span>
                </div>
              )}
              
              {video.created_at && (
                <div className="flex items-center space-x-2 text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">
                    Enviado em: {new Date(video.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Link 
                to={`/editor/${video.id}`}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-ritmo-gradient text-white rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                <Edit className="w-4 h-4" />
                <span className="font-medium">Editar Ritmo</span>
              </Link>
            </div>
          </div>

          {/* Additional Info */}
          {video.metadata && (
            <div className="bg-gradient-to-br from-ritmo-50 to-creative-50 rounded-3xl p-6 border border-ritmo-200">
              <h3 className="font-semibold text-gray-900 mb-4">Metadados Técnicos</h3>
              <div className="space-y-2 text-sm">
                {video.metadata.width && video.metadata.height && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Resolução:</span>
                    <span className="font-medium text-gray-900">
                      {video.metadata.width} × {video.metadata.height}
                    </span>
                  </div>
                )}
                {video.metadata.fps && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">FPS:</span>
                    <span className="font-medium text-gray-900">{video.metadata.fps}</span>
                  </div>
                )}
                {video.metadata.codec && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Codec:</span>
                    <span className="font-medium text-gray-900">{video.metadata.codec}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default VideoPlayer
