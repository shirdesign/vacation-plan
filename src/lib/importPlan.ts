// Parse a trip plan out of an uploaded file (TXT / CSV / Excel / Word) —
// deterministic, no AI. The AI path lives in /api/import-plan.

export type ImportedEvent = {
  start_time?: string
  title: string
  description?: string
  location?: string
}

export type ImportedDay = {
  date: string // YYYY-MM-DD
  title?: string
  location_name?: string
  notes?: string
  events: ImportedEvent[]
}

export type ImportedPlan = { days: ImportedDay[] }

// --- File → raw text ---------------------------------------------------------

export async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(await file.arrayBuffer())
    const ws = wb.Sheets[wb.SheetNames[0]]
    return XLSX.utils.sheet_to_csv(ws)
  }
  if (ext === 'docx') {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    return result.value
  }
  // txt / csv / anything readable as text
  return file.text()
}

// --- Date helpers -------------------------------------------------------------

function pad(n: string | number) {
  return String(n).padStart(2, '0')
}

// Resolve a date string to YYYY-MM-DD. Dates without a year get the trip's year
// (rolling into the next year if the trip crosses January 1st).
function resolveDate(raw: string, tripStart: string, tripEnd: string): string | null {
  let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`

  m = raw.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})$/)
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${y}-${pad(m[2])}-${pad(m[1])}`
  }

  m = raw.match(/^(\d{1,2})[\/.](\d{1,2})$/)
  if (m) {
    const startYear = tripStart.slice(0, 4)
    const candidate = `${startYear}-${pad(m[2])}-${pad(m[1])}`
    if (candidate < tripStart && tripEnd.slice(0, 4) > startYear) {
      return `${Number(startYear) + 1}-${pad(m[2])}-${pad(m[1])}`
    }
    return candidate
  }

  // "יום 3" / "Day 3" → offset from trip start
  m = raw.match(/^(?:יום|day)\s*(\d{1,2})$/i)
  if (m) {
    const d = new Date(`${tripStart}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + Number(m[1]) - 1)
    return d.toISOString().slice(0, 10)
  }

  return null
}

// --- CSV / table parsing ------------------------------------------------------

const HEADER_ALIASES: Record<keyof typeof EMPTY_ROW, string[]> = {
  date: ['date', 'תאריך', 'יום'],
  time: ['time', 'hour', 'שעה'],
  title: ['title', 'activity', 'event', 'פעילות', 'אירוע', 'כותרת'],
  location: ['location', 'place', 'city', 'מיקום', 'מקום', 'עיר'],
  description: ['description', 'notes', 'details', 'תיאור', 'הערות', 'פירוט'],
  dayTitle: ['day title', 'day_title', 'כותרת יום', 'כותרת היום', 'נושא'],
}

const EMPTY_ROW = {
  date: '',
  time: '',
  title: '',
  location: '',
  description: '',
  dayTitle: '',
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current.trim())
  return cells
}

function parseAsTable(text: string, tripStart: string, tripEnd: string): ImportedPlan | null {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return null

  const delimiter = [',', '\t', ';'].find(d => lines[0].includes(d))
  if (!delimiter) return null

  const headers = splitCsvLine(lines[0], delimiter).map(h => h.toLowerCase().trim())
  const columnOf: Partial<Record<keyof typeof EMPTY_ROW, number>> = {}
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = headers.findIndex(h => aliases.includes(h))
    if (idx >= 0) columnOf[field as keyof typeof EMPTY_ROW] = idx
  }
  // A usable table needs at least a date column and a title column
  if (columnOf.date === undefined || columnOf.title === undefined) return null

  const dayMap = new Map<string, ImportedDay>()
  let lastDate: string | null = null

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line, delimiter)
    const get = (f: keyof typeof EMPTY_ROW) =>
      columnOf[f] !== undefined ? (cells[columnOf[f]!] || '').trim() : ''

    const rawDate = get('date')
    const date: string | null = rawDate ? resolveDate(rawDate, tripStart, tripEnd) : lastDate
    if (!date) continue
    lastDate = date

    if (!dayMap.has(date)) dayMap.set(date, { date, events: [] })
    const day = dayMap.get(date)!

    const dayTitle = get('dayTitle')
    if (dayTitle && !day.title) day.title = dayTitle

    const title = get('title')
    if (!title) continue

    const time = get('time').match(/^(\d{1,2}):(\d{2})/)
    day.events.push({
      title,
      start_time: time ? `${pad(time[1])}:${time[2]}` : undefined,
      location: get('location') || undefined,
      description: get('description') || undefined,
    })
    // First event's location doubles as the day's location if none was given
    if (!day.location_name && get('location')) day.location_name = get('location')
  }

  const days = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date))
  return days.length ? { days } : null
}

// --- Free-text parsing --------------------------------------------------------

// A "day header" line starts with a date (or יום N), optionally followed by a title:
//   14/08: שוק לילה בצ'יאנג מאי
//   2026-08-14 - הגעה לבנגקוק
//   יום 3 — האי קופנגן
const DAY_HEADER = /^[\s*#-]*((?:\d{4}-\d{1,2}-\d{1,2})|(?:\d{1,2}[\/.]\d{1,2}(?:[\/.]\d{2,4})?)|(?:(?:יום|day)\s*\d{1,2}))\s*[:\-–—]?\s*(.*)$/i

function parseAsFreeText(text: string, tripStart: string, tripEnd: string): ImportedPlan | null {
  const lines = text.split(/\r?\n/)
  const days: ImportedDay[] = []
  let current: ImportedDay | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    const header = line.match(DAY_HEADER)
    const date = header ? resolveDate(header[1].trim(), tripStart, tripEnd) : null
    if (header && date) {
      current = { date, title: header[2].trim() || undefined, events: [] }
      days.push(current)
      continue
    }
    if (!current) continue

    // Event line: optional "HH:MM" prefix, optional "@ מיקום" suffix
    const cleaned = line.replace(/^[-*•]\s*/, '')
    const time = cleaned.match(/^(\d{1,2}):(\d{2})\s*[:\-–—]?\s*(.*)$/)
    let rest = time ? time[3] : cleaned
    let location: string | undefined
    const at = rest.match(/^(.*?)\s*@\s*(.+)$/)
    if (at) {
      rest = at[1].trim()
      location = at[2].trim()
    }
    if (!rest) continue
    current.events.push({
      title: rest,
      start_time: time ? `${pad(time[1])}:${time[2]}` : undefined,
      location,
    })
  }

  return days.length ? { days: days.sort((a, b) => a.date.localeCompare(b.date)) } : null
}

// --- Entry point --------------------------------------------------------------

export function parsePlanText(text: string, tripStart: string, tripEnd: string): ImportedPlan | null {
  return parseAsTable(text, tripStart, tripEnd) || parseAsFreeText(text, tripStart, tripEnd)
}
