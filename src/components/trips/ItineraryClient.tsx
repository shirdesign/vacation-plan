'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trip, TripDay, DayEvent } from '@/lib/types'
import { format, parseISO } from 'date-fns'
import DayCard from './DayCard'

type DayWithEvents = (TripDay | { date: string; trip_id: string; day_events: DayEvent[] }) & { day_events?: DayEvent[] }

export default function ItineraryClient({
  trip,
  initialDays,
}: {
  trip: Trip
  initialDays: DayWithEvents[]
}) {
  const [days, setDays] = useState<DayWithEvents[]>(initialDays)
  const supabase = createClient()

  async function upsertDay(date: string, patch: Partial<TripDay>): Promise<TripDay> {
    const existing = days.find(d => d.date === date) as TripDay | undefined
    if (existing?.id) {
      const { data } = await supabase
        .from('trip_days')
        .update(patch)
        .eq('id', existing.id)
        .select()
        .single()
      return data as TripDay
    } else {
      const { data } = await supabase
        .from('trip_days')
        .insert({ trip_id: trip.id, date, ...patch })
        .select()
        .single()
      return data as TripDay
    }
  }

  function updateDayInState(date: string, updated: Partial<DayWithEvents>) {
    setDays(prev => prev.map(d => d.date === date ? { ...d, ...updated } : d))
  }

  return (
    <div className="space-y-3">
      {days.map((day, idx) => (
        <DayCard
          key={day.date}
          day={day as TripDay & { day_events: DayEvent[] }}
          dayNumber={idx + 1}
          tripId={trip.id}
          onUpsertDay={upsertDay}
          onUpdate={(updated) => updateDayInState(day.date, updated)}
        />
      ))}
    </div>
  )
}
