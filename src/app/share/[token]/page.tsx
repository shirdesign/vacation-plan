import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Trip, TripDay, DayEvent, Expense } from '@/lib/types'
import { format, parseISO, differenceInDays, eachDayOfInterval } from 'date-fns'
import { he } from 'date-fns/locale'
import JumpToToday from '@/components/share/JumpToToday'
import type { TripTip } from '@/lib/types'

const TIP_EMOJI: Record<string, string> = {
  general: '💡', food: '🍽️', kosher: '🔯', transport: '🚌',
  hotel: '🏨', chabad: '🕍', nails: '💅', shopping: '🛍️',
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()

  // Find trip by share token via SECURITY DEFINER RPC (no auth needed, RLS-safe)
  const { data: shared } = await supabase.rpc('get_shared_trip', { token })

  if (!shared?.trip) notFound()

  const t = shared.trip as Trip
  const days = shared.days as (TripDay & { day_events: DayEvent[] })[]
  const expenses = shared.expenses as Expense[]
  const tips = (shared.tips || []) as TripTip[]
  const tipLocations = [...new Set(tips.map(tip => tip.location))]

  const totalSpent = (expenses || []).reduce((s: number, e: Expense) => s + Number(e.amount), 0)
  const daysMap = new Map((days || []).map((d: TripDay) => [d.date, d]))
  const totalDays = differenceInDays(parseISO(t.end_date), parseISO(t.start_date)) + 1

  const allDates = eachDayOfInterval({ start: parseISO(t.start_date), end: parseISO(t.end_date) })

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4" dir="rtl">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-5 text-center">
          <div className="text-4xl mb-2">✈️</div>
          <h1 className="text-2xl font-bold text-gray-800">{t.name}</h1>
          <p className="text-gray-500 mt-1">📍 {t.destination}</p>
          <p className="text-sm text-gray-400 mt-1">
            {format(parseISO(t.start_date), 'dd/MM/yyyy')} – {format(parseISO(t.end_date), 'dd/MM/yyyy')} · {totalDays} ימים
          </p>
        </div>

        {/* Budget (if enabled) */}
        {t.share_show_budget && t.total_budget > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
            <h2 className="font-semibold text-gray-700 mb-3">💰 תקציב</h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="font-bold text-gray-800">{t.total_budget.toLocaleString()}</div>
                <div className="text-xs text-gray-400">כולל</div>
              </div>
              <div>
                <div className="font-bold text-orange-500">{totalSpent.toLocaleString()}</div>
                <div className="text-xs text-gray-400">הוצא</div>
              </div>
              <div>
                <div className={`font-bold ${t.total_budget - totalSpent >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {(t.total_budget - totalSpent).toLocaleString()}
                </div>
                <div className="text-xs text-gray-400">נשאר ({t.currency})</div>
              </div>
            </div>
          </div>
        )}

        {/* Itinerary */}
        {t.share_show_itinerary && (
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-700 px-1">🗓️ מסלול הטיול</h2>
            {allDates.map((date, idx) => {
              const dateStr = format(date, 'yyyy-MM-dd')
              const day = daysMap.get(dateStr) as (TripDay & { day_events?: DayEvent[] }) | undefined
              const events = day?.day_events || []
              const isToday = dateStr === format(new Date(), 'yyyy-MM-dd')
              const isShabbat = date.getDay() === 6

              return (
                <div
                  key={dateStr}
                  id={`day-${dateStr}`}
                  className={`rounded-2xl shadow-sm p-5 scroll-mt-4 ${isShabbat ? 'bg-blue-50 border border-blue-200' : 'bg-white'} ${isToday ? 'ring-2 ring-blue-400' : ''}`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isToday ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800 text-sm">
                        {format(date, 'EEEE', { locale: he })} · {format(date, 'dd/MM/yyyy')}
                        {isShabbat && <span className="mr-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">✡️ שבת</span>}
                        {isToday && <span className="mr-2 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">היום</span>}
                      </div>
                      {day?.title && (
                        <div className="text-xs font-medium text-gray-600">{day.title}</div>
                      )}
                      {day?.location_name && (
                        <div className="text-xs text-gray-500">📍 {day.location_name}</div>
                      )}
                    </div>
                  </div>

                  {day?.notes && (
                    <p className="text-xs text-gray-500 whitespace-pre-wrap mr-11 mb-2">📝 {day.notes}</p>
                  )}

                  {events.length > 0 ? (
                    <div className="space-y-1.5 mr-11">
                      {events
                        .sort((a: DayEvent, b: DayEvent) => (a.start_time || '').localeCompare(b.start_time || ''))
                        .map((event: DayEvent) => (
                          <div key={event.id} className={`text-sm flex items-center gap-2 ${event.status === 'cancelled' ? 'opacity-40 line-through' : ''}`}>
                            {event.status === 'done'
                              ? <span className="text-green-500">✓</span>
                              : <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 mt-1" />
                            }
                            <span className="text-gray-700">{event.title}</span>
                            {event.start_time && <span className="text-gray-400 text-xs">{event.start_time.slice(0, 5)}</span>}
                          </div>
                        ))}
                    </div>
                  ) : (
                    !day?.location_name && (
                      <p className="text-sm text-gray-400 italic mr-11">יום פתוח</p>
                    )
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Tips & recommendations */}
        {tips.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-5 mt-5">
            <h2 className="font-semibold text-gray-700 mb-3">🗺️ טיפים והמלצות</h2>
            <div className="space-y-4">
              {tipLocations.map(loc => (
                <div key={loc}>
                  <div className="text-xs font-semibold text-gray-500 mb-1.5">📍 {loc}</div>
                  <div className="space-y-1 pr-2">
                    {tips.filter(tip => tip.location === loc).map(tip => (
                      <div key={tip.id} className="text-sm text-gray-700 flex items-start gap-2">
                        <span>{TIP_EMOJI[tip.category] || '💡'}</span>
                        <span>{tip.tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <JumpToToday startDate={t.start_date} endDate={t.end_date} />

        <p className="text-center text-xs text-gray-400 mt-8">
          נוצר עם TripTrack ✈️
        </p>
      </div>
    </div>
  )
}
