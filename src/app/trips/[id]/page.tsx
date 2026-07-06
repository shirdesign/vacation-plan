import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import NavBar from '@/components/ui/NavBar'
import { Trip, TripDay } from '@/lib/types'
import { format, parseISO, differenceInDays } from 'date-fns'
import ShareButton from '@/components/trips/ShareButton'
import ChecklistSection from '@/components/trips/ChecklistSection'
import TipsSection from '@/components/trips/TipsSection'
import EmergencyContactsSection from '@/components/trips/EmergencyContactsSection'
import PlanTripButton from '@/components/trips/PlanTripButton'
import ImportPlanSection from '@/components/trips/ImportPlanSection'
import TripMapSection from '@/components/map/TripMapSection'

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
  const [{ data: expenses }, { data: checklist }, { data: tips }, { data: contacts }, { data: tripDays }] = await Promise.all([
    supabase.from('expenses').select('amount, date, paid_by, budget_categories(is_fixed)').eq('trip_id', id),
    supabase.from('trip_checklists').select('*').eq('trip_id', id).order('sort_order'),
    supabase.from('trip_tips').select('*').eq('trip_id', id).order('location').order('sort_order'),
    supabase.from('trip_emergency_contacts').select('*').eq('trip_id', id).order('sort_order'),
    supabase.from('trip_days').select('*').eq('trip_id', id).order('date'),
  ])

  type ExpenseRow = { amount: number; date: string; paid_by: string | null; budget_categories: { is_fixed: boolean } | null }
  const expRows = (expenses || []) as unknown as ExpenseRow[]
  const totalSpent = expRows.reduce((sum, e) => sum + Number(e.amount), 0)
  const fixedSpent = expRows.filter(e => e.budget_categories?.is_fixed).reduce((s, e) => s + Number(e.amount), 0)

  // Days math — shared by all travelers
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const tripStarted = todayStr >= t.start_date
  const tripEnded = todayStr > t.end_date
  // Days left including today (before the trip: all days)
  const daysLeft = tripEnded ? 0 : tripStarted
    ? differenceInDays(parseISO(t.end_date), today) + 1
    : days
  // Days elapsed including today
  const daysElapsed = tripStarted
    ? Math.min(differenceInDays(today, parseISO(t.start_date)) + 1, days)
    : 0

  // Two travelers: entirely separate budgets — summary, remaining-per-day and
  // averages are each computed from her own expenses (+half of shared ones)
  const hasCompanion = !!t.companion_name
  const sumBy = (payer: string, onlyFixed = false) =>
    expRows
      .filter(e => (e.paid_by || 'me') === payer && (!onlyFixed || e.budget_categories?.is_fixed))
      .reduce((s, e) => s + Number(e.amount), 0)

  const budgetViews = (hasCompanion
    ? [
        { name: t.traveler_name || 'אני', budget: t.total_budget, spent: sumBy('me') + sumBy('shared') / 2, fixed: sumBy('me', true) + sumBy('shared', true) / 2, color: 'blue' },
        { name: t.companion_name!, budget: Number(t.companion_budget || 0), spent: sumBy('companion') + sumBy('shared') / 2, fixed: sumBy('companion', true) + sumBy('shared', true) / 2, color: 'purple' },
      ]
    : [
        { name: null as string | null, budget: t.total_budget, spent: totalSpent, fixed: fixedSpent, color: 'blue' },
      ]
  ).map(b => {
    const remaining = b.budget - b.spent
    return {
      ...b,
      remaining,
      spentPct: b.budget > 0 ? Math.min((b.spent / b.budget) * 100, 100) : 0,
      perDayLeft: daysLeft > 0 ? remaining / daysLeft : 0,
      avgDailyAll: daysElapsed > 0 ? b.spent / daysElapsed : 0,
      avgDailyOnly: daysElapsed > 0 ? (b.spent - b.fixed) / daysElapsed : 0,
    }
  })

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
          <div className="flex items-center gap-2">
            <Link
              href={`/trips/${id}/edit`}
              className="text-sm bg-white border border-gray-200 hover:border-blue-300 text-gray-600 px-3 py-1.5 rounded-lg transition"
            >
              ✏️ עריכה
            </Link>
            <ShareButton tripId={id} shareToken={t.share_token} />
          </div>
        </div>

        {/* Budget summary — with two travelers each gets her own complete card,
            including remaining-per-day and daily averages from her numbers only */}
        {(t.total_budget > 0 || hasCompanion) && budgetViews.map(b => (
          <div
            key={b.name || 'single'}
            className={`bg-white rounded-2xl border p-5 mb-6 ${b.name ? (b.color === 'blue' ? 'border-blue-200' : 'border-purple-200') : 'border-gray-200'}`}
          >
            <h2 className="font-semibold text-gray-700 mb-3">
              {b.name
                ? <>💰 התקציב של <span className={b.color === 'blue' ? 'text-blue-700' : 'text-purple-700'}>{b.name}</span></>
                : 'סיכום תקציב'}
              {b.name && <span className="text-xs font-normal text-gray-400 mr-2">· כולל מחצית מההוצאות המשותפות</span>}
            </h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-xl font-bold text-gray-800">{b.budget.toLocaleString()}</div>
                <div className="text-xs text-gray-500 mt-1">תקציב ({t.currency})</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-orange-500">{b.spent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                <div className="text-xs text-gray-500 mt-1">הוצא עד כה</div>
              </div>
              <div className="text-center">
                <div className={`text-xl font-bold ${b.remaining >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {b.budget > 0 ? b.remaining.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                </div>
                <div className="text-xs text-gray-500 mt-1">נשאר</div>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${b.spentPct > 90 ? 'bg-red-500' : b.spentPct > 70 ? 'bg-orange-400' : 'bg-green-500'}`}
                style={{ width: `${b.spentPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1 text-left">{b.spentPct.toFixed(0)}% מהתקציב</p>

            {/* Daily budget breakdown — her own numbers */}
            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <div className="font-bold text-blue-700 text-lg">
                  {daysLeft > 0 && b.budget > 0 ? `${Math.floor(b.perDayLeft).toLocaleString()} ${t.currency}` : '—'}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  נשאר ליום · {daysLeft > 0 ? `${daysLeft} ימים ${tripStarted ? 'נותרו' : 'בטיול'}` : 'הטיול הסתיים'}
                </div>
              </div>
              <div className="bg-orange-50 rounded-xl p-3 text-center">
                <div className="font-bold text-orange-600 text-lg">
                  {daysElapsed > 0 ? Math.round(b.avgDailyOnly).toLocaleString() + ' ' + t.currency : '—'}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {daysElapsed > 0 ? 'ממוצע ליום · בלי טיסות וביטוח' : 'ממוצע יומי — הטיול טרם התחיל'}
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <div className="font-bold text-gray-700 text-lg">
                  {daysElapsed > 0 ? Math.round(b.avgDailyAll).toLocaleString() + ' ' + t.currency : '—'}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {daysElapsed > 0 ? `ממוצע ליום · כולל הכל (${daysElapsed} ימים)` : 'ממוצע כולל — הטיול טרם התחיל'}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Navigation tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
          <Link
            href={`/trips/${id}/itinerary`}
            className="text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition"
          >
            🗓️ מסלול יומי
          </Link>
          <Link
            href={`/trips/${id}/budget`}
            className="text-center bg-white border border-gray-200 hover:border-blue-300 text-gray-700 font-semibold py-3 rounded-xl transition"
          >
            💰 תקציב
          </Link>
          <Link
            href={`/trips/${id}/places`}
            className="text-center bg-white border border-gray-200 hover:border-blue-300 text-gray-700 font-semibold py-3 rounded-xl transition"
          >
            📍 מקומות
          </Link>
          <Link
            href={`/trips/${id}/kosher`}
            className="text-center bg-white border border-gray-200 hover:border-blue-300 text-gray-700 font-semibold py-3 rounded-xl transition"
          >
            🔯 כשר ב...
          </Link>
        </div>

        {t.description && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
            <h2 className="font-semibold text-gray-700 mb-2">הערות כלליות</h2>
            <p className="text-gray-600 text-sm whitespace-pre-wrap">{t.description}</p>
          </div>
        )}

        {/* AI Trip Planner */}
        <PlanTripButton tripId={id} />

        {/* Import an existing plan from a file */}
        <ImportPlanSection tripId={id} tripStart={t.start_date} tripEnd={t.end_date} />

        {/* Pre-trip Checklist */}
        <ChecklistSection tripId={id} initialItems={checklist || []} />

        {/* Route map — pass only the fields the map renders */}
        <TripMapSection
          days={((tripDays || []) as TripDay[]).map(d => ({
            id: d.id,
            date: d.date,
            title: d.title,
            location_name: d.location_name,
            location_lat: d.location_lat,
            location_lng: d.location_lng,
          }))}
          editable
        />

        {/* Tips & Recommendations */}
        <TipsSection tripId={id} initialTips={tips || []} />

        {/* Emergency Contacts */}
        <EmergencyContactsSection tripId={id} initialContacts={contacts || []} />
      </main>
    </div>
  )
}
