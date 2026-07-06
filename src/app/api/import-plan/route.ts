import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import type { ImportedDay } from '@/lib/importPlan'

export const maxDuration = 300

const EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD' },
          title: { type: 'string', description: 'כותרת היום כפי שמופיעה בטקסט' },
          location_name: { type: 'string', description: 'עיר/אזור' },
          notes: { type: 'string', description: 'הערות ליום' },
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
        required: ['date', 'events'],
        additionalProperties: false,
      },
    },
  },
  required: ['days'],
  additionalProperties: false,
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { tripId, days: parsedDays, text, useAi } = await request.json() as {
    tripId: string
    days?: ImportedDay[]
    text?: string
    useAi?: boolean
  }

  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .eq('user_id', user.id)
    .single()
  if (!trip) return NextResponse.json({ error: 'trip not found' }, { status: 404 })

  let days: ImportedDay[]

  if (useAi) {
    if (!text?.trim()) {
      return NextResponse.json({ error: 'הקובץ ריק' }, { status: 400 })
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'חסר מפתח API של Anthropic. הוסיפי ANTHROPIC_API_KEY למשתני הסביבה.' },
        { status: 500 },
      )
    }

    const anthropic = new Anthropic()
    const prompt = `חלצי את תכנון הטיול מהטקסט הבא והמירי אותו למבנה JSON.

פרטי הטיול (לפענוח תאריכים חלקיים או "יום 3"):
- תאריכים: ${trip.start_date} עד ${trip.end_date}
- יעד: ${trip.destination}

הנחיות:
- חלצי רק מה שכתוב בטקסט — אל תמציאי פעילויות, ימים או טיפים שלא מופיעים בו
- תאריך בלי שנה מקבל את שנת הטיול; "יום N" נספר מתאריך ההתחלה
- שמרי על ניסוח המקור (אפשר לקצר כותרות ארוכות מאוד)
- שעות בפורמט HH:MM אם צוינו, אחרת השאירי ריק

הטקסט:
${text.slice(0, 100000)}`

    try {
      const stream = anthropic.messages.stream({
        model: 'claude-opus-4-8',
        max_tokens: 32000,
        output_config: { format: { type: 'json_schema', schema: EXTRACT_SCHEMA } },
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
      days = (JSON.parse(textBlock.text) as { days: ImportedDay[] }).days
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return NextResponse.json({ error: `שגיאה בניתוח הקובץ: ${msg}` }, { status: 500 })
    }
  } else {
    if (!Array.isArray(parsedDays) || parsedDays.length === 0) {
      return NextResponse.json({ error: 'לא נמצאו ימים לייבוא' }, { status: 400 })
    }
    days = parsedDays
  }

  // Insert: merge into existing days — fill empty fields, append events
  let daysImported = 0
  let eventsImported = 0
  let skippedOutOfRange = 0

  for (const day of days) {
    if (!day?.date || !/^\d{4}-\d{2}-\d{2}$/.test(day.date)) continue
    if (day.date < trip.start_date || day.date > trip.end_date) {
      skippedOutOfRange++
      continue
    }

    const { data: existing } = await supabase
      .from('trip_days')
      .select('id, title, location_name, notes')
      .eq('trip_id', tripId)
      .eq('date', day.date)
      .maybeSingle()

    let dayId: string
    if (existing) {
      const patch: Record<string, string> = {}
      if (day.title && !existing.title) patch.title = day.title
      if (day.location_name && !existing.location_name) patch.location_name = day.location_name
      if (day.notes && !existing.notes) patch.notes = day.notes
      if (Object.keys(patch).length) {
        await supabase.from('trip_days').update(patch).eq('id', existing.id)
      }
      dayId = existing.id
    } else {
      const { data: inserted } = await supabase
        .from('trip_days')
        .insert({
          trip_id: tripId,
          date: day.date,
          title: day.title || null,
          location_name: day.location_name || null,
          notes: day.notes || null,
        })
        .select('id')
        .single()
      if (!inserted) continue
      dayId = inserted.id
    }
    daysImported++

    const events = (day.events || []).filter(e => e?.title)
    if (events.length) {
      const { count } = await supabase
        .from('day_events')
        .select('id', { count: 'exact', head: true })
        .eq('day_id', dayId)
      const base = count || 0

      const { error: eventsError } = await supabase.from('day_events').insert(
        events.map((e, i) => ({
          day_id: dayId,
          start_time: e.start_time || null,
          title: e.title,
          description: e.description || null,
          location: e.location || null,
          status: 'planned',
          sort_order: base + i,
        })),
      )
      if (!eventsError) eventsImported += events.length
    }
  }

  return NextResponse.json({ daysImported, eventsImported, skippedOutOfRange })
}
