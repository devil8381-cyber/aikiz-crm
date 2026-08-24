'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useAppStore } from '@/lib/store'
import { X, Minimize2, Maximize2, GripHorizontal } from 'lucide-react'

export default function FloatingScript() {
  const { data: session } = useSession()
  const user = session?.user as any
  const { scriptOpen, setScriptOpen } = useAppStore()
  const [script, setScript] = useState('')
  const [minimized, setMinimized] = useState(false)
  const [position, setPosition] = useState({ x: 20, y: 100 })
  const [dragging, setDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/script').then(r => r.json()).then(data => setScript(data.content || '')).catch(() => {})
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input, textarea, select')) return
    setDragging(true)
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y }
  }

  useEffect(() => {
    if (!dragging) return
    const handleMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y })
    }
    const handleUp = () => setDragging(false)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp) }
  }, [dragging])

  if (!scriptOpen) return null

  return (
    <div
      ref={panelRef}
      className={`fixed z-50 floating-script rounded-xl border border-slate-200 bg-white shadow-2xl transition-all duration-200 ${dragging ? 'cursor-grabbing' : ''}`}
      style={{ left: position.x, top: position.y, width: minimized ? 48 : 360 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-t-xl cursor-grab select-none"
        onMouseDown={handleMouseDown}
      >
        {!minimized && (
          <div className="flex items-center gap-2">
            <GripHorizontal className="w-4 h-4 opacity-70" />
            <span className="text-sm font-semibold">Calling Script</span>
          </div>
        )}
        <div className={`flex items-center gap-1 ${minimized ? 'mx-auto' : ''}`}>
          <button
            onClick={(e) => { e.stopPropagation(); setMinimized(!minimized) }}
            className="p-1 hover: rounded transition-colors"
          >
            {minimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setScriptOpen(false) }}
            className="p-1 hover: rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      {!minimized && (
        <div className="p-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="prose prose-sm prose-slate max-w-none">
            {script.split('\n').map((line, i) => {
              if (line.startsWith('# ')) return <h1 key={i} className="text-lg font-bold text-slate-900 mt-4 mb-2 first:mt-0">{line.replace('# ', '')}</h1>
              if (line.startsWith('## ')) return <h2 key={i} className="text-base font-semibold text-teal-700 mt-3 mb-1.5">{line.replace('## ', '')}</h2>
              if (line.startsWith('- **')) {
                const match = line.match(/- \*\*(.+?)\*\*(.*)/)
                return match ? (
                  <div key={i} className="ml-3 my-1">
                    <span className="font-semibold text-slate-700">{match[1]}</span>
                    <span className="text-slate-600">{match[2]}</span>
                  </div>
                ) : <p key={i} className="ml-3 text-sm text-slate-600">{line.replace('- ', '')}</p>
              }
              if (line.startsWith('- ')) return <li key={i} className="ml-4 text-sm text-slate-600 list-disc">{line.replace('- ', '')}</li>
              if (line.match(/^\d+\.\s/)) return <li key={i} className="ml-4 text-sm text-slate-600 list-decimal">{line.replace(/^\d+\.\s/, '')}</li>
              if (line.startsWith('"')) return <p key={i} className="text-sm text-slate-700 italic bg-slate-50 rounded px-2 py-1 my-1 border-l-2 border-teal-400">{line}</p>
              if (line.trim() === '') return <div key={i} className="h-2" />
              return <p key={i} className="text-sm text-slate-600">{line}</p>
            })}
          </div>
          {user?.role === 'ADMIN' && (
            <p className="text-xs text-teal-600 mt-4 pt-2 border-t border-slate-100">
              Admin: Edit script in Script Editor panel
            </p>
          )}
        </div>
      )}
    </div>
  )
}