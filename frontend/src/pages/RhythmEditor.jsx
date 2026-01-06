import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Play, Pause, Download, Settings, Music, Timer, ArrowLeft, Zap, RotateCcw } from 'lucide-react'

function RhythmEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const videoRef = useRef(null)
  
  const [video, setVideo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Rhythm grid parameters
  const [bpm, setBpm] = useState(120)
  const [timeSignatureNum, setTimeSignatureNum] = useState(4)
  const [timeSignatureDen, setTimeSignatureDen] = useState(4)
  const [offsetStart, setOffsetStart] = useState(0)
  
  // Export parameters
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(null)
  const [exporting, setExporting] = useState(false)
  
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [currentBar, setCurrentBar] = useState(0)
  const [currentBeat, setCurrentBeat] = useState(0)
  
  // Tap tempo recording state
  const [isRecording, setIsRecording] = useState(false)
  const [taps, setTaps] = useState([])
  const [recordingStartTime, setRecordingStartTime] = useState(null)
  const [showTapFlash, setShowTapFlash] = useState(false)

  useEffect(() => {
    fetchVideo()
  }, [id])

  useEffect(() => {
    if (video && video.duration) {
      setEndTime(video.duration)
    }
  }, [video])

  useEffect(() => {
    // Update beat/bar display based on current time
    if (currentTime >= offsetStart) {
      const beatDuration = 60.0 / bpm
      const barDuration = beatDuration * timeSignatureNum
      const elapsed = currentTime - offsetStart
      
      const bar = Math.floor(elapsed / barDuration) + 1
      const beat = Math.floor((elapsed % barDuration) / beatDuration) + 1
      
      setCurrentBar(bar)
      setCurrentBeat(beat)
    } else {
      setCurrentBar(0)
      setCurrentBeat(0)
    }
  }, [currentTime, bpm, timeSignatureNum, offsetStart])

  // Keyboard listener for space bar during recording
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.code === 'Space' && isRecording && videoRef.current) {
        e.preventDefault()
        recordTap()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isRecording, recordingStartTime])

  const fetchVideo = async () => {
    try {
      const response = await fetch(`/api/videos/videos/${id}/`)
      if (!response.ok) {
        throw new Error('Vídeo não encontrado')
      }
      const data = await response.json()
      console.log('Video data:', data)
      console.log('File URL:', data.file_url)
      setVideo(data)
      
      // Try to load existing rhythm grid (404 is expected if doesn't exist)
      try {
        const gridResponse = await fetch(`/api/videos/videos/${id}/rhythm_grid/`)
        if (gridResponse.ok) {
          const gridData = await gridResponse.json()
          setBpm(gridData.bpm)
          setTimeSignatureNum(gridData.time_signature_numerator)
          setTimeSignatureDen(gridData.time_signature_denominator)
          setOffsetStart(gridData.offset_start)
        }
        // 404 is expected when rhythm grid doesn't exist yet
      } catch (err) {
        // Silently ignore - rhythm grid will be created when user saves
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const setOffsetToCurrent = () => {
    setOffsetStart(currentTime)
  }

  const setStartTimeToCurrent = () => {
    setStartTime(currentTime)
  }

  const setEndTimeToCurrent = () => {
    setEndTime(currentTime)
  }

  const startRecording = () => {
    if (!videoRef.current) return
    
    // Reset taps and start video
    setTaps([])
    setRecordingStartTime(null)
    setIsRecording(true)
    
    // Start video from current position
    videoRef.current.currentTime = currentTime
    videoRef.current.play()
    setIsPlaying(true)
  }

  const stopRecording = () => {
    setIsRecording(false)
    
    if (taps.length < 4) {
      alert('Grave pelo menos 4 batidas para calcular o BPM')
      setTaps([])
      return
    }
    
    // Calculate BPM from taps
    calculateBPMFromTaps()
  }

  const recordTap = () => {
    const currentVideoTime = videoRef.current.currentTime
    
    // First tap sets the recording start time and offset
    if (taps.length === 0) {
      setRecordingStartTime(currentVideoTime)
      setOffsetStart(currentVideoTime)
    }
    
    setTaps(prev => [...prev, currentVideoTime])
    
    // Show visual feedback
    setShowTapFlash(true)
    setTimeout(() => setShowTapFlash(false), 150)
  }

  const calculateBPMFromTaps = () => {
    if (taps.length < 2) return
    
    // Calculate intervals between taps
    const intervals = []
    for (let i = 1; i < taps.length; i++) {
      intervals.push(taps[i] - taps[i - 1])
    }
    
    // Calculate average interval
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
    
    // Convert to BPM (60 seconds / interval)
    const calculatedBPM = Math.round(60 / avgInterval)
    
    // Set the calculated BPM
    setBpm(calculatedBPM)
    
    // Show success message
    alert(`BPM detectado: ${calculatedBPM}\nBatidas gravadas: ${taps.length}\nOffset: ${offsetStart.toFixed(2)}s`)
  }

  const saveRhythmGrid = async () => {
    try {
      const data = {
        bpm,
        time_signature_numerator: timeSignatureNum,
        time_signature_denominator: timeSignatureDen,
        offset_start: offsetStart,
      }
      console.log('Saving rhythm grid:', data)
      
      const response = await fetch(`/api/videos/videos/${id}/create_rhythm_grid/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      
      console.log('Response status:', response.status)
      const responseText = await response.text()
      console.log('Response:', responseText)
      
      if (!response.ok) {
        throw new Error(`Falha ao salvar configuração de ritmo: ${response.status} - ${responseText}`)
      }
      
      alert('Configuração de ritmo salva com sucesso!')
    } catch (err) {
      console.error('Error saving rhythm grid:', err)
      alert('Erro ao salvar: ' + err.message)
    }
  }

  const exportVideo = async () => {
    setExporting(true)
    try {
      // First, save the rhythm grid
      await saveRhythmGrid()
      
      // Then export the video
      const response = await fetch(`/api/videos/videos/${id}/export_with_counter/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start_time: startTime,
          end_time: endTime,
          use_rhythm_grid: true,
        }),
      })
      
      if (!response.ok) {
        throw new Error('Falha ao exportar vídeo')
      }
      
      // Download the file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${video.title}_with_counter.mp4`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      alert('Vídeo exportado com sucesso!')
    } catch (err) {
      alert('Erro ao exportar: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  const formatTime = (seconds) => {
    if (!seconds && seconds !== 0) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="min-h-96 flex items-center justify-center">
        <div className="flex items-center space-x-3 text-ritmo-600">
          <div className="w-6 h-6 border-2 border-ritmo-600 border-t-transparent rounded-full animate-spin" />
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
            <Music className="w-8 h-8 text-red-600" />
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

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/app"
          className="flex items-center space-x-2 text-gray-600 hover:text-ritmo-600 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Biblioteca</span>
        </Link>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Editor de Ritmo
            </h1>
            <p className="text-xl text-gray-600">
              {video.title}
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Video Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="relative">
              <video
                ref={videoRef}
                src={video.file_url}
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                className="w-full aspect-video bg-black"
              >
                Seu navegador não suporta reprodução de vídeos.
              </video>
              
              {/* Tap flash indicator */}
              {showTapFlash && (
                <div className="absolute inset-0 bg-success-400 opacity-50 animate-pulse pointer-events-none" />
              )}
              
              {/* Rhythm Display Overlay */}
              <div className="absolute top-4 left-4 right-4">
                {isRecording ? (
                  <div className="bg-red-500 text-white px-6 py-3 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                      <span className="font-medium">GRAVANDO - Pressione ESPAÇO</span>
                    </div>
                    <div className="bg-white/20 px-3 py-1 rounded-full">
                      {taps.length} batidas
                    </div>
                  </div>
                ) : currentBar > 0 ? (
                  <div className="bg-ritmo-gradient text-white px-6 py-3 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="text-center">
                        <div className="text-sm opacity-90">Compasso</div>
                        <div className="text-2xl font-bold">{currentBar}</div>
                      </div>
                      <div className="w-px h-8 bg-white/30" />
                      <div className="text-center">
                        <div className="text-sm opacity-90">Batida</div>
                        <div className="text-2xl font-bold">{currentBeat}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-800/80 text-white px-6 py-3 rounded-2xl">
                    <span className="font-medium">Aguardando início do ritmo...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Video Controls */}
            <div className="p-6 bg-gray-50 flex items-center justify-between">
              <button
                onClick={handlePlayPause}
                className="flex items-center space-x-2 px-6 py-3 bg-ritmo-gradient text-white rounded-full hover:shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                <span className="font-medium">{isPlaying ? 'Pausar' : 'Reproduzir'}</span>
              </button>
              
              <div className="text-gray-600 font-medium">
                {formatTime(currentTime)} / {formatTime(video.duration)}
              </div>
            </div>
          </div>
        </div>

        {/* Settings Section */}
        <div className="space-y-6">
          {/* Rhythm Configuration */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center space-x-2 mb-6">
              <Music className="w-5 h-5 text-ritmo-600" />
              <h2 className="text-xl font-bold text-gray-900">Configuração de Ritmo</h2>
            </div>
            
            {/* Tap Tempo Recording */}
            <div className="space-y-4 mb-6">
              <h3 className="font-semibold text-gray-900">Gravar Batidas</h3>
              <p className="text-sm text-gray-600">
                {isRecording 
                  ? `Pressione ESPAÇO no ritmo da música (${taps.length} batidas gravadas)`
                  : 'Clique para iniciar e pressione ESPAÇO seguindo o ritmo'}
              </p>
              
              {!isRecording ? (
                <button 
                  onClick={startRecording} 
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-creative-gradient text-white rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                >
                  <Zap className="w-4 h-4" />
                  <span className="font-medium">Iniciar Gravação</span>
                </button>
              ) : (
                <button 
                  onClick={stopRecording} 
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
                >
                  <Pause className="w-4 h-4" />
                  <span className="font-medium">Parar e Calcular BPM</span>
                </button>
              )}
              
              {taps.length > 0 && !isRecording && (
                <div className="bg-success-50 border border-success-200 rounded-xl p-4">
                  <p className="text-sm text-success-800 mb-2">Batidas gravadas: {taps.length}</p>
                  <button 
                    onClick={() => setTaps([])} 
                    className="flex items-center space-x-1 text-success-700 hover:text-success-800 text-sm"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Limpar</span>
                  </button>
                </div>
              )}
            </div>
            
            <div className="border-t border-gray-200 pt-6">
              <h3 className="font-semibold text-gray-900 mb-4">Configuração Manual</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    BPM (Batidas por Minuto)
                  </label>
                  <input
                    type="number"
                    value={bpm}
                    onChange={(e) => setBpm(Number(e.target.value))}
                    min="1"
                    max="300"
                    disabled={isRecording}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ritmo-500 focus:border-ritmo-500 transition-colors disabled:bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fórmula de Compasso
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={timeSignatureNum}
                      onChange={(e) => setTimeSignatureNum(Number(e.target.value))}
                      min="1"
                      max="16"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ritmo-500 focus:border-ritmo-500 transition-colors"
                    />
                    <span className="text-gray-500 font-medium">/</span>
                    <input
                      type="number"
                      value={timeSignatureDen}
                      onChange={(e) => setTimeSignatureDen(Number(e.target.value))}
                      min="1"
                      max="16"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ritmo-500 focus:border-ritmo-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Início do Ritmo (segundos)
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      value={offsetStart}
                      onChange={(e) => setOffsetStart(Number(e.target.value))}
                      min="0"
                      step="0.1"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ritmo-500 focus:border-ritmo-500 transition-colors"
                    />
                    <button 
                      onClick={setOffsetToCurrent} 
                      className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap"
                    >
                      Usar atual
                    </button>
                  </div>
                </div>
              </div>

              <button 
                onClick={saveRhythmGrid} 
                className="w-full mt-6 px-4 py-3 bg-ritmo-gradient text-white rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105 font-medium"
              >
                Salvar Configuração
              </button>
            </div>
          </div>

          {/* Export Section */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center space-x-2 mb-6">
              <Download className="w-5 h-5 text-energy-600" />
              <h2 className="text-xl font-bold text-gray-900">Exportar Vídeo</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tempo Inicial (segundos)
                </label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={startTime}
                    onChange={(e) => setStartTime(Number(e.target.value))}
                    min="0"
                    step="0.1"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ritmo-500 focus:border-ritmo-500 transition-colors"
                  />
                  <button 
                    onClick={setStartTimeToCurrent} 
                    className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap"
                  >
                    Usar atual
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tempo Final (segundos)
                </label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={endTime || 0}
                    onChange={(e) => setEndTime(Number(e.target.value))}
                    min="0"
                    step="0.1"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ritmo-500 focus:border-ritmo-500 transition-colors"
                  />
                  <button 
                    onClick={setEndTimeToCurrent} 
                    className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap"
                  >
                    Usar atual
                  </button>
                </div>
              </div>

              <div className="bg-electric-50 border border-electric-200 rounded-xl p-4">
                <div className="flex items-center space-x-2">
                  <Timer className="w-4 h-4 text-electric-600" />
                  <span className="text-sm font-medium text-electric-800">
                    Duração do corte: {formatTime((endTime || 0) - startTime)}
                  </span>
                </div>
              </div>

              <button
                onClick={exportVideo}
                disabled={exporting}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-energy-gradient text-white rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105 font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {exporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Exportando...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Exportar com Contador</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RhythmEditor
