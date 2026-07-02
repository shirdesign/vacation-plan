'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TripDay, DayEvent } from '@/lib/types'
import { format, parseISO } from 'date-fns'
import EventItem from './EventItem'
import AddEventForm from './AddEventForm'

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-400 line-through',
}

type DayCardProps = {
  day: TripDay & { day_events?: DayEvent[] }
  dayNumber: number
  tripId: string
  onUpsertDay: (date: string, patch: Partial<TripDay>) => Promise<TripDay>
  onUpdate: (updated: Partial<TripDay & { day_events: DayEvent[] }>) => void
}

export default function DayCard({ day, dayNumber, tripId, onUpsertDay, onUpdate }: DayCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editingLocation, setEditingLocation] = useState(false)
  const [locationName, setLocationName] = useState(day.location_name || '')
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(day.title || '')
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(day.notes || '')
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [events, setEvents] = useState<DayEvent[]>(day.day_events || [])
  const supabase = createClient()

  const hebrewDay = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']
  const dow = parseISO(day.date).getDay()
  const isShabbat = dow === 6 // Saturday
  const isFriday = dow === 5
  const isErevShabbat = isFriday

  async function saveTitle() {
    const updated = await onUpsertDay(day.date, { title })
    onUpdate({ title, id: updated.id })
    setEditingTitle(false)
  }

  async function saveLocation() {
    const updated = await onUpsertDay(day.date, { location_name: locationName })
    onUpdate({ location_name: locationName, id: updated.id })
    setEditingLocation(false)
  }

  async function saveNotes() {
    const updated = await onUpsertDay(day.date, { notes })
    onUpdate({ notes, id: updated.id })
    setEditingNotes(false)
  }

  async function addEvent(event: Omit<DayEvent, 'id' | 'day_id'>) {
    // Ensure day exists in DB
    let dayId = day.id
    if (!dayId) {
      const upserted = await onUpsertDay(day.date, {})
      dayId = upserted.id
      onUpdate({ id: dayId })
    }

    const { data } = await supabase
      .from('day_events')
      .insert({ ...event, day_id: dayId, sort_order: events.length })
      .select()
      .single()

    if (data) {
      setEvents(prev => [...prev, data as DayEvent])
      setShowAddEvent(false)
    }
  }

  async function updateEventStatus(eventId: string, status: DayEvent['status']) {
    await supabase.from('day_events').update({ status }).eq('id', eventId)
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status } : e))
  }

  async function deleteEvent(eventId: string) {
    await supabase.from('day_events').delete().eq('id', eventId)
    setEvents(prev => prev.filter(e => e.id !== eventId))
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
            {(title || day.title) && (
              <div className="text-sm font-medium text-gray-600">{title || day.title}</div>
            )}
            {day.location_name && (
              <div className="text-sm text-gray-500">📍 {day.location_name}</div>
            )}
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
                  {title || day.title ? 'ערכי' : 'הוסיפי'}
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
              (title || day.title)
                ? <p className="text-sm text-gray-700">{title || day.title}</p>
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
              {events.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')).map(event => (
                <EventItem
                  key={event.id}
                  event={event}
                  onStatusChange={updateEventStatus}
                  onDelete={deleteEvent}
                />
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
