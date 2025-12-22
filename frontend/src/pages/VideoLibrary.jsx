import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './VideoLibrary.css'

function VideoLibrary() {
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
      const response = await fetch('/api/videos/videos/')
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
    return <div className="loading">Carregando vídeos...</div>
  }

  if (error) {
    return <div className="error">Erro: {error}</div>
  }

  return (
    <div className="video-library">
      <h2>Biblioteca de Vídeos</h2>
      {videos.length === 0 ? (
        <p className="no-videos">Nenhum vídeo disponível.</p>
      ) : (
        <div className="video-grid">
          {videos.map((video) => (
            <Link key={video.id} to={`/video/${video.id}`} className="video-card">
              <div className="video-thumbnail">
                {video.thumbnail ? (
                  <img src={video.thumbnail} alt={video.title} />
                ) : (
                  <div className="placeholder-thumbnail">
                    <span>📹</span>
                  </div>
                )}
              </div>
              <div className="video-info">
                <h3>{video.title}</h3>
                {video.description && (
                  <p className="video-description">{video.description}</p>
                )}
                {video.duration && (
                  <span className="video-duration">{formatDuration(video.duration)}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default VideoLibrary
