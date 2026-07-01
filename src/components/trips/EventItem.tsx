'use client'
import { useState } from 'react'
import { DayEvent } from '@/lib/types'

const STATUS_LABELS = { planned: 'מתוכנן', done: 'בוצע', cancelled: 'בוטל' }
const STATUS_COLORS = {
  planned: 'border-blue-200 bg-blue-50',
  done: 'border-green-200 bg-green-50',
  cancelled: 'border-gray-200 bg-gray-50 opacity-60',
}

export default function EventItem({
  event,
  onStatusChange,
  onDelete,
}: {
  event: DayEvent
  onStatusChange: (id: string, status: DayEvent['status']) => void
  onDelete: (id: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border ${STATUS_COLORS[event.status]} relative`}>
      {/* Status toggle */}
      <button
        onClick={() => onStatusChange(event.id, event.status === 'done' ? 'planned' : 'done')}
        className="mt-0.5 flex-shrink-0"
        title="שנה סטטוס"
      >
        {event.status === 'done'
          ? <span className="text-green-500 text-lg">✓</span>
          : <span className="w-5 h-5 border-2 border-gray-300 rounded-full inline-block" />
        }
      </button>

      <div className="flex-1 min-w-0">
        <div className={`font-medium text-gray-800 text-sm ${event.status === 'cancelled' ? 'line-through' : ''}`}>
          {event.title}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
          {event.start_time && <span>⏰ {event.start_time}{event.end_time ? ` – ${event.end_time}` : ''}</span>}
          {event.location && <span>📍 {event.location}</span>}
        </div>
        {event.description && (
          <p className="text-xs text-gray-600 mt-1">{event.description}</p>
        )}
      </div>

      {/* Menu */}
      <div className="relative">
        <button onClick={() => setMenuOpen(!menuOpen)} className="text-gray-400 hover:text-gray-600 px-1">
          ⋮
        </button>
        {menuOpen && (
          <div className="absolute left-0 top-6 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1 min-w-[130px]">
            {(['planned', 'done', 'cancelled'] as DayEvent['status'][]).map(s => (
              <button
                key={s}
                onClick={() => { onStatusChange(event.id, s); setMenuOpen(false) }}
                className="block w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                {STATUS_LABELS[s]} {event.status === s ? '✓' : ''}
              </button>
            ))}
            <hr className="my-1" />
            <button
              onClick={() => { onDelete(event.id); setMenuOpen(false) }}
              className="block w-full text-right px-4 py-2 text-sm text-red-500 hover:bg-red-50"
            >
              מחקי
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
