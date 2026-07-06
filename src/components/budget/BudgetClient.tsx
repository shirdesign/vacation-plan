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
  const [flightCount, setFlightCount] = useState(flights.length)
  const [showAdd, setShowAdd] = useState(false)
  const [filterCat, setFilterCat] = useState<string>('all')
  const [filterPayer, setFilterPayer] = useState<'all' | ExpensePayer>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ description: '', amount: '', date: '', category_id: '', paid_by: 'me' as ExpensePayer, shared_payer: null as 'me' | 'companion' | null })
  const [person, setPerson] = useState<'me' | 'companion'>('me')
  const supabase = createClient()

  const meName = trip.traveler_name || 'אני'
  const compName = trip.companion_name
  const hasCompanion = !!compName
  const PAYER_LABEL: Record<ExpensePayer, string> = {
    me: meName,
    companion: compName || 'חבר/ה',
    shared: 'משותף',
  }

  // Flights create/update/delete their own expenses (and may create the
  // "טיסות פנים" category) — refetch both to stay in sync
  async function refetchExpenses() {
    const [{ data: exp }, { data: cats }] = await Promise.all([
      supabase
        .from('expenses')
        .select('*, budget_categories(name, icon), trip_days(date)')
        .eq('trip_id', trip.id)
        .order('date', { ascending: false }),
      supabase.from('budget_categories').select('*').eq('trip_id', trip.id).order('sort_order'),
    ])
    if (exp) setExpenses(exp as Expense[])
    if (cats) setCategories(cats as BudgetCategory[])
  }

  function startEdit(e: Expense) {
    setEditingId(e.id)
    setEditForm({
      description: e.description,
      amount: String(e.amount),
      date: e.date,
      category_id: e.category_id || '',
      paid_by: e.paid_by || 'me',
      shared_payer: e.shared_payer || null,
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
        shared_payer: editForm.paid_by === 'shared' ? editForm.shared_payer : null,
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

  // Settling up: when one traveler fronted a shared expense, the other owes her half.
  // shared_payer=null means they split at the register — no debt.
  const owedToMe = expenses
    .filter(e => e.paid_by === 'shared' && e.shared_payer === 'me')
    .reduce((s, e) => s + Number(e.amount) / 2, 0)
  const owedToComp = expenses
    .filter(e => e.paid_by === 'shared' && e.shared_payer === 'companion')
    .reduce((s, e) => s + Number(e.amount) / 2, 0)
  const settleNet = owedToMe - owedToComp // >0: companion owes me

  // The budget being viewed: with a companion each traveler has her own full
  // budget (summary, categories, planned amounts); shared expenses count half for each
  const plannedKey: 'planned_amount' | 'companion_planned_amount' =
    hasCompanion && person === 'companion' ? 'companion_planned_amount' : 'planned_amount'
  const personName = person === 'me' ? meName : (compName || '')
  const viewBudget = hasCompanion
    ? (person === 'me' ? trip.total_budget : Number(trip.companion_budget || 0))
    : trip.total_budget
  const viewSpent = hasCompanion ? (person === 'me' ? meSpent : compSpent) : totalSpent
  const remaining = viewBudget - viewSpent
  const spentPct = viewBudget > 0 ? Math.min((viewSpent / viewBudget) * 100, 100) : 0

  // Per-category spending for the viewed traveler
  const catSpending = categories.map(cat => {
    const catExp = expenses.filter(e => e.category_id === cat.id)
    let spent: number
    if (!hasCompanion) {
      spent = catExp.reduce((s, e) => s + Number(e.amount), 0)
    } else {
      const own = catExp.filter(e => (e.paid_by || 'me') === person).reduce((s, e) => s + Number(e.amount), 0)
      const sharedHalf = catExp.filter(e => e.paid_by === 'shared').reduce((s, e) => s + Number(e.amount), 0) / 2
      spent = own + sharedHalf
    }
    return { ...cat, spent }
  })

  const totalPlanned = categories.reduce((s, c) => s + Number(c[plannedKey] || 0), 0)

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

  // One tap on an expense's tag cycles: mine → hers → shared
  async function cyclePayer(e: Expense) {
    const order: ExpensePayer[] = ['me', 'companion', 'shared']
    const next = order[(order.indexOf(e.paid_by || 'me') + 1) % order.length]
    await supabase.from('expenses').update({ paid_by: next, shared_payer: null }).eq('id', e.id)
    setExpenses(prev => prev.map(x => x.id === e.id ? { ...x, paid_by: next, shared_payer: null } : x))
  }

  const PAYER_TAG_STYLE: Record<ExpensePayer, string> = {
    me: 'bg-blue-50 text-blue-600 border-blue-200',
    companion: 'bg-purple-50 text-purple-600 border-purple-200',
    shared: 'bg-green-50 text-green-600 border-green-200',
  }

  const filtered = expenses
    .filter(e => filterCat === 'all' || e.category_id === filterCat)
    .filter(e => filterPayer === 'all' || (e.paid_by || 'me') === filterPayer)

  return (
    <div className="space-y-5">
      {/* Whose budget are we looking at */}
      {hasCompanion && (
        <div className="grid grid-cols-2 bg-gray-100 rounded-xl p-1 gap-1">
          {([
            { value: 'me' as const, label: meName },
            { value: 'companion' as const, label: compName! },
          ]).map(opt => (
            <button
              key={opt.value}
              onClick={() => setPerson(opt.value)}
              className={`py-2.5 rounded-lg text-sm font-semibold transition ${
                person === opt.value
                  ? opt.value === 'me' ? 'bg-white shadow text-blue-600' : 'bg-white shadow text-purple-600'
                  : 'text-gray-500'
              }`}
            >
              💰 התקציב של {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Budget overview — the viewed traveler's own numbers */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-700 mb-4">
          {hasCompanion ? `סיכום תקציב — ${personName}` : 'סיכום תקציב'}
        </h2>
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
          <div className="text-center p-3 bg-gray-50 rounded-xl">
            <div className="text-lg sm:text-xl font-bold text-gray-800">{viewBudget.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">תקציב</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-xl">
            <div className="text-lg sm:text-xl font-bold text-orange-500">{viewSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div className="text-xs text-gray-500 mt-1">הוצא עד כה</div>
          </div>
          <div className={`text-center p-3 rounded-xl ${remaining >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className={`text-lg sm:text-xl font-bold ${remaining >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}
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
        <p className="text-xs text-gray-400 mt-1 flex justify-between">
          <span>{hasCompanion ? 'כולל מחצית מההוצאות המשותפות' : ''}</span>
          <span>{spentPct.toFixed(1)}% מהתקציב ({trip.currency})</span>
        </p>

        {/* Planned total vs the viewed traveler's budget */}
        {totalPlanned > 0 && (
          <div className={`mt-3 pt-3 border-t border-gray-100 text-xs flex flex-wrap gap-1 items-center justify-between ${
            totalPlanned > viewBudget ? 'text-red-500' : 'text-gray-500'
          }`}>
            <span>הקטגוריות המשוערות של {hasCompanion ? personName : 'הטיול'}: <strong>{totalPlanned.toLocaleString()} {trip.currency}</strong></span>
            <span>
              {totalPlanned > viewBudget
                ? `⚠️ ${(totalPlanned - viewBudget).toLocaleString()} מעל התקציב`
                : `${(viewBudget - totalPlanned).toLocaleString()} לא הוקצה`}
            </span>
          </div>
        )}
      </div>

      {/* Joint view: who spent what + settling up */}
      {hasCompanion && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-700 mb-1">👯 שתיהן ביחד</h2>
          <p className="text-xs text-gray-400 mb-3">
            {sharedSpent > 0 ? `${sharedSpent.toLocaleString()} ${trip.currency} הוצאות משותפות עד כה (מתחלקות חצי-חצי)` : 'אין עדיין הוצאות משותפות'}
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {[
              { name: meName, budget: trip.total_budget, spent: meSpent, color: 'blue' },
              { name: compName!, budget: Number(trip.companion_budget || 0), spent: compSpent, color: 'purple' },
            ].map(p => {
              const left = p.budget - p.spent
              return (
                <div key={p.name} className={`rounded-xl px-3 py-2 text-xs ${p.color === 'blue' ? 'bg-blue-50' : 'bg-purple-50'}`}>
                  <span className={`font-semibold ${p.color === 'blue' ? 'text-blue-700' : 'text-purple-700'}`}>{p.name}</span>
                  <span className="text-gray-500"> · הוציאה {p.spent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  {p.budget > 0 && (
                    <span className={left >= 0 ? 'text-green-600' : 'text-red-500'}> · נשאר {left.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Who owes whom */}
          <div className={`rounded-xl px-4 py-3 text-sm font-medium text-center ${
            settleNet === 0 ? 'bg-gray-50 text-gray-500' : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            {settleNet === 0
              ? '💸 מאוזנות — אף אחת לא חייבת כלום'
              : settleNet > 0
                ? <>💸 <strong>{compName}</strong> חייבת ל<strong>{meName}</strong> {Math.abs(settleNet).toLocaleString(undefined, { maximumFractionDigits: 0 })} {trip.currency}</>
                : <>💸 <strong>{meName}</strong> חייבת ל<strong>{compName}</strong> {Math.abs(settleNet).toLocaleString(undefined, { maximumFractionDigits: 0 })} {trip.currency}</>}
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5 text-center">
            לפי הוצאות משותפות שאחת מכן שילמה לבד (בהוצאה משותפת מסמנים מי הוציאה את הכסף)
          </p>
        </div>
      )}

      {/* Planned vs actual — the viewed traveler's own categories; flights managed inside their category */}
      <BudgetPlanner
        tripId={trip.id}
        currency={trip.currency}
        categories={catSpending}
        onCategoriesChange={setCategories}
        plannedKey={plannedKey}
        personName={hasCompanion ? personName : undefined}
        flightsCount={flightCount}
        flightsPanel={
          <FlightsSection
            embedded
            tripId={trip.id}
            currency={trip.currency}
            startDate={trip.start_date}
            endDate={trip.end_date}
            initialFlights={flights}
            onExpensesChanged={refetchExpenses}
            onFlightsChange={setFlightCount}
          />
        }
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
          defaultPayer={hasCompanion ? person : 'me'}
          onAdd={addExpense}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* Expenses list */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b border-gray-100">
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
          {hasCompanion && (
            <div className="flex gap-1.5 w-full sm:w-auto">
              {([
                { value: 'all' as const, label: 'הכל' },
                { value: 'me' as const, label: meName },
                { value: 'companion' as const, label: compName! },
                { value: 'shared' as const, label: '👯 משותף' },
              ]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFilterPayer(opt.value)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${
                    filterPayer === opt.value
                      ? 'bg-gray-800 text-white border-gray-800'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
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
                    <div className="flex flex-wrap gap-1.5">
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
                  {hasCompanion && editForm.paid_by === 'shared' && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-gray-500">מי הוציאה את הכסף?</span>
                      {([
                        { value: null, label: 'חצי-חצי' },
                        { value: 'me' as const, label: meName },
                        { value: 'companion' as const, label: compName! },
                      ]).map(opt => (
                        <button
                          key={String(opt.value)}
                          type="button"
                          onClick={() => setEditForm(f => ({ ...f, shared_payer: opt.value }))}
                          className={`text-xs px-2.5 py-1 rounded-full border transition ${
                            editForm.shared_payer === opt.value
                              ? 'bg-green-600 text-white border-green-600'
                              : 'bg-white border-gray-200 text-gray-600'
                          }`}
                        >
                          {opt.label}
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
                    <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <span>{expense.budget_categories?.name} · {format(parseISO(expense.date), 'dd/MM')}</span>
                      {hasCompanion && (
                        <button
                          onClick={() => cyclePayer(expense)}
                          title="לחצי להחלפה: אישי / של השנייה / משותף"
                          className={`px-1.5 py-0.5 rounded-full text-[10px] border transition hover:opacity-75 ${PAYER_TAG_STYLE[expense.paid_by || 'me']}`}
                        >
                          {expense.paid_by === 'shared'
                            ? `👯 משותף${expense.shared_payer ? ` · שילמה ${PAYER_LABEL[expense.shared_payer]}` : ''}`
                            : PAYER_LABEL[expense.paid_by || 'me']}
                        </button>
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
