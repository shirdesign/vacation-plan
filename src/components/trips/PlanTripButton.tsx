'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PlanTripButton({ tripId }: { tripId: string }) {
  const [open, setOpen] = useState(false)
  const [preferences, setPreferences] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ daysCreated: number; tipsCreated: number } | null>(null)
  const router = useRouter()

  async function plan() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/plan-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, preferences }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'שגיאה לא ידועה')
      } else {
        setResult(data)
        router.refresh()
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'שגיאת רשת')
    }
    setLoading(false)
  }

  return (
    <div className="bg-gradient-to-l from-violet-50 to-fuchsia-50 rounded-2xl border border-violet-200 p-5 mb-6">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between">
        <h2 className="font-semibold text-violet-800">✨ תכנני לי את הטיול</h2>
        <span className="text-violet-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-gray-600">
            ה-AI יתכנן אוטומטית את כל הימים הריקים במסלול — כותרות, מיקומים, פעילויות עם שעות, וטיפים לכל עיר. ימים שכבר תכננת לא ייגעו.
          </p>
          <textarea
            value={preferences}
            onChange={e => setPreferences(e.target.value)}
            rows={2}
            placeholder='העדפות (אופציונלי): למשל "אוהבות טבע וחופים, אוכל כשר, בלי מוזיאונים"'
            className="w-full text-sm border border-violet-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
          />

          {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg p-3">{error}</p>}
          {result && (
            <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3">
              ✅ תוכננו {result.daysCreated} ימים ונוספו {result.tipsCreated} טיפים! גשי למסלול היומי לראות.
            </p>
          )}

          <button
            onClick={plan}
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3 rounded-xl transition disabled:opacity-60"
          >
            {loading ? '🪄 מתכנן... (זה לוקח דקה-שתיים)' : '✨ תכנני עכשיו'}
          </button>
        </div>
      )}
    </div>
  )
}
