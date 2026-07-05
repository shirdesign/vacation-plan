import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import NavBar from '@/components/ui/NavBar'
import PlacesClient from '@/components/places/PlacesClient'
import { Trip, TripDay, DayEvent, TripTip, PlaceActivity } from '@/lib/types'
import Link from 'next/link'

export default async function PlacesPage({ params }: { params: Promise<{ id: string }> }) {
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

  const [{ data: days }, { data: tips }, { data: activities }] = await Promise.all([
    supabase.from('trip_days').select('*, day_events(*)').eq('trip_id', id).order('date'),
    supabase.from('trip_tips').select('*').eq('trip_id', id).order('location').order('sort_order'),
    supabase.from('place_activities').select('*').eq('trip_id', id).order('location').order('sort_order'),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar user={user} />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/trips/${id}`} className="text-gray-400 hover:text-gray-600">←</Link>
          <div>
            <h1 className="text-xl font-bold text-gray-800">מה עושים בכל מקום</h1>
            <p className="text-sm text-gray-500">{trip.name}</p>
          </div>
        </div>
        <PlacesClient
          trip={trip as Trip}
          days={(days || []) as (TripDay & { day_events: DayEvent[] })[]}
          tips={(tips || []) as TripTip[]}
          initialActivities={(activities || []) as PlaceActivity[]}
        />
      </main>
    </div>
  )
}
