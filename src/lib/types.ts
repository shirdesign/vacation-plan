export type Trip = {
  id: string
  user_id: string
  name: string
  destination: string
  start_date: string
  end_date: string
  description?: string
  total_budget: number
  daily_budget: number
  currency: string
  share_token: string
  share_show_itinerary: boolean
  share_show_budget: boolean
  created_at: string
  updated_at: string
}

export type TripDay = {
  id: string
  trip_id: string
  date: string
  title?: string
  notes?: string
  location_name?: string
  location_lat?: number
  location_lng?: number
}

export type DayEvent = {
  id: string
  day_id: string
  start_time?: string
  end_time?: string
  title: string
  description?: string
  location?: string
  status: 'planned' | 'done' | 'cancelled'
  sort_order: number
}

export type BudgetCategory = {
  id: string
  trip_id: string
  name: string
  planned_amount: number
  icon: string
  sort_order: number
}

export type ChecklistItem = {
  id: string
  trip_id: string
  text: string
  is_done: boolean
  sort_order: number
  created_at: string
}

export type EmergencyContact = {
  id: string
  trip_id: string
  name: string
  role?: string
  phone?: string
  notes?: string
  sort_order: number
}

export type TripTip = {
  id: string
  trip_id: string
  location: string
  category: string
  tip: string
  source?: string
  sort_order: number
}

export type Expense = {
  id: string
  trip_id: string
  day_id?: string
  category_id?: string
  description: string
  amount: number
  currency: string
  date: string
  notes?: string
  created_at: string
  budget_categories?: BudgetCategory
  trip_days?: TripDay
}
