'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { extractTextFromFile, parsePlanText, ImportedPlan } from '@/lib/importPlan'

const HEBREW_DAY = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`)
  return `יום ${HEBREW_DAY[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}`
}

export default function ImportPlanSection({
  tripId,
  tripStart,
  tripEnd,
}: {
  tripId: string
  tripStart: string
  tripEnd: string
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [fileName, setFileName] = useState('')
  const [rawText, setRawText] = useState('')
  const [preview, setPreview] = useState<ImportedPlan | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState<'parsed' | 'ai' | null>(null)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ daysImported: number; eventsImported: number; skippedOutOfRange: number } | null>(null)

  function reset() {
    setFileName('')
    setRawText('')
    setPreview(null)
    setError('')
    setResult(null)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    reset()
    setFileName(file.name)
    setParsing(true)
    try {
      const text = await extractTextFromFile(file)
      setRawText(text)
      setPreview(parsePlanText(text, tripStart, tripEnd))
    } catch {
      setError('לא הצלחנו לקרוא את הקובץ')
    } finally {
      setParsing(false)
    }
  }

  async function doImport(mode: 'parsed' | 'ai') {
    setImporting(mode)
    setError('')
    try {
      const body = mode === 'parsed'
        ? { tripId, days: preview?.days }
        : { tripId, text: rawText, useAi: true }
      const res = await fetch('/api/import-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'שגיאה לא ידועה')
      } else {
        setResult(data)
        setPreview(null)
        router.refresh()
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'שגיאת רשת')
    }
    setImporting(null)
  }

  const totalEvents = preview?.days.reduce((sum, d) => sum + d.events.length, 0) || 0

  return (
    <div className="bg-gradient-to-l from-sky-50 to-teal-50 rounded-2xl border border-sky-200 p-5 mb-6">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between">
        <h2 className="font-semibold text-sky-800">📎 ייבאי תכנון קיים מקובץ</h2>
        <span className="text-sky-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-gray-600">
            יש לך כבר תכנון ב-TXT, CSV, Excel או Word? העלי אותו וניכניס את הימים והפעילויות ישר למסלול.
            קובץ מסודר (תאריך בתחילת שורה או טבלה עם עמודת תאריך) נקלט בלי AI; טקסט חופשי — עם AI.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept=".txt,.csv,.xlsx,.xls,.docx"
            onChange={handleFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={parsing || importing !== null}
            className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm transition disabled:opacity-60"
          >
            {parsing ? 'קורא את הקובץ...' : fileName ? `📄 ${fileName} — החליפי קובץ` : 'בחרי קובץ'}
          </button>

          {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg p-3">{error}</p>}

          {result && (
            <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3">
              ✅ יובאו {result.daysImported} ימים ו-{result.eventsImported} פעילויות!
              {result.skippedOutOfRange > 0 && ` (${result.skippedOutOfRange} ימים מחוץ לתאריכי הטיול דולגו)`}
              {' '}גשי למסלול היומי לראות.
            </p>
          )}

          {rawText && !result && (
            preview ? (
              <div className="bg-white rounded-xl p-4 border border-sky-200 space-y-2">
                <p className="text-sm font-semibold text-gray-700">
                  זיהינו {preview.days.length} ימים עם {totalEvents} פעילויות:
                </p>
                <ul className="text-sm text-gray-600 space-y-1 max-h-48 overflow-y-auto">
                  {preview.days.map(d => (
                    <li key={d.date}>
                      📅 {formatDate(d.date)}
                      {d.title ? ` — ${d.title}` : ''}
                      <span className="text-gray-400"> ({d.events.length} פעילויות)</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => doImport('parsed')}
                    disabled={importing !== null}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm transition disabled:opacity-60"
                  >
                    {importing === 'parsed' ? 'מייבא...' : '✓ ייבאי למסלול'}
                  </button>
                  <button
                    type="button"
                    onClick={() => doImport('ai')}
                    disabled={importing !== null}
                    className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm transition disabled:opacity-60"
                  >
                    {importing === 'ai' ? '🪄 מנתח...' : '✨ נתחי עם AI במקום'}
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    disabled={importing !== null}
                    className="text-gray-500 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 transition"
                  >
                    בטלי
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  משהו חסר או לא מדויק בזיהוי? &quot;נתחי עם AI&quot; שולח את הטקסט המלא לניתוח חכם יותר.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl p-4 border border-sky-200 space-y-2">
                <p className="text-sm text-gray-700">
                  לא הצלחנו לזהות ימים ופעילויות בקובץ בצורה אוטומטית — אבל אפשר לתת ל-AI לנתח אותו.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => doImport('ai')}
                    disabled={importing !== null}
                    className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm transition disabled:opacity-60"
                  >
                    {importing === 'ai' ? '🪄 מנתח... (עד דקה)' : '✨ נתחי עם AI'}
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    disabled={importing !== null}
                    className="text-gray-500 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 transition"
                  >
                    בטלי
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
