import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import NavBar from '@/components/ui/NavBar'
import ItineraryClient from '@/components/trips/ItineraryClient'
import { Trip, TripDay, DayEvent, TripFlight } from '@/lib/types'
import { eachDayOfInterval, parseISO, format } from 'date-fns'
import Link from 'next/link'

export default async function ItineraryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!trip) notFound()

  const [{ data: days }, { data: flights }] = await Promise.all([
    supabase
      .from('trip_days')
      .select('*, day_events(*)')
      .eq('trip_id', id)
      .order('date', { ascending: true }),
    supabase
      .from('trip_flights')
      .select('*')
      .eq('trip_id', id)
      .order('flight_date', { ascending: true }),
  ])

  // Build full date range with existing days merged in
  const allDates = eachDayOfInterval({
    start: parseISO(trip.start_date),
    end: parseISO(trip.end_date),
  })

  const daysMap = new Map((days || []).map((d: TripDay & { day_events: DayEvent[] }) => [d.date, d]))

  const fullDays = allDates.map(date => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const existing = daysMap.get(dateStr)
    return existing
      ? { ...existing, day_events: existing.day_events || [] }
      : { date: dateStr, trip_id: id, day_events: [] as DayEvent[] }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar user={user} />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/trips/${id}`} className="text-gray-400 hover:text-gray-600">←</Link>
          <div>
            <h1 className="text-xl font-bold text-gray-800">מסלול יומי</h1>
            <p className="text-sm text-gray-500">{trip.name}</p>
          </div>
        </div>
        <ItineraryClient
          trip={trip as Trip}
          initialDays={fullDays as (TripDay & { day_events: DayEvent[] })[]}
          flights={(flights || []) as TripFlight[]}
        />
      </main>
    </div>
  )
}
