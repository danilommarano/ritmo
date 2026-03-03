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

// Get the time range (start, end) for a specific bar number given BPM config
export function getBarTimeRange(barNumber, bpmConfig) {
  const { bpm, timeSignatureNum, offsetStart } = bpmConfig
  const beatDuration = 60.0 / bpm
  const barDuration = beatDuration * timeSignatureNum
  const startTime = offsetStart + (barNumber - 1) * barDuration
  const endTime = startTime + barDuration
  return { startTime, endTime }
}

// Get the bar number at a given time (1-indexed, 0 if before offset)
export function getBarNumberAtTime(time, bpmConfig) {
  const { bpm, timeSignatureNum, offsetStart } = bpmConfig
  if (time < offsetStart) return 0
  const beatDuration = 60.0 / bpm
  const barDuration = beatDuration * timeSignatureNum
  return Math.floor((time - offsetStart) / barDuration) + 1
}

// Get total number of bars that fit in a given duration
export function getTotalBars(duration, bpmConfig) {
  const { bpm, timeSignatureNum, offsetStart } = bpmConfig
  if (!bpm || bpm <= 0 || duration <= offsetStart) return 0
  const beatDuration = 60.0 / bpm
  const barDuration = beatDuration * timeSignatureNum
  return Math.ceil((duration - offsetStart) / barDuration)
}

// Find which segment a given timeline time falls into, returns { segmentIndex, segment, segmentStartInTimeline, segmentEndInTimeline }
export function getSegmentAtTimelineTime(timelineTime, videoSegments, originalDuration) {
  let accumulatedTime = 0
  for (let i = 0; i < videoSegments.length; i++) {
    const segment = videoSegments[i]
    const segmentDuration = (segment.endTime || originalDuration) - segment.startTime
    if (timelineTime < accumulatedTime + segmentDuration + 0.001) {
      return {
        segmentIndex: i,
        segment,
        segmentStartInTimeline: accumulatedTime,
        segmentEndInTimeline: accumulatedTime + segmentDuration
      }
    }
    accumulatedTime += segmentDuration
  }
  return null
}

// Get the bar number in the TIMELINE (considering all segments sequentially)
// This maps a timeline-local bar number given that segments may reference different parts of the original video
export function getTimelineBarAtTime(timelineTime, bpmConfig, videoSegments, originalDuration) {
  const { bpm, timeSignatureNum, offsetStart } = bpmConfig
  if (!bpm || bpm <= 0) return 0
  const beatDuration = 60.0 / bpm
  const barDuration = beatDuration * timeSignatureNum

  // Walk through segments, accumulating bars
  let accumulatedTimelineTime = 0
  let accumulatedBars = 0

  for (let i = 0; i < videoSegments.length; i++) {
    const segment = videoSegments[i]
    const segStart = segment.startTime
    const segEnd = segment.endTime || originalDuration
    const segDuration = segEnd - segStart

    if (timelineTime <= accumulatedTimelineTime + segDuration + 0.001) {
      // Time falls in this segment
      // Calculate the original video time for this point
      const offsetInSegment = timelineTime - accumulatedTimelineTime
      const originalTime = segStart + offsetInSegment

      if (originalTime < offsetStart) return accumulatedBars
      // Bar number within the original video at this point
      const barInOriginal = Math.floor((originalTime - offsetStart) / barDuration) + 1
      // How many bars the segment starts at in the original
      const segStartBar = segStart <= offsetStart ? 0 : Math.floor((segStart - offsetStart) / barDuration)
      // Local bar index within this segment
      const localBar = barInOriginal - segStartBar
      return accumulatedBars + localBar
    }

    // Count how many bars are in this segment
    const segEffectiveStart = Math.max(segStart, offsetStart)
    const barsInSegment = segEnd <= offsetStart ? 0 : Math.ceil((segEnd - segEffectiveStart) / barDuration)
    accumulatedBars += barsInSegment
    accumulatedTimelineTime += segDuration
  }

  return accumulatedBars
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
  metronome: 'Metrônomo',
  timer: 'Cronômetro',
  alert: 'Alerta'
}

// Alert type labels
export const alertTypeLabels = {
  flash: 'Piscada na Tela',
  circle: 'Bolinha'
}

// Metronome type labels
export const metronomeTypeLabels = {
  'bar-beat': 'Compasso e Batida',
  'bar': 'Apenas Compasso',
  'beat': 'Apenas Batida',
  'time': 'Tempo'
}
