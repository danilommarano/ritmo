// Video Editor - Main Component
// Layout: Header with dropdown, Video with floating Toolbar, Configuration Bar (right), Timeline (bottom)

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ChevronDown, Download, Video, X, Undo2, Redo2, LogIn, LogOut, User, Clock, HardDrive, AlertTriangle } from 'lucide-react'
import Toolbar from './Toolbar'
import VideoPreview from './VideoPreview'
import Timeline from './Timeline'
import ConfigurationBar from './ConfigurationBar'
import { generateId } from './utils'
import { useAuth } from '../../contexts/AuthContext'
import AuthModal from '../AuthModal'

// Maximum history size
const MAX_HISTORY = 100

function VideoEditor() {
  const { id } = useParams()
  const videoRef = useRef(null)
  const { user, isAuthenticated, authFetch, logout } = useAuth()
  
  // Auth modal state
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authModalReason, setAuthModalReason] = useState('export')
  
  // Video state
  const [video, setVideo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [originalDuration, setOriginalDuration] = useState(0) // Original video duration
  
  // Elements state (texts, metronomes, alerts)
  const [elements, setElements] = useState([])
  const [selectedElementId, setSelectedElementId] = useState(null)
  
  // Video cuts state
  const [cuts, setCuts] = useState([])
  
  // Video segments state (for speed control and cuts)
  const [videoSegments, setVideoSegments] = useState([
    { id: generateId(), startTime: 0, endTime: null, speed: 1.0 } // null endTime means duration
  ])
  const [selectedSegmentId, setSelectedSegmentId] = useState(null)
  
  // Bar selection state
  const [barSelection, setBarSelection] = useState(null) // { startBar, endBar } or null
  
  // BPM configuration for alerts
  const [bpmConfig, setBpmConfig] = useState({
    bpm: 120,
    timeSignatureNum: 4,
    timeSignatureDen: 4,
    offsetStart: 0
  })
  
  // Waveform data
  const [waveformData, setWaveformData] = useState(null)
  
  // Save state
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  
  // Export dropdown state
  const [showExportDropdown, setShowExportDropdown] = useState(false)
  const [exporting, setExporting] = useState(false)
  
  // Billing state
  const [billingInfo, setBillingInfo] = useState(null) // { credits, storage, subscription }
  
  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')

  // History state for undo/redo
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const isUndoRedoRef = useRef(false)
  const lastRecordedRef = useRef(null)
  const isSeekingRef = useRef(false)
  const historyDebounceRef = useRef(null)
  const pendingHistoryRef = useRef(null)

  // Fetch billing info for authenticated users
  useEffect(() => {
    if (!isAuthenticated) { setBillingInfo(null); return }
    authFetch('/api/billing/status/')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setBillingInfo(data) })
      .catch(() => {})
  }, [isAuthenticated, authFetch])

  // Calculate effective duration based on video segments
  const calculateEffectiveDuration = useCallback(() => {
    if (!videoSegments || videoSegments.length === 0) return originalDuration
    
    let totalDuration = 0
    videoSegments.forEach(segment => {
      const segmentDuration = (segment.endTime || originalDuration) - segment.startTime
      totalDuration += segmentDuration
    })
    
    return totalDuration
  }, [videoSegments, originalDuration])

  // Convert timeline time to actual video time based on segments
  const timelineToVideoTime = useCallback((timelineTime) => {
    if (!videoSegments || videoSegments.length === 0) return timelineTime
    
    let accumulatedTime = 0
    for (const segment of videoSegments) {
      const segmentDuration = (segment.endTime || originalDuration) - segment.startTime
      
      if (timelineTime <= accumulatedTime + segmentDuration) {
        // The time falls within this segment
        const offsetInSegment = timelineTime - accumulatedTime
        return segment.startTime + offsetInSegment
      }
      
      accumulatedTime += segmentDuration
    }
    
    // If we're past all segments, return the end of the last segment
    const lastSegment = videoSegments[videoSegments.length - 1]
    return lastSegment.endTime || originalDuration
  }, [videoSegments, originalDuration])

  // Convert actual video time to timeline time based on segments
  const videoToTimelineTime = useCallback((videoTime) => {
    if (!videoSegments || videoSegments.length === 0) return videoTime
    
    let accumulatedTime = 0
    for (const segment of videoSegments) {
      const segmentStart = segment.startTime
      const segmentEnd = segment.endTime || originalDuration
      
      if (videoTime >= segmentStart && videoTime <= segmentEnd) {
        // The time falls within this segment
        const offsetInSegment = videoTime - segmentStart
        return accumulatedTime + offsetInSegment
      }
      
      accumulatedTime += segmentEnd - segmentStart
    }
    
    return accumulatedTime
  }, [videoSegments, originalDuration])

  // Get current segment info based on timeline time
  const getCurrentSegmentInfo = useCallback((timelineTime) => {
    if (!videoSegments || videoSegments.length === 0) return null
    
    let accumulatedTime = 0
    for (let i = 0; i < videoSegments.length; i++) {
      const segment = videoSegments[i]
      const segmentDuration = (segment.endTime || originalDuration) - segment.startTime
      
      if (timelineTime < accumulatedTime + segmentDuration) {
        return {
          index: i,
          segment,
          segmentStartInTimeline: accumulatedTime,
          segmentEndInTimeline: accumulatedTime + segmentDuration
        }
      }
      
      accumulatedTime += segmentDuration
    }
    
    return null
  }, [videoSegments, originalDuration])

  // Update duration when segments change
  useEffect(() => {
    if (originalDuration > 0) {
      const newDuration = calculateEffectiveDuration()
      setDuration(newDuration)
    }
  }, [videoSegments, originalDuration, calculateEffectiveDuration])

  // Fetch video data
  useEffect(() => {
    fetchVideo()
  }, [id])
  
  // Auto-save elements when they change (debounced)
  useEffect(() => {
    if (!video || elements.length === 0) return
    
    setHasUnsavedChanges(true)
    
    const saveTimeout = setTimeout(() => {
      saveElements()
    }, 2000) // Save after 2 seconds of no changes
    
    return () => clearTimeout(saveTimeout)
  }, [elements])
  
  // Auto-save BPM config when it changes (debounced)
  useEffect(() => {
    if (!video) return
    
    const saveBpmTimeout = setTimeout(() => {
      saveBpmConfig()
    }, 2000)
    
    return () => clearTimeout(saveBpmTimeout)
  }, [bpmConfig])
  
  // Save elements to backend
  const saveElements = async () => {
    if (!video || isSaving) return
    
    setIsSaving(true)
    try {
      const response = await authFetch(`/api/videos/videos/${id}/elements/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elements })
      })
      
      if (response.ok) {
        setHasUnsavedChanges(false)
        console.log('Elements saved successfully')
      }
    } catch (err) {
      console.error('Failed to save elements:', err)
    } finally {
      setIsSaving(false)
    }
  }
  
  // Record state to history for undo/redo
  const recordHistory = useCallback((actionType, newElements = elements, newSelectedId = selectedElementId, newBpmConfig = bpmConfig) => {
    if (isUndoRedoRef.current) return
    
    const stateSnapshot = {
      elements: JSON.parse(JSON.stringify(newElements)),
      selectedElementId: newSelectedId,
      bpmConfig: { ...newBpmConfig },
      actionType,
      timestamp: Date.now()
    }
    
    // Avoid recording duplicate states
    const lastState = lastRecordedRef.current
    if (lastState && 
        JSON.stringify(lastState.elements) === JSON.stringify(stateSnapshot.elements) &&
        lastState.selectedElementId === stateSnapshot.selectedElementId &&
        JSON.stringify(lastState.bpmConfig) === JSON.stringify(stateSnapshot.bpmConfig)) {
      return
    }
    
    lastRecordedRef.current = stateSnapshot
    
    setHistory(prev => {
      // Remove any future states if we're not at the end
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push(stateSnapshot)
      
      // Limit history size
      if (newHistory.length > MAX_HISTORY) {
        return newHistory.slice(-MAX_HISTORY)
      }
      return newHistory
    })
    
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1))
  }, [elements, selectedElementId, bpmConfig, historyIndex])

  // Undo action
  const undo = useCallback(() => {
    if (historyIndex <= 0) return
    
    isUndoRedoRef.current = true
    const newIndex = historyIndex - 1
    const prevState = history[newIndex]
    
    if (prevState) {
      setElements(prevState.elements)
      setSelectedElementId(prevState.selectedElementId)
      if (prevState.bpmConfig) {
        setBpmConfig(prevState.bpmConfig)
      }
      setHistoryIndex(newIndex)
    }
    
    setTimeout(() => {
      isUndoRedoRef.current = false
    }, 0)
  }, [history, historyIndex])

  // Redo action
  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return
    
    isUndoRedoRef.current = true
    const newIndex = historyIndex + 1
    const nextState = history[newIndex]
    
    if (nextState) {
      setElements(nextState.elements)
      setSelectedElementId(nextState.selectedElementId)
      if (nextState.bpmConfig) {
        setBpmConfig(nextState.bpmConfig)
      }
      setHistoryIndex(newIndex)
    }
    
    setTimeout(() => {
      isUndoRedoRef.current = false
    }, 0)
  }, [history, historyIndex])

  // Check if undo/redo is available
  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  // Update BPM config with history recording
  const updateBpmConfig = useCallback((newConfig) => {
    if (isUndoRedoRef.current) {
      setBpmConfig(newConfig)
      return
    }
    
    setBpmConfig(newConfig)
    
    // Debounce BPM config history recording
    if (historyDebounceRef.current) {
      clearTimeout(historyDebounceRef.current)
    }
    
    historyDebounceRef.current = setTimeout(() => {
      recordHistory('update_bpm', elements, selectedElementId, newConfig)
    }, 300)
  }, [elements, selectedElementId, recordHistory])

  // Save BPM config to backend
  const saveBpmConfig = async () => {
    if (!video) return
    
    try {
      const response = await authFetch(`/api/videos/videos/${id}/create_rhythm_grid/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bpm: bpmConfig.bpm,
          time_signature_numerator: bpmConfig.timeSignatureNum,
          time_signature_denominator: bpmConfig.timeSignatureDen,
          offset_start: bpmConfig.offsetStart
        })
      })
      if (response.ok) {
        console.log('BPM config saved successfully')
      } else {
        console.error('Failed to save BPM config:', await response.text())
      }
    } catch (err) {
      console.error('Failed to save BPM config:', err)
    }
  }

  // Save video title
  const saveVideoTitle = async (newTitle) => {
    if (!video || !newTitle.trim()) return
    
    try {
      const response = await authFetch(`/api/videos/videos/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() })
      })
      
      if (response.ok) {
        const updatedVideo = await response.json()
        setVideo(updatedVideo)
        console.log('Video title saved successfully')
      }
    } catch (err) {
      console.error('Failed to save video title:', err)
    }
  }

  // Handle title edit
  const handleTitleClick = () => {
    setEditedTitle(video?.title || '')
    setIsEditingTitle(true)
  }

  const handleTitleBlur = () => {
    if (editedTitle.trim() && editedTitle !== video?.title) {
      saveVideoTitle(editedTitle)
    }
    setIsEditingTitle(false)
  }

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleTitleBlur()
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false)
      setEditedTitle('')
    }
  }

  const fetchVideo = async () => {
    try {
      const response = await authFetch(`/api/videos/videos/${id}/`)
      if (!response.ok) {
        throw new Error('Vídeo não encontrado')
      }
      const data = await response.json()
      setVideo(data)
      const videoDuration = data.duration || 0
      setOriginalDuration(videoDuration)
      setDuration(videoDuration)
      
      // Initialize video segments with full duration
      setVideoSegments([
        { id: generateId(), startTime: 0, endTime: videoDuration, speed: 1.0 }
      ])
      
      // Try to load saved elements first
      let hasElements = false
      let loadedElements = []
      try {
        const elementsResponse = await authFetch(`/api/videos/videos/${id}/elements/`)
        if (elementsResponse.ok) {
          const savedElements = await elementsResponse.json()
          if (savedElements && savedElements.length > 0) {
            setElements(savedElements)
            loadedElements = savedElements
            hasElements = true
          }
        }
      } catch (err) {
        console.log('Could not load elements:', err)
      }
      
      // Initialize history with loaded elements
      const initialState = {
        elements: loadedElements,
        selectedElementId: null,
        actionType: 'initial',
        timestamp: Date.now()
      }
      setHistory([initialState])
      setHistoryIndex(0)
      lastRecordedRef.current = initialState
      
      // Try to load existing rhythm grid
      let hasRhythmGrid = false
      try {
        const gridResponse = await authFetch(`/api/videos/videos/${id}/rhythm_grid/`)
        if (gridResponse.ok) {
          const gridData = await gridResponse.json()
          setBpmConfig({
            bpm: gridData.bpm,
            timeSignatureNum: gridData.time_signature_numerator,
            timeSignatureDen: gridData.time_signature_denominator,
            offsetStart: gridData.offset_start
          })
          hasRhythmGrid = true
        }
      } catch (err) {
        // Rhythm grid doesn't exist yet
      }
      
      // If no rhythm grid exists, analyze the video to detect BPM and downbeat
      if (!hasRhythmGrid && data.file_url) {
        try {
          const analyzeResponse = await authFetch(`/api/videos/videos/${id}/analyze_bpm/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          })
          if (analyzeResponse.ok) {
            const analysisData = await analyzeResponse.json()
            setBpmConfig({
              bpm: analysisData.bpm,
              timeSignatureNum: analysisData.time_signature_numerator,
              timeSignatureDen: analysisData.time_signature_denominator,
              offsetStart: analysisData.offset_start
            })
          }
        } catch (err) {
          console.log('Could not analyze BPM:', err)
        }
      }
      
      // If no saved elements, add default metronome
      if (!hasElements) {
        addDefaultMetronome(videoDuration, 0)
      }
      
      // Try to load waveform data
      try {
        const waveformResponse = await authFetch(`/api/videos/videos/${id}/waveform/`)
        if (waveformResponse.ok) {
          const waveformJson = await waveformResponse.json()
          setWaveformData(waveformJson.data)
        }
      } catch (err) {
        // Waveform not available
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  
  // Add default metronome element at bottom of video
  const addDefaultMetronome = (videoDuration, offsetStart) => {
    const defaultMetronome = {
      id: generateId(),
      type: 'metronome',
      startTime: 0,
      endTime: videoDuration,
      // Position at bottom center (y: 90% = near bottom)
      x: 50,
      y: 90,
      visible: true,
      metronomeType: 'bar-beat',
      fontSize: 36,
      fontColor: '#FFFFFF',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      hasBackground: true
    }
    setElements([defaultMetronome])
  }

  // Track which segment we're currently playing
  const currentSegmentIndexRef = useRef(0)

  // Video control handlers - manages playback across segments
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current || isSeekingRef.current || !videoSegments || videoSegments.length === 0) return
    
    const actualVideoTime = videoRef.current.currentTime
    const currentSegmentIndex = currentSegmentIndexRef.current
    const segment = videoSegments[currentSegmentIndex]
    
    if (!segment) return
    
    const segmentEndInVideo = segment.endTime || originalDuration
    
    // Apply playback rate for current segment
    const segmentSpeed = segment.speed || 1.0
    if (Math.abs(videoRef.current.playbackRate - segmentSpeed) > 0.01) {
      videoRef.current.playbackRate = segmentSpeed
    }
    
    // Calculate timeline position for this segment
    let segmentStartInTimeline = 0
    for (let i = 0; i < currentSegmentIndex; i++) {
      const seg = videoSegments[i]
      segmentStartInTimeline += (seg.endTime || originalDuration) - seg.startTime
    }
    
    // Check if we've reached the end of the current segment
    if (actualVideoTime >= segmentEndInVideo - 0.05) {
      // Move to the next segment
      const nextSegmentIndex = currentSegmentIndex + 1
      
      if (nextSegmentIndex < videoSegments.length) {
        // Jump to the start of the next segment in the actual video
        const nextSegment = videoSegments[nextSegmentIndex]
        currentSegmentIndexRef.current = nextSegmentIndex
        isSeekingRef.current = true
        videoRef.current.currentTime = nextSegment.startTime
        
        // Apply speed of the next segment
        videoRef.current.playbackRate = nextSegment.speed || 1.0
        
        // Calculate new timeline time
        const segmentDuration = segmentEndInVideo - segment.startTime
        setCurrentTime(segmentStartInTimeline + segmentDuration)
        
        setTimeout(() => {
          isSeekingRef.current = false
        }, 50)
      } else {
        // No more segments, stop playback
        videoRef.current.pause()
        videoRef.current.playbackRate = 1.0
        setIsPlaying(false)
        setCurrentTime(duration)
      }
    } else {
      // Update timeline time based on current video position within the segment
      const offsetInSegment = actualVideoTime - segment.startTime
      const newTimelineTime = segmentStartInTimeline + offsetInSegment
      setCurrentTime(newTimelineTime)
    }
  }, [videoSegments, duration, originalDuration])

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      // Only set original duration from video metadata, effective duration is calculated from segments
      if (originalDuration === 0) {
        setOriginalDuration(videoRef.current.duration)
      }
    }
  }, [originalDuration])

  const handlePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        // Before playing, ensure video is at the correct position for current timeline time
        const actualVideoTime = timelineToVideoTime(currentTime)
        if (Math.abs(videoRef.current.currentTime - actualVideoTime) > 0.1) {
          videoRef.current.currentTime = actualVideoTime
        }
        
        // Update current segment index based on current timeline time
        if (videoSegments && videoSegments.length > 0) {
          let accumulatedTime = 0
          for (let i = 0; i < videoSegments.length; i++) {
            const segment = videoSegments[i]
            const segmentDuration = (segment.endTime || originalDuration) - segment.startTime
            if (currentTime < accumulatedTime + segmentDuration) {
              currentSegmentIndexRef.current = i
              // Apply speed of the segment we're about to play
              videoRef.current.playbackRate = segment.speed || 1.0
              break
            }
            accumulatedTime += segmentDuration
          }
        }
        
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }, [isPlaying, currentTime, timelineToVideoTime, videoSegments, originalDuration])

  const handleSeek = useCallback((timelineTime) => {
    if (videoRef.current) {
      isSeekingRef.current = true
      // Convert timeline time to actual video time
      const actualVideoTime = timelineToVideoTime(timelineTime)
      videoRef.current.currentTime = actualVideoTime
      setCurrentTime(timelineTime)
      
      // Update current segment index based on timeline time
      if (videoSegments && videoSegments.length > 0) {
        let accumulatedTime = 0
        for (let i = 0; i < videoSegments.length; i++) {
          const segment = videoSegments[i]
          const segmentDuration = (segment.endTime || originalDuration) - segment.startTime
          if (timelineTime < accumulatedTime + segmentDuration) {
            currentSegmentIndexRef.current = i
            break
          }
          accumulatedTime += segmentDuration
        }
      }
      
      // Reset seeking flag after a short delay to allow video to settle
      setTimeout(() => {
        isSeekingRef.current = false
      }, 100)
    }
  }, [timelineToVideoTime, videoSegments, originalDuration])

  // Element management
  const addElement = useCallback((type) => {
    const newElement = {
      id: generateId(),
      type, // 'text', 'metronome', 'alert', 'timer'
      startTime: currentTime,
      endTime: Math.min(currentTime + 5, duration), // Default 5 seconds duration
      // Position (percentage of video dimensions)
      x: 50,
      y: 50,
      // Common properties
      visible: true,
    }

    // Type-specific defaults
    switch (type) {
      case 'text':
        newElement.content = 'Novo Texto'
        newElement.fontSize = 32
        newElement.fontColor = '#FFFFFF'
        newElement.backgroundColor = 'rgba(0, 0, 0, 0.5)'
        newElement.hasBackground = true
        newElement.fontWeight = 'bold'
        break
      case 'metronome':
        newElement.metronomeType = 'bar-beat' // 'bar-beat', 'bar', 'beat', 'time'
        newElement.fontSize = 48
        newElement.fontColor = '#FFFFFF'
        newElement.backgroundColor = 'rgba(0, 0, 0, 0.7)'
        newElement.hasBackground = true
        break
      case 'timer':
        newElement.fontSize = 48
        newElement.fontColor = '#FFFFFF'
        newElement.backgroundColor = 'rgba(0, 0, 0, 0.7)'
        newElement.hasBackground = true
        break
      case 'alert':
        newElement.alertType = 'flash' // 'flash', 'circle'
        newElement.color = 'rgba(255, 255, 255, 0.5)'
        newElement.syncToBeat = true // Sync to beat start by default
        newElement.circleSize = 20
        // For alerts synced to beat, we'll calculate times based on BPM
        break
      default:
        break
    }

    const newElements = [...elements, newElement]
    setElements(newElements)
    setSelectedElementId(newElement.id)
    recordHistory('add_element', newElements, newElement.id)
  }, [currentTime, duration, elements, recordHistory])

  const updateElement = useCallback((elementId, updates) => {
    setElements(prev => {
      const newElements = prev.map(el => 
        el.id === elementId ? { ...el, ...updates } : el
      )
      
      // Check if this is a text content update (needs debouncing by word)
      const isTextUpdate = 'content' in updates
      
      if (isTextUpdate) {
        // Debounce text updates - record history after 500ms of no typing or on space/enter
        const content = updates.content || ''
        const lastChar = content.slice(-1)
        const isWordBoundary = lastChar === ' ' || lastChar === '\n' || lastChar === ''
        
        // Clear existing debounce
        if (historyDebounceRef.current) {
          clearTimeout(historyDebounceRef.current)
        }
        
        // Store pending state
        pendingHistoryRef.current = { elements: newElements, selectedId: selectedElementId }
        
        // If word boundary, record immediately
        if (isWordBoundary && content.length > 0) {
          if (!isUndoRedoRef.current) {
            recordHistory('update_text', newElements, selectedElementId)
          }
          pendingHistoryRef.current = null
        } else {
          // Otherwise debounce for 500ms
          historyDebounceRef.current = setTimeout(() => {
            if (!isUndoRedoRef.current && pendingHistoryRef.current) {
              recordHistory('update_text', pendingHistoryRef.current.elements, pendingHistoryRef.current.selectedId)
              pendingHistoryRef.current = null
            }
          }, 500)
        }
      } else {
        // For non-text updates, record immediately but with small debounce to batch rapid changes
        if (historyDebounceRef.current) {
          clearTimeout(historyDebounceRef.current)
        }
        
        pendingHistoryRef.current = { elements: newElements, selectedId: selectedElementId }
        
        historyDebounceRef.current = setTimeout(() => {
          if (!isUndoRedoRef.current && pendingHistoryRef.current) {
            recordHistory('update_element', pendingHistoryRef.current.elements, pendingHistoryRef.current.selectedId)
            pendingHistoryRef.current = null
          }
        }, 100)
      }
      
      return newElements
    })
  }, [recordHistory, selectedElementId])

  const deleteElement = useCallback((elementId) => {
    const newElements = elements.filter(el => el.id !== elementId)
    const newSelectedId = selectedElementId === elementId ? null : selectedElementId
    
    setElements(newElements)
    if (selectedElementId === elementId) {
      setSelectedElementId(null)
    }
    recordHistory('delete_element', newElements, newSelectedId)
  }, [elements, selectedElementId, recordHistory])

  const selectElement = useCallback((elementId) => {
    if (elementId !== selectedElementId) {
      setSelectedElementId(elementId)
      recordHistory('select_element', elements, elementId)
    }
  }, [elements, selectedElementId, recordHistory])

  // Clipboard for copy/paste
  const [clipboardElement, setClipboardElement] = useState(null)

  const copyElement = useCallback((elementId) => {
    const element = elements.find(el => el.id === elementId)
    if (element) {
      setClipboardElement({ ...element })
    }
  }, [elements])

  const pasteElement = useCallback(() => {
    if (!clipboardElement) return
    
    const newElement = {
      ...clipboardElement,
      id: generateId(),
      x: Math.min(clipboardElement.x + 5, 95),
      y: Math.min(clipboardElement.y + 5, 95),
    }
    const newElements = [...elements, newElement]
    setElements(newElements)
    setSelectedElementId(newElement.id)
    recordHistory('paste_element', newElements, newElement.id)
  }, [clipboardElement, elements, recordHistory])

  const duplicateElement = useCallback((elementId) => {
    const element = elements.find(el => el.id === elementId)
    if (element) {
      const newElement = {
        ...element,
        id: generateId(),
        x: Math.min(element.x + 5, 95),
        y: Math.min(element.y + 5, 95),
      }
      const newElements = [...elements, newElement]
      setElements(newElements)
      setSelectedElementId(newElement.id)
      recordHistory('duplicate_element', newElements, newElement.id)
    }
  }, [elements, recordHistory])

  // Video segment management
  const cutVideoAtCurrentTime = useCallback(() => {
    if (!selectedSegmentId) return
    
    const segmentIndex = videoSegments.findIndex(s => s.id === selectedSegmentId)
    if (segmentIndex === -1) return
    
    const segment = videoSegments[segmentIndex]
    const segmentEndTime = segment.endTime || originalDuration
    
    // Calculate where in the timeline this segment starts
    let segmentStartInTimeline = 0
    for (let i = 0; i < segmentIndex; i++) {
      const seg = videoSegments[i]
      segmentStartInTimeline += (seg.endTime || originalDuration) - seg.startTime
    }
    const segmentEndInTimeline = segmentStartInTimeline + (segmentEndTime - segment.startTime)
    
    // Check if current timeline time is within this segment
    if (currentTime <= segmentStartInTimeline || currentTime >= segmentEndInTimeline) return
    
    // Convert timeline time to video time for the cut point
    const offsetInSegment = currentTime - segmentStartInTimeline
    const cutPointInVideo = segment.startTime + offsetInSegment
    
    // Create two new segments from the cut
    const newSegments = [...videoSegments]
    const leftSegment = {
      ...segment,
      endTime: cutPointInVideo
    }
    const rightSegment = {
      id: generateId(),
      startTime: cutPointInVideo,
      endTime: segment.endTime || originalDuration,
      speed: segment.speed
    }
    
    newSegments.splice(segmentIndex, 1, leftSegment, rightSegment)
    setVideoSegments(newSegments)
    setSelectedSegmentId(rightSegment.id)
  }, [videoSegments, selectedSegmentId, currentTime, originalDuration])

  const duplicateVideoSegment = useCallback((segmentId) => {
    const segmentIndex = videoSegments.findIndex(s => s.id === segmentId)
    if (segmentIndex === -1) return
    
    const segment = videoSegments[segmentIndex]
    
    // Create a duplicate that references the SAME original video time range
    // This means when played, it will replay the same portion of the original video
    const duplicateSegment = {
      id: generateId(),
      startTime: segment.startTime,  // Same start time in original video
      endTime: segment.endTime || originalDuration,  // Same end time in original video
      speed: segment.speed
    }
    
    // Insert duplicate right after the original segment
    const newSegments = [...videoSegments]
    newSegments.splice(segmentIndex + 1, 0, duplicateSegment)
    
    setVideoSegments(newSegments)
    setSelectedSegmentId(duplicateSegment.id)
  }, [videoSegments, originalDuration])

  const removeVideoSegment = useCallback((segmentId) => {
    if (videoSegments.length <= 1) {
      alert('Não é possível remover o último segmento')
      return
    }
    
    const segmentIndex = videoSegments.findIndex(s => s.id === segmentId)
    if (segmentIndex === -1) return
    
    // Simply remove the segment - no need to shift times since each segment
    // references its own portion of the original video
    const newSegments = videoSegments.filter(s => s.id !== segmentId)
    
    setVideoSegments(newSegments)
    setSelectedSegmentId(null)
  }, [videoSegments])

  const updateVideoSegmentSpeed = useCallback((segmentId, speed) => {
    const newSegments = videoSegments.map(seg =>
      seg.id === segmentId ? { ...seg, speed } : seg
    )
    setVideoSegments(newSegments)
  }, [videoSegments])

  // === BAR SELECTION HELPERS ===
  
  // Get timeline bars - same logic as Timeline's getTimelineBars, plus originalTimeStart/End for isolateBarSelection
  const getTimelineBars = useCallback(() => {
    if (!bpmConfig || !bpmConfig.bpm || bpmConfig.bpm <= 0) return []
    
    const { bpm, timeSignatureNum = 4, offsetStart = 0 } = bpmConfig
    const barDuration = (60.0 / bpm) * timeSignatureNum
    
    const bars = []
    let globalBarIndex = 1
    let accumulatedTimelineTime = 0
    
    for (let segIdx = 0; segIdx < videoSegments.length; segIdx++) {
      const segment = videoSegments[segIdx]
      const segStart = segment.startTime
      const segEnd = segment.endTime || originalDuration
      const segDuration = segEnd - segStart
      
      const effectiveStart = Math.max(segStart, offsetStart)
      if (effectiveStart >= segEnd) {
        accumulatedTimelineTime += segDuration
        continue
      }
      
      const firstBarNum = Math.floor((effectiveStart - offsetStart) / barDuration) + 1
      
      let barNum = firstBarNum
      while (true) {
        const barOrigStart = offsetStart + (barNum - 1) * barDuration
        const barOrigEnd = barOrigStart + barDuration
        
        const clippedStart = Math.max(barOrigStart, segStart)
        const clippedEnd = Math.min(barOrigEnd, segEnd)
        
        if (clippedStart >= segEnd) break
        if (clippedEnd - clippedStart < 0.001) { barNum++; continue }
        
        const tlStart = accumulatedTimelineTime + (clippedStart - segStart)
        const tlEnd = accumulatedTimelineTime + (clippedEnd - segStart)
        
        bars.push({
          barNumber: globalBarIndex,
          originalBarNumber: barNum,
          timelineStart: tlStart,
          timelineEnd: tlEnd,
          segmentIndex: segIdx,
          segmentId: segment.id,
          originalTimeStart: clippedStart,
          originalTimeEnd: clippedEnd
        })
        globalBarIndex++
        barNum++
      }
      
      accumulatedTimelineTime += segDuration
    }
    
    return bars
  }, [bpmConfig, videoSegments, originalDuration])

  // Split segments so that bars in the selection become their own segments.
  // Returns new segments array with the selection isolated.
  const isolateBarSelection = useCallback((startBar, endBar) => {
    const allBars = getTimelineBars()
    const selectedBars = allBars.filter(b => b.barNumber >= startBar && b.barNumber <= endBar)
    if (selectedBars.length === 0) return { newSegments: videoSegments.map(s => ({ ...s })), affectedSegmentIds: [] }
    
    // Group selected bars by segment
    const barsBySegment = new Map()
    for (const bar of selectedBars) {
      if (!barsBySegment.has(bar.segmentIndex)) {
        barsBySegment.set(bar.segmentIndex, [])
      }
      barsBySegment.get(bar.segmentIndex).push(bar)
    }
    
    // Build new segments array
    const newSegments = []
    const affectedSegmentIds = [] // IDs of segments that contain the selection
    
    for (let segIdx = 0; segIdx < videoSegments.length; segIdx++) {
      const segment = videoSegments[segIdx]
      const segStart = segment.startTime
      const segEnd = segment.endTime || originalDuration
      
      if (!barsBySegment.has(segIdx)) {
        // This segment is not affected, keep as is
        newSegments.push({ ...segment })
        continue
      }
      
      const segBars = barsBySegment.get(segIdx)
      const selOrigStart = segBars[0].originalTimeStart
      const selOrigEnd = segBars[segBars.length - 1].originalTimeEnd
      
      // Create up to 3 parts: before selection, selection, after selection
      
      // Part before selection
      if (selOrigStart > segStart + 0.001) {
        newSegments.push({
          id: generateId(),
          startTime: segStart,
          endTime: selOrigStart,
          speed: segment.speed
        })
      }
      
      // Selection part
      const selSegment = {
        id: generateId(),
        startTime: selOrigStart,
        endTime: selOrigEnd,
        speed: segment.speed,
        _isSelection: true // marker for the caller
      }
      newSegments.push(selSegment)
      affectedSegmentIds.push(selSegment.id)
      
      // Part after selection
      if (selOrigEnd < segEnd - 0.001) {
        newSegments.push({
          id: generateId(),
          startTime: selOrigEnd,
          endTime: segEnd,
          speed: segment.speed
        })
      }
    }
    
    return { newSegments, affectedSegmentIds }
  }, [videoSegments, originalDuration, getTimelineBars])

  // === BAR SELECTION ACTIONS ===
  
  // Remove selected bars from the video
  const handleBarSelectionRemove = useCallback(() => {
    if (!barSelection) return
    const { startBar, endBar } = barSelection
    
    const { newSegments, affectedSegmentIds } = isolateBarSelection(startBar, endBar)
    
    // Remove the selection segments
    const finalSegments = newSegments.filter(s => !s._isSelection)
    
    // Clean up _isSelection markers
    finalSegments.forEach(s => delete s._isSelection)
    
    if (finalSegments.length === 0) {
      alert('N\u00e3o \u00e9 poss\u00edvel remover todos os segmentos do v\u00eddeo')
      return
    }
    
    setVideoSegments(finalSegments)
    setBarSelection(null)
  }, [barSelection, isolateBarSelection])

  // Duplicate selected bars (insert copy right after the selection)
  const handleBarSelectionDuplicate = useCallback(() => {
    if (!barSelection) return
    const { startBar, endBar } = barSelection
    
    const { newSegments, affectedSegmentIds } = isolateBarSelection(startBar, endBar)
    
    // Find the selection segments and duplicate them right after
    const finalSegments = []
    for (const seg of newSegments) {
      finalSegments.push({ ...seg })
      delete finalSegments[finalSegments.length - 1]._isSelection
      
      if (seg._isSelection) {
        // Insert a duplicate
        finalSegments.push({
          id: generateId(),
          startTime: seg.startTime,
          endTime: seg.endTime,
          speed: seg.speed
        })
      }
    }
    
    setVideoSegments(finalSegments)
    setBarSelection(null)
  }, [barSelection, isolateBarSelection])

  // Change speed of selected bars
  const handleBarSelectionSpeed = useCallback((speed) => {
    if (!barSelection) return
    const { startBar, endBar } = barSelection
    
    const { newSegments, affectedSegmentIds } = isolateBarSelection(startBar, endBar)
    
    // Set speed on the selection segments
    const finalSegments = newSegments.map(seg => {
      const cleaned = { ...seg }
      if (cleaned._isSelection) {
        cleaned.speed = speed
      }
      delete cleaned._isSelection
      return cleaned
    })
    
    setVideoSegments(finalSegments)
    setBarSelection(null)
  }, [barSelection, isolateBarSelection])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl/Cmd + Z - Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y - Redo
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' && e.shiftKey || e.key === 'y')) {
        e.preventDefault()
        redo()
      }
      // Ctrl/Cmd + C - Copy
      else if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedElementId) {
        e.preventDefault()
        copyElement(selectedElementId)
      }
      // Ctrl/Cmd + V - Paste
      else if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboardElement) {
        e.preventDefault()
        pasteElement()
      }
      // Ctrl/Cmd + D - Duplicate
      else if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedElementId) {
        e.preventDefault()
        duplicateElement(selectedElementId)
      }
      // Escape - Clear bar selection
      else if (e.key === 'Escape') {
        if (barSelection) {
          e.preventDefault()
          setBarSelection(null)
        }
      }
      // Delete or Backspace - Delete element, bar selection, or video segment
      else if ((e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault()
        if (barSelection) {
          handleBarSelectionRemove()
        } else if (selectedElementId) {
          deleteElement(selectedElementId)
        } else if (selectedSegmentId) {
          removeVideoSegment(selectedSegmentId)
        }
      }
      // S - Split/Cut video segment at current time
      else if (e.key === 's' && selectedSegmentId && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        cutVideoAtCurrentTime()
      }
      // Ctrl/Cmd + D - Duplicate video segment (when segment is selected)
      else if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedSegmentId && !selectedElementId) {
        e.preventDefault()
        duplicateVideoSegment(selectedSegmentId)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedElementId, selectedSegmentId, clipboardElement, copyElement, pasteElement, duplicateElement, deleteElement, undo, redo, cutVideoAtCurrentTime, duplicateVideoSegment, removeVideoSegment, barSelection, handleBarSelectionRemove])

  // Cut management
  const addCut = useCallback(() => {
    if (currentTime > 0 && currentTime < duration) {
      setCuts(prev => {
        const newCuts = [...prev, currentTime].sort((a, b) => a - b)
        return [...new Set(newCuts)] // Remove duplicates
      })
    }
  }, [currentTime, duration])

  const removeCut = useCallback((cutTime) => {
    setCuts(prev => prev.filter(c => c !== cutTime))
  }, [])

  // Export video with elements
  const handleExportVideo = async () => {
    if (!video || !video.id) return
    
    setExporting(true)
    try {
      // Prepare video segments for export - each segment references a portion of the original video
      const exportSegments = videoSegments.map(seg => ({
        start_time: seg.startTime,
        end_time: seg.endTime || originalDuration,
        speed: seg.speed
      }))
      
      // Get the video element's actual displayed size for proper scaling
      // This is crucial for matching font sizes between preview and export
      const videoElement = videoRef.current
      let previewWidth = 360  // Default fallback
      let previewHeight = 640
      
      if (videoElement) {
        // Get the actual rendered size of the video element
        const rect = videoElement.getBoundingClientRect()
        previewWidth = rect.width
        previewHeight = rect.height
      }
      
      const response = await authFetch(`/api/videos/videos/${video.id}/export_with_elements/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          elements: elements,
          video_segments: exportSegments,
          start_time: 0,
          end_time: duration,
          bpm_config: {
            bpm: bpmConfig.bpm,
            timeSignatureNum: bpmConfig.timeSignatureNum,
            offsetStart: bpmConfig.offsetStart
          },
          // Send preview dimensions for proper scale calculation
          preview_width: previewWidth,
          preview_height: previewHeight
        }),
      })
      
      if (response.status === 402) {
        const errData = await response.json().catch(() => ({}))
        alert(`Creditos insuficientes: necessario ${errData.credits_needed || '?'} min, disponivel ${errData.credits_available || '?'} min.`)
        return
      }
      
      if (!response.ok) {
        throw new Error('Falha ao exportar vídeo')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${video.title}_with_elements.mp4`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      setShowExportDropdown(false)
      alert('Vídeo exportado com sucesso!')
      
      // Refresh billing info after export
      if (isAuthenticated) {
        authFetch('/api/billing/status/')
          .then(res => res.ok ? res.json() : null)
          .then(data => { if (data) setBillingInfo(data) })
          .catch(() => {})
      }
    } catch (err) {
      alert('Erro ao exportar: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  // Get selected element
  const selectedElement = elements.find(el => el.id === selectedElementId)

  // Get visible elements at current time
  const visibleElements = elements.filter(el => 
    el.visible && currentTime >= el.startTime && currentTime <= el.endTime
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="flex items-center space-x-3 text-white">
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span className="text-lg font-medium">Carregando vídeo...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center space-y-4">
          <h3 className="text-xl font-semibold text-white">Erro ao carregar vídeo</h3>
          <p className="text-gray-400">{error}</p>
          <Link 
            to="/app"
            className="inline-flex items-center space-x-2 px-6 py-2 bg-ritmo-gradient text-white rounded-full"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para biblioteca</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <Link
            to="/app"
            className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar</span>
          </Link>
          <span className="text-gray-600">|</span>
          {isEditingTitle ? (
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              autoFocus
              className="font-semibold bg-gray-700 text-white px-2 py-1 rounded border border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-md"
            />
          ) : (
            <h1 
              className="font-semibold truncate max-w-md cursor-pointer hover:text-blue-400 transition-colors"
              onClick={handleTitleClick}
              title="Clique para editar"
            >
              {video?.title}
            </h1>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Save status indicator */}
          <div className="flex items-center space-x-2 text-sm">
            {isSaving ? (
              <span className="flex items-center text-yellow-400">
                <div className="w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mr-2" />
                Salvando...
              </span>
            ) : hasUnsavedChanges ? (
              <span className="text-orange-400">● Alterações não salvas</span>
            ) : (
              <span className="text-green-400">✓ Salvo</span>
            )}
          </div>

          {/* Billing badges (authenticated users with billing) */}
          {billingInfo && billingInfo.subscription && (
            <div className="flex items-center gap-3 px-3 py-1 bg-gray-700/50 rounded-lg">
              {/* Credits badge */}
              <div
                className="flex items-center gap-1.5 text-xs"
                title={`Creditos: ${billingInfo.credits?.subscription_minutes?.toFixed?.(0) || 0} assinatura + ${billingInfo.credits?.purchased_minutes?.toFixed?.(0) || 0} comprados`}
              >
                <Clock className={`w-3.5 h-3.5 ${
                  (billingInfo.credits?.total_minutes || 0) <= 5
                    ? 'text-red-400'
                    : (billingInfo.credits?.total_minutes || 0) <= 15
                      ? 'text-yellow-400'
                      : 'text-green-400'
                }`} />
                <span className={`font-mono font-bold ${
                  (billingInfo.credits?.total_minutes || 0) <= 5
                    ? 'text-red-400'
                    : 'text-gray-200'
                }`}>
                  {billingInfo.credits?.total_minutes?.toFixed?.(0) || 0}
                </span>
                <span className="text-gray-500">
                  /{billingInfo.subscription?.plan_limits?.export_minutes || '∞'} min
                </span>
              </div>
              <span className="text-gray-600">|</span>
              {/* Storage badge */}
              <div
                className="flex items-center gap-1.5 text-xs"
                title={`Storage: ${billingInfo.storage?.gb_used?.toFixed?.(2) || 0} / ${billingInfo.subscription?.plan_limits?.storage_gb || '?'} GB`}
              >
                <HardDrive className={`w-3.5 h-3.5 ${
                  billingInfo.subscription?.plan_limits?.storage_gb &&
                  (billingInfo.storage?.gb_used || 0) / billingInfo.subscription.plan_limits.storage_gb > 0.9
                    ? 'text-red-400'
                    : 'text-blue-400'
                }`} />
                <span className="text-gray-200 font-mono font-bold">
                  {billingInfo.storage?.gb_used?.toFixed?.(1) || '0.0'}
                </span>
                <span className="text-gray-500">
                  /{billingInfo.subscription?.plan_limits?.storage_gb || '?'} GB
                </span>
              </div>
            </div>
          )}

          {/* Undo/Redo buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={undo}
              disabled={!canUndo}
              className={`p-1.5 rounded transition-colors ${canUndo ? 'hover:bg-gray-700 text-white' : 'text-gray-600 cursor-not-allowed'}`}
              title="Desfazer (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className={`p-1.5 rounded transition-colors ${canRedo ? 'hover:bg-gray-700 text-white' : 'text-gray-600 cursor-not-allowed'}`}
              title="Refazer (Ctrl+Shift+Z)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
            {history.length > 1 && (
              <span className="text-xs text-gray-500 ml-1">
                {historyIndex + 1}/{history.length}
              </span>
            )}
          </div>
          
          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg font-medium transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Exportar</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showExportDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {/* Dropdown Content */}
            {showExportDropdown && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-blue-400" />
                      <h3 className="font-medium">Informações do Vídeo</h3>
                    </div>
                    <button
                      onClick={() => setShowExportDropdown(false)}
                      className="p-1 hover:bg-gray-700 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Duração:</span>
                      <span>{video?.duration ? `${Math.floor(video.duration / 60)}:${Math.floor(video.duration % 60).toString().padStart(2, '0')}` : '--'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Resolução:</span>
                      <span>{video?.width && video?.height ? `${video.width}x${video.height}` : '--'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">FPS:</span>
                      <span>{video?.fps || '--'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Elementos:</span>
                      <span>{elements.length}</span>
                    </div>
                  </div>
                  
                  {/* Insufficient credits warning */}
                  {billingInfo && billingInfo.subscription && (billingInfo.credits?.total_minutes || 0) <= 0 && (
                    <div className="flex items-center gap-2 p-2 mb-3 bg-red-900/40 border border-red-700/50 rounded-lg text-xs text-red-300">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Sem creditos de export. <a href="/pricing" className="underline text-red-200 hover:text-white">Fazer upgrade</a></span>
                    </div>
                  )}
                  {billingInfo && billingInfo.subscription && (billingInfo.credits?.total_minutes || 0) > 0 && (billingInfo.credits?.total_minutes || 0) <= 5 && (
                    <div className="flex items-center gap-2 p-2 mb-3 bg-yellow-900/40 border border-yellow-700/50 rounded-lg text-xs text-yellow-300">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Apenas {billingInfo.credits.total_minutes.toFixed(0)} min restantes</span>
                    </div>
                  )}
                  
                  <button
                    onClick={handleExportVideo}
                    disabled={exporting || !video || elements.length === 0 || (billingInfo?.subscription && (billingInfo.credits?.total_minutes || 0) <= 0)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title={billingInfo?.subscription && (billingInfo.credits?.total_minutes || 0) <= 0 ? 'Sem creditos de export disponiveis' : ''}
                  >
                    {exporting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Exportando...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Exportar Vídeo</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Auth / User button */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 rounded-lg text-sm">
                <User className="w-4 h-4 text-blue-400" />
                <span className="text-gray-300 max-w-[120px] truncate">{user?.full_name || user?.email}</span>
              </div>
              <button
                onClick={logout}
                className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setAuthModalReason('default'); setShowAuthModal(true) }}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span>Entrar</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Section (Video + Timeline) */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toolbar - centered above video */}
          <div className="flex justify-center py-2 bg-gray-900">
            <Toolbar onAddElement={addElement} />
          </div>
          
          {/* Video Preview */}
          <div className="flex-1 min-h-0">
            <VideoPreview
              videoRef={videoRef}
              videoUrl={video?.file_url}
              elements={visibleElements}
              selectedElementId={selectedElementId}
              onSelectElement={selectElement}
              onUpdateElement={updateElement}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              currentTime={currentTime}
              duration={duration}
              bpmConfig={bpmConfig}
              onCopyElement={copyElement}
              onPasteElement={pasteElement}
              onDuplicateElement={duplicateElement}
              onDeleteElement={deleteElement}
              clipboardElement={clipboardElement}
            />
          </div>
          
          {/* Timeline */}
          <Timeline
            elements={elements}
            cuts={cuts}
            videoSegments={videoSegments}
            selectedSegmentId={selectedSegmentId}
            onSelectSegment={setSelectedSegmentId}
            onCutSegment={cutVideoAtCurrentTime}
            onDuplicateSegment={duplicateVideoSegment}
            onRemoveSegment={removeVideoSegment}
            onUpdateSegmentSpeed={updateVideoSegmentSpeed}
            onUpdateVideoSegments={setVideoSegments}
            selectedElementId={selectedElementId}
            onSelectElement={selectElement}
            onUpdateElement={updateElement}
            onRemoveCut={removeCut}
            currentTime={currentTime}
            duration={duration}
            originalDuration={originalDuration}
            onSeek={handleSeek}
            waveformData={waveformData}
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            onCopyElement={copyElement}
            onPasteElement={pasteElement}
            onDuplicateElement={duplicateElement}
            onDeleteElement={deleteElement}
            clipboardElement={clipboardElement}
            bpmConfig={bpmConfig}
            barSelection={barSelection}
            onBarSelectionChange={setBarSelection}
            onBarSelectionRemove={handleBarSelectionRemove}
            onBarSelectionDuplicate={handleBarSelectionDuplicate}
            onBarSelectionSpeed={handleBarSelectionSpeed}
          />
        </div>

        {/* Configuration Bar (Right) */}
        <ConfigurationBar
          selectedElement={selectedElement}
          onUpdateElement={updateElement}
          onDeleteElement={deleteElement}
          bpmConfig={bpmConfig}
          onUpdateBpmConfig={updateBpmConfig}
        />
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        reason={authModalReason}
      />
    </div>
  )
}

export default VideoEditor
