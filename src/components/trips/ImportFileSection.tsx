'use client'
import { useState, useRef } from 'react'

interface ImportedData {
  name?: string
  destination?: string
  start_date?: string
  end_date?: string
  description?: string
  total_budget?: string
}

export default function ImportFileSection({ onImport }: { onImport: (data: ImportedData) => void }) {
  const [open, setOpen] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [preview, setPreview] = useState<ImportedData | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setParsing(true)
    setPreview(null)

    try {
      const ext = file.name.split('.').pop()?.toLowerCase()
      let extracted: ImportedData = {}

      if (ext === 'xlsx' || ext === 'xls') {
        const XLSX = await import('xlsx')
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf)
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
        const text = rows.flat().join(' ')
        extracted = extractFromText(text)
      } else if (ext === 'docx') {
        const mammoth = await import('mammoth')
        const buf = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer: buf })
        extracted = extractFromText(result.value)
      } else if (ext === 'csv') {
        const text = await file.text()
        extracted = extractFromText(text)
      }

      setPreview(extracted)
    } catch (err) {
      console.error(err)
    } finally {
      setParsing(false)
    }
  }

  function extractFromText(text: string): ImportedData {
    const result: ImportedData = {}

    // Date patterns: DD/MM/YYYY or YYYY-MM-DD
    const datePattern = /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/g
    const isoPattern = /\b(\d{4})-(\d{2})-(\d{2})\b/g

    const dates: string[] = []
    let m
    while ((m = isoPattern.exec(text)) !== null) {
      dates.push(`${m[1]}-${m[2]}-${m[3]}`)
    }
    while ((m = datePattern.exec(text)) !== null) {
      const y = m[3].length === 2 ? `20${m[3]}` : m[3]
      dates.push(`${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`)
    }

    const validDates = [...new Set(dates)].sort()
    if (validDates.length >= 1) result.start_date = validDates[0]
    if (validDates.length >= 2) result.end_date = validDates[validDates.length - 1]

    // Budget: look for ₪/$/€ followed by number or vice versa
    const budgetMatch = text.match(/[\$€₪£฿]\s*(\d[\d,]+)/)
      || text.match(/(\d[\d,]+)\s*[\$€₪£฿]/)
    if (budgetMatch) {
      result.total_budget = budgetMatch[1].replace(/,/g, '')
    }

    // Destination keywords
    const destMatch = text.match(/(?:יעד|destination|to|ל[:\-]?)\s*[:\-]?\s*([A-Za-zא-ת][A-Za-zא-ת\s,]{2,30})/i)
    if (destMatch) result.destination = destMatch[1].trim()

    return result
  }

  function applyImport() {
    if (preview) {
      onImport(preview)
      setOpen(false)
      setPreview(null)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full border-2 border-dashed border-gray-300 rounded-xl py-4 text-gray-500 hover:border-blue-400 hover:text-blue-500 transition flex items-center justify-center gap-2"
      >
        📎 ייבא מ-Excel / Word / CSV
      </button>
    )
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-blue-800">ייבא מקובץ</h3>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
      </div>

      <p className="text-sm text-blue-700 mb-3">
        העלי קובץ Excel, Word או CSV שמכיל מידע על הטיול — נזהה תאריכים, יעד ותקציב אוטומטית.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.docx,.csv"
        onChange={handleFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={parsing}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition disabled:opacity-60"
      >
        {parsing ? 'מנתח...' : 'בחר קובץ'}
      </button>

      {preview && (
        <div className="mt-4 bg-white rounded-lg p-4 border border-blue-200 space-y-2">
          <p className="text-sm font-semibold text-gray-700 mb-2">מצאנו את הפרטים הבאים:</p>
          {preview.start_date && <p className="text-sm text-gray-600">📅 תאריך התחלה: <strong>{preview.start_date}</strong></p>}
          {preview.end_date && <p className="text-sm text-gray-600">📅 תאריך סיום: <strong>{preview.end_date}</strong></p>}
          {preview.destination && <p className="text-sm text-gray-600">📍 יעד: <strong>{preview.destination}</strong></p>}
          {preview.total_budget && <p className="text-sm text-gray-600">💰 תקציב: <strong>{preview.total_budget}</strong></p>}

          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={applyImport}
              className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-green-700 transition"
            >
              ✓ אשרי ויבאי
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="text-gray-500 px-4 py-1.5 border rounded-lg text-sm hover:bg-gray-50 transition"
            >
              בטלי
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
