import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Trip } from '@/lib/types'
import TripCard from '@/components/trips/TripCard'
import NavBar from '@/components/ui/NavBar'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: trips } = await supabase
    .from('trips')
    .select('*')
    .order('start_date', { ascending: true })

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar user={user} />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">הטיולים שלי</h1>
            <p className="text-gray-500 text-sm mt-1">כל הטיולים שלך במקום אחד</p>
          </div>
          <Link
            href="/trips/new"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition flex items-center gap-2"
          >
            <span>+</span> טיול חדש
          </Link>
        </div>

        {!trips || trips.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-gray-300">
            <div className="text-5xl mb-4">🌍</div>
            <h2 className="text-lg font-semibold text-gray-700 mb-2">עדיין אין טיולים</h2>
            <p className="text-gray-400 mb-6">צרי טיול חדש והתחילי לתכנן!</p>
            <Link
              href="/trips/new"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition"
            >
              + צרי טיול ראשון
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {(trips as Trip[]).map(trip => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
