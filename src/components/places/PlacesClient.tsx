'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trip, TripDay, DayEvent, TripTip, PlaceActivity } from '@/lib/types'
import { format, parseISO } from 'date-fns'

const CATEGORY_LABELS: Record<string, { emoji: string; label: string }> = {
  attraction: { emoji: '🎡', label: 'אטרקציה' },
  food: { emoji: '🍽️', label: 'אוכל' },
  nature: { emoji: '🌿', label: 'טבע' },
  shopping: { emoji: '🛍️', label: 'קניות' },
  culture: { emoji: '🎭', label: 'תרבות' },
  family: { emoji: '👨‍👩‍👧', label: 'משפחה' },
}

const TIP_EMOJI: Record<string, string> = {
  general: '💡', food: '🍽️', kosher: '🔯', transport: '🚌',
  hotel: '🏨', chabad: '🕍', nails: '💅', shopping: '🛍️',
}

type DayWithEvents = TripDay & { day_events: DayEvent[] }

export default function PlacesClient({
  trip,
  days,
  tips,
  initialActivities,
}: {
  trip: Trip
  days: DayWithEvents[]
  tips: TripTip[]
  initialActivities: PlaceActivity[]
}) {
  const [activities, setActivities] = useState<PlaceActivity[]>(initialActivities)
  const [loadingPlace, setLoadingPlace] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [addingTo, setAddingTo] = useState<string | null>(null) // activity id showing the day picker
  const supabase = createClient()

  // Group trip days by location
  const placesMap = new Map<string, DayWithEvents[]>()
  for (const day of days) {
    if (!day.location_name) continue
    const list = placesMap.get(day.location_name) || []
    list.push(day)
    placesMap.set(day.location_name, list)
  }
  const places = [...placesMap.entries()]

  async function suggest(location: string) {
    setLoadingPlace(location)
    setError('')
    try {
      const res = await fetch('/api/suggest-activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: trip.id, location }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה')
      setActivities(prev => [...prev, ...(data.activities as PlaceActivity[])])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בקבלת הצעות')
    }
    setLoadingPlace(null)
  }

  async function addToDay(activity: PlaceActivity, date: string) {
    const day = days.find(d => d.date === date)
    let dayId = day?.id
    if (!dayId) {
      const { data } = await supabase
        .from('trip_days')
        .insert({ trip_id: trip.id, date })
        .select('id')
        .single()
      dayId = data?.id
    }
    if (!dayId) return
    const { data: event } = await supabase
      .from('day_events')
      .insert({
        day_id: dayId,
        title: activity.title,
        description: activity.description || null,
        location: activity.location,
        status: 'planned',
        sort_order: day?.day_events.length || 0,
      })
      .select('id')
      .single()
    if (event) {
      await supabase.from('place_activities').update({ added_event_id: event.id }).eq('id', activity.id)
      setActivities(prev => prev.map(a => a.id === activity.id ? { ...a, added_event_id: event.id } : a))
    }
    setAddingTo(null)
  }

  async function removeActivity(id: string) {
    await supabase.from('place_activities').delete().eq('id', id)
    setActivities(prev => prev.filter(a => a.id !== id))
  }

  if (places.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400">
        <p>עדיין לא הוגדרו מיקומים לימי הטיול.</p>
        <p className="text-sm mt-1">הוסיפי מיקום לימים במסלול היומי — והם יופיעו כאן.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {error && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">{error}</p>}

      {places.map(([location, placeDays]) => {
        const placeActivities = activities.filter(a => a.location === location)
        const placeTips = tips.filter(t => t.location === location)
        const dayNumbers = placeDays.map(d => days.findIndex(x => x.date === d.date) + 1)

        return (
          <div key={location} className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h2 className="font-bold text-gray-800 text-lg">📍 {location}</h2>
                <p className="text-xs text-gray-400">
                  ימים {dayNumbers.join(', ')} · {placeDays.map(d => format(parseISO(d.date), 'dd/MM')).join(', ')}
                </p>
              </div>
              <button
                onClick={() => suggest(location)}
                disabled={loadingPlace !== null}
                className="text-xs bg-purple-50 text-purple-600 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition disabled:opacity-50 flex-shrink-0"
              >
                {loadingPlace === location ? '🤖 חושב...' : '🤖 מה יש לעשות כאן?'}
              </button>
            </div>

            {/* Already planned here */}
            {placeDays.some(d => d.day_events.length > 0) && (
              <div className="mt-3">
                <h3 className="text-xs font-semibold text-gray-500 mb-1.5">🗓️ כבר מתוכנן</h3>
                <div className="space-y-1">
                  {placeDays.flatMap(d =>
                    d.day_events.filter(e => e.status !== 'cancelled').map(e => (
                      <div key={e.id} className="text-sm text-gray-700 flex items-center gap-2">
                        {e.status === 'done' ? <span className="text-green-500">✓</span> : <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />}
                        <span>{e.title}</span>
                        <span className="text-xs text-gray-400">({format(parseISO(d.date), 'dd/MM')})</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Suggested activities */}
            {placeActivities.length > 0 && (
              <div className="mt-3">
                <h3 className="text-xs font-semibold text-gray-500 mb-1.5">✨ רעיונות לפעילויות</h3>
                <div className="space-y-2">
                  {placeActivities.map(a => {
                    const cat = CATEGORY_LABELS[a.category] || { emoji: '✨', label: a.category }
                    return (
                      <div key={a.id} className={`p-3 rounded-xl border ${a.added_event_id ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-800 text-sm">
                              {cat.emoji} {a.title}
                              {a.added_event_id && <span className="text-xs text-green-600 mr-2">✓ נוסף למסלול</span>}
                            </div>
                            {a.description && <p className="text-xs text-gray-600 mt-0.5">{a.description}</p>}
                            <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                              <span>{cat.label}</span>
                              {a.est_cost != null && Number(a.est_cost) > 0 && (
                                <span>· ~{Number(a.est_cost).toLocaleString()} {trip.currency}</span>
                              )}
                              {a.est_cost != null && Number(a.est_cost) === 0 && <span>· חינם</span>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            {!a.added_event_id && (
                              addingTo === a.id ? (
                                <select
                                  autoFocus
                                  defaultValue=""
                                  onChange={e => e.target.value && addToDay(a, e.target.value)}
                                  onBlur={() => setAddingTo(null)}
                                  className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="" disabled>לאיזה יום?</option>
                                  {placeDays.map(d => (
                                    <option key={d.date} value={d.date}>{format(parseISO(d.date), 'dd/MM')}</option>
                                  ))}
                                  {days.filter(d => !placeDays.some(pd => pd.date === d.date)).map(d => (
                                    <option key={d.date} value={d.date}>{format(parseISO(d.date), 'dd/MM')} (יום אחר)</option>
                                  ))}
                                </select>
                              ) : (
                                <button
                                  onClick={() => setAddingTo(a.id)}
                                  className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition"
                                >
                                  + ליום במסלול
                                </button>
                              )
                            )}
                            <button onClick={() => removeActivity(a.id)} className="text-xs text-gray-300 hover:text-red-500">✕</button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Tips for this place */}
            {placeTips.length > 0 && (
              <div className="mt-3">
                <h3 className="text-xs font-semibold text-gray-500 mb-1.5">💡 טיפים</h3>
                <div className="space-y-1">
                  {placeTips.map(tip => (
                    <div key={tip.id} className="text-sm text-gray-700 flex items-start gap-2">
                      <span>{TIP_EMOJI[tip.category] || '💡'}</span>
                      <span>{tip.tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
