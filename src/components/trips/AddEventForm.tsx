'use client'
import { useState } from 'react'
import { DayEvent } from '@/lib/types'

export default function AddEventForm({
  onAdd,
  onCancel,
}: {
  onAdd: (event: Omit<DayEvent, 'id' | 'day_id'>) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({
      title: title.trim(),
      start_time: startTime || undefined,
      end_time: endTime || undefined,
      location: location || undefined,
      description: description || undefined,
      status: 'planned',
      sort_order: 0,
    })
  }

  return (
    <form onSubmit={submit} className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <div>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="שם הפעילות *"
          required
          autoFocus
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="time"
          value={startTime}
          onChange={e => setStartTime(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="שעת התחלה"
        />
        <input
          type="time"
          value={endTime}
          onChange={e => setEndTime(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="שעת סיום"
        />
      </div>
      <input
        value={location}
        onChange={e => setLocation(e.target.value)}
        placeholder="מיקום (אופציונלי)"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <input
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="הערות / פרטים"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex gap-2">
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition">
          הוסיפי
        </button>
        <button type="button" onClick={onCancel} className="text-gray-500 px-3 py-2 text-sm hover:text-gray-700">
          ביטול
        </button>
      </div>
    </form>
  )
}
