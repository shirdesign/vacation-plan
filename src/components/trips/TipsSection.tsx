'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TripTip } from '@/lib/types'

const CATEGORY_LABELS: Record<string, { emoji: string; label: string }> = {
  general: { emoji: '💡', label: 'כללי' },
  food: { emoji: '🍽️', label: 'אוכל' },
  kosher: { emoji: '🔯', label: 'כשר' },
  transport: { emoji: '🚌', label: 'תחבורה' },
  hotel: { emoji: '🏨', label: 'לינה' },
  chabad: { emoji: '🕍', label: 'חב"ד' },
  nails: { emoji: '💅', label: 'ניילס' },
  shopping: { emoji: '🛍️', label: 'קניות' },
}

export default function TipsSection({ tripId, initialTips }: { tripId: string; initialTips: TripTip[] }) {
  const [tips, setTips] = useState<TripTip[]>(initialTips)
  const [open, setOpen] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<string | null>(null)
  const [form, setForm] = useState({ location: '', category: 'general', tip: '', source: '' })
  const supabase = createClient()

  function startEdit(tip: TripTip) {
    setEditingId(tip.id)
    setForm({ location: tip.location, category: tip.category, tip: tip.tip, source: tip.source || '' })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm({ location: '', category: 'general', tip: '', source: '' })
  }

  async function saveEdit() {
    if (!editingId || !form.location.trim() || !form.tip.trim()) return
    const { data } = await supabase
      .from('trip_tips')
      .update({ location: form.location.trim(), category: form.category, tip: form.tip.trim(), source: form.source || null })
      .eq('id', editingId)
      .select()
      .single()
    if (data) setTips(prev => prev.map(t => t.id === editingId ? data : t))
    closeForm()
  }

  const locations = [...new Set(tips.map(t => t.location))].sort()
  const displayed = filter ? tips.filter(t => t.location === filter) : tips

  // Group by location
  const grouped = locations.reduce((acc, loc) => {
    const locTips = displayed.filter(t => t.location === loc)
    if (locTips.length) acc[loc] = locTips
    return acc
  }, {} as Record<string, TripTip[]>)

  async function add() {
    if (!form.location.trim() || !form.tip.trim()) return
    const { data } = await supabase
      .from('trip_tips')
      .insert({ trip_id: tripId, ...form, sort_order: tips.length + 1 })
      .select()
      .single()
    if (data) { setTips(prev => [...prev, data]); setForm({ location: '', category: 'general', tip: '', source: '' }); setShowForm(false) }
  }

  async function remove(id: string) {
    await supabase.from('trip_tips').delete().eq('id', id)
    setTips(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between">
        <h2 className="font-semibold text-gray-700 flex items-center gap-2">
          🗺️ טיפים והמלצות מקומיות
          <span className="text-sm font-normal text-gray-400">({tips.length})</span>
        </h2>
        <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4">
          {/* Location filter chips */}
          {locations.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setFilter(null)}
                className={`text-xs px-3 py-1 rounded-full border transition ${!filter ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}
              >
                הכל
              </button>
              {locations.map(loc => (
                <button
                  key={loc}
                  onClick={() => setFilter(filter === loc ? null : loc)}
                  className={`text-xs px-3 py-1 rounded-full border transition ${filter === loc ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}
                >
                  {loc}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-4">
            {Object.entries(grouped).map(([loc, locTips]) => (
              <div key={loc}>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">📍 {loc}</div>
                <div className="space-y-2 pr-3">
                  {locTips.map(tip => {
                    const cat = CATEGORY_LABELS[tip.category] || CATEGORY_LABELS.general
                    return (
                      <div key={tip.id} className="flex items-start gap-2 group">
                        <span className="text-lg flex-shrink-0">{cat.emoji}</span>
                        <div className="flex-1">
                          <span className="text-sm text-gray-700">{tip.tip}</span>
                          {tip.source && <div className="text-xs text-gray-400 mt-0.5">{tip.source}</div>}
                        </div>
                        <button
                          onClick={() => startEdit(tip)}
                          className="opacity-0 group-hover:opacity-100 text-blue-400 hover:text-blue-600 text-xs transition flex-shrink-0"
                        >ערכי</button>
                        <button
                          onClick={() => remove(tip.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs transition flex-shrink-0"
                        >✕</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {showForm ? (
            <div className="border border-blue-200 rounded-xl p-4 space-y-2 bg-blue-50 mt-4">
              <input placeholder="מיקום (עיר / מדינה)" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400">
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
              <textarea placeholder="הטיפ *" value={form.tip} onChange={e => setForm(f => ({ ...f, tip: e.target.value }))} rows={2}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
              <input placeholder="מקור (אופציונלי)" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <div className="flex gap-2">
                <button onClick={editingId ? saveEdit : add} className="flex-1 bg-blue-600 text-white text-sm py-2 rounded-lg hover:bg-blue-700 transition">
                  {editingId ? 'עדכני' : 'שמרי'}
                </button>
                <button onClick={closeForm} className="flex-1 bg-gray-200 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-300 transition">ביטול</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowForm(true)} className="w-full text-sm text-blue-600 hover:text-blue-800 py-2 border-2 border-dashed border-blue-200 rounded-xl hover:border-blue-400 transition mt-4">
              + הוסיפי טיפ
            </button>
          )}
        </div>
      )}
    </div>
  )
}
