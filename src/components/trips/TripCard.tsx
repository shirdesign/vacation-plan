import Link from 'next/link'
import { Trip } from '@/lib/types'
import { format, differenceInDays, parseISO } from 'date-fns'

function tripStatus(trip: Trip): { label: string; color: string } {
  const today = new Date()
  const start = parseISO(trip.start_date)
  const end = parseISO(trip.end_date)
  if (today < start) return { label: 'מתוכנן', color: 'bg-blue-100 text-blue-700' }
  if (today > end) return { label: 'הסתיים', color: 'bg-gray-100 text-gray-600' }
  return { label: 'בטיול עכשיו!', color: 'bg-green-100 text-green-700' }
}

export default function TripCard({ trip }: { trip: Trip }) {
  const { label, color } = tripStatus(trip)
  const days = differenceInDays(parseISO(trip.end_date), parseISO(trip.start_date)) + 1

  return (
    <Link href={`/trips/${trip.id}`} className="block group">
      <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md hover:border-blue-200 transition-all">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="font-bold text-gray-800 text-lg group-hover:text-blue-600 transition-colors">
              {trip.name}
            </h2>
            <p className="text-gray-500 text-sm mt-0.5">📍 {trip.destination}</p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${color}`}>
            {label}
          </span>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-500 mt-3 pt-3 border-t border-gray-100">
          <span>📅 {format(parseISO(trip.start_date), 'dd/MM/yy')} – {format(parseISO(trip.end_date), 'dd/MM/yy')}</span>
          <span>🗓️ {days} ימים</span>
        </div>

        {trip.total_budget > 0 && (
          <div className="mt-2 text-sm text-gray-500">
            💰 תקציב: {trip.total_budget.toLocaleString()} {trip.currency}
          </div>
        )}
      </div>
    </Link>
  )
}
