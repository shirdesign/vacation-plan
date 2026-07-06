import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import NavBar from '@/components/ui/NavBar'
import KosherClient from '@/components/kosher/KosherClient'
import { TripDay, TripKosherInfo } from '@/lib/types'
import Link from 'next/link'

export default async function KosherPage({ params }: { params: Promise<{ id: string }> }) {
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

  const [{ data: items }, { data: days }] = await Promise.all([
    supabase.from('trip_kosher_info').select('*').eq('trip_id', id).order('location').order('sort_order'),
    supabase.from('trip_days').select('date, location_name').eq('trip_id', id).order('date'),
  ])

  // Itinerary order of locations, so sections follow the route
  const locationOrder: string[] = []
  for (const d of (days || []) as Pick<TripDay, 'date' | 'location_name'>[]) {
    if (d.location_name && !locationOrder.includes(d.location_name)) {
      locationOrder.push(d.location_name)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar user={user} />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/trips/${id}`} className="text-gray-400 hover:text-gray-600">←</Link>
          <div>
            <h1 className="text-xl font-bold text-gray-800">🔯 כשר ב...</h1>
            <p className="text-sm text-gray-500">{trip.name}</p>
          </div>
        </div>
        <KosherClient
          tripId={id}
          initialItems={(items || []) as TripKosherInfo[]}
          locationOrder={locationOrder}
        />
      </main>
    </div>
  )
}
