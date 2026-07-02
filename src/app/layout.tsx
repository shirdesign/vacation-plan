import type { Metadata } from 'next'
import { Rubik } from 'next/font/google'
import './globals.css'

const rubik = Rubik({ subsets: ['hebrew', 'latin'] })

export const metadata: Metadata = {
  title: 'TripTrack — מעקב טיול משפחתי',
  description: 'תכנון מסלול, מעקב תקציב ושיתוף עם המשפחה',
  appleWebApp: { capable: true, title: 'TripTrack', statusBarStyle: 'default' },
  icons: { apple: '/apple-touch-icon.png' },
}

export const viewport = {
  themeColor: '#2563eb',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className="h-full">
      <body className={`${rubik.className} min-h-full bg-gray-50`}>{children}</body>
    </html>
  )
}
