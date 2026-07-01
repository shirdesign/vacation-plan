import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import NavBar from '@/components/ui/NavBar'
import BudgetClient from '@/components/budget/BudgetClient'
import Link from 'next/link'

export default async function BudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!trip) notFound()

  const [{ data: categories }, { data: expenses }] = await Promise.all([
    supabase.from('budget_categories').select('*').eq('trip_id', id).order('sort_order'),
    supabase.from('expenses').select('*, budget_categories(name, icon), trip_days(date)').eq('trip_id', id).order('date', { ascending: false }),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar user={user} />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/trips/${id}`} className="text-gray-400 hover:text-gray-600">←</Link>
          <div>
            <h1 className="text-xl font-bold text-gray-800">תקציב והוצאות</h1>
            <p className="text-sm text-gray-500">{trip.name}</p>
          </div>
        </div>
        <BudgetClient
          trip={trip}
          initialCategories={categories || []}
          initialExpenses={expenses || []}
        />
      </main>
    </div>
  )
}
