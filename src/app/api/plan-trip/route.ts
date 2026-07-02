import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { eachDayOfInterval, parseISO, format } from 'date-fns'

export const maxDuration = 300

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD' },
          title: { type: 'string', description: 'כותרת היום בעברית' },
          location_name: { type: 'string', description: 'עיר/אזור' },
          notes: { type: 'string', description: 'הערות ליום — מלונות, טיפים' },
          events: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                start_time: { type: 'string', description: 'HH:MM או ריק' },
                title: { type: 'string' },
                description: { type: 'string' },
                location: { type: 'string' },
              },
              required: ['title'],
              additionalProperties: false,
            },
          },
        },
        required: ['date', 'title', 'location_name', 'events'],
        additionalProperties: false,
      },
    },
    tips: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          location: { type: 'string' },
          category: { type: 'string', enum: ['general', 'food', 'transport', 'hotel', 'shopping'] },
          tip: { type: 'string' },
        },
        required: ['location', 'category', 'tip'],
        additionalProperties: false,
      },
    },
  },
  required: ['days', 'tips'],
  additionalProperties: false,
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { tripId, preferences } = await request.json()

  // Verify ownership + load trip
  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .eq('user_id', user.id)
    .single()
  if (!trip) return NextResponse.json({ error: 'trip not found' }, { status: 404 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'חסר מפתח API של Anthropic. הוסיפי ANTHROPIC_API_KEY למשתני הסביבה.' },
      { status: 500 },
    )
  }

  // Only plan days that are still empty
  const { data: existingDays } = await supabase
    .from('trip_days')
    .select('date, title, location_name')
    .eq('trip_id', tripId)

  const plannedDates = new Set(
    (existingDays || []).filter(d => d.title || d.location_name).map(d => d.date),
  )
  const allDates = eachDayOfInterval({
    start: parseISO(trip.start_date),
    end: parseISO(trip.end_date),
  }).map(d => format(d, 'yyyy-MM-dd'))
  const emptyDates = allDates.filter(d => !plannedDates.has(d))

  if (emptyDates.length === 0) {
    return NextResponse.json({ error: 'כל הימים כבר מתוכננים! מחקי ימים כדי לתכנן מחדש.' }, { status: 400 })
  }

  const anthropic = new Anthropic()

  const prompt = `תכנני מסלול טיול מפורט בעברית.

פרטי הטיול:
- שם: ${trip.name}
- יעד: ${trip.destination}
- תאריכים: ${trip.start_date} עד ${trip.end_date}
- תקציב כולל: ${trip.total_budget} ${trip.currency}
- תיאור: ${trip.description || 'אין'}
${preferences ? `- העדפות המשתמשת: ${preferences}` : ''}

ימים שכבר מתוכננים (אל תתכנני אותם מחדש):
${[...plannedDates].sort().join(', ') || 'אין'}

תכנני רק את הימים הבאים: ${emptyDates.join(', ')}

הנחיות:
- כל התוכן בעברית
- לכל יום: כותרת, מיקום (עיר, מדינה), והערות שימושיות
- 2-4 אירועים ליום עם שעות הגיוניות (אטרקציות, מסעדות, מנוחה)
- ימי שישי/שבת: תכנון רגוע יותר, ציון אם יש בית חב"ד באזור
- ימי הגעה/עזיבה: תכנון קל
- טיפים מעשיים לכל עיר (תחבורה, אוכל, קניות)
- התאימי את הקצב לתקציב היומי (~${Math.round(trip.total_budget / allDates.length)} ${trip.currency} ליום)`

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 32000,
      output_config: { format: { type: 'json_schema', schema: PLAN_SCHEMA } },
      messages: [{ role: 'user', content: prompt }],
    })
    const message = await stream.finalMessage()

    if (message.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'הבקשה נדחתה, נסי שוב' }, { status: 500 })
    }

    const textBlock = message.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'לא התקבלה תשובה' }, { status: 500 })
    }
    const plan = JSON.parse(textBlock.text) as {
      days: { date: string; title: string; location_name: string; notes?: string; events?: { start_time?: string; title: string; description?: string; location?: string }[] }[]
      tips: { location: string; category: string; tip: string }[]
    }

    // Insert days (only for dates we asked about)
    const emptySet = new Set(emptyDates)
    let daysCreated = 0
    for (const day of plan.days) {
      if (!emptySet.has(day.date)) continue
      const { data: existing } = await supabase
        .from('trip_days')
        .select('id')
        .eq('trip_id', tripId)
        .eq('date', day.date)
        .maybeSingle()

      let dayId: string
      if (existing) {
        await supabase
          .from('trip_days')
          .update({ title: day.title, location_name: day.location_name, notes: day.notes || null })
          .eq('id', existing.id)
        dayId = existing.id
      } else {
        const { data: inserted } = await supabase
          .from('trip_days')
          .insert({
            trip_id: tripId,
            date: day.date,
            title: day.title,
            location_name: day.location_name,
            notes: day.notes || null,
          })
          .select('id')
          .single()
        if (!inserted) continue
        dayId = inserted.id
      }
      daysCreated++

      if (day.events?.length) {
        await supabase.from('day_events').insert(
          day.events.map((e, i) => ({
            day_id: dayId,
            start_time: e.start_time || null,
            title: e.title,
            description: e.description || null,
            location: e.location || null,
            status: 'planned',
            sort_order: i,
          })),
        )
      }
    }

    // Insert tips (skip duplicates by location+tip text)
    const { data: existingTips } = await supabase
      .from('trip_tips')
      .select('tip')
      .eq('trip_id', tripId)
    const existingTipTexts = new Set((existingTips || []).map(t => t.tip))
    const newTips = plan.tips.filter(t => !existingTipTexts.has(t.tip))
    if (newTips.length) {
      await supabase.from('trip_tips').insert(
        newTips.map((t, i) => ({
          trip_id: tripId,
          location: t.location,
          category: t.category,
          tip: t.tip,
          sort_order: i,
        })),
      )
    }

    return NextResponse.json({ daysCreated, tipsCreated: newTips.length })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `שגיאה בתכנון: ${msg}` }, { status: 500 })
  }
}
