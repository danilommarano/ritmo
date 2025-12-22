import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import './RhythmEditor.css'

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

  return (
    <div className="rhythm-editor">
      <div className="editor-header">
        <Link to="/" className="back-link">← Voltar</Link>
        <h1>{video.title}</h1>
      </div>

      <div className="editor-content">
        <div className="video-section">
          <div className="video-container">
            <video
              ref={videoRef}
              src={video.file_url}
              onTimeUpdate={handleTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className="video-player"
            >
              Seu navegador não suporta reprodução de vídeos.
            </video>
            
            <div className="rhythm-display">
              {currentBar > 0 ? (
                <>
                  <div className="bar-display">Compasso: {currentBar}</div>
                  <div className="beat-display">Batida: {currentBeat}</div>
                </>
              ) : (
                <div className="waiting-display">Aguardando início...</div>
              )}
            </div>
          </div>

          <div className="video-controls">
            <button onClick={handlePlayPause} className="play-button">
              {isPlaying ? '⏸️ Pausar' : '▶️ Reproduzir'}
            </button>
            <div className="time-display">
              {formatTime(currentTime)} / {formatTime(video.duration)}
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-card">
            <h2>Configuração de Ritmo</h2>
            
            <div className="form-group">
              <label>BPM (Batidas por Minuto)</label>
              <input
                type="number"
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                min="1"
                max="300"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Fórmula de Compasso</label>
                <div className="time-signature">
                  <input
                    type="number"
                    value={timeSignatureNum}
                    onChange={(e) => setTimeSignatureNum(Number(e.target.value))}
                    min="1"
                    max="16"
                  />
                  <span>/</span>
                  <input
                    type="number"
                    value={timeSignatureDen}
                    onChange={(e) => setTimeSignatureDen(Number(e.target.value))}
                    min="1"
                    max="16"
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Início do Ritmo (segundos)</label>
              <div className="input-with-button">
                <input
                  type="number"
                  value={offsetStart}
                  onChange={(e) => setOffsetStart(Number(e.target.value))}
                  min="0"
                  step="0.1"
                />
                <button onClick={setOffsetToCurrent} className="btn-small">
                  Usar tempo atual
                </button>
              </div>
            </div>

            <button onClick={saveRhythmGrid} className="btn-primary">
              Salvar Configuração
            </button>
          </div>

          <div className="settings-card">
            <h2>Exportar Vídeo</h2>
            
            <div className="form-group">
              <label>Tempo Inicial (segundos)</label>
              <div className="input-with-button">
                <input
                  type="number"
                  value={startTime}
                  onChange={(e) => setStartTime(Number(e.target.value))}
                  min="0"
                  step="0.1"
                />
                <button onClick={setStartTimeToCurrent} className="btn-small">
                  Usar tempo atual
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Tempo Final (segundos)</label>
              <div className="input-with-button">
                <input
                  type="number"
                  value={endTime || 0}
                  onChange={(e) => setEndTime(Number(e.target.value))}
                  min="0"
                  step="0.1"
                />
                <button onClick={setEndTimeToCurrent} className="btn-small">
                  Usar tempo atual
                </button>
              </div>
            </div>

            <div className="export-info">
              <p>Duração do corte: {formatTime((endTime || 0) - startTime)}</p>
            </div>

            <button
              onClick={exportVideo}
              disabled={exporting}
              className="btn-export"
            >
              {exporting ? 'Exportando...' : '📥 Exportar com Contador'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RhythmEditor
