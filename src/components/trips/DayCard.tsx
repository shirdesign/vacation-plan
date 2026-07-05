'use client'
import { useState } from 'react'
import { TripDay, DayEvent, TripFlight } from '@/lib/types'
import { format, parseISO } from 'date-fns'
import EventItem from './EventItem'
import AddEventForm from './AddEventForm'

type DayCardProps = {
  day: TripDay & { day_events: DayEvent[] }
  dayNumber: number
  allDates: string[]
  flights: TripFlight[]
  startExpanded?: boolean
  onUpsertDay: (date: string, patch: Partial<TripDay>) => Promise<TripDay>
  onAddEvent: (date: string, event: Omit<DayEvent, 'id' | 'day_id'>) => Promise<void>
  onUpdateEvent: (date: string, eventId: string, patch: Partial<DayEvent>) => Promise<void>
  onEventStatusChange: (date: string, eventId: string, status: DayEvent['status']) => void
  onDeleteEvent: (date: string, eventId: string) => void
  onMoveEvent: (fromDate: string, eventId: string, toDate: string) => void
}

export default function DayCard({
  day, dayNumber, allDates, flights, startExpanded = false,
  onUpsertDay, onAddEvent, onUpdateEvent, onEventStatusChange, onDeleteEvent, onMoveEvent,
}: DayCardProps) {
  const [expanded, setExpanded] = useState(startExpanded)
  const [editingLocation, setEditingLocation] = useState(false)
  const [locationName, setLocationName] = useState(day.location_name || '')
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(day.title || '')
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(day.notes || '')
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)

  const events = day.day_events

  const hebrewDay = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']
  const dow = parseISO(day.date).getDay()
  const isShabbat = dow === 6 // Saturday
  const isErevShabbat = dow === 5

  async function saveTitle() {
    await onUpsertDay(day.date, { title })
    setEditingTitle(false)
  }

  async function saveLocation() {
    await onUpsertDay(day.date, { location_name: locationName })
    setEditingLocation(false)
  }

  async function saveNotes() {
    await onUpsertDay(day.date, { notes })
    setEditingNotes(false)
  }

  async function addEvent(event: Omit<DayEvent, 'id' | 'day_id'>) {
    await onAddEvent(day.date, event)
    setShowAddEvent(false)
  }

  const doneCount = events.filter(e => e.status === 'done').length

  const cardBg = isShabbat ? 'bg-blue-50 border-blue-200' : isErevShabbat ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'
  const numBg = isShabbat ? 'bg-blue-700' : isErevShabbat ? 'bg-amber-500' : 'bg-blue-600'

  return (
    <div className={`rounded-2xl border overflow-hidden ${cardBg}`}>
      {/* Day header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-black/5 transition text-right"
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full text-white text-sm font-bold flex items-center justify-center flex-shrink-0 ${numBg}`}>
            {dayNumber}
          </div>
          <div>
            <div className="font-semibold text-gray-800 flex items-center gap-2">
              יום {hebrewDay[dow]} · {format(parseISO(day.date), 'dd/MM/yyyy')}
              {isShabbat && <span className="text-xs bg-blue-700 text-white px-2 py-0.5 rounded-full">✡️ שבת</span>}
              {isErevShabbat && <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full">🕯️ ערב שבת</span>}
            </div>
            {day.title && (
              <div className="text-sm font-medium text-gray-600">{day.title}</div>
            )}
            {day.location_name && (
              <div className="text-sm text-gray-500">📍 {day.location_name}</div>
            )}
            {flights.map(f => (
              <div key={f.id} className="text-sm text-indigo-600">
                ✈️ {f.from_location} ← {f.to_location}
                {f.depart_time && ` · ${f.depart_time.slice(0, 5)}`}
                {!f.is_booked && <span className="text-xs text-orange-500 mr-1">(טרם הוזמן)</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {events.length > 0 && (
            <span className="text-xs text-gray-400">{doneCount}/{events.length} פעילויות</span>
          )}
          <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-4">
          {/* Title */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-600">🏷️ כותרת היום</span>
              {!editingTitle && (
                <button onClick={() => setEditingTitle(true)} className="text-xs text-blue-500 hover:underline">
                  {day.title ? 'ערכי' : 'הוסיפי'}
                </button>
              )}
            </div>
            {editingTitle ? (
              <div className="flex gap-2">
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder='למשל: "יום שווקים וטיול בעיר העתיקה"'
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={e => e.key === 'Enter' && saveTitle()}
                  autoFocus
                />
                <button onClick={saveTitle} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm">שמור</button>
                <button onClick={() => setEditingTitle(false)} className="text-gray-500 px-2 text-sm">ביטול</button>
              </div>
            ) : (
              day.title
                ? <p className="text-sm text-gray-700">{day.title}</p>
                : <p className="text-sm text-gray-400 italic">אין כותרת</p>
            )}
          </div>

          {/* Location */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-600">📍 מיקום / לאן הולכים</span>
              {!editingLocation && (
                <button onClick={() => setEditingLocation(true)} className="text-xs text-blue-500 hover:underline">
                  {day.location_name ? 'ערכי' : 'הוסיפי'}
                </button>
              )}
            </div>
            {editingLocation ? (
              <div className="flex gap-2">
                <input
                  value={locationName}
                  onChange={e => setLocationName(e.target.value)}
                  placeholder='למשל: "מנהטן, ניו יורק"'
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={e => e.key === 'Enter' && saveLocation()}
                  autoFocus
                />
                <button onClick={saveLocation} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm">שמור</button>
                <button onClick={() => setEditingLocation(false)} className="text-gray-500 px-2 text-sm">ביטול</button>
              </div>
            ) : (
              day.location_name
                ? <p className="text-sm text-gray-700">{day.location_name}</p>
                : <p className="text-sm text-gray-400 italic">לא הוגדר מיקום</p>
            )}
          </div>

          {/* Events */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">🗓️ פעילויות</span>
              <button
                onClick={() => setShowAddEvent(true)}
                className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition"
              >
                + הוסיפי פעילות
              </button>
            </div>

            {events.length === 0 && !showAddEvent && (
              <p className="text-sm text-gray-400 italic">אין פעילויות מתוכננות עדיין</p>
            )}

            <div className="space-y-2">
              {[...events].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')).map(event => (
                editingEventId === event.id ? (
                  <AddEventForm
                    key={event.id}
                    initial={event}
                    onAdd={async (patch) => {
                      await onUpdateEvent(day.date, event.id, patch)
                      setEditingEventId(null)
                    }}
                    onCancel={() => setEditingEventId(null)}
                  />
                ) : (
                  <EventItem
                    key={event.id}
                    event={event}
                    currentDate={day.date}
                    allDates={allDates}
                    onEdit={(id) => setEditingEventId(id)}
                    onStatusChange={(id, status) => onEventStatusChange(day.date, id, status)}
                    onDelete={(id) => onDeleteEvent(day.date, id)}
                    onMove={(id, toDate) => onMoveEvent(day.date, id, toDate)}
                  />
                )
              ))}
            </div>

            {showAddEvent && (
              <AddEventForm
                onAdd={addEvent}
                onCancel={() => setShowAddEvent(false)}
              />
            )}
          </div>

          {/* Notes */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-600">📝 הערות יומיות</span>
              {!editingNotes && (
                <button onClick={() => setEditingNotes(true)} className="text-xs text-blue-500 hover:underline">
                  {day.notes ? 'ערכי' : 'הוסיפי'}
                </button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={saveNotes} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm">שמור</button>
                  <button onClick={() => setEditingNotes(false)} className="text-gray-500 px-2 text-sm">ביטול</button>
                </div>
              </div>
            ) : (
              day.notes
                ? <p className="text-sm text-gray-700 whitespace-pre-wrap">{day.notes}</p>
                : <p className="text-sm text-gray-400 italic">אין הערות</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
