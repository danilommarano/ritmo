// Utility functions for VideoEditor

// Generate unique ID for elements
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Format time as MM:SS or MM:SS.ms
export function formatTime(seconds, showMs = false) {
  if (!seconds && seconds !== 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  
  if (showMs) {
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Calculate bar and beat from time based on BPM config
export function calculateBarBeat(time, bpmConfig) {
  const { bpm, timeSignatureNum, offsetStart } = bpmConfig
  
  if (time < offsetStart) {
    return { bar: 0, beat: 0 }
  }
  
  const beatDuration = 60.0 / bpm
  const barDuration = beatDuration * timeSignatureNum
  const elapsed = time - offsetStart
  
  const bar = Math.floor(elapsed / barDuration) + 1
  const beat = Math.floor((elapsed % barDuration) / beatDuration) + 1
  
  return { bar, beat }
}

// Get beat times for alert synchronization
export function getBeatTimes(bpmConfig, duration) {
  const { bpm, timeSignatureNum, offsetStart } = bpmConfig
  const beatDuration = 60.0 / bpm
  const beats = []
  
  let time = offsetStart
  while (time < duration) {
    beats.push(time)
    time += beatDuration
  }
  
  return beats
}

// Get bar start times for alert synchronization
export function getBarStartTimes(bpmConfig, duration) {
  const { bpm, timeSignatureNum, offsetStart } = bpmConfig
  const beatDuration = 60.0 / bpm
  const barDuration = beatDuration * timeSignatureNum
  const bars = []
  
  let time = offsetStart
  while (time < duration) {
    bars.push(time)
    time += barDuration
  }
  
  return bars
}

// Clamp value between min and max
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

// Convert percentage position to pixel position
export function percentToPixel(percent, containerSize) {
  return (percent / 100) * containerSize
}

// Convert pixel position to percentage
export function pixelToPercent(pixel, containerSize) {
  return (pixel / containerSize) * 100
}

// Element type labels in Portuguese
export const elementTypeLabels = {
  text: 'Texto',
  counter: 'Contador',
  timer: 'Cronômetro',
  alert: 'Alerta'
}

// Alert type labels
export const alertTypeLabels = {
  flash: 'Piscada na Tela',
  circle: 'Bolinha'
}

// Counter type labels
export const counterTypeLabels = {
  'bar-beat': 'Compasso e Batida',
  'bar': 'Apenas Compasso',
  'beat': 'Apenas Batida',
  'time': 'Tempo'
}
