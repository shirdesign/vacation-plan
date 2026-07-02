'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { EmergencyContact } from '@/lib/types'

export default function EmergencyContactsSection({ tripId, initialContacts }: { tripId: string; initialContacts: EmergencyContact[] }) {
  const [contacts, setContacts] = useState<EmergencyContact[]>(initialContacts)
  const [open, setOpen] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', role: '', phone: '', notes: '' })
  const supabase = createClient()

  async function add() {
    if (!form.name.trim()) return
    const { data } = await supabase
      .from('trip_emergency_contacts')
      .insert({ trip_id: tripId, ...form, sort_order: contacts.length + 1 })
      .select()
      .single()
    if (data) { setContacts(prev => [...prev, data]); setForm({ name: '', role: '', phone: '', notes: '' }); setShowForm(false) }
  }

  async function remove(id: string) {
    await supabase.from('trip_emergency_contacts').delete().eq('id', id)
    setContacts(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between">
        <h2 className="font-semibold text-gray-700 flex items-center gap-2">
          🆘 אנשי קשר לחירום
          <span className="text-sm font-normal text-gray-400">({contacts.length})</span>
        </h2>
        <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          {contacts.map(c => (
            <div key={c.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl group">
              <div className="text-2xl">👤</div>
              <div className="flex-1">
                <div className="font-medium text-gray-800">{c.name}</div>
                {c.role && <div className="text-xs text-gray-500">{c.role}</div>}
                {c.phone && (
                  <a href={`tel:${c.phone}`} className="text-sm text-blue-600 hover:underline mt-0.5 block">
                    📞 {c.phone}
                  </a>
                )}
                {c.notes && <div className="text-xs text-gray-400 mt-1">{c.notes}</div>}
              </div>
              <button
                onClick={() => remove(c.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs transition"
              >✕</button>
            </div>
          ))}

          {showForm ? (
            <div className="border border-blue-200 rounded-xl p-4 space-y-2 bg-blue-50">
              <input placeholder="שם *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <input placeholder="תפקיד (משפחה, שגרירות...)" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <input placeholder="טלפון" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <div className="flex gap-2">
                <button onClick={add} className="flex-1 bg-blue-600 text-white text-sm py-2 rounded-lg hover:bg-blue-700 transition">שמרי</button>
                <button onClick={() => setShowForm(false)} className="flex-1 bg-gray-200 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-300 transition">ביטול</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowForm(true)} className="w-full text-sm text-blue-600 hover:text-blue-800 py-2 border-2 border-dashed border-blue-200 rounded-xl hover:border-blue-400 transition">
              + הוסיפי איש קשר
            </button>
          )}
        </div>
      )}
    </div>
  )
}
