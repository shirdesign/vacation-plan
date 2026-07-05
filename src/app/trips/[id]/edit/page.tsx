import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import NavBar from '@/components/ui/NavBar'
import EditTripForm from '@/components/trips/EditTripForm'
import { Trip } from '@/lib/types'
import Link from 'next/link'

export default async function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
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

  // Dates that already have content — used to warn before shrinking the range
  const { data: days } = await supabase
    .from('trip_days')
    .select('date, title, location_name, day_events(id)')
    .eq('trip_id', id)

  const plannedDates = (days || [])
    .filter(d => d.title || d.location_name || (d.day_events?.length ?? 0) > 0)
    .map(d => d.date)
    .sort()

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar user={user} />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/trips/${id}`} className="text-gray-400 hover:text-gray-600">←</Link>
          <h1 className="text-xl font-bold text-gray-800">עריכת הטיול</h1>
        </div>
        <EditTripForm trip={trip as Trip} plannedDates={plannedDates} />
      </main>
    </div>
  )
}
