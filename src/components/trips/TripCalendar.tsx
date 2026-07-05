'use client'
import { TripDay, DayEvent, TripFlight } from '@/lib/types'
import { format, parseISO, eachMonthOfInterval, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns'
import { he } from 'date-fns/locale'

type DayWithEvents = TripDay & { day_events: DayEvent[] }

const WEEKDAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']

export default function TripCalendar({
  days,
  startDate,
  endDate,
  flights,
  selectedDate,
  onSelectDate,
}: {
  days: DayWithEvents[]
  startDate: string
  endDate: string
  flights: TripFlight[]
  selectedDate: string | null
  onSelectDate: (date: string) => void
}) {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  const months = eachMonthOfInterval({ start, end })
  const daysMap = new Map(days.map(d => [d.date, d]))
  const flightDates = new Set(flights.map(f => f.flight_date))
  const tripDayNumber = new Map(days.map((d, i) => [d.date, i + 1]))

  return (
    <div className="space-y-6">
      {months.map(month => {
        const monthDays = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
        const leadingBlanks = getDay(monthDays[0]) // Sunday = 0

        return (
          <div key={format(month, 'yyyy-MM')} className="bg-white rounded-2xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-700 mb-3 text-center">
              {format(month, 'LLLL yyyy', { locale: he })}
            </h3>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 font-medium mb-1">
              {WEEKDAYS.map(w => <div key={w}>{w}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: leadingBlanks }).map((_, i) => <div key={`blank-${i}`} />)}
              {monthDays.map(date => {
                const dateStr = format(date, 'yyyy-MM-dd')
                const inTrip = dateStr >= startDate && dateStr <= endDate
                const day = daysMap.get(dateStr)
                const events = day?.day_events || []
                const dow = getDay(date)
                const isShabbat = dow === 6
                const isFriday = dow === 5
                const isSelected = selectedDate === dateStr
                const hasFlight = flightDates.has(dateStr)

                if (!inTrip) {
                  return (
                    <div key={dateStr} className="min-h-[60px] rounded-lg p-1 text-xs text-gray-300 text-center pt-2">
                      {date.getDate()}
                    </div>
                  )
                }

                return (
                  <button
                    key={dateStr}
                    onClick={() => onSelectDate(dateStr)}
                    className={`min-h-[60px] rounded-lg p-1 text-right border transition flex flex-col
                      ${isSelected
                        ? 'border-blue-500 ring-2 ring-blue-300 bg-blue-50'
                        : isShabbat
                          ? 'bg-blue-50 border-blue-200 hover:border-blue-400'
                          : isFriday
                            ? 'bg-amber-50 border-amber-200 hover:border-amber-400'
                            : 'bg-white border-gray-200 hover:border-blue-300'
                      }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[10px] text-white bg-blue-600 rounded-full w-4 h-4 flex items-center justify-center">
                        {tripDayNumber.get(dateStr)}
                      </span>
                      <span className="text-xs font-semibold text-gray-700">{date.getDate()}</span>
                    </div>
                    <div className="flex-1 w-full overflow-hidden">
                      {day?.location_name && (
                        <div className="text-[10px] text-gray-500 truncate">📍{day.location_name}</div>
                      )}
                      {day?.title && (
                        <div className="text-[10px] text-gray-600 truncate">{day.title}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 w-full">
                      {hasFlight && <span className="text-[10px]">✈️</span>}
                      {events.length > 0 && (
                        <span className="text-[9px] text-blue-600 bg-blue-100 rounded-full px-1">
                          {events.length}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
