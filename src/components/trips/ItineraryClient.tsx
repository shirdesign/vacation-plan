'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trip, TripDay, DayEvent, TripFlight } from '@/lib/types'
import { geocodeLocation } from '@/lib/geocode'
import DayCard from './DayCard'
import TripCalendar from './TripCalendar'

export type DayWithEvents = TripDay & { day_events: DayEvent[] }

export default function ItineraryClient({
  trip,
  initialDays,
  flights,
}: {
  trip: Trip
  initialDays: DayWithEvents[]
  flights: TripFlight[]
}) {
  const [days, setDays] = useState<DayWithEvents[]>(initialDays)
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const supabase = createClient()

  const allDates = days.map(d => d.date)

  function patchDay(date: string, patch: Partial<DayWithEvents>) {
    setDays(prev => prev.map(d => d.date === date ? { ...d, ...patch } : d))
  }

  async function upsertDay(date: string, patch: Partial<TripDay>): Promise<TripDay> {
    // Fill coordinates whenever a location name is saved, so the map stays in sync
    if (patch.location_name) {
      const coords = await geocodeLocation(patch.location_name)
      if (coords) {
        patch = { ...patch, location_lat: coords.lat, location_lng: coords.lng }
      }
    }
    const existing = days.find(d => d.date === date)
    let saved: TripDay
    if (existing?.id) {
      const { data } = await supabase
        .from('trip_days')
        .update(patch)
        .eq('id', existing.id)
        .select()
        .single()
      saved = data as TripDay
    } else {
      const { data } = await supabase
        .from('trip_days')
        .insert({ trip_id: trip.id, date, ...patch })
        .select()
        .single()
      saved = data as TripDay
    }
    patchDay(date, { ...patch, id: saved.id })
    return saved
  }

  async function addEvent(date: string, event: Omit<DayEvent, 'id' | 'day_id'>) {
    const day = days.find(d => d.date === date)
    let dayId = day?.id
    if (!dayId) {
      const upserted = await upsertDay(date, {})
      dayId = upserted.id
    }
    const { data } = await supabase
      .from('day_events')
      .insert({ ...event, day_id: dayId, sort_order: day?.day_events.length || 0 })
      .select()
      .single()
    if (data) {
      setDays(prev => prev.map(d =>
        d.date === date ? { ...d, day_events: [...d.day_events, data as DayEvent] } : d
      ))
    }
  }

  async function updateEvent(date: string, eventId: string, patch: Partial<DayEvent>) {
    const { data } = await supabase
      .from('day_events')
      .update({
        title: patch.title,
        start_time: patch.start_time || null,
        end_time: patch.end_time || null,
        location: patch.location || null,
        description: patch.description || null,
      })
      .eq('id', eventId)
      .select()
      .single()
    if (data) {
      setDays(prev => prev.map(d =>
        d.date === date
          ? { ...d, day_events: d.day_events.map(e => e.id === eventId ? data as DayEvent : e) }
          : d
      ))
    }
  }

  async function updateEventStatus(date: string, eventId: string, status: DayEvent['status']) {
    await supabase.from('day_events').update({ status }).eq('id', eventId)
    setDays(prev => prev.map(d =>
      d.date === date
        ? { ...d, day_events: d.day_events.map(e => e.id === eventId ? { ...e, status } : e) }
        : d
    ))
  }

  async function deleteEvent(date: string, eventId: string) {
    await supabase.from('day_events').delete().eq('id', eventId)
    setDays(prev => prev.map(d =>
      d.date === date ? { ...d, day_events: d.day_events.filter(e => e.id !== eventId) } : d
    ))
  }

  async function moveEvent(fromDate: string, eventId: string, toDate: string) {
    if (fromDate === toDate) return
    const target = days.find(d => d.date === toDate)
    let targetId = target?.id
    if (!targetId) {
      const upserted = await upsertDay(toDate, {})
      targetId = upserted.id
    }
    await supabase.from('day_events').update({ day_id: targetId }).eq('id', eventId)
    setDays(prev => {
      const event = prev.find(d => d.date === fromDate)?.day_events.find(e => e.id === eventId)
      if (!event) return prev
      return prev.map(d => {
        if (d.date === fromDate) return { ...d, day_events: d.day_events.filter(e => e.id !== eventId) }
        if (d.date === toDate) return { ...d, day_events: [...d.day_events, event] }
        return d
      })
    })
  }

  const selectedDay = selectedDate ? days.find(d => d.date === selectedDate) : null
  const selectedIdx = selectedDate ? days.findIndex(d => d.date === selectedDate) : -1

  function renderDayCard(day: DayWithEvents, idx: number, startExpanded = false) {
    return (
      <DayCard
        key={day.date}
        day={day}
        dayNumber={idx + 1}
        allDates={allDates}
        flights={flights.filter(f => f.flight_date === day.date)}
        startExpanded={startExpanded}
        onUpsertDay={upsertDay}
        onAddEvent={addEvent}
        onUpdateEvent={updateEvent}
        onEventStatusChange={updateEventStatus}
        onDeleteEvent={deleteEvent}
        onMoveEvent={moveEvent}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setView('list')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${view === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
        >
          📋 רשימה
        </button>
        <button
          onClick={() => setView('calendar')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${view === 'calendar' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
        >
          🗓️ לוח שנה
        </button>
      </div>

      {view === 'list' ? (
        <div className="space-y-3">
          {days.map((day, idx) => renderDayCard(day, idx))}
        </div>
      ) : (
        <div className="space-y-4">
          <TripCalendar
            days={days}
            startDate={trip.start_date}
            endDate={trip.end_date}
            flights={flights}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
          {selectedDay
            ? renderDayCard(selectedDay, selectedIdx, true)
            : <p className="text-sm text-gray-400 text-center">לחצי על יום בלוח כדי לערוך אותו</p>}
        </div>
      )}
    </div>
  )
}
