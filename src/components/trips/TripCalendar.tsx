'use client'
import { useState } from 'react'
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

  // Open on the current month when the trip is underway, otherwise the first month
  const nowMonth = format(new Date(), 'yyyy-MM')
  const initialIdx = months.findIndex(m => format(m, 'yyyy-MM') === nowMonth)
  const [monthIdx, setMonthIdx] = useState(initialIdx === -1 ? 0 : initialIdx)

  const month = months[monthIdx]
  const monthDays = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
  const leadingBlanks = getDay(monthDays[0]) // Sunday = 0

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setMonthIdx(i => Math.max(0, i - 1))}
          disabled={monthIdx === 0}
          className="w-9 h-9 rounded-full bg-gray-50 hover:bg-blue-50 text-gray-500 hover:text-blue-600 font-bold transition disabled:opacity-30 disabled:hover:bg-gray-50"
          title="החודש הקודם"
        >
          ❯
        </button>
        <div className="text-center">
          <h3 className="font-semibold text-gray-700">
            {format(month, 'LLLL yyyy', { locale: he })}
          </h3>
          {months.length > 1 && (
            <p className="text-[11px] text-gray-400">חודש {monthIdx + 1} מתוך {months.length}</p>
          )}
        </div>
        <button
          onClick={() => setMonthIdx(i => Math.min(months.length - 1, i + 1))}
          disabled={monthIdx === months.length - 1}
          className="w-9 h-9 rounded-full bg-gray-50 hover:bg-blue-50 text-gray-500 hover:text-blue-600 font-bold transition disabled:opacity-30 disabled:hover:bg-gray-50"
          title="החודש הבא"
        >
          ❮
        </button>
      </div>

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
          // The city alone — dropping ", תאילנד" etc. leaves room for the full name
          const shortLocation = day?.location_name?.split(',')[0].trim()

          if (!inTrip) {
            return (
              <div key={dateStr} className="min-h-[76px] rounded-lg p-1 text-xs text-gray-300 text-center pt-2">
                {date.getDate()}
              </div>
            )
          }

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(dateStr)}
              className={`min-h-[76px] rounded-lg p-1 text-right border transition flex flex-col
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
                <span className="text-[10px] text-white bg-blue-600 rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0">
                  {tripDayNumber.get(dateStr)}
                </span>
                <span className="text-xs font-semibold text-gray-700">{date.getDate()}</span>
              </div>
              <div className="flex-1 w-full overflow-hidden mt-0.5">
                {shortLocation && (
                  <div className="text-[10px] leading-[1.15] text-gray-600 font-medium break-words line-clamp-3">
                    📍{shortLocation}
                  </div>
                )}
                {day?.title && !shortLocation && (
                  <div className="text-[10px] leading-tight text-gray-500 break-words line-clamp-2">{day.title}</div>
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
}
