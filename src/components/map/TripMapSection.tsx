'use client'
import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { geocodeLocation } from '@/lib/geocode'
import { TripDay } from '@/lib/types'
import type { MapPoint } from './TripMap'

// Leaflet touches `window`, so the map must be client-only
const TripMap = dynamic(() => import('./TripMap'), {
  ssr: false,
  loading: () => <div className="h-[360px] bg-gray-100 rounded-2xl animate-pulse" />,
})

export default function TripMapSection({
  days,
  editable = false,
}: {
  days: TripDay[]
  editable?: boolean
}) {
  const [localDays, setLocalDays] = useState<TripDay[]>(days)
  const [locating, setLocating] = useState(false)
  const [progress, setProgress] = useState('')
  const supabase = createClient()

  const sorted = useMemo(
    () => [...localDays].sort((a, b) => a.date.localeCompare(b.date)),
    [localDays]
  )
  const points: MapPoint[] = sorted
    .map((d, i) => ({ day: d, dayNumber: i + 1 }))
    .filter(({ day }) => day.location_lat != null && day.location_lng != null)
    .map(({ day, dayNumber }) => ({
      date: day.date,
      dayNumber,
      lat: day.location_lat!,
      lng: day.location_lng!,
      name: day.location_name || '',
      title: day.title,
    }))

  const missing = sorted.filter(d => d.location_name && (d.location_lat == null || d.location_lng == null))

  // Geocode all named-but-unlocated days, one request at a time (Nominatim rate limit)
  async function locateAll() {
    setLocating(true)
    let found = 0
    for (let i = 0; i < missing.length; i++) {
      const day = missing[i]
      setProgress(`מאתר ${i + 1}/${missing.length}: ${day.location_name}`)
      const coords = await geocodeLocation(day.location_name!)
      if (coords) {
        await supabase
          .from('trip_days')
          .update({ location_lat: coords.lat, location_lng: coords.lng })
          .eq('id', day.id)
        setLocalDays(prev => prev.map(d => d.id === day.id ? { ...d, location_lat: coords.lat, location_lng: coords.lng } : d))
        found++
      }
      if (i < missing.length - 1) await new Promise(r => setTimeout(r, 1100))
    }
    setProgress(found < missing.length ? `אותרו ${found} מתוך ${missing.length} מיקומים` : '')
    setLocating(false)
  }

  if (points.length === 0 && missing.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-700">🗺️ מפת המסלול</h2>
        {editable && missing.length > 0 && (
          <button
            onClick={locateAll}
            disabled={locating}
            className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition disabled:opacity-50"
          >
            {locating ? 'מאתר...' : `📍 אתרי ${missing.length} מיקומים על המפה`}
          </button>
        )}
      </div>
      {progress && <p className="text-xs text-gray-400 mb-2">{progress}</p>}
      {points.length > 0
        ? <TripMap points={points} />
        : <p className="text-sm text-gray-400 italic">אין עדיין מיקומים על המפה — לחצי על הכפתור למעלה כדי לאתר אותם</p>}
    </div>
  )
}
