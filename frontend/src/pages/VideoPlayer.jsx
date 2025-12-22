import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import './VideoPlayer.css'

function VideoPlayer() {
  const { id } = useParams()
  const [video, setVideo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchVideo()
  }, [id])

  const fetchVideo = async () => {
    try {
      const response = await fetch(`/api/videos/videos/${id}/`)
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

  if (loading) {
    return <div className="loading">Carregando vídeo...</div>
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error">Erro: {error}</div>
        <Link to="/" className="back-link">← Voltar para biblioteca</Link>
      </div>
    )
  }

  if (!video) {
    return (
      <div className="error-container">
        <div className="error">Vídeo não encontrado</div>
        <Link to="/" className="back-link">← Voltar para biblioteca</Link>
      </div>
    )
  }

  return (
    <div className="video-player">
      <Link to="/" className="back-link">← Voltar para biblioteca</Link>
      
      <div className="video-container">
        <video
          controls
          autoPlay
          className="video-element"
          src={video.url}
        >
          Seu navegador não suporta a reprodução de vídeos.
        </video>
      </div>

      <div className="video-details">
        <h1>{video.title}</h1>
        {video.description && (
          <p className="description">{video.description}</p>
        )}
        {video.metadata && (
          <div className="metadata">
            {video.metadata.duration && (
              <span className="meta-item">Duração: {video.metadata.duration}</span>
            )}
            {video.metadata.uploadDate && (
              <span className="meta-item">
                Enviado em: {new Date(video.metadata.uploadDate).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default VideoPlayer
