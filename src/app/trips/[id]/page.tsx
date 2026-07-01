import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import NavBar from '@/components/ui/NavBar'
import { Trip } from '@/lib/types'
import { format, parseISO, differenceInDays } from 'date-fns'
import ShareButton from '@/components/trips/ShareButton'

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
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

  const t = trip as Trip
  const days = differenceInDays(parseISO(t.end_date), parseISO(t.start_date)) + 1

  // Get total spent
  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount')
    .eq('trip_id', id)

  const totalSpent = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
  const remaining = t.total_budget - totalSpent
  const spentPct = t.total_budget > 0 ? Math.min((totalSpent / t.total_budget) * 100, 100) : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar user={user} />
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 mb-2 inline-block">
              ← כל הטיולים
            </Link>
            <h1 className="text-2xl font-bold text-gray-800">{t.name}</h1>
            <p className="text-gray-500 mt-1">📍 {t.destination} · {days} ימים · {format(parseISO(t.start_date), 'dd/MM/yyyy')} – {format(parseISO(t.end_date), 'dd/MM/yyyy')}</p>
          </div>
          <ShareButton tripId={id} shareToken={t.share_token} />
        </div>

        {/* Budget summary card */}
        {t.total_budget > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
            <h2 className="font-semibold text-gray-700 mb-3">סיכום תקציב</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-xl font-bold text-gray-800">{t.total_budget.toLocaleString()}</div>
                <div className="text-xs text-gray-500 mt-1">תקציב כולל ({t.currency})</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-orange-500">{totalSpent.toLocaleString()}</div>
                <div className="text-xs text-gray-500 mt-1">הוצא עד כה</div>
              </div>
              <div className="text-center">
                <div className={`text-xl font-bold ${remaining >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {remaining.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 mt-1">נשאר</div>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${spentPct > 90 ? 'bg-red-500' : spentPct > 70 ? 'bg-orange-400' : 'bg-green-500'}`}
                style={{ width: `${spentPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1 text-left">{spentPct.toFixed(0)}% מהתקציב</p>
          </div>
        )}

        {/* Navigation tabs */}
        <div className="flex gap-2 mb-6">
          <Link
            href={`/trips/${id}/itinerary`}
            className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition"
          >
            🗓️ מסלול יומי
          </Link>
          <Link
            href={`/trips/${id}/budget`}
            className="flex-1 text-center bg-white border border-gray-200 hover:border-blue-300 text-gray-700 font-semibold py-3 rounded-xl transition"
          >
            💰 תקציב והוצאות
          </Link>
        </div>

        {t.description && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-700 mb-2">הערות כלליות</h2>
            <p className="text-gray-600 text-sm whitespace-pre-wrap">{t.description}</p>
          </div>
        )}
      </main>
    </div>
  )
}
