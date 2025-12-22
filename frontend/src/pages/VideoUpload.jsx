import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './VideoUpload.css'

function VideoUpload() {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState(null)

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      // Validate file type
      const validTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/mkv', 'video/webm']
      if (!validTypes.includes(selectedFile.type)) {
        setError('Formato de vídeo não suportado. Use MP4, AVI, MOV, MKV ou WEBM.')
        return
      }
      
      // Validate file size (500MB max)
      const maxSize = 500 * 1024 * 1024
      if (selectedFile.size > maxSize) {
        setError('Arquivo muito grande. Tamanho máximo: 500MB.')
        return
      }
      
      setFile(selectedFile)
      setError(null)
      
      // Set default title from filename
      if (!title) {
        const filename = selectedFile.name.replace(/\.[^/.]+$/, '')
        setTitle(filename)
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!file) {
      setError('Selecione um arquivo de vídeo.')
      return
    }
    
    if (!title.trim()) {
      setError('Digite um título para o vídeo.')
      return
    }
    
    setUploading(true)
    setError(null)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', title)
      formData.append('description', description)
      
      const xhr = new XMLHttpRequest()
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100)
          setUploadProgress(progress)
        }
      })
      
      // Handle completion
      xhr.addEventListener('load', async () => {
        if (xhr.status === 201) {
          const video = JSON.parse(xhr.responseText)
          
          // Process metadata
          try {
            await fetch(`/api/videos/videos/${video.id}/process_metadata/`, {
              method: 'POST'
            })
          } catch (err) {
            console.error('Failed to process metadata:', err)
          }
          
          // Redirect to editor
          navigate(`/editor/${video.id}`)
        } else {
          setError('Falha no upload. Tente novamente.')
          setUploading(false)
        }
      })
      
      xhr.addEventListener('error', () => {
        setError('Erro de rede. Verifique sua conexão.')
        setUploading(false)
      })
      
      xhr.open('POST', '/api/videos/videos/')
      xhr.send(formData)
      
    } catch (err) {
      setError('Erro ao fazer upload: ' + err.message)
      setUploading(false)
    }
  }

  return (
    <div className="video-upload">
      <div className="upload-container">
        <h1>Upload de Vídeo</h1>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="upload-form">
          <div className="form-group">
            <label htmlFor="file-input" className="file-label">
              {file ? (
                <div className="file-selected">
                  <span className="file-icon">📹</span>
                  <div className="file-info">
                    <div className="file-name">{file.name}</div>
                    <div className="file-size">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </div>
                  </div>
                </div>
              ) : (
                <div className="file-placeholder">
                  <span className="upload-icon">⬆️</span>
                  <p>Clique para selecionar um vídeo</p>
                  <p className="file-hint">MP4, AVI, MOV, MKV ou WEBM (máx. 500MB)</p>
                </div>
              )}
            </label>
            <input
              id="file-input"
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              disabled={uploading}
              className="file-input"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="title">Título</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={uploading}
              placeholder="Nome do vídeo"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="description">Descrição (opcional)</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={uploading}
              placeholder="Descreva o conteúdo do vídeo"
              rows={4}
            />
          </div>
          
          {uploading && (
            <div className="upload-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="progress-text">
                {uploadProgress < 100 
                  ? `Enviando... ${uploadProgress}%` 
                  : 'Processando vídeo...'}
              </p>
            </div>
          )}
          
          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate('/')}
              disabled={uploading}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              className="btn-primary"
            >
              {uploading ? 'Enviando...' : 'Fazer Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default VideoUpload
