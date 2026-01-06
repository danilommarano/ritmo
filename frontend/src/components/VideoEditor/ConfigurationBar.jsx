// ConfigurationBar Component - Right panel with configuration forms

import { useState } from 'react'
import { Trash2, Eye, EyeOff, Music } from 'lucide-react'
import { elementTypeLabels, alertTypeLabels, counterTypeLabels } from './utils'

// Helper to parse color and opacity from various formats
const parseColor = (color) => {
  if (!color) return { hex: '#000000', opacity: 100 }
  
  // Handle rgba format
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, '0')
    const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, '0')
    const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, '0')
    const opacity = rgbaMatch[4] ? Math.round(parseFloat(rgbaMatch[4]) * 100) : 100
    return { hex: `#${r}${g}${b}`, opacity }
  }
  
  // Handle hex with alpha (e.g., #FFFFFFcc)
  if (color.length === 9 && color.startsWith('#')) {
    const hex = color.slice(0, 7)
    const alpha = parseInt(color.slice(7), 16)
    return { hex, opacity: Math.round((alpha / 255) * 100) }
  }
  
  // Handle regular hex
  if (color.startsWith('#')) {
    return { hex: color.slice(0, 7), opacity: 100 }
  }
  
  return { hex: '#000000', opacity: 100 }
}

// Helper to build color string with opacity
const buildColor = (hex, opacity) => {
  const alpha = Math.round((opacity / 100) * 255).toString(16).padStart(2, '0')
  return `${hex}${alpha}`
}

// Color input component like Figma
const ColorInput = ({ label, color, opacity, onColorChange, onOpacityChange, showOpacity = true }) => {
  const { hex, opacity: currentOpacity } = parseColor(color)
  const displayHex = hex.replace('#', '').toUpperCase()
  
  return (
    <div className="space-y-2">
      <label className="block text-sm text-gray-400">{label}</label>
      <div className="flex items-center gap-2 bg-gray-700 rounded-lg p-2">
        <input
          type="color"
          value={hex}
          onChange={(e) => onColorChange(buildColor(e.target.value, opacity ?? currentOpacity))}
          className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
        />
        <input
          type="text"
          value={displayHex}
          onChange={(e) => {
            let val = e.target.value.replace('#', '').toUpperCase()
            if (val.length <= 6 && /^[0-9A-F]*$/.test(val)) {
              if (val.length === 6) {
                onColorChange(buildColor(`#${val}`, opacity ?? currentOpacity))
              }
            }
          }}
          className="flex-1 bg-transparent text-white text-sm font-mono w-16"
          maxLength={6}
        />
        {showOpacity && (
          <>
            <span className="text-gray-500">|</span>
            <input
              type="number"
              min="0"
              max="100"
              value={opacity ?? currentOpacity}
              onChange={(e) => onOpacityChange?.(Number(e.target.value))}
              className="w-12 bg-transparent text-white text-sm text-right"
            />
            <span className="text-gray-500 text-sm">%</span>
          </>
        )}
      </div>
    </div>
  )
}

// Font size input with slider and text input
const FontSizeInput = ({ value, onChange, min = 12, max = 96 }) => (
  <div className="space-y-2">
    <label className="block text-sm text-gray-400">Tamanho da Fonte</label>
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1"
      />
      <div className="flex items-center bg-gray-700 rounded px-2 py-1">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-12 bg-transparent text-white text-sm text-right"
        />
        <span className="text-gray-500 text-sm ml-1">px</span>
      </div>
    </div>
  </div>
)

function ConfigurationBar({
  selectedElement,
  onUpdateElement,
  onDeleteElement,
  bpmConfig,
  onUpdateBpmConfig
}) {
  // Track opacity separately for better UX
  const [textOpacity, setTextOpacity] = useState(100)
  const [bgOpacity, setBgOpacity] = useState(70)

  // Render form for text element
  const renderTextForm = () => {
    const { opacity: currentBgOpacity } = parseColor(selectedElement.backgroundColor)
    
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Conteúdo</label>
          <input
            type="text"
            value={selectedElement.content}
            onChange={(e) => onUpdateElement(selectedElement.id, { content: e.target.value })}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <FontSizeInput
          value={selectedElement.fontSize}
          onChange={(val) => onUpdateElement(selectedElement.id, { fontSize: val })}
          min={12}
          max={72}
        />

        <ColorInput
          label="Cor do Texto"
          color={selectedElement.fontColor}
          showOpacity={false}
          onColorChange={(color) => onUpdateElement(selectedElement.id, { fontColor: color.slice(0, 7) })}
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-400">Cor do Fundo</label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={selectedElement.hasBackground}
                onChange={(e) => onUpdateElement(selectedElement.id, { hasBackground: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          {selectedElement.hasBackground && (
            <ColorInput
              label=""
              color={selectedElement.backgroundColor}
              opacity={currentBgOpacity}
              onColorChange={(color) => onUpdateElement(selectedElement.id, { backgroundColor: color })}
              onOpacityChange={(opacity) => {
                const { hex } = parseColor(selectedElement.backgroundColor)
                onUpdateElement(selectedElement.id, { backgroundColor: buildColor(hex, opacity) })
              }}
            />
          )}
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Peso da Fonte</label>
          <select
            value={selectedElement.fontWeight}
            onChange={(e) => onUpdateElement(selectedElement.id, { fontWeight: e.target.value })}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
          >
            <option value="normal">Normal</option>
            <option value="bold">Negrito</option>
          </select>
        </div>
      </div>
    )
  }

  // Render form for counter element
  const renderCounterForm = () => {
    const { opacity: currentBgOpacity } = parseColor(selectedElement.backgroundColor)
    
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Tipo de Contador</label>
          <select
            value={selectedElement.counterType}
            onChange={(e) => onUpdateElement(selectedElement.id, { counterType: e.target.value })}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
          >
            {Object.entries(counterTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <FontSizeInput
          value={selectedElement.fontSize}
          onChange={(val) => onUpdateElement(selectedElement.id, { fontSize: val })}
          min={24}
          max={96}
        />

        <ColorInput
          label="Cor do Texto"
          color={selectedElement.fontColor}
          showOpacity={false}
          onColorChange={(color) => onUpdateElement(selectedElement.id, { fontColor: color.slice(0, 7) })}
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-400">Cor do Fundo</label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={selectedElement.hasBackground}
                onChange={(e) => onUpdateElement(selectedElement.id, { hasBackground: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          {selectedElement.hasBackground && (
            <ColorInput
              label=""
              color={selectedElement.backgroundColor}
              opacity={currentBgOpacity}
              onColorChange={(color) => onUpdateElement(selectedElement.id, { backgroundColor: color })}
              onOpacityChange={(opacity) => {
                const { hex } = parseColor(selectedElement.backgroundColor)
                onUpdateElement(selectedElement.id, { backgroundColor: buildColor(hex, opacity) })
              }}
            />
          )}
        </div>
      </div>
    )
  }

  // Render form for timer element
  const renderTimerForm = () => {
    const { opacity: currentBgOpacity } = parseColor(selectedElement.backgroundColor)
    
    return (
      <div className="space-y-4">
        <FontSizeInput
          value={selectedElement.fontSize}
          onChange={(val) => onUpdateElement(selectedElement.id, { fontSize: val })}
          min={24}
          max={96}
        />

        <ColorInput
          label="Cor do Texto"
          color={selectedElement.fontColor}
          showOpacity={false}
          onColorChange={(color) => onUpdateElement(selectedElement.id, { fontColor: color.slice(0, 7) })}
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-400">Cor do Fundo</label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={selectedElement.hasBackground}
                onChange={(e) => onUpdateElement(selectedElement.id, { hasBackground: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          {selectedElement.hasBackground && (
            <ColorInput
              label=""
              color={selectedElement.backgroundColor}
              opacity={currentBgOpacity}
              onColorChange={(color) => onUpdateElement(selectedElement.id, { backgroundColor: color })}
              onOpacityChange={(opacity) => {
                const { hex } = parseColor(selectedElement.backgroundColor)
                onUpdateElement(selectedElement.id, { backgroundColor: buildColor(hex, opacity) })
              }}
            />
          )}
        </div>
      </div>
    )
  }

  // Render form for alert element
  const renderAlertForm = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-gray-400 mb-1">Tipo de Alerta</label>
        <select
          value={selectedElement.alertType}
          onChange={(e) => onUpdateElement(selectedElement.id, { alertType: e.target.value })}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
        >
          {Object.entries(alertTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Cor</label>
        <input
          type="color"
          value={selectedElement.color.startsWith('rgba') ? '#ffffff' : selectedElement.color}
          onChange={(e) => onUpdateElement(selectedElement.id, { color: e.target.value + '80' })}
          className="w-full h-10 rounded cursor-pointer"
        />
      </div>

      {selectedElement.alertType === 'circle' && (
        <div>
          <label className="block text-sm text-gray-400 mb-1">Tamanho da Bolinha</label>
          <input
            type="range"
            min="10"
            max="100"
            value={selectedElement.circleSize}
            onChange={(e) => onUpdateElement(selectedElement.id, { circleSize: Number(e.target.value) })}
            className="w-full"
          />
          <span className="text-sm text-gray-500">{selectedElement.circleSize}px</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="syncToBeat"
          checked={selectedElement.syncToBeat}
          onChange={(e) => onUpdateElement(selectedElement.id, { syncToBeat: e.target.checked })}
          className="rounded"
        />
        <label htmlFor="syncToBeat" className="text-sm text-gray-400">Sincronizar com batida</label>
      </div>

      <p className="text-xs text-gray-500">
        {selectedElement.syncToBeat 
          ? 'O alerta aparecerá no início de cada compasso'
          : 'O alerta aparecerá durante o período definido na timeline'}
      </p>
    </div>
  )

  // Render timing controls (common for all elements)
  const renderTimingControls = () => (
    <div className="space-y-4 pt-4 border-t border-gray-700">
      <h4 className="text-sm font-medium text-gray-300">Tempo</h4>
      
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Início (s)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={selectedElement.startTime.toFixed(1)}
            onChange={(e) => onUpdateElement(selectedElement.id, { startTime: Number(e.target.value) })}
            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Fim (s)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={selectedElement.endTime.toFixed(1)}
            onChange={(e) => onUpdateElement(selectedElement.id, { endTime: Number(e.target.value) })}
            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => onUpdateElement(selectedElement.id, { visible: !selectedElement.visible })}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-white"
        >
          {selectedElement.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {selectedElement.visible ? 'Visível' : 'Oculto'}
        </button>
        
        <button
          onClick={() => onDeleteElement(selectedElement.id)}
          className="flex items-center gap-1 text-sm text-red-400 hover:text-red-300"
        >
          <Trash2 className="w-4 h-4" />
          Excluir
        </button>
      </div>
    </div>
  )

  // Render BPM configuration
  const renderBpmConfig = () => (
    <div className="p-4 border-b border-gray-700">
      <div className="flex items-center gap-2 mb-4">
        <Music className="w-4 h-4 text-purple-400" />
        <h3 className="font-medium">Configuração de Ritmo</h3>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">BPM</label>
          <input
            type="number"
            min="1"
            max="300"
            value={bpmConfig.bpm}
            onChange={(e) => onUpdateBpmConfig({ ...bpmConfig, bpm: Number(e.target.value) })}
            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Compasso</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="1"
                max="16"
                value={bpmConfig.timeSignatureNum}
                onChange={(e) => onUpdateBpmConfig({ ...bpmConfig, timeSignatureNum: Number(e.target.value) })}
                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              />
              <span className="text-gray-500">/</span>
              <input
                type="number"
                min="1"
                max="16"
                value={bpmConfig.timeSignatureDen}
                onChange={(e) => onUpdateBpmConfig({ ...bpmConfig, timeSignatureDen: Number(e.target.value) })}
                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Offset (s)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={bpmConfig.offsetStart}
              onChange={(e) => onUpdateBpmConfig({ ...bpmConfig, offsetStart: Number(e.target.value) })}
              className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col overflow-hidden">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* BPM Config */}
        {renderBpmConfig()}

        {/* Selected Element Config */}
        {selectedElement ? (
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-3 h-3 rounded ${
                selectedElement.type === 'text' ? 'bg-blue-500' :
                selectedElement.type === 'counter' ? 'bg-purple-500' :
                selectedElement.type === 'timer' ? 'bg-indigo-500' :
                'bg-yellow-500'
              }`} />
              <h3 className="font-medium">{elementTypeLabels[selectedElement.type]}</h3>
            </div>

            {selectedElement.type === 'text' && renderTextForm()}
            {selectedElement.type === 'counter' && renderCounterForm()}
            {selectedElement.type === 'timer' && renderTimerForm()}
            {selectedElement.type === 'alert' && renderAlertForm()}
            {renderTimingControls()}
          </div>
        ) : (
          <div className="p-4 text-center text-gray-500">
            <p className="text-sm">Selecione um elemento para editar suas configurações</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ConfigurationBar
