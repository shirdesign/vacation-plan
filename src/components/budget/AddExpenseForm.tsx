'use client'
import { useState } from 'react'
import { BudgetCategory, Expense } from '@/lib/types'

const CURRENCIES = ['USD', 'EUR', 'ILS', 'THB', 'GBP']

export default function AddExpenseForm({
  tripId,
  currency,
  categories,
  onAdd,
  onCancel,
}: {
  tripId: string
  currency: string
  categories: BudgetCategory[]
  onAdd: (data: Omit<Expense, 'id' | 'created_at'>) => void
  onCancel: () => void
}) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [expCurrency, setExpCurrency] = useState(currency)
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    onAdd({
      trip_id: tripId,
      description,
      amount: parseFloat(amount),
      currency: expCurrency,
      category_id: categoryId || null,
      date,
      notes: notes || null,
    } as unknown as Omit<Expense, 'id' | 'created_at'>)
  }

  return (
    <form onSubmit={submit} className="bg-orange-50 border border-orange-200 rounded-2xl p-5 space-y-3">
      <h3 className="font-semibold text-gray-700">הוספת הוצאה</h3>

      <div>
        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="תיאור ההוצאה *"
          required
          autoFocus
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="סכום *"
          required
          min="0"
          step="0.01"
          className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <select
          value={expCurrency}
          onChange={e => setExpCurrency(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <select
        value={categoryId}
        onChange={e => setCategoryId(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
      >
        {categories.map(c => (
          <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
        ))}
      </select>

      <input
        type="date"
        value={date}
        onChange={e => setDate(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
      />

      <input
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="הערות (אופציונלי)"
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
      />

      <div className="flex gap-2 pt-1">
        <button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 rounded-xl transition text-sm">
          הוסיפי הוצאה
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2.5 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition text-sm">
          ביטול
        </button>
      </div>
    </form>
  )
}
