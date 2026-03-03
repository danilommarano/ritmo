import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Video, X, Check, AlertCircle, ArrowLeft, FileVideo } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

function VideoUpload() {
  const navigate = useNavigate()
  const { authFetch, getAuthHeaders } = useAuth()
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
            await authFetch(`/api/videos/videos/${video.id}/process_metadata/`, {
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
      // Add auth headers (JWT or session key)
      const headers = getAuthHeaders()
      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value)
      })
      xhr.send(formData)
      
    } catch (err) {
      setError('Erro ao fazer upload: ' + err.message)
      setUploading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/app')}
          className="flex items-center space-x-2 text-gray-600 hover:text-ritmo-600 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Biblioteca</span>
        </button>
        
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Upload de Vídeo
        </h1>
        <p className="text-xl text-gray-600">
          Faça upload do seu vídeo para criar ritmos incríveis
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-red-900">Erro no upload</h3>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Upload Form */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {/* File Upload Area */}
          <div>
            <label htmlFor="file-input" className="block text-sm font-medium text-gray-700 mb-3">
              Arquivo de Vídeo
            </label>
            <div className="relative">
              <input
                id="file-input"
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                disabled={uploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              
              {file ? (
                <div className="border-2 border-success-300 bg-success-50 rounded-2xl p-6 flex items-center space-x-4">
                  <div className="w-12 h-12 bg-success-gradient rounded-xl flex items-center justify-center flex-shrink-0">
                    <FileVideo className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">{file.name}</h4>
                    <p className="text-sm text-gray-600">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    disabled={uploading}
                    className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors disabled:opacity-50"
                  >
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 hover:border-ritmo-400 rounded-2xl p-12 text-center transition-colors">
                  <div className="w-16 h-16 bg-gradient-to-br from-ritmo-100 to-creative-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-8 h-8 text-ritmo-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Clique para selecionar um vídeo
                  </h3>
                  <p className="text-gray-600 mb-1">
                    ou arraste e solte aqui
                  </p>
                  <p className="text-sm text-gray-500">
                    MP4, AVI, MOV, MKV ou WEBM (máx. 500MB)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Title Input */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-3">
              Título *
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={uploading}
              placeholder="Nome do vídeo"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-ritmo-500 focus:border-ritmo-500 transition-colors disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          {/* Description Input */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-3">
              Descrição (opcional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={uploading}
              placeholder="Descreva o conteúdo do vídeo"
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-ritmo-500 focus:border-ritmo-500 transition-colors disabled:bg-gray-50 disabled:text-gray-500 resize-none"
            />
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="bg-gradient-to-r from-ritmo-50 to-creative-50 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">
                  {uploadProgress < 100 ? 'Enviando vídeo...' : 'Processando vídeo...'}
                </span>
                <span className="text-sm font-medium text-ritmo-600">
                  {uploadProgress}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="h-full bg-ritmo-gradient transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              {uploadProgress >= 100 && (
                <p className="text-sm text-gray-600 mt-2 flex items-center">
                  <Check className="w-4 h-4 text-success-600 mr-1" />
                  Upload concluído! Processando metadados...
                </p>
              )}
            </div>
          )}

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={() => navigate('/app')}
              disabled={uploading}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-full hover:bg-gray-50 transition-all duration-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={uploading || !file || !title.trim()}
              className="flex-1 px-6 py-3 bg-ritmo-gradient text-white rounded-full hover:shadow-lg transition-all duration-300 transform hover:scale-105 font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:shadow-none flex items-center justify-center space-x-2"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Fazer Upload</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default VideoUpload
