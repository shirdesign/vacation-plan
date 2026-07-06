'use client'
import { useState } from 'react'
import { BudgetCategory, Expense, ExpensePayer } from '@/lib/types'

// Approximate rates to ILS — editable by the user per entry
const RATES_TO_ILS: Record<string, number> = {
  ILS: 1,
  USD: 3.7,
  EUR: 4.0,
  THB: 0.105,
  VND: 0.000145,
  GBP: 4.7,
}
const CURRENCY_SYMBOLS: Record<string, string> = {
  ILS: '₪', USD: '$', EUR: '€', THB: '฿', VND: '₫', GBP: '£',
}

export default function AddExpenseForm({
  tripId,
  currency,
  categories,
  travelerName,
  companionName,
  onAdd,
  onCancel,
}: {
  tripId: string
  currency: string
  categories: BudgetCategory[]
  travelerName?: string
  companionName?: string
  onAdd: (data: Omit<Expense, 'id' | 'created_at'>) => void
  onCancel: () => void
}) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState<ExpensePayer>('me')
  const [expCurrency, setExpCurrency] = useState(currency)
  const [rate, setRate] = useState<string>('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [showMore, setShowMore] = useState(false)

  const effectiveRate = rate !== '' ? parseFloat(rate) || 0 : (RATES_TO_ILS[expCurrency] ?? 1)
  const amountNum = parseFloat(amount) || 0
  const converted = expCurrency === currency ? amountNum : amountNum * effectiveRate

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const isConverted = expCurrency !== currency
    onAdd({
      trip_id: tripId,
      description: description || categories.find(c => c.id === categoryId)?.name || 'הוצאה',
      amount: Math.round(converted * 100) / 100,
      currency,
      category_id: categoryId || null,
      paid_by: paidBy,
      date,
      notes: [notes, isConverted ? `${amountNum} ${expCurrency} (שער ${effectiveRate})` : '']
        .filter(Boolean).join(' · ') || null,
    } as unknown as Omit<Expense, 'id' | 'created_at'>)
  }

  return (
    <form onSubmit={submit} className="bg-orange-50 border border-orange-200 rounded-2xl p-5 space-y-3">
      <h3 className="font-semibold text-gray-700">הוספת הוצאה מהירה</h3>

      {/* Amount + currency — the fast path */}
      <div className="grid grid-cols-2 gap-3">
        <input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="סכום *"
          required
          autoFocus
          min="0"
          step="0.01"
          className="border border-gray-300 rounded-lg px-3 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <select
          value={expCurrency}
          onChange={e => { setExpCurrency(e.target.value); setRate('') }}
          className="border border-gray-300 rounded-lg px-3 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          {Object.keys(RATES_TO_ILS).map(c => (
            <option key={c} value={c}>{CURRENCY_SYMBOLS[c]} {c}</option>
          ))}
        </select>
      </div>

      {/* Live conversion preview */}
      {expCurrency !== currency && amountNum > 0 && (
        <div className="flex items-center justify-between text-sm bg-white rounded-lg border border-orange-200 px-3 py-2">
          <span className="text-gray-600">
            ≈ <strong>{converted.toLocaleString(undefined, { maximumFractionDigits: 2 })} {currency}</strong>
          </span>
          <label className="flex items-center gap-1 text-xs text-gray-400">
            שער:
            <input
              type="number"
              step="0.0001"
              value={rate !== '' ? rate : effectiveRate}
              onChange={e => setRate(e.target.value)}
              className="w-20 border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
          </label>
        </div>
      )}

      {/* Who paid — only for two-traveler trips */}
      {companionName && (
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-xs text-gray-500 ml-1">מי שילמה?</span>
          {([
            { value: 'me' as ExpensePayer, label: travelerName || 'אני' },
            { value: 'companion' as ExpensePayer, label: companionName },
            { value: 'shared' as ExpensePayer, label: '👯 משותף' },
          ]).map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPaidBy(opt.value)}
              className={`text-xs px-2.5 py-1.5 rounded-full border transition ${
                paidBy === opt.value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Category chips — one tap */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategoryId(c.id)}
            className={`text-xs px-2.5 py-1.5 rounded-full border transition ${
              categoryId === c.id
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white border-gray-200 text-gray-600 hover:border-orange-300'
            }`}
          >
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      {/* Optional details */}
      {showMore ? (
        <div className="space-y-3">
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="תיאור (ברירת מחדל: שם הקטגוריה)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
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
        </div>
      ) : (
        <button type="button" onClick={() => setShowMore(true)} className="text-xs text-orange-600 hover:underline">
          + תיאור / תאריך / הערות
        </button>
      )}

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={!amountNum} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 rounded-xl transition text-sm disabled:opacity-50">
          הוסיפי הוצאה
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2.5 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition text-sm">
          ביטול
        </button>
      </div>
    </form>
  )
}
