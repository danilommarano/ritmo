// Toolbar Component - Centered floating toolbar with element icons

import { Type, Music2, Clock, Zap } from 'lucide-react'

function Toolbar({ onAddElement }) {
  const tools = [
    {
      id: 'text',
      label: 'Texto',
      icon: Type,
      onClick: () => onAddElement('text'),
      color: 'bg-blue-600 hover:bg-blue-500'
    },
    {
      id: 'counter',
      label: 'Contador (Bar.Beat)',
      icon: Music2,
      onClick: () => onAddElement('counter'),
      color: 'bg-purple-600 hover:bg-purple-500'
    },
    {
      id: 'timer',
      label: 'Cronômetro',
      icon: Clock,
      onClick: () => onAddElement('timer'),
      color: 'bg-indigo-600 hover:bg-indigo-500'
    },
    {
      id: 'alert',
      label: 'Alerta',
      icon: Zap,
      onClick: () => onAddElement('alert'),
      color: 'bg-yellow-600 hover:bg-yellow-500'
    }
  ]

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-800 rounded-lg border border-gray-700">
      {tools.map(tool => (
        <button
          key={tool.id}
          onClick={tool.onClick}
          className={`p-2 rounded-lg text-white transition-colors ${tool.color}`}
          title={tool.label}
        >
          <tool.icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  )
}

export default Toolbar
