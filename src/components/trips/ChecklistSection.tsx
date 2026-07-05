'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChecklistItem } from '@/lib/types'

export default function ChecklistSection({ tripId, initialItems }: { tripId: string; initialItems: ChecklistItem[] }) {
  const [items, setItems] = useState<ChecklistItem[]>(initialItems)
  const [newText, setNewText] = useState('')
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const supabase = createClient()

  async function saveEdit(item: ChecklistItem) {
    const text = editText.trim()
    setEditingId(null)
    if (!text || text === item.text) return
    const { data } = await supabase
      .from('trip_checklists')
      .update({ text })
      .eq('id', item.id)
      .select()
      .single()
    if (data) setItems(prev => prev.map(i => i.id === item.id ? data : i))
  }

  const done = items.filter(i => i.is_done).length

  async function toggle(item: ChecklistItem) {
    const { data } = await supabase
      .from('trip_checklists')
      .update({ is_done: !item.is_done })
      .eq('id', item.id)
      .select()
      .single()
    if (data) setItems(prev => prev.map(i => i.id === item.id ? data : i))
  }

  async function addItem() {
    if (!newText.trim()) return
    setAdding(true)
    const { data } = await supabase
      .from('trip_checklists')
      .insert({ trip_id: tripId, text: newText.trim(), sort_order: items.length + 1 })
      .select()
      .single()
    if (data) { setItems(prev => [...prev, data]); setNewText('') }
    setAdding(false)
  }

  async function remove(id: string) {
    await supabase.from('trip_checklists').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between">
        <h2 className="font-semibold text-gray-700 flex items-center gap-2">
          ✅ לפני הטיול
          <span className="text-sm font-normal text-gray-400">({done}/{items.length})</span>
        </h2>
        <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-2">
          {/* Progress bar */}
          {items.length > 0 && (
            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
              <div
                className="h-1.5 rounded-full bg-green-500 transition-all"
                style={{ width: `${(done / items.length) * 100}%` }}
              />
            </div>
          )}

          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 group">
              <button onClick={() => toggle(item)} className="flex-shrink-0">
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  item.is_done ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'
                }`}>
                  {item.is_done && <span className="text-white text-xs">✓</span>}
                </div>
              </button>
              {editingId === item.id ? (
                <input
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(item); if (e.key === 'Escape') setEditingId(null) }}
                  onBlur={() => saveEdit(item)}
                  autoFocus
                  className="flex-1 text-sm border border-blue-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              ) : (
                <span
                  onClick={() => { setEditingId(item.id); setEditText(item.text) }}
                  title="לחצי לעריכה"
                  className={`flex-1 text-sm cursor-text ${item.is_done ? 'line-through text-gray-400' : 'text-gray-700'}`}
                >
                  {item.text}
                </span>
              )}
              <button
                onClick={() => remove(item.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs transition"
              >✕</button>
            </div>
          ))}

          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
            <input
              type="text"
              value={newText}
              onChange={e => setNewText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem()}
              placeholder="הוסיפי משימה..."
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={addItem}
              disabled={adding || !newText.trim()}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              הוסיפי
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
