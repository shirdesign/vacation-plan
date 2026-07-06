'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TripKosherInfo } from '@/lib/types'

const CATEGORIES: Record<string, { emoji: string; label: string }> = {
  chabad: { emoji: '🕍', label: 'בית חב"ד' },
  restaurant: { emoji: '🍽️', label: 'מסעדה' },
  products: { emoji: '🛒', label: 'מוצרים' },
  shabbat: { emoji: '🕯️', label: 'שבת' },
  info: { emoji: '💡', label: 'מידע' },
}

export default function KosherClient({
  tripId,
  initialItems,
  locationOrder,
}: {
  tripId: string
  initialItems: TripKosherInfo[]
  locationOrder: string[]
}) {
  const [items, setItems] = useState<TripKosherInfo[]>(initialItems)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ location: '', category: 'info', title: '', details: '', link: '' })
  const supabase = createClient()

  // Group by location, ordered by the itinerary; unknown locations last
  const grouped = new Map<string, TripKosherInfo[]>()
  for (const item of items) {
    const list = grouped.get(item.location) || []
    list.push(item)
    grouped.set(item.location, list)
  }
  const locations = [...grouped.keys()].sort((a, b) => {
    const ia = locationOrder.indexOf(a)
    const ib = locationOrder.indexOf(b)
    // "כללי" sections (not tied to a day location) come first
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return -1
    if (ib === -1) return 1
    return ia - ib
  })

  const allLocations = [...new Set([...locationOrder, ...grouped.keys()])]

  async function addItem() {
    if (!form.location.trim() || !form.title.trim()) return
    const { data } = await supabase
      .from('trip_kosher_info')
      .insert({
        trip_id: tripId,
        location: form.location.trim(),
        category: form.category,
        title: form.title.trim(),
        details: form.details.trim() || null,
        link: form.link.trim() || null,
        sort_order: items.filter(i => i.location === form.location).length,
      })
      .select()
      .single()
    if (data) {
      setItems(prev => [...prev, data as TripKosherInfo])
      setForm({ location: form.location, category: 'info', title: '', details: '', link: '' })
      setShowAdd(false)
    }
  }

  async function deleteItem(id: string) {
    await supabase.from('trip_kosher_info').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  return (
    <div className="space-y-5">
      {items.length === 0 && !showAdd && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400">
          <div className="text-3xl mb-2">🔯</div>
          <p>אין עדיין מידע כשרות לטיול הזה</p>
        </div>
      )}

      {locations.map(location => {
        const locationItems = grouped.get(location) || []
        // Chabad first, then restaurants, products, the rest
        const order = ['chabad', 'shabbat', 'restaurant', 'products', 'info']
        const sorted = [...locationItems].sort((a, b) => {
          const d = order.indexOf(a.category) - order.indexOf(b.category)
          return d !== 0 ? d : a.sort_order - b.sort_order
        })
        return (
          <div key={location} className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-800 text-lg mb-3">כשר ב{location}</h2>
            <div className="space-y-2.5">
              {sorted.map(item => {
                const cat = CATEGORIES[item.category] || CATEGORIES.info
                return (
                  <div key={item.id} className="flex items-start gap-2.5 group">
                    <span className="text-lg leading-6 flex-shrink-0" title={cat.label}>{cat.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800">
                        {item.link ? (
                          <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {item.title} ↗
                          </a>
                        ) : item.title}
                      </div>
                      {item.details && (
                        <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">{item.details}</p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="text-gray-300 hover:text-red-400 text-sm transition flex-shrink-0"
                      title="מחקי"
                    >✕</button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {showAdd ? (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">
          <h3 className="font-semibold text-gray-700 text-sm">הוספת מידע כשרות</h3>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="מקום *"
              list="kosher-locations"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <datalist id="kosher-locations">
              {allLocations.map(loc => <option key={loc} value={loc} />)}
            </datalist>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {Object.entries(CATEGORIES).map(([key, c]) => (
                <option key={key} value={key}>{c.emoji} {c.label}</option>
              ))}
            </select>
          </div>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="שם / כותרת *"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <textarea
            value={form.details}
            onChange={e => setForm(f => ({ ...f, details: e.target.value }))}
            placeholder="פרטים (אופציונלי)"
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
          <input
            value={form.link}
            onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
            placeholder="קישור (אופציונלי)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            dir="ltr"
          />
          <div className="flex gap-2">
            <button onClick={addItem} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 rounded-xl transition">
              הוסיפי
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition text-sm">
              ביטול
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full bg-white border border-gray-200 hover:border-blue-300 text-gray-600 text-sm font-medium py-2.5 rounded-xl transition"
        >
          + הוסיפי מידע כשרות
        </button>
      )}
    </div>
  )
}
