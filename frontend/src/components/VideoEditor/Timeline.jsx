// Timeline Component - Shows element tracks, cuts, waveform and playhead

import { useRef, useCallback, useEffect, useState } from 'react'
import { Play, Pause, ZoomIn, ZoomOut, Copy, Clipboard, CopyPlus, Trash2, Eye, EyeOff, Clock, Music2, X } from 'lucide-react'
import { formatTime, elementTypeLabels, getBarNumberAtTime, getBarTimeRange, getSegmentAtTimelineTime } from './utils'

function Timeline({
  elements,
  cuts,
  videoSegments,
  selectedSegmentId,
  onSelectSegment,
  onCutSegment,
  onDuplicateSegment,
  onRemoveSegment,
  onUpdateSegmentSpeed,
  onUpdateVideoSegments,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  onRemoveCut,
  currentTime,
  duration,
  originalDuration,
  onSeek,
  waveformData,
  isPlaying,
  onPlayPause,
  onCopyElement,
  onPasteElement,
  onDuplicateElement,
  onDeleteElement,
  clipboardElement,
  bpmConfig,
  barSelection,
  onBarSelectionChange,
  onBarSelectionRemove,
  onBarSelectionDuplicate,
  onBarSelectionSpeed
}) {
  const timelineRef = useRef(null)
  const [zoom, setZoom] = useState(1) // pixels per second
  const [scrollLeft, setScrollLeft] = useState(0)
  const [draggingElement, setDraggingElement] = useState(null)
  const [dragType, setDragType] = useState(null) // 'move', 'start', 'end'
  const [dragStartX, setDragStartX] = useState(0)
  const [dragStartTime, setDragStartTime] = useState(0)
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false)
  const [contextMenu, setContextMenu] = useState(null) // { x, y, elementId }
  const [rulerMode, setRulerMode] = useState('bars') // 'time' or 'bars'
  
  // Bar selection drag state
  const [barDragStart, setBarDragStart] = useState(null) // bar number where drag started
  const [barDragCurrent, setBarDragCurrent] = useState(null) // current bar during drag
  const [isDraggingBars, setIsDraggingBars] = useState(false)
  const barClickTimerRef = useRef(null)
  const [speedInputValue, setSpeedInputValue] = useState('0.5')
  const barTrackRef = useRef(null)
  
  // Timeline height resize state
  const [timelineHeight, setTimelineHeight] = useState(280) // Default height in pixels
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartY = useRef(0)
  const resizeStartHeight = useRef(0)

  // Calculate timeline width based on duration and zoom
  const basePixelsPerSecond = 50
  const pixelsPerSecond = basePixelsPerSecond * zoom
  const timelineWidth = Math.max(duration * pixelsPerSecond, 800)

  // Convert time to pixel position
  const timeToPixel = useCallback((time) => {
    return time * pixelsPerSecond
  }, [pixelsPerSecond])

  // Convert pixel position to time
  const pixelToTime = useCallback((pixel) => {
    return pixel / pixelsPerSecond
  }, [pixelsPerSecond])

  // Handle timeline mousedown to start playhead drag
  const handleTimelineMouseDown = (e) => {
    if (draggingElement) return
    
    // Check if clicking on an element (not the timeline background)
    if (e.target.closest('[data-element-track]')) return
    
    const rect = timelineRef.current.getBoundingClientRect()
    const scrollContainer = timelineRef.current.parentElement
    const x = e.clientX - rect.left + scrollContainer.scrollLeft
    const time = Math.max(0, Math.min(pixelToTime(x), duration))
    onSeek(time)
    setIsDraggingPlayhead(true)
  }

  // Handle playhead drag
  useEffect(() => {
    if (!isDraggingPlayhead) return

    const handleMouseMove = (e) => {
      if (!timelineRef.current) return
      const rect = timelineRef.current.getBoundingClientRect()
      const scrollContainer = timelineRef.current.parentElement
      const x = e.clientX - rect.left + scrollContainer.scrollLeft
      // Use pixelsPerSecond directly instead of pixelToTime to avoid dependency issues
      const time = Math.max(0, Math.min(x / pixelsPerSecond, duration))
      onSeek(time)
    }

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingPlayhead, pixelsPerSecond, duration, onSeek])

  // Handle element drag start
  const handleElementDragStart = (e, element, type) => {
    e.stopPropagation()
    setContextMenu(null)
    setDraggingElement(element.id)
    setDragType(type)
    setDragStartX(e.clientX)
    setDragStartTime(type === 'start' ? element.startTime : type === 'end' ? element.endTime : element.startTime)
    onSelectElement(element.id)
  }

  // Handle right-click context menu on timeline elements
  const handleContextMenu = useCallback((e, element) => {
    e.preventDefault()
    e.stopPropagation()
    onSelectElement(element.id)
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      elementId: element.id
    })
  }, [onSelectElement])

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null)
    if (contextMenu) {
      window.addEventListener('click', handleClickOutside)
      return () => window.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenu])

  // Handle timeline height resize
  const handleResizeStart = (e) => {
    e.preventDefault()
    setIsResizing(true)
    resizeStartY.current = e.clientY
    resizeStartHeight.current = timelineHeight
  }

  useEffect(() => {
    if (!isResizing) return

    const handleResizeMove = (e) => {
      // Dragging up increases height, dragging down decreases
      const deltaY = resizeStartY.current - e.clientY
      const newHeight = Math.max(150, Math.min(600, resizeStartHeight.current + deltaY))
      setTimelineHeight(newHeight)
    }

    const handleResizeEnd = () => {
      setIsResizing(false)
    }

    window.addEventListener('mousemove', handleResizeMove)
    window.addEventListener('mouseup', handleResizeEnd)
    
    return () => {
      window.removeEventListener('mousemove', handleResizeMove)
      window.removeEventListener('mouseup', handleResizeEnd)
    }
  }, [isResizing])

  // Context menu component
  const renderContextMenu = () => {
    if (!contextMenu) return null
    
    // Check if context menu is for a video segment or element
    const isSegmentMenu = !!contextMenu.segmentId
    
    let menuItems = []
    
    if (isSegmentMenu) {
      // Video segment context menu
      menuItems = [
        { label: 'Cortar no Tempo Atual', icon: Copy, action: () => onCutSegment?.(), shortcut: 'S' },
        { label: 'Duplicar Segmento', icon: CopyPlus, action: () => onDuplicateSegment?.(contextMenu.segmentId), shortcut: 'Ctrl+D' },
        { type: 'divider' },
        { label: 'Excluir Segmento', icon: Trash2, action: () => onRemoveSegment?.(contextMenu.segmentId), danger: true, shortcut: 'Del' },
      ]
    } else {
      // Element context menu
      const element = elements.find(el => el.id === contextMenu.elementId)
      const isVisible = element?.visible !== false
      
      menuItems = [
        { label: 'Copiar', icon: Copy, action: () => onCopyElement?.(contextMenu.elementId), shortcut: 'Ctrl+C' },
        { label: 'Colar', icon: Clipboard, action: () => onPasteElement?.(), disabled: !clipboardElement, shortcut: 'Ctrl+V' },
        { label: 'Duplicar', icon: CopyPlus, action: () => onDuplicateElement?.(contextMenu.elementId), shortcut: 'Ctrl+D' },
        { type: 'divider' },
        { label: isVisible ? 'Ocultar' : 'Mostrar', icon: isVisible ? EyeOff : Eye, action: () => onUpdateElement?.(contextMenu.elementId, { visible: !isVisible }) },
        { label: 'Excluir', icon: Trash2, action: () => onDeleteElement?.(contextMenu.elementId), danger: true, shortcut: 'Del' },
      ]
    }

    return (
      <div
        className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 z-50 min-w-[160px]"
        style={{ left: contextMenu.x, top: contextMenu.y }}
        onClick={(e) => e.stopPropagation()}
      >
        {menuItems.map((item, index) => {
          if (item.type === 'divider') {
            return <div key={index} className="border-t border-gray-600 my-1" />
          }
          return (
            <button
              key={item.label}
              onClick={() => {
                item.action()
                setContextMenu(null)
              }}
              disabled={item.disabled}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed ${item.danger ? 'text-red-400 hover:text-red-300' : 'text-white'}`}
            >
              <item.icon className="w-4 h-4" />
              <span className="flex-1">{item.label}</span>
              <span className="text-xs text-gray-500">{item.shortcut}</span>
            </button>
          )
        })}
      </div>
    )
  }

  // Handle drag move and end
  useEffect(() => {
    if (!draggingElement) return

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - dragStartX
      const deltaTime = pixelToTime(deltaX)
      const element = elements.find(el => el.id === draggingElement)
      if (!element) return

      if (dragType === 'move') {
        const newStart = Math.max(0, Math.min(dragStartTime + deltaTime, duration - (element.endTime - element.startTime)))
        const elementDuration = element.endTime - element.startTime
        onUpdateElement(draggingElement, {
          startTime: newStart,
          endTime: newStart + elementDuration
        })
      } else if (dragType === 'start') {
        const newStart = Math.max(0, Math.min(dragStartTime + deltaTime, element.endTime - 0.1))
        onUpdateElement(draggingElement, { startTime: newStart })
      } else if (dragType === 'end') {
        const newEnd = Math.max(element.startTime + 0.1, Math.min(dragStartTime + deltaTime, duration))
        onUpdateElement(draggingElement, { endTime: newEnd })
      }
    }

    const handleMouseUp = () => {
      setDraggingElement(null)
      setDragType(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingElement, dragType, dragStartX, dragStartTime, elements, duration, pixelToTime, onUpdateElement])

  // Auto-scroll to keep playhead visible
  useEffect(() => {
    if (!timelineRef.current || !isPlaying) return
    
    const scrollContainer = timelineRef.current.parentElement
    const playheadX = timeToPixel(currentTime)
    const containerWidth = scrollContainer.clientWidth
    const scrollLeft = scrollContainer.scrollLeft
    
    if (playheadX < scrollLeft + 100 || playheadX > scrollLeft + containerWidth - 100) {
      scrollContainer.scrollLeft = playheadX - containerWidth / 2
    }
  }, [currentTime, isPlaying, timeToPixel])

  // Group elements by type for track display
  const trackGroups = {
    text: elements.filter(el => el.type === 'text'),
    metronome: elements.filter(el => el.type === 'metronome'),
    timer: elements.filter(el => el.type === 'timer'),
    alert: elements.filter(el => el.type === 'alert')
  }

  // Render time markers
  const renderTimeMarkers = () => {
    const markers = []
    const interval = zoom >= 2 ? 1 : zoom >= 1 ? 5 : 10 // Adjust interval based on zoom
    
    for (let t = 0; t <= duration; t += interval) {
      markers.push(
        <div
          key={t}
          className="absolute top-0 h-full border-l border-gray-700 text-xs text-gray-500"
          style={{ left: `${timeToPixel(t)}px` }}
        >
          <span className="absolute top-1 left-1">{formatTime(t)}</span>
        </div>
      )
    }
    return markers
  }

  // Render bar markers (measure ruler)
  const renderBarMarkers = () => {
    if (!bpmConfig || !bpmConfig.bpm || bpmConfig.bpm <= 0) {
      return <div className="text-xs text-gray-500 p-1">Configure o BPM para ver os compassos</div>
    }
    
    const { bpm, timeSignatureNum = 4, offsetStart = 0 } = bpmConfig
    const beatsPerBar = timeSignatureNum
    const secondsPerBeat = 60 / bpm
    const secondsPerBar = secondsPerBeat * beatsPerBar
    
    const markers = []
    let barTime = offsetStart
    let barNumber = 1
    
    while (barTime <= duration) {
      if (barTime >= 0) {
        markers.push(
          <div
            key={`bar-marker-${barNumber}`}
            className="absolute top-0 h-full border-l border-blue-600/50 text-xs text-blue-400"
            style={{ left: `${timeToPixel(barTime)}px` }}
          >
            <span className="absolute top-1 left-1 font-mono">{barNumber}</span>
          </div>
        )
      }
      barTime += secondsPerBar
      barNumber++
    }
    
    return markers
  }

  // Render waveform - reflects video segments (cuts and duplications)
  const renderWaveform = () => {
    if (!videoSegments || videoSegments.length === 0) return null
    
    const numSamples = waveformData?.length || 2000
    const useRealData = waveformData && waveformData.length > 0
    
    // Generate or use waveform data
    const sourceData = useRealData ? waveformData : Array.from({ length: numSamples }, (_, i) => {
      const x = Math.sin(i * 0.05) * 0.4 + Math.sin(i * 0.02) * 0.3 + Math.sin(i * 0.01) * 0.2
      return x
    })
    
    // Render waveform for each segment
    let currentX = 0
    const waveformPaths = []
    
    videoSegments.forEach((segment, segmentIndex) => {
      const segmentStart = segment.startTime
      const segmentEnd = segment.endTime || originalDuration
      const segmentDuration = segmentEnd - segmentStart
      const segmentWidth = timeToPixel(segmentDuration)
      
      // Calculate which part of the original waveform this segment represents
      const startRatio = segmentStart / originalDuration
      const endRatio = segmentEnd / originalDuration
      const startSample = Math.floor(startRatio * sourceData.length)
      const endSample = Math.ceil(endRatio * sourceData.length)
      
      // Extract the relevant portion of waveform data
      const segmentData = sourceData.slice(startSample, endSample)
      
      if (segmentData.length === 0) return
      
      // Build path for this segment
      let pathData = `M ${currentX} 32`
      segmentData.forEach((value, i) => {
        const x = currentX + (i / segmentData.length) * segmentWidth
        const y = 32 - value * 32
        pathData += ` L ${x} ${y}`
      })
      
      waveformPaths.push({
        key: `segment-${segmentIndex}`,
        path: pathData,
        fillPath: pathData + ` L ${currentX + segmentWidth} 32 L ${currentX} 32 Z`,
        startX: currentX,
        width: segmentWidth
      })
      
      currentX += segmentWidth
    })
    
    return (
      <svg 
        className="absolute bottom-0 left-0 h-16"
        style={{ width: `${timelineWidth}px` }}
        preserveAspectRatio="none"
        viewBox={`0 0 ${timelineWidth} 64`}
      >
        {/* Center line */}
        <line x1="0" y1="32" x2={timelineWidth} y2="32" stroke="#444" strokeWidth="0.5" />
        
        {/* Render each segment's waveform */}
        {waveformPaths.map(({ key, path, fillPath }) => (
          <g key={key}>
            <path d={path} stroke={useRealData ? "#3b82f6" : "#22c55e"} strokeWidth="1.5" fill="none" />
            <path d={fillPath} fill={useRealData ? "#3b82f6" : "#22c55e"} opacity="0.1" />
          </g>
        ))}
      </svg>
    )
  }

  // Render element track item with row index for vertical positioning
  const renderTrackItem = (element, trackColor, rowIndex = 0) => {
    const isSelected = element.id === selectedElementId
    const left = timeToPixel(element.startTime)
    const width = timeToPixel(element.endTime - element.startTime)
    const rowHeight = 28 // Height per row including gap

    return (
      <div
        key={element.id}
        data-element-track="true"
        className={`absolute h-6 rounded cursor-pointer flex items-center ${trackColor} ${isSelected ? 'ring-2 ring-white' : ''}`}
        style={{
          left: `${left}px`,
          width: `${Math.max(width, 20)}px`,
          top: `${4 + rowIndex * rowHeight}px`
        }}
        onMouseDown={(e) => handleElementDragStart(e, element, 'move')}
        onContextMenu={(e) => handleContextMenu(e, element)}
      >
        {/* Left resize handle */}
        <div
          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30"
          onMouseDown={(e) => handleElementDragStart(e, element, 'start')}
        />
        
        {/* Content */}
        <span className="text-xs text-white truncate px-2 flex-1">
          {element.type === 'text' ? element.content : elementTypeLabels[element.type]}
        </span>
        
        {/* Right resize handle */}
        <div
          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30"
          onMouseDown={(e) => handleElementDragStart(e, element, 'end')}
        />
      </div>
    )
  }

  // Calculate row index for each element to avoid overlaps
  const calculateRowIndex = (elements) => {
    const sortedElements = [...elements].sort((a, b) => a.startTime - b.startTime)
    const rows = [] // Each row contains end times of elements in that row
    const elementRows = new Map()

    for (const element of sortedElements) {
      let assignedRow = -1
      
      // Find first row where this element fits (no overlap)
      for (let i = 0; i < rows.length; i++) {
        if (rows[i] <= element.startTime) {
          assignedRow = i
          rows[i] = element.endTime
          break
        }
      }
      
      // If no existing row fits, create a new one
      if (assignedRow === -1) {
        assignedRow = rows.length
        rows.push(element.endTime)
      }
      
      elementRows.set(element.id, assignedRow)
    }

    return elementRows
  }

  // Calculate total height of all tracks for proper scrolling
  const calculateTotalTracksHeight = () => {
    let totalHeight = 48 // Video track height
    totalHeight += 32 // Bar selection track height
    
    if (trackGroups.text.length > 0) {
      const textRows = calculateRowIndex(trackGroups.text)
      const maxRows = Math.max(...Array.from(textRows.values())) + 1
      totalHeight += Math.max(32, maxRows * 28 + 8)
    }
    
    if (trackGroups.metronome.length > 0) {
      const metronomeRows = calculateRowIndex(trackGroups.metronome)
      const maxRows = Math.max(...Array.from(metronomeRows.values())) + 1
      totalHeight += Math.max(32, maxRows * 28 + 8)
    }
    
    if (trackGroups.timer.length > 0) {
      const timerRows = calculateRowIndex(trackGroups.timer)
      const maxRows = Math.max(...Array.from(timerRows.values())) + 1
      totalHeight += Math.max(32, maxRows * 28 + 8)
    }
    
    if (trackGroups.alert.length > 0) {
      const alertRows = calculateRowIndex(trackGroups.alert)
      const maxRows = Math.max(...Array.from(alertRows.values())) + 1
      totalHeight += Math.max(32, maxRows * 28 + 8)
    }
    
    return totalHeight
  }

  const tracksHeight = calculateTotalTracksHeight()
  const timelineContentHeight = 6 + tracksHeight + 16 + 200 // header + tracks + waveform + extra padding

  // Render cuts
  const renderCuts = () => {
    return cuts.map((cutTime, i) => (
      <div
        key={i}
        className="absolute top-0 bottom-0 w-0.5 bg-red-500 cursor-pointer hover:bg-red-400 z-20"
        style={{ left: `${timeToPixel(cutTime)}px` }}
        onClick={(e) => {
          e.stopPropagation()
          if (confirm('Remover este corte?')) {
            onRemoveCut(cutTime)
          }
        }}
        title={`Corte em ${formatTime(cutTime)}`}
      />
    ))
  }

  // Render video segments track
  const renderVideoSegments = () => {
    if (!videoSegments || videoSegments.length === 0) return null

    // Calculate timeline positions for each segment
    let timelinePosition = 0
    
    return videoSegments.map((segment, index) => {
      // Each segment's duration in the original video
      const segmentDuration = (segment.endTime || originalDuration) - segment.startTime
      
      // Position in timeline (accumulated from previous segments)
      const startX = timeToPixel(timelinePosition)
      const width = timeToPixel(segmentDuration)
      const isSelected = segment.id === selectedSegmentId
      
      // Store current position for this segment, then advance for next
      const currentTimelineStart = timelinePosition
      timelinePosition += segmentDuration

      return (
        <div
          key={segment.id}
          className={`absolute h-full rounded cursor-pointer transition-all ${
            isSelected 
              ? 'bg-gradient-to-r from-blue-600 to-blue-500 border-2 border-blue-400 shadow-lg' 
              : 'bg-gradient-to-r from-green-600/80 to-emerald-600/80 border border-green-500/50 hover:from-green-500/90 hover:to-emerald-500/90'
          }`}
          style={{
            left: `${startX}px`,
            width: `${width}px`,
            top: 0
          }}
          onClick={(e) => {
            e.stopPropagation()
            onSelectSegment?.(segment.id)
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onSelectSegment?.(segment.id)
            setContextMenu({
              x: e.clientX,
              y: e.clientY,
              segmentId: segment.id
            })
          }}
          title={`Segmento ${index + 1} (${formatTime(segment.startTime)}-${formatTime(segment.endTime || originalDuration)}) - Velocidade: ${segment.speed}x\nClique para selecionar | S para cortar | Ctrl+D para duplicar | Del para remover`}
        >
          <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-semibold pointer-events-none">
            {segment.speed !== 1.0 ? `${segment.speed}x` : `${formatTime(segment.startTime)}-${formatTime(segment.endTime || originalDuration)}`}
          </div>
          
          {/* Segment border indicators */}
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-white/50" />
          <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-white/50" />
        </div>
      )
    })
  }

  // Calculate bar info for each segment in the timeline
  // Returns array of { barNumber (global), timelineStart, timelineEnd, segmentIndex, originalBarNumber }
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
      
      // Find the first bar that overlaps with this segment
      // A bar N starts at: offsetStart + (N-1) * barDuration
      const effectiveStart = Math.max(segStart, offsetStart)
      if (effectiveStart >= segEnd) {
        accumulatedTimelineTime += segDuration
        continue
      }
      
      // First bar number that contains effectiveStart
      const firstBarNum = Math.floor((effectiveStart - offsetStart) / barDuration) + 1
      
      let barNum = firstBarNum
      while (true) {
        const barOrigStart = offsetStart + (barNum - 1) * barDuration
        const barOrigEnd = barOrigStart + barDuration
        
        // Clip to segment boundaries
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
          segmentIndex: segIdx
        })
        globalBarIndex++
        barNum++
      }
      
      accumulatedTimelineTime += segDuration
    }
    
    return bars
  }, [bpmConfig, videoSegments, originalDuration])

  // Handle bar mousedown (start of click or drag)
  const handleBarMouseDown = useCallback((e, barNumber) => {
    e.stopPropagation()
    e.preventDefault()
    setBarDragStart(barNumber)
    setBarDragCurrent(barNumber)
    setIsDraggingBars(true)
  }, [])

  // Handle bar double-click (select whole segment)
  const handleBarDoubleClick = useCallback((e, barNumber) => {
    e.stopPropagation()
    e.preventDefault()
    
    // Find which segment this bar belongs to
    const allBars = getTimelineBars()
    const clickedBar = allBars.find(b => b.barNumber === barNumber)
    if (!clickedBar) return
    
    const segIdx = clickedBar.segmentIndex
    // Select all bars in this segment
    const segBars = allBars.filter(b => b.segmentIndex === segIdx)
    if (segBars.length === 0) return
    
    const firstBar = segBars[0].barNumber
    const lastBar = segBars[segBars.length - 1].barNumber
    
    onBarSelectionChange?.({ startBar: firstBar, endBar: lastBar })
  }, [getTimelineBars, onBarSelectionChange])

  // Handle bar drag move and end
  useEffect(() => {
    if (!isDraggingBars) return

    const handleMouseMove = (e) => {
      if (!timelineRef.current) return
      const rect = timelineRef.current.getBoundingClientRect()
      const scrollContainer = timelineRef.current.parentElement
      const x = e.clientX - rect.left + scrollContainer.scrollLeft
      const time = Math.max(0, Math.min(x / pixelsPerSecond, duration))
      
      // Find the bar at this time position
      const allBars = getTimelineBars()
      let hoveredBar = null
      for (const bar of allBars) {
        const barStartPx = timeToPixel(bar.timelineStart)
        const barEndPx = timeToPixel(bar.timelineEnd)
        if (x >= barStartPx && x <= barEndPx) {
          hoveredBar = bar.barNumber
          break
        }
      }
      if (hoveredBar !== null) {
        setBarDragCurrent(hoveredBar)
      }
    }

    const handleMouseUp = () => {
      if (barDragStart !== null && barDragCurrent !== null) {
        const startBar = Math.min(barDragStart, barDragCurrent)
        const endBar = Math.max(barDragStart, barDragCurrent)
        onBarSelectionChange?.({ startBar, endBar })
      }
      setIsDraggingBars(false)
      setBarDragStart(null)
      setBarDragCurrent(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingBars, barDragStart, barDragCurrent, pixelsPerSecond, duration, getTimelineBars, timeToPixel, onBarSelectionChange])

  // Render bar selection track - interactive bar cells
  const renderBarSelectionTrack = () => {
    if (!bpmConfig || !bpmConfig.bpm || bpmConfig.bpm <= 0) return null
    
    const allBars = getTimelineBars()
    if (allBars.length === 0) return null
    
    // Determine current selection range (from drag or from prop)
    let selStart = null, selEnd = null
    if (isDraggingBars && barDragStart !== null && barDragCurrent !== null) {
      selStart = Math.min(barDragStart, barDragCurrent)
      selEnd = Math.max(barDragStart, barDragCurrent)
    } else if (barSelection) {
      selStart = barSelection.startBar
      selEnd = barSelection.endBar
    }
    
    return (
      <div ref={barTrackRef} className="relative h-8 border-b border-gray-700 bg-gray-850">
        <span className="absolute left-2 top-1 text-xs text-gray-500 z-10 pointer-events-none">Compassos</span>
        {allBars.map((bar) => {
          const left = timeToPixel(bar.timelineStart)
          const width = timeToPixel(bar.timelineEnd - bar.timelineStart)
          const isSelected = selStart !== null && selEnd !== null && bar.barNumber >= selStart && bar.barNumber <= selEnd
          
          return (
            <div
              key={`bar-cell-${bar.barNumber}`}
              className={`absolute top-0 h-full border-r border-gray-600/50 flex items-center justify-center cursor-pointer select-none transition-colors ${
                isSelected
                  ? 'bg-orange-500/40 hover:bg-orange-500/50 border-orange-400/50'
                  : 'hover:bg-blue-500/20'
              }`}
              style={{ left: `${left}px`, width: `${Math.max(width, 2)}px` }}
              onMouseDown={(e) => {
                if (e.detail === 1) handleBarMouseDown(e, bar.barNumber)
              }}
              onDoubleClick={(e) => handleBarDoubleClick(e, bar.barNumber)}
              title={`Compasso ${bar.originalBarNumber} (original)`}
            >
              {width > 20 && (
                <span className={`text-[10px] font-mono pointer-events-none ${
                  isSelected ? 'text-orange-200 font-bold' : 'text-gray-500'
                }`}>
                  {bar.originalBarNumber}
                </span>
              )}
            </div>
          )
        })}
        
      </div>
    )
  }

  // Render fixed-position selection action toolbar (rendered at component root level to avoid overflow clipping)
  const renderBarSelectionToolbar = () => {
    if (!bpmConfig || !bpmConfig.bpm || bpmConfig.bpm <= 0) return null
    
    const selStart = barSelection?.startBar
    const selEnd = barSelection?.endBar
    if (selStart == null || selEnd == null || isDraggingBars) return null
    
    const allBars = getTimelineBars()
    const firstBar = allBars.find(b => b.barNumber === selStart)
    const lastBar = allBars.find(b => b.barNumber === selEnd)
    if (!firstBar || !lastBar || !barTrackRef.current || !timelineRef.current) return null
    
    const trackRect = barTrackRef.current.getBoundingClientRect()
    const timelineRect = timelineRef.current.getBoundingClientRect()
    const scrollContainer = timelineRef.current.parentElement
    const scrollOffset = scrollContainer ? scrollContainer.scrollLeft : 0
    
    const selLeftPx = timeToPixel(firstBar.timelineStart) - scrollOffset
    const selRightPx = timeToPixel(lastBar.timelineEnd) - scrollOffset
    const selCenterX = timelineRect.left + (selLeftPx + selRightPx) / 2
    const toolbarY = trackRect.top - 4
    
    return (
      <div
        className="fixed z-50 flex items-center gap-1 bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 shadow-xl"
        style={{ left: `${selCenterX}px`, top: `${toolbarY}px`, transform: 'translate(-50%, -100%)' }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span className="text-[10px] text-orange-300 font-mono mr-1">
          {selStart === selEnd ? `C${firstBar.originalBarNumber}` : `C${firstBar.originalBarNumber}-${lastBar.originalBarNumber}`}
        </span>
        <button
          onClick={() => onBarSelectionDuplicate?.()}
          className="p-1 rounded hover:bg-gray-700 text-blue-400 hover:text-blue-300" 
          title="Duplicar sele\u00e7\u00e3o"
        >
          <CopyPlus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onBarSelectionRemove?.()}
          className="p-1 rounded hover:bg-gray-700 text-red-400 hover:text-red-300"
          title="Remover sele\u00e7\u00e3o (Del)"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <span className="text-gray-600">|</span>
        <div className="flex items-center gap-0.5">
          <select
            value={speedInputValue}
            onChange={(e) => setSpeedInputValue(e.target.value)}
            className="bg-gray-700 text-white text-[10px] rounded px-1 py-0.5 border border-gray-600 w-14"
          >
            <option value="0.25">0.25x</option>
            <option value="0.5">0.5x</option>
            <option value="0.75">0.75x</option>
            <option value="1">1x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
          <button
            onClick={() => onBarSelectionSpeed?.(parseFloat(speedInputValue))}
            className="p-1 rounded hover:bg-gray-700 text-yellow-400 hover:text-yellow-300"
            title="Alterar velocidade da sele\u00e7\u00e3o"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
        </div>
        <button
          onClick={() => onBarSelectionChange?.(null)}
          className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-300 ml-0.5"
          title="Limpar sele\u00e7\u00e3o (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  // Render bar lines (vertical lines at the start of each measure/bar)
  const renderBarLines = () => {
    if (!bpmConfig || !bpmConfig.bpm || bpmConfig.bpm <= 0) return null
    
    const { bpm, timeSignatureNum = 4, offsetStart = 0 } = bpmConfig
    const beatsPerBar = timeSignatureNum
    const secondsPerBeat = 60 / bpm
    const secondsPerBar = secondsPerBeat * beatsPerBar
    
    const lines = []
    let barTime = offsetStart
    let barNumber = 1
    
    while (barTime <= duration) {
      if (barTime >= 0) {
        lines.push(
          <div
            key={`bar-${barNumber}`}
            className="absolute top-0 bottom-0 border-l border-blue-500/30 z-5 pointer-events-none"
            style={{ left: `${timeToPixel(barTime)}px` }}
            title={`Compasso ${barNumber}`}
          >
            <span className="absolute top-7 left-1 text-[10px] text-blue-400/50">{barNumber}</span>
          </div>
        )
      }
      barTime += secondsPerBar
      barNumber++
    }
    
    return lines
  }

  return (
    <div 
      className="bg-gray-850 border-t border-gray-700 flex flex-col relative"
      style={{ height: `${timelineHeight}px` }}
    >
      {/* Resize handle at the top */}
      <div
        className={`absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-50 group ${isResizing ? 'bg-blue-500/50' : 'hover:bg-blue-500/30'}`}
        onMouseDown={handleResizeStart}
      >
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 rounded-full transition-colors ${isResizing ? 'bg-blue-400' : 'bg-gray-600 group-hover:bg-blue-400'}`} />
      </div>
      
      {/* Timeline Header with controls */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <button
            onClick={onPlayPause}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white text-gray-900 hover:bg-gray-200 transition-colors"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <span className="text-sm text-gray-300 font-mono">
            {formatTime(currentTime, true)} <span className="text-gray-500">/</span> {formatTime(duration)}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Ruler mode toggle */}
          <button
            onClick={() => setRulerMode(mode => mode === 'time' ? 'bars' : 'time')}
            className={`p-1.5 rounded transition-colors ${rulerMode === 'bars' ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}
            title={rulerMode === 'bars' ? 'Régua de compassos (clique para tempo)' : 'Régua de tempo (clique para compassos)'}
          >
            {rulerMode === 'bars' ? <Music2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
          </button>
          
          <span className="text-gray-600">|</span>
          
          <button
            onClick={() => setZoom(z => Math.max(0.25, z / 1.5))}
            className="p-1.5 rounded hover:bg-gray-700 transition-colors"
            title="Diminuir zoom"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(z => Math.min(4, z * 1.5))}
            className="p-1.5 rounded hover:bg-gray-700 transition-colors"
            title="Aumentar zoom"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Timeline Content with fixed waveform at bottom */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Scrollable tracks area */}
        <div className="flex-1 overflow-auto" onScroll={(e) => setScrollLeft(e.target.scrollLeft)}>
          <div
            ref={timelineRef}
            className="relative"
            style={{ width: `${timelineWidth}px`, minWidth: '100%', minHeight: `${timelineContentHeight - 64}px` }}
            onMouseDown={handleTimelineMouseDown}
          >
            {/* Bar lines (measure markers) - always visible behind elements */}
            {renderBarLines()}

            {/* Ruler - sticky at top, switches between time and bars */}
            <div className="sticky top-0 left-0 right-0 h-6 bg-gray-800 border-b border-gray-700 z-20">
              {rulerMode === 'time' ? renderTimeMarkers() : renderBarMarkers()}
            </div>

            {/* Tracks Container */}
            <div className="relative">
              {/* Video Track - Always visible */}
              <div className="relative border-b border-gray-700 h-12 bg-gray-850">
                <span className="absolute left-2 top-1 text-xs text-gray-500 z-10">Vídeo</span>
                <div className="absolute left-0 right-0 top-5 bottom-1">
                  {renderVideoSegments()}
                </div>
              </div>

              {/* Bar Selection Track */}
              {renderBarSelectionTrack()}

              {/* Text Track */}
              {trackGroups.text.length > 0 && (() => {
                const textRows = calculateRowIndex(trackGroups.text)
                const maxRows = Math.max(...Array.from(textRows.values())) + 1
                return (
                  <div className="relative border-b border-gray-700" style={{ height: `${Math.max(32, maxRows * 28 + 8)}px` }}>
                    <span className="absolute left-2 top-1 text-xs text-gray-500 z-10">Texto</span>
                    {trackGroups.text.map(el => renderTrackItem(el, 'bg-blue-600', textRows.get(el.id)))}
                  </div>
                )
              })()}

              {/* Metronome Track */}
              {trackGroups.metronome.length > 0 && (() => {
                const metronomeRows = calculateRowIndex(trackGroups.metronome)
                const maxRows = Math.max(...Array.from(metronomeRows.values())) + 1
                return (
                  <div className="relative border-b border-gray-700" style={{ height: `${Math.max(32, maxRows * 28 + 8)}px` }}>
                    <span className="absolute left-2 top-1 text-xs text-gray-500 z-10">Metrônomo</span>
                    {trackGroups.metronome.map(el => renderTrackItem(el, 'bg-purple-600', metronomeRows.get(el.id)))}
                  </div>
                )
              })()}

              {/* Timer Track */}
              {trackGroups.timer.length > 0 && (() => {
                const timerRows = calculateRowIndex(trackGroups.timer)
                const maxRows = Math.max(...Array.from(timerRows.values())) + 1
                return (
                  <div className="relative border-b border-gray-700" style={{ height: `${Math.max(32, maxRows * 28 + 8)}px` }}>
                    <span className="absolute left-2 top-1 text-xs text-gray-500 z-10">Cronômetro</span>
                    {trackGroups.timer.map(el => renderTrackItem(el, 'bg-indigo-600', timerRows.get(el.id)))}
                  </div>
                )
              })()}

              {/* Alert Track */}
              {trackGroups.alert.length > 0 && (() => {
                const alertRows = calculateRowIndex(trackGroups.alert)
                const maxRows = Math.max(...Array.from(alertRows.values())) + 1
                return (
                  <div className="relative border-b border-gray-700" style={{ height: `${Math.max(32, maxRows * 28 + 8)}px` }}>
                    <span className="absolute left-2 top-1 text-xs text-gray-500 z-10">Alerta</span>
                    {trackGroups.alert.map(el => renderTrackItem(el, 'bg-yellow-600', alertRows.get(el.id)))}
                  </div>
                )
              })()}

              {/* Cuts */}
              {renderCuts()}
            </div>

            {/* Playhead in scrollable area */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white z-30 pointer-events-none"
              style={{ left: `${timeToPixel(currentTime)}px` }}
            >
              <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45" />
            </div>
          </div>
        </div>

        {/* Fixed Waveform at bottom - follows horizontal scroll */}
        <div className="h-16 bg-gray-900/90 border-t border-gray-700 overflow-x-hidden">
          <div 
            className="relative h-full"
            style={{ width: `${timelineWidth}px`, transform: `translateX(-${scrollLeft}px)` }}
          >
            {renderWaveform()}
            {/* Playhead in waveform */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white z-30 pointer-events-none"
              style={{ left: `${timeToPixel(currentTime)}px` }}
            />
            {/* Bar lines in waveform */}
            {renderBarLines()}
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {renderContextMenu()}

      {/* Bar Selection Action Toolbar (fixed position, outside scroll) */}
      {renderBarSelectionToolbar()}
    </div>
  )
}

export default Timeline
