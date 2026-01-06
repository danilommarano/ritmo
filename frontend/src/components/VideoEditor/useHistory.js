// useHistory Hook - Manages undo/redo history for video editor state
// Tracks all changes including elements, selection, and other editor state

import { useState, useCallback, useRef } from 'react'

const MAX_HISTORY_SIZE = 100

function useHistory(initialState) {
  // History stack: array of past states
  const [history, setHistory] = useState([initialState])
  // Current position in history (index)
  const [historyIndex, setHistoryIndex] = useState(0)
  // Flag to prevent recording during undo/redo operations
  const isUndoRedoRef = useRef(false)
  // Batch update flag to group multiple changes
  const batchRef = useRef(false)
  const batchStateRef = useRef(null)

  // Get current state from history
  const currentState = history[historyIndex]

  // Record a new state in history
  const recordState = useCallback((newState, actionType = 'unknown') => {
    // Skip recording if we're in the middle of undo/redo
    if (isUndoRedoRef.current) return

    // If batching, just update the batch state
    if (batchRef.current) {
      batchStateRef.current = { state: newState, actionType }
      return
    }

    setHistory(prev => {
      // Remove any future states if we're not at the end
      const newHistory = prev.slice(0, historyIndex + 1)
      
      // Add new state
      newHistory.push({ ...newState, _actionType: actionType, _timestamp: Date.now() })
      
      // Limit history size
      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift()
        return newHistory
      }
      
      return newHistory
    })
    
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY_SIZE - 1))
  }, [historyIndex])

  // Undo - go back one step
  const undo = useCallback(() => {
    if (historyIndex <= 0) return null
    
    isUndoRedoRef.current = true
    const newIndex = historyIndex - 1
    setHistoryIndex(newIndex)
    
    // Reset flag after state update
    setTimeout(() => {
      isUndoRedoRef.current = false
    }, 0)
    
    return history[newIndex]
  }, [history, historyIndex])

  // Redo - go forward one step
  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return null
    
    isUndoRedoRef.current = true
    const newIndex = historyIndex + 1
    setHistoryIndex(newIndex)
    
    // Reset flag after state update
    setTimeout(() => {
      isUndoRedoRef.current = false
    }, 0)
    
    return history[newIndex]
  }, [history, historyIndex])

  // Check if undo/redo is available
  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  // Start batching changes (useful for drag operations)
  const startBatch = useCallback(() => {
    batchRef.current = true
    batchStateRef.current = null
  }, [])

  // End batching and record the final state
  const endBatch = useCallback(() => {
    batchRef.current = false
    if (batchStateRef.current) {
      const { state, actionType } = batchStateRef.current
      // Force record by temporarily disabling the undo/redo flag
      isUndoRedoRef.current = false
      
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1)
        newHistory.push({ ...state, _actionType: actionType, _timestamp: Date.now() })
        
        if (newHistory.length > MAX_HISTORY_SIZE) {
          newHistory.shift()
          return newHistory
        }
        
        return newHistory
      })
      
      setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY_SIZE - 1))
      batchStateRef.current = null
    }
  }, [historyIndex])

  // Get history info for debugging/display
  const getHistoryInfo = useCallback(() => ({
    currentIndex: historyIndex,
    totalStates: history.length,
    canUndo,
    canRedo,
    lastAction: history[historyIndex]?._actionType || 'initial'
  }), [history, historyIndex, canUndo, canRedo])

  // Reset history (useful when loading a new video)
  const resetHistory = useCallback((newInitialState) => {
    setHistory([newInitialState])
    setHistoryIndex(0)
    isUndoRedoRef.current = false
    batchRef.current = false
    batchStateRef.current = null
  }, [])

  return {
    currentState,
    recordState,
    undo,
    redo,
    canUndo,
    canRedo,
    startBatch,
    endBatch,
    getHistoryInfo,
    resetHistory,
    isUndoRedo: () => isUndoRedoRef.current
  }
}

export default useHistory
