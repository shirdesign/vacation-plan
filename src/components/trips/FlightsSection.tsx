'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TripFlight } from '@/lib/types'
import { format, parseISO } from 'date-fns'

const FLIGHTS_CATEGORY_NAME = 'טיסות פנים'

export default function FlightsSection({
  tripId,
  currency,
  startDate,
  endDate,
  initialFlights,
}: {
  tripId: string
  currency: string
  startDate: string
  endDate: string
  initialFlights: TripFlight[]
}) {
  const EMPTY_FORM = {
    from_location: '', to_location: '', flight_date: '', depart_time: '',
    airline: '', flight_number: '', price: '', is_booked: false, notes: '',
  }
  const [flights, setFlights] = useState<TripFlight[]>(initialFlights)
  const [open, setOpen] = useState(initialFlights.length > 0)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const supabase = createClient()

  function startEdit(f: TripFlight) {
    setEditingId(f.id)
    setForm({
      from_location: f.from_location,
      to_location: f.to_location,
      flight_date: f.flight_date,
      depart_time: f.depart_time?.slice(0, 5) || '',
      airline: f.airline || '',
      flight_number: f.flight_number || '',
      price: String(f.price ?? ''),
      is_booked: f.is_booked,
      notes: f.notes || '',
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const totalPrice = flights.reduce((s, f) => s + Number(f.price), 0)

  function set(field: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // The fixed "domestic flights" budget category — created on first use
  async function getFlightsCategoryId(): Promise<string | null> {
    const { data: existing } = await supabase
      .from('budget_categories')
      .select('id')
      .eq('trip_id', tripId)
      .eq('name', FLIGHTS_CATEGORY_NAME)
      .maybeSingle()
    if (existing) return existing.id
    const { data: created } = await supabase
      .from('budget_categories')
      .insert({ trip_id: tripId, name: FLIGHTS_CATEGORY_NAME, icon: '✈️', planned_amount: 0, is_fixed: true, sort_order: 99 })
      .select('id')
      .single()
    return created?.id || null
  }

  // Booked flights are recorded as real expenses; unbooked ones are only planned
  async function createExpenseForFlight(flight: TripFlight): Promise<string | null> {
    const categoryId = await getFlightsCategoryId()
    const { data } = await supabase
      .from('expenses')
      .insert({
        trip_id: tripId,
        category_id: categoryId,
        description: `טיסה ${flight.from_location} ← ${flight.to_location}`,
        amount: Number(flight.price) || 0,
        currency,
        date: flight.flight_date,
        notes: flight.flight_number ? `${flight.airline || ''} ${flight.flight_number}`.trim() : flight.airline || null,
      })
      .select('id')
      .single()
    return data?.id || null
  }

  async function saveFlight(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const values = {
      from_location: form.from_location.trim(),
      to_location: form.to_location.trim(),
      flight_date: form.flight_date,
      depart_time: form.depart_time || null,
      airline: form.airline.trim() || null,
      flight_number: form.flight_number.trim() || null,
      price: parseFloat(form.price) || 0,
      currency,
      is_booked: form.is_booked,
      notes: form.notes.trim() || null,
    }

    if (editingId) {
      const existing = flights.find(f => f.id === editingId)
      const { data } = await supabase
        .from('trip_flights')
        .update(values)
        .eq('id', editingId)
        .select()
        .single()
      if (data) {
        let f = data as TripFlight
        // Keep the linked budget expense in sync with the edited flight
        if (existing?.expense_id) {
          if (f.is_booked && Number(f.price) > 0) {
            await supabase
              .from('expenses')
              .update({
                description: `טיסה ${f.from_location} ← ${f.to_location}`,
                amount: Number(f.price),
                date: f.flight_date,
                notes: f.flight_number ? `${f.airline || ''} ${f.flight_number}`.trim() : f.airline || null,
              })
              .eq('id', existing.expense_id)
            f = { ...f, expense_id: existing.expense_id }
          } else {
            await supabase.from('expenses').delete().eq('id', existing.expense_id)
            await supabase.from('trip_flights').update({ expense_id: null }).eq('id', f.id)
            f = { ...f, expense_id: undefined }
          }
        } else if (f.is_booked && Number(f.price) > 0) {
          const expenseId = await createExpenseForFlight(f)
          if (expenseId) {
            await supabase.from('trip_flights').update({ expense_id: expenseId }).eq('id', f.id)
            f = { ...f, expense_id: expenseId }
          }
        }
        setFlights(prev => prev.map(x => x.id === editingId ? f : x).sort((a, b) => a.flight_date.localeCompare(b.flight_date)))
        closeForm()
      }
    } else {
      const { data: flight } = await supabase
        .from('trip_flights')
        .insert({ trip_id: tripId, ...values })
        .select()
        .single()

      if (flight) {
        let f = flight as TripFlight
        if (f.is_booked && Number(f.price) > 0) {
          const expenseId = await createExpenseForFlight(f)
          if (expenseId) {
            await supabase.from('trip_flights').update({ expense_id: expenseId }).eq('id', f.id)
            f = { ...f, expense_id: expenseId }
          }
        }
        setFlights(prev => [...prev, f].sort((a, b) => a.flight_date.localeCompare(b.flight_date)))
        closeForm()
      }
    }
    setSaving(false)
  }

  async function toggleBooked(flight: TripFlight) {
    const nowBooked = !flight.is_booked
    let expenseId = flight.expense_id || null

    if (nowBooked && !expenseId && Number(flight.price) > 0) {
      expenseId = await createExpenseForFlight(flight)
    } else if (!nowBooked && expenseId) {
      await supabase.from('expenses').delete().eq('id', expenseId)
      expenseId = null
    }

    await supabase.from('trip_flights').update({ is_booked: nowBooked, expense_id: expenseId }).eq('id', flight.id)
    setFlights(prev => prev.map(f => f.id === flight.id ? { ...f, is_booked: nowBooked, expense_id: expenseId || undefined } : f))
  }

  async function deleteFlight(flight: TripFlight) {
    if (!confirm('למחוק את הטיסה? ההוצאה המשויכת בתקציב תימחק גם.')) return
    if (flight.expense_id) {
      await supabase.from('expenses').delete().eq('id', flight.expense_id)
    }
    await supabase.from('trip_flights').delete().eq('id', flight.id)
    setFlights(prev => prev.filter(f => f.id !== flight.id))
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between">
        <h2 className="font-semibold text-gray-700 flex items-center gap-2">
          ✈️ טיסות פנים
          <span className="text-sm font-normal text-gray-400">
            ({flights.length}{totalPrice > 0 ? ` · ${totalPrice.toLocaleString()} ${currency}` : ''})
          </span>
        </h2>
        <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          {flights.length === 0 && !showForm && (
            <p className="text-sm text-gray-400 italic">אין טיסות פנים עדיין</p>
          )}

          {flights.map(f => (
            <div key={f.id} className={`flex items-start gap-3 p-3 rounded-xl border ${f.is_booked ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-800 text-sm">
                  {f.from_location} ← {f.to_location}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-0.5">
                  <span>🗓️ {format(parseISO(f.flight_date), 'dd/MM/yyyy')}</span>
                  {f.depart_time && <span>⏰ {f.depart_time.slice(0, 5)}</span>}
                  {(f.airline || f.flight_number) && <span>{[f.airline, f.flight_number].filter(Boolean).join(' ')}</span>}
                  {Number(f.price) > 0 && <span className="font-semibold text-gray-700">{Number(f.price).toLocaleString()} {f.currency}</span>}
                </div>
                {f.notes && <p className="text-xs text-gray-500 mt-1">{f.notes}</p>}
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <button
                  onClick={() => toggleBooked(f)}
                  className={`text-xs px-2.5 py-1 rounded-full transition ${f.is_booked ? 'bg-green-500 text-white' : 'bg-white border border-orange-300 text-orange-600 hover:bg-orange-100'}`}
                >
                  {f.is_booked ? '✓ הוזמן' : 'טרם הוזמן'}
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={() => startEdit(f)} className="text-xs text-blue-500 hover:underline">ערכי</button>
                  <button onClick={() => deleteFlight(f)} className="text-xs text-red-400 hover:text-red-600">מחקי</button>
                </div>
              </div>
            </div>
          ))}

          {showForm ? (
            <form onSubmit={saveFlight} className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input value={form.from_location} onChange={e => set('from_location', e.target.value)} placeholder="מאיפה *" required
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                <input value={form.to_location} onChange={e => set('to_location', e.target.value)} placeholder="לאן *" required
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={form.flight_date} onChange={e => set('flight_date', e.target.value)} required min={startDate} max={endDate}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                <input type="time" value={form.depart_time} onChange={e => set('depart_time', e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input value={form.airline} onChange={e => set('airline', e.target.value)} placeholder="חברת תעופה"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                <input value={form.flight_number} onChange={e => set('flight_number', e.target.value)} placeholder="מספר טיסה"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div className="grid grid-cols-2 gap-3 items-center">
                <input type="number" inputMode="decimal" min="0" step="0.01" value={form.price} onChange={e => set('price', e.target.value)}
                  placeholder={`מחיר (${currency})`}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={form.is_booked} onChange={e => set('is_booked', e.target.checked)} className="w-4 h-4" />
                  כבר הוזמן
                </label>
              </div>
              <input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="הערות (אופציונלי)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              <p className="text-xs text-gray-500">
                💡 טיסה שמסומנת &quot;הוזמן&quot; נרשמת אוטומטית כהוצאה בקטגוריית &quot;{FLIGHTS_CATEGORY_NAME}&quot; בתקציב.
              </p>
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-xl transition text-sm disabled:opacity-50">
                  {saving ? 'שומר...' : editingId ? 'עדכני טיסה' : 'הוסיפי טיסה'}
                </button>
                <button type="button" onClick={closeForm} className="px-4 py-2 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition text-sm">
                  ביטול
                </button>
              </div>
            </form>
          ) : (
            <button onClick={() => setShowForm(true)} className="text-sm bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition">
              + הוסיפי טיסה
            </button>
          )}
        </div>
      )}
    </div>
  )
}
