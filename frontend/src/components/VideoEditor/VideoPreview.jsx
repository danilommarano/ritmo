// VideoPreview Component - Video player with overlay elements

import { useRef, useEffect, useState, useCallback } from 'react'
import { Copy, Clipboard, CopyPlus, Trash2, Eye, EyeOff } from 'lucide-react'
import { formatTime, calculateBarBeat, clamp } from './utils'

function VideoPreview({
  videoRef,
  videoUrl,
  elements,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  onTimeUpdate,
  onLoadedMetadata,
  onPlay,
  onPause,
  isPlaying,
  onPlayPause,
  currentTime,
  duration,
  bpmConfig,
  onCopyElement,
  onPasteElement,
  onDuplicateElement,
  onDeleteElement,
  clipboardElement
}) {
  const containerRef = useRef(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [dragging, setDragging] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [contextMenu, setContextMenu] = useState(null) // { x, y, elementId }
  const [resizing, setResizing] = useState(null) // { elementId, handle, startX, startY, startWidth, startHeight }

  // Update container size on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setContainerSize({ width: rect.width, height: rect.height })
      }
    }
    
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // Handle element drag start
  const handleDragStart = useCallback((e, element) => {
    e.stopPropagation()
    if (e.button !== 0) return // Only left click
    
    const rect = e.currentTarget.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
    setDragging(element.id)
    onSelectElement(element.id)
  }, [onSelectElement])

  // Handle drag move
  useEffect(() => {
    if (!dragging) return

    const handleMouseMove = (e) => {
      if (!containerRef.current) return
      
      const containerRect = containerRef.current.getBoundingClientRect()
      const x = ((e.clientX - containerRect.left - dragOffset.x + 50) / containerRect.width) * 100
      const y = ((e.clientY - containerRect.top - dragOffset.y + 20) / containerRect.height) * 100
      
      onUpdateElement(dragging, {
        x: clamp(x, 0, 100),
        y: clamp(y, 0, 100)
      })
    }

    const handleMouseUp = () => {
      setDragging(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging, dragOffset, onUpdateElement])

  // Handle resize start
  const handleResizeStart = useCallback((e, element, handle) => {
    e.stopPropagation()
    e.preventDefault()
    
    const elementNode = e.target.closest('[data-element-id]')
    const rect = elementNode?.getBoundingClientRect()
    
    setResizing({
      elementId: element.id,
      handle, // 'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'
      startX: e.clientX,
      startY: e.clientY,
      startWidth: element.width || rect?.width || 100,
      startHeight: element.height || rect?.height || 40,
      startFontSize: element.fontSize || 32
    })
    onSelectElement(element.id)
  }, [onSelectElement])

  // Handle resize move
  useEffect(() => {
    if (!resizing) return

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - resizing.startX
      const deltaY = e.clientY - resizing.startY
      const element = elements.find(el => el.id === resizing.elementId)
      if (!element) return

      const handle = resizing.handle
      let updates = {}

      // For text elements, we scale fontSize instead of width/height
      if (element.type === 'text' || element.type === 'counter' || element.type === 'timer') {
        // Calculate scale factor based on handle type
        let scaleFactor = 1
        
        if (handle.includes('e') || handle.includes('w')) {
          scaleFactor = 1 + (handle.includes('e') ? deltaX : -deltaX) / 200
        }
        if (handle.includes('s') || handle.includes('n')) {
          const yScale = 1 + (handle.includes('s') ? deltaY : -deltaY) / 200
          scaleFactor = handle.length === 2 ? Math.max(scaleFactor, yScale) : yScale
        }
        
        // Corner handles scale proportionally
        if (handle.length === 2) {
          const avgDelta = (Math.abs(deltaX) + Math.abs(deltaY)) / 2
          const sign = (deltaX + deltaY) > 0 ? 1 : -1
          if (handle === 'se' || handle === 'nw') {
            scaleFactor = 1 + (sign * avgDelta) / 200
          } else {
            scaleFactor = 1 + (sign * avgDelta) / 200
          }
        }
        
        const newFontSize = Math.round(clamp(resizing.startFontSize * scaleFactor, 12, 200))
        updates.fontSize = newFontSize
      } else {
        // For other elements like alerts, scale width/height
        let newWidth = resizing.startWidth
        let newHeight = resizing.startHeight

        if (handle.includes('e')) newWidth = resizing.startWidth + deltaX
        if (handle.includes('w')) newWidth = resizing.startWidth - deltaX
        if (handle.includes('s')) newHeight = resizing.startHeight + deltaY
        if (handle.includes('n')) newHeight = resizing.startHeight - deltaY

        updates.width = Math.max(20, newWidth)
        updates.height = Math.max(20, newHeight)
      }

      onUpdateElement(resizing.elementId, updates)
    }

    const handleMouseUp = () => {
      setResizing(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizing, elements, onUpdateElement])

  // Render resize handles for selected element
  const renderResizeHandles = (element) => {
    if (element.id !== selectedElementId) return null
    
    const handleStyle = {
      position: 'absolute',
      width: '8px',
      height: '8px',
      backgroundColor: 'white',
      border: '1px solid #3b82f6',
      borderRadius: '2px',
      zIndex: 30,
    }

    const handles = [
      { id: 'nw', style: { top: '-4px', left: '-4px', cursor: 'nwse-resize' } },
      { id: 'n', style: { top: '-4px', left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' } },
      { id: 'ne', style: { top: '-4px', right: '-4px', cursor: 'nesw-resize' } },
      { id: 'w', style: { top: '50%', left: '-4px', transform: 'translateY(-50%)', cursor: 'ew-resize' } },
      { id: 'e', style: { top: '50%', right: '-4px', transform: 'translateY(-50%)', cursor: 'ew-resize' } },
      { id: 'sw', style: { bottom: '-4px', left: '-4px', cursor: 'nesw-resize' } },
      { id: 's', style: { bottom: '-4px', left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' } },
      { id: 'se', style: { bottom: '-4px', right: '-4px', cursor: 'nwse-resize' } },
    ]

    return handles.map(handle => (
      <div
        key={handle.id}
        style={{ ...handleStyle, ...handle.style }}
        onMouseDown={(e) => handleResizeStart(e, element, handle.id)}
      />
    ))
  }

  // Click on video area to deselect and close context menu
  const handleContainerClick = (e) => {
    setContextMenu(null)
    if (e.target === containerRef.current || e.target === videoRef.current) {
      onSelectElement(null)
    }
  }

  // Handle right-click context menu on elements
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

  // Context menu component
  const renderContextMenu = () => {
    if (!contextMenu) return null
    
    const element = elements.find(el => el.id === contextMenu.elementId)
    const isVisible = element?.visible !== false
    
    const menuItems = [
      { label: 'Copiar', icon: Copy, action: () => onCopyElement?.(contextMenu.elementId), shortcut: 'Ctrl+C' },
      { label: 'Colar', icon: Clipboard, action: () => onPasteElement?.(), disabled: !clipboardElement, shortcut: 'Ctrl+V' },
      { label: 'Duplicar', icon: CopyPlus, action: () => onDuplicateElement?.(contextMenu.elementId), shortcut: 'Ctrl+D' },
      { type: 'divider' },
      { label: isVisible ? 'Ocultar' : 'Mostrar', icon: isVisible ? EyeOff : Eye, action: () => onUpdateElement?.(contextMenu.elementId, { visible: !isVisible }) },
      { label: 'Excluir', icon: Trash2, action: () => onDeleteElement?.(contextMenu.elementId), danger: true, shortcut: 'Del' },
    ]

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

  // Render element based on type
  const renderElement = (element) => {
    const isSelected = element.id === selectedElementId
    const baseStyle = {
      position: 'absolute',
      left: `${element.x}%`,
      top: `${element.y}%`,
      transform: 'translate(-50%, -50%)',
      cursor: dragging === element.id ? 'grabbing' : 'grab',
      userSelect: 'none',
      zIndex: isSelected ? 20 : 10,
    }

    const selectionStyle = isSelected ? {
      outline: '2px solid #3b82f6',
      outlineOffset: '2px',
    } : {}

    switch (element.type) {
      case 'text':
        return (
          <div
            key={element.id}
            data-element-id={element.id}
            style={{
              ...baseStyle,
              ...selectionStyle,
              fontSize: `${element.fontSize}px`,
              color: element.fontColor,
              backgroundColor: element.hasBackground ? element.backgroundColor : 'transparent',
              padding: element.hasBackground ? '8px 16px' : '0',
              borderRadius: '8px',
              fontWeight: element.fontWeight,
              whiteSpace: 'nowrap',
            }}
            onMouseDown={(e) => handleDragStart(e, element)}
            onClick={(e) => {
              e.stopPropagation()
              onSelectElement(element.id)
            }}
            onContextMenu={(e) => handleContextMenu(e, element)}
          >
            {element.content}
            {renderResizeHandles(element)}
          </div>
        )

      case 'counter':
        const { bar, beat } = calculateBarBeat(currentTime, bpmConfig)
        let counterText = ''
        switch (element.counterType) {
          case 'bar-beat':
            counterText = `${bar}.${beat}`
            break
          case 'bar':
            counterText = `${bar}`
            break
          case 'beat':
            counterText = `${beat}`
            break
          case 'time':
            counterText = formatTime(currentTime)
            break
          default:
            counterText = `${bar}.${beat}`
        }
        
        return (
          <div
            key={element.id}
            data-element-id={element.id}
            style={{
              ...baseStyle,
              ...selectionStyle,
              fontSize: `${element.fontSize}px`,
              color: element.fontColor,
              backgroundColor: element.hasBackground ? element.backgroundColor : 'transparent',
              padding: element.hasBackground ? '12px 24px' : '0',
              borderRadius: '12px',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              minWidth: '80px',
              textAlign: 'center',
            }}
            onMouseDown={(e) => handleDragStart(e, element)}
            onClick={(e) => {
              e.stopPropagation()
              onSelectElement(element.id)
            }}
            onContextMenu={(e) => handleContextMenu(e, element)}
          >
            {bar > 0 ? counterText : '--'}
            {renderResizeHandles(element)}
          </div>
        )

      case 'timer':
        const timerText = formatTime(currentTime, true)
        
        return (
          <div
            key={element.id}
            data-element-id={element.id}
            style={{
              ...baseStyle,
              ...selectionStyle,
              fontSize: `${element.fontSize}px`,
              color: element.fontColor,
              backgroundColor: element.hasBackground ? element.backgroundColor : 'transparent',
              padding: element.hasBackground ? '12px 24px' : '0',
              borderRadius: '12px',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              minWidth: '100px',
              textAlign: 'center',
            }}
            onMouseDown={(e) => handleDragStart(e, element)}
            onClick={(e) => {
              e.stopPropagation()
              onSelectElement(element.id)
            }}
            onContextMenu={(e) => handleContextMenu(e, element)}
          >
            {timerText}
            {renderResizeHandles(element)}
          </div>
        )

      case 'alert':
        // Check if alert should be visible based on beat sync
        let alertVisible = true
        if (element.syncToBeat) {
          const { beat: currentBeat } = calculateBarBeat(currentTime, bpmConfig)
          const beatDuration = 60.0 / bpmConfig.bpm
          const timeInBeat = (currentTime - bpmConfig.offsetStart) % beatDuration
          // Show alert for first 20% of each beat
          alertVisible = currentTime >= bpmConfig.offsetStart && timeInBeat < beatDuration * 0.2
        }

        if (!alertVisible) return null

        if (element.alertType === 'flash') {
          return (
            <div
              key={element.id}
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: element.color,
                pointerEvents: 'none',
                zIndex: 5,
              }}
            />
          )
        } else {
          // Circle alert
          return (
            <div
              key={element.id}
              style={{
                ...baseStyle,
                ...selectionStyle,
                width: `${element.circleSize}px`,
                height: `${element.circleSize}px`,
                borderRadius: '50%',
                backgroundColor: element.color,
              }}
              onMouseDown={(e) => handleDragStart(e, element)}
              onClick={(e) => {
                e.stopPropagation()
                onSelectElement(element.id)
              }}
            />
          )
        }

      default:
        return null
    }
  }

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Video Container */}
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden flex items-center justify-center"
        onClick={handleContainerClick}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onPlay={onPlay}
          onPause={onPause}
          className="max-w-full max-h-full"
          style={{ objectFit: 'contain' }}
        >
          Seu navegador não suporta reprodução de vídeos.
        </video>

        {/* Elements Overlay */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="relative w-full h-full pointer-events-auto">
            {elements.map(renderElement)}
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {renderContextMenu()}
    </div>
  )
}

export default VideoPreview
