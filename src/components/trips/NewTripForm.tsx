'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import ImportFileSection from './ImportFileSection'

const CURRENCIES = ['USD', 'EUR', 'ILS', 'THB', 'GBP']

export default function NewTripForm() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    destination: '',
    start_date: '',
    end_date: '',
    description: '',
    total_budget: '',
    daily_budget: '',
    currency: 'USD',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .insert({
        user_id: user.id,
        name: form.name,
        destination: form.destination,
        start_date: form.start_date,
        end_date: form.end_date,
        description: form.description || null,
        total_budget: parseFloat(form.total_budget) || 0,
        daily_budget: parseFloat(form.daily_budget) || 0,
        currency: form.currency,
      })
      .select()
      .single()

    if (tripError || !trip) {
      setError(tripError?.message || 'שגיאה ביצירת הטיול')
      setLoading(false)
      return
    }

    // Create default budget categories
    await supabase.rpc('create_default_categories', { trip_uuid: trip.id })

    router.push(`/trips/${trip.id}`)
  }

  return (
    <div className="space-y-6">
      <ImportFileSection onImport={(data) => setForm(prev => ({ ...prev, ...data }))} />

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">פרטי הטיול</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">שם הטיול *</label>
          <input
            value={form.name}
            onChange={e => set('name', e.target.value)}
            required
            placeholder='למשל: "חופשה בארה״ב 2026"'
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">יעד *</label>
          <input
            value={form.destination}
            onChange={e => set('destination', e.target.value)}
            required
            placeholder='למשל: "ניו יורק, ארה״ב"'
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">תאריך התחלה *</label>
            <input
              type="date"
              value={form.start_date}
              onChange={e => set('start_date', e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">תאריך סיום *</label>
            <input
              type="date"
              value={form.end_date}
              onChange={e => set('end_date', e.target.value)}
              required
              min={form.start_date}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">תיאור / הערות</label>
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={3}
            placeholder="הוסיפי פרטים, קישורים, מספרי הזמנה..."
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <hr className="border-gray-100" />
        <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">תקציב</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">מטבע</label>
          <select
            value={form.currency}
            onChange={e => set('currency', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">תקציב כולל</label>
            <input
              type="number"
              value={form.total_budget}
              onChange={e => set('total_budget', e.target.value)}
              min="0"
              placeholder="0"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">תקציב יומי</label>
            <input
              type="number"
              value={form.daily_budget}
              onChange={e => set('daily_budget', e.target.value)}
              min="0"
              placeholder="0"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition disabled:opacity-60"
          >
            {loading ? 'יוצר טיול...' : 'צרי טיול'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition"
          >
            ביטול
          </button>
        </div>
      </form>
    </div>
  )
}
