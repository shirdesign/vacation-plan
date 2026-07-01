'use client'
import { useState } from 'react'

export default function ShareButton({ tripId, shareToken }: { tripId: string; shareToken: string }) {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    const url = `${window.location.origin}/share/${shareToken}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function shareWhatsApp() {
    const url = `${window.location.origin}/share/${shareToken}`
    window.open(`https://wa.me/?text=${encodeURIComponent(`עקבו אחרי הטיול שלי 🌍\n${url}`)}`, '_blank')
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={shareWhatsApp}
        className="flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-xl transition"
        title="שתפי בוואטסאפ"
      >
        📱 וואטסאפ
      </button>
      <button
        onClick={copyLink}
        className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:border-blue-300 text-gray-700 text-sm font-medium rounded-xl transition"
      >
        {copied ? '✓ הועתק!' : '🔗 העתק קישור'}
      </button>
    </div>
  )
}
