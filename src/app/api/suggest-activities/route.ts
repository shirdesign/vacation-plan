import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 120

const ACTIVITIES_SCHEMA = {
  type: 'object',
  properties: {
    activities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'שם הפעילות בעברית' },
          description: { type: 'string', description: 'משפט-שניים על הפעילות' },
          category: { type: 'string', enum: ['attraction', 'food', 'nature', 'shopping', 'culture', 'family'] },
          est_cost: { type: 'number', description: 'עלות משוערת לאדם במטבע הטיול, 0 אם חינם' },
        },
        required: ['title', 'description', 'category'],
        additionalProperties: false,
      },
    },
  },
  required: ['activities'],
  additionalProperties: false,
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { tripId, location } = await request.json()
  if (!location) return NextResponse.json({ error: 'missing location' }, { status: 400 })

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

  const { data: existing } = await supabase
    .from('place_activities')
    .select('title')
    .eq('trip_id', tripId)
    .eq('location', location)
  const existingTitles = new Set((existing || []).map(a => a.title))

  const anthropic = new Anthropic()

  const prompt = `הציעי 8-12 דברים לעשות ב${location}, עבור טיול משפחתי.

הקשר:
- הטיול: ${trip.name} (${trip.destination})
- מטבע התקציב: ${trip.currency}
${existingTitles.size > 0 ? `- כבר הוצעו (אל תחזרי עליהן): ${[...existingTitles].join(', ')}` : ''}

הנחיות:
- כל התוכן בעברית
- גיוון: אטרקציות, אוכל, טבע, קניות, תרבות, משפחה
- עלות משוערת לאדם במטבע ${trip.currency} (0 אם חינם)
- העדיפי מקומות מוכרים ואמינים, לא המצאות`

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 8000,
      output_config: { format: { type: 'json_schema', schema: ACTIVITIES_SCHEMA } },
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
    const result = JSON.parse(textBlock.text) as {
      activities: { title: string; description: string; category: string; est_cost?: number }[]
    }

    const fresh = result.activities.filter(a => !existingTitles.has(a.title))
    const { data: inserted } = await supabase
      .from('place_activities')
      .insert(
        fresh.map((a, i) => ({
          trip_id: tripId,
          location,
          title: a.title,
          description: a.description || null,
          category: a.category,
          est_cost: a.est_cost ?? null,
          source: 'ai',
          sort_order: existingTitles.size + i,
        })),
      )
      .select()

    return NextResponse.json({ activities: inserted || [] })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `שגיאה בהצעות: ${msg}` }, { status: 500 })
  }
}
