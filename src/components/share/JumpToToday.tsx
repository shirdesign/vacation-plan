'use client'
import { useEffect, useState } from 'react'

export default function JumpToToday({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [todayStr, setTodayStr] = useState<string | null>(null)

  useEffect(() => {
    const now = new Date()
    const str = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    if (str >= startDate && str <= endDate) {
      setTodayStr(str)
      // Auto-scroll to today on first load
      requestAnimationFrame(() => {
        document.getElementById(`day-${str}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [startDate, endDate])

  if (!todayStr) return null

  return (
    <button
      onClick={() => document.getElementById(`day-${todayStr}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      className="fixed bottom-5 left-5 z-20 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg transition"
    >
      📍 קפצי להיום
    </button>
  )
}
