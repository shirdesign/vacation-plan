'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trip, BudgetCategory, Expense, ExpensePayer, TripFlight } from '@/lib/types'
import AddExpenseForm from './AddExpenseForm'
import BudgetPlanner from './BudgetPlanner'
import FlightsSection from '@/components/trips/FlightsSection'
import { format, parseISO } from 'date-fns'

export default function BudgetClient({
  trip,
  initialCategories,
  initialExpenses,
  flights,
}: {
  trip: Trip
  initialCategories: BudgetCategory[]
  initialExpenses: Expense[]
  flights: TripFlight[]
}) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [categories, setCategories] = useState<BudgetCategory[]>(initialCategories)
  const [showAdd, setShowAdd] = useState(false)
  const [filterCat, setFilterCat] = useState<string>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ description: '', amount: '', date: '', category_id: '', paid_by: 'me' as ExpensePayer })
  const supabase = createClient()

  const meName = trip.traveler_name || 'אני'
  const compName = trip.companion_name
  const hasCompanion = !!compName
  const PAYER_LABEL: Record<ExpensePayer, string> = {
    me: meName,
    companion: compName || 'חבר/ה',
    shared: 'משותף',
  }

  // Flights create/update/delete their own expenses — refetch to stay in sync
  async function refetchExpenses() {
    const { data } = await supabase
      .from('expenses')
      .select('*, budget_categories(name, icon), trip_days(date)')
      .eq('trip_id', trip.id)
      .order('date', { ascending: false })
    if (data) setExpenses(data as Expense[])
  }

  function startEdit(e: Expense) {
    setEditingId(e.id)
    setEditForm({
      description: e.description,
      amount: String(e.amount),
      date: e.date,
      category_id: e.category_id || '',
      paid_by: e.paid_by || 'me',
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
        paid_by: editForm.paid_by,
      })
      .eq('id', editingId)
      .select('*, budget_categories(name, icon), trip_days(date)')
      .single()
    if (data) setExpenses(prev => prev.map(e => e.id === editingId ? data as Expense : e))
    setEditingId(null)
  }

  const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  // Per-traveler split: own expenses + half of shared
  const spentBy = (payer: ExpensePayer) =>
    expenses.filter(e => (e.paid_by || 'me') === payer).reduce((s, e) => s + Number(e.amount), 0)
  const sharedSpent = spentBy('shared')
  const meSpent = spentBy('me') + sharedSpent / 2
  const compSpent = spentBy('companion') + sharedSpent / 2

  const combinedBudget = trip.total_budget + (hasCompanion ? Number(trip.companion_budget || 0) : 0)
  const remaining = combinedBudget - totalSpent
  const spentPct = combinedBudget > 0 ? Math.min((totalSpent / combinedBudget) * 100, 100) : 0

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
        <h2 className="font-semibold text-gray-700 mb-4">
          סיכום תקציב{hasCompanion && <span className="text-sm font-normal text-gray-400"> · {meName} + {compName} ביחד</span>}
        </h2>
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
          <div className="text-center p-3 bg-gray-50 rounded-xl">
            <div className="text-lg sm:text-xl font-bold text-gray-800">{combinedBudget.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">תקציב כולל</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-xl">
            <div className="text-lg sm:text-xl font-bold text-orange-500">{totalSpent.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">הוצא עד כה</div>
          </div>
          <div className={`text-center p-3 rounded-xl ${remaining >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className={`text-lg sm:text-xl font-bold ${remaining >= 0 ? 'text-green-600' : 'text-red-500'}`}>
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
          <div className={`mt-3 pt-3 border-t border-gray-100 text-xs flex flex-wrap gap-1 items-center justify-between ${
            totalPlanned > combinedBudget ? 'text-red-500' : 'text-gray-500'
          }`}>
            <span>סך הקטגוריות המשוערות: <strong>{totalPlanned.toLocaleString()} {trip.currency}</strong></span>
            <span>
              {totalPlanned > combinedBudget
                ? `⚠️ ${(totalPlanned - combinedBudget).toLocaleString()} מעל התקציב`
                : `${(combinedBudget - totalPlanned).toLocaleString()} לא הוקצה`}
            </span>
          </div>
        )}
      </div>

      {/* Per-traveler split */}
      {hasCompanion && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-700 mb-1">👯 מי הוציאה כמה</h2>
          <p className="text-xs text-gray-400 mb-4">הוצאות משותפות מתחלקות חצי-חצי · {sharedSpent > 0 ? `${sharedSpent.toLocaleString()} ${trip.currency} משותפות עד כה` : 'אין עדיין הוצאות משותפות'}</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { name: meName, budget: trip.total_budget, spent: meSpent, color: 'blue' },
              { name: compName!, budget: Number(trip.companion_budget || 0), spent: compSpent, color: 'purple' },
            ].map(p => {
              const left = p.budget - p.spent
              const pct = p.budget > 0 ? Math.min((p.spent / p.budget) * 100, 100) : 0
              return (
                <div key={p.name} className={`rounded-xl p-3 ${p.color === 'blue' ? 'bg-blue-50' : 'bg-purple-50'}`}>
                  <div className={`font-semibold text-sm mb-2 ${p.color === 'blue' ? 'text-blue-700' : 'text-purple-700'}`}>{p.name}</div>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between"><span>תקציב</span><strong>{p.budget > 0 ? p.budget.toLocaleString() : '—'}</strong></div>
                    <div className="flex justify-between"><span>הוציאה</span><strong>{p.spent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></div>
                    <div className="flex justify-between">
                      <span>נשאר</span>
                      <strong className={p.budget > 0 ? (left >= 0 ? 'text-green-600' : 'text-red-500') : 'text-gray-400'}>
                        {p.budget > 0 ? left.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                      </strong>
                    </div>
                  </div>
                  {p.budget > 0 && (
                    <div className="w-full bg-white rounded-full h-1.5 mt-2">
                      <div
                        className={`h-1.5 rounded-full ${pct > 90 ? 'bg-red-400' : p.color === 'blue' ? 'bg-blue-400' : 'bg-purple-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {Number(trip.companion_budget || 0) === 0 && (
            <p className="text-xs text-gray-400 mt-3">💡 אפשר להגדיר תקציב ל{compName} בעמוד עריכת הטיול</p>
          )}
        </div>
      )}

      {/* Planned vs actual comparison */}
      <BudgetPlanner
        tripId={trip.id}
        currency={trip.currency}
        categories={catSpending}
        onCategoriesChange={setCategories}
      />

      {/* Domestic flights — booked flights turn into expenses automatically */}
      <FlightsSection
        tripId={trip.id}
        currency={trip.currency}
        startDate={trip.start_date}
        endDate={trip.end_date}
        initialFlights={flights}
        onExpensesChanged={refetchExpenses}
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
          travelerName={meName}
          companionName={compName}
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
                  {hasCompanion && (
                    <div className="flex gap-1.5">
                      {(['me', 'companion', 'shared'] as ExpensePayer[]).map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setEditForm(f => ({ ...f, paid_by: p }))}
                          className={`text-xs px-2.5 py-1 rounded-full border transition ${
                            editForm.paid_by === p
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white border-gray-200 text-gray-600'
                          }`}
                        >
                          {p === 'shared' ? '👯 משותף' : PAYER_LABEL[p]}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={saveEdit} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition">עדכני</button>
                    <button onClick={() => setEditingId(null)} className="text-gray-500 px-3 py-1.5 text-sm hover:text-gray-700">ביטול</button>
                  </div>
                </div>
              ) : (
              <div key={expense.id} className="flex items-center justify-between px-5 py-3 gap-2 group">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg flex-shrink-0">
                    {expense.budget_categories?.icon || '💰'}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{expense.description}</div>
                    <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap items-center gap-x-1.5">
                      <span>{expense.budget_categories?.name} · {format(parseISO(expense.date), 'dd/MM')}</span>
                      {hasCompanion && (expense.paid_by || 'me') !== 'me' && (
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                          expense.paid_by === 'shared' ? 'bg-green-50 text-green-600' : 'bg-purple-50 text-purple-600'
                        }`}>
                          {expense.paid_by === 'shared' ? '👯 משותף' : compName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="font-semibold text-gray-800 text-sm sm:text-base">
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
