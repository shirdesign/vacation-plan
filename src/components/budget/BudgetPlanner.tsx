'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BudgetCategory } from '@/lib/types'

const ICONS = ['💰', '✈️', '🏨', '🍽️', '🎡', '🚌', '🛍️', '🎲', '🆘', '🎁', '☕', '💊', '🎫', '⛽']

type CatWithSpent = BudgetCategory & { spent: number }

export default function BudgetPlanner({
  tripId,
  currency,
  categories,
  onCategoriesChange,
}: {
  tripId: string
  currency: string
  categories: CatWithSpent[]
  onCategoriesChange: (cats: BudgetCategory[]) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showAddCat, setShowAddCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('💰')
  const [newCatPlanned, setNewCatPlanned] = useState('')
  const supabase = createClient()

  const totalPlanned = categories.reduce((s, c) => s + Number(c.planned_amount || 0), 0)
  const totalSpent = categories.reduce((s, c) => s + c.spent, 0)
  const totalDiff = totalPlanned - totalSpent

  function baseCats(cats: CatWithSpent[]): BudgetCategory[] {
    return cats.map(({ spent: _spent, ...rest }) => rest)
  }

  async function savePlanned(cat: CatWithSpent) {
    const amount = parseFloat(editValue) || 0
    await supabase.from('budget_categories').update({ planned_amount: amount }).eq('id', cat.id)
    onCategoriesChange(baseCats(categories).map(c => c.id === cat.id ? { ...c, planned_amount: amount } : c))
    setEditingId(null)
  }

  async function addCategory() {
    if (!newCatName.trim()) return
    const { data } = await supabase
      .from('budget_categories')
      .insert({
        trip_id: tripId,
        name: newCatName.trim(),
        icon: newCatIcon,
        planned_amount: parseFloat(newCatPlanned) || 0,
        sort_order: categories.length + 1,
      })
      .select()
      .single()
    if (data) {
      onCategoriesChange([...baseCats(categories), data as BudgetCategory])
      setNewCatName(''); setNewCatPlanned(''); setNewCatIcon('💰'); setShowAddCat(false)
    }
  }

  async function deleteCategory(id: string) {
    await supabase.from('budget_categories').delete().eq('id', id)
    onCategoriesChange(baseCats(categories).filter(c => c.id !== id))
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-700">משוער מול בפועל</h2>
        <button onClick={() => setShowAddCat(true)} className="text-xs text-blue-600 hover:underline">
          + קטגוריה
        </button>
      </div>

      {/* Header row */}
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-xs text-gray-400 font-medium px-1 pb-2 border-b border-gray-100">
        <span>קטגוריה</span>
        <span className="w-20 text-left">משוער</span>
        <span className="w-20 text-left">בפועל</span>
        <span className="w-20 text-left">הפרש</span>
      </div>

      <div className="divide-y divide-gray-50">
        {categories.map(cat => {
          const planned = Number(cat.planned_amount || 0)
          const diff = planned - cat.spent
          const overBudget = planned > 0 && cat.spent > planned
          const pct = planned > 0 ? Math.min((cat.spent / planned) * 100, 100) : 0
          return (
            <div key={cat.id} className="py-2.5 group">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center text-sm">
                <span className="flex items-center gap-1.5 truncate">
                  {cat.icon} {cat.name}
                  {cat.is_fixed && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">קבוע</span>}
                </span>

                {/* Planned — editable */}
                {editingId === cat.id ? (
                  <input
                    type="number"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={() => savePlanned(cat)}
                    onKeyDown={e => e.key === 'Enter' && savePlanned(cat)}
                    autoFocus
                    className="w-20 text-left border border-blue-300 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                ) : (
                  <button
                    onClick={() => { setEditingId(cat.id); setEditValue(String(planned)) }}
                    className="w-20 text-left text-gray-500 hover:text-blue-600 hover:underline"
                  >
                    {planned.toLocaleString()}
                  </button>
                )}

                <span className="w-20 text-left font-medium text-gray-800">{cat.spent.toLocaleString()}</span>

                <span className={`w-20 text-left font-medium ${diff < 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {diff >= 0 ? '+' : ''}{diff.toLocaleString()}
                </span>
              </div>

              {planned > 0 && (
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${overBudget ? 'bg-red-400' : 'bg-blue-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 w-8 text-left">{Math.round((cat.spent / planned) * 100)}%</span>
                  <button
                    onClick={() => deleteCategory(cat.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs transition"
                  >✕</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Totals row */}
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center text-sm mt-3 pt-3 border-t-2 border-gray-200 font-bold">
        <span className="text-gray-700">סה״כ</span>
        <span className="w-20 text-left text-gray-500">{totalPlanned.toLocaleString()}</span>
        <span className="w-20 text-left text-gray-800">{totalSpent.toLocaleString()}</span>
        <span className={`w-20 text-left ${totalDiff < 0 ? 'text-red-500' : 'text-green-600'}`}>
          {totalDiff >= 0 ? '+' : ''}{totalDiff.toLocaleString()}
        </span>
      </div>
      <p className="text-xs text-gray-400 mt-2">
        💡 הפרש חיובי = חסכת מהמשוער · הפרש שלילי = חריגה · לחצי על סכום משוער כדי לערוך ({currency})
      </p>

      {/* Add category form */}
      {showAddCat && (
        <div className="mt-4 border border-blue-200 rounded-xl p-4 bg-blue-50 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {ICONS.map(ic => (
              <button
                key={ic}
                type="button"
                onClick={() => setNewCatIcon(ic)}
                className={`w-8 h-8 rounded-lg text-lg ${newCatIcon === ic ? 'bg-blue-500 ring-2 ring-blue-300' : 'bg-white border border-gray-200'}`}
              >{ic}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              placeholder="שם הקטגוריה *"
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <input
              type="number"
              value={newCatPlanned}
              onChange={e => setNewCatPlanned(e.target.value)}
              placeholder={`סכום משוער (${currency})`}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={addCategory} className="flex-1 bg-blue-600 text-white text-sm py-2 rounded-lg hover:bg-blue-700">שמרי</button>
            <button onClick={() => setShowAddCat(false)} className="flex-1 bg-gray-200 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-300">ביטול</button>
          </div>
        </div>
      )}
    </div>
  )
}
