'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trip, BudgetCategory, Expense } from '@/lib/types'
import AddExpenseForm from './AddExpenseForm'
import BudgetPlanner from './BudgetPlanner'
import { format, parseISO } from 'date-fns'

export default function BudgetClient({
  trip,
  initialCategories,
  initialExpenses,
}: {
  trip: Trip
  initialCategories: BudgetCategory[]
  initialExpenses: Expense[]
}) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [categories, setCategories] = useState<BudgetCategory[]>(initialCategories)
  const [showAdd, setShowAdd] = useState(false)
  const [filterCat, setFilterCat] = useState<string>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ description: '', amount: '', date: '', category_id: '' })
  const supabase = createClient()

  function startEdit(e: Expense) {
    setEditingId(e.id)
    setEditForm({
      description: e.description,
      amount: String(e.amount),
      date: e.date,
      category_id: e.category_id || '',
    })
  }

  async function saveEdit() {
    if (!editingId) return
    const { data } = await supabase
      .from('expenses')
      .update({
        description: editForm.description || 'הוצאה',
        amount: parseFloat(editForm.amount) || 0,
        date: editForm.date,
        category_id: editForm.category_id || null,
      })
      .eq('id', editingId)
      .select('*, budget_categories(name, icon), trip_days(date)')
      .single()
    if (data) setExpenses(prev => prev.map(e => e.id === editingId ? data as Expense : e))
    setEditingId(null)
  }

  const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const remaining = trip.total_budget - totalSpent
  const spentPct = trip.total_budget > 0 ? Math.min((totalSpent / trip.total_budget) * 100, 100) : 0

  // Per-category spending
  const catSpending = categories.map(cat => {
    const spent = expenses.filter(e => e.category_id === cat.id).reduce((s, e) => s + Number(e.amount), 0)
    return { ...cat, spent }
  })

  const totalPlanned = categories.reduce((s, c) => s + Number(c.planned_amount || 0), 0)

  async function addExpense(data: Omit<Expense, 'id' | 'created_at'>) {
    const { data: exp } = await supabase
      .from('expenses')
      .insert({ ...data, trip_id: trip.id })
      .select('*, budget_categories(name, icon), trip_days(date)')
      .single()
    if (exp) setExpenses(prev => [exp as Expense, ...prev])
    setShowAdd(false)
  }

  async function deleteExpense(id: string) {
    await supabase.from('expenses').delete().eq('id', id)
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  const filtered = filterCat === 'all' ? expenses : expenses.filter(e => e.category_id === filterCat)

  return (
    <div className="space-y-5">
      {/* Budget overview */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-700 mb-4">סיכום תקציב</h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-gray-50 rounded-xl">
            <div className="text-xl font-bold text-gray-800">{trip.total_budget.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">תקציב כולל</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-xl">
            <div className="text-xl font-bold text-orange-500">{totalSpent.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">הוצא עד כה</div>
          </div>
          <div className={`text-center p-3 rounded-xl ${remaining >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className={`text-xl font-bold ${remaining >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {remaining.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-1">נשאר</div>
          </div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${spentPct > 90 ? 'bg-red-500' : spentPct > 70 ? 'bg-orange-400' : 'bg-green-500'}`}
            style={{ width: `${spentPct}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1 text-left">{spentPct.toFixed(1)}% מהתקציב ({trip.currency})</p>

        {/* Planned total vs trip budget */}
        {totalPlanned > 0 && (
          <div className={`mt-3 pt-3 border-t border-gray-100 text-xs flex items-center justify-between ${
            totalPlanned > trip.total_budget ? 'text-red-500' : 'text-gray-500'
          }`}>
            <span>סך הקטגוריות המשוערות: <strong>{totalPlanned.toLocaleString()} {trip.currency}</strong></span>
            <span>
              {totalPlanned > trip.total_budget
                ? `⚠️ ${(totalPlanned - trip.total_budget).toLocaleString()} מעל התקציב`
                : `${(trip.total_budget - totalPlanned).toLocaleString()} לא הוקצה`}
            </span>
          </div>
        )}
      </div>

      {/* Planned vs actual comparison */}
      <BudgetPlanner
        tripId={trip.id}
        currency={trip.currency}
        categories={catSpending}
        onCategoriesChange={setCategories}
      />

      {/* Add expense button */}
      <button
        onClick={() => setShowAdd(true)}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition"
      >
        + הוסיפי הוצאה
      </button>

      {showAdd && (
        <AddExpenseForm
          tripId={trip.id}
          currency={trip.currency}
          categories={categories}
          onAdd={addExpense}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* Expenses list */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700">כל ההוצאות</h2>
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1"
          >
            <option value="all">כל הקטגוריות</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <div className="text-3xl mb-2">💳</div>
            <p className="text-sm">אין הוצאות עדיין</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(expense => (
              editingId === expense.id ? (
                <div key={expense.id} className="px-5 py-3 bg-blue-50 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={editForm.description}
                      onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="תיאור"
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={editForm.amount}
                      onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="סכום"
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={editForm.date}
                      onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <select
                      value={editForm.category_id}
                      onChange={e => setEditForm(f => ({ ...f, category_id: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="">ללא קטגוריה</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveEdit} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition">עדכני</button>
                    <button onClick={() => setEditingId(null)} className="text-gray-500 px-3 py-1.5 text-sm hover:text-gray-700">ביטול</button>
                  </div>
                </div>
              ) : (
              <div key={expense.id} className="flex items-center justify-between px-5 py-3 group">
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {expense.budget_categories?.icon || '💰'}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-gray-800">{expense.description}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {expense.budget_categories?.name} · {format(parseISO(expense.date), 'dd/MM')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-800">
                    {Number(expense.amount).toLocaleString()} {expense.currency}
                  </span>
                  <button
                    onClick={() => startEdit(expense)}
                    className="text-xs text-blue-400 hover:text-blue-600 transition"
                  >
                    ערכי
                  </button>
                  <button
                    onClick={() => deleteExpense(expense.id)}
                    className="text-gray-300 hover:text-red-400 transition text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              </div>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
