'use client'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import { divIcon, latLngBounds } from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type MapPoint = {
  date: string
  dayNumber: number
  lat: number
  lng: number
  name: string
  title?: string
}

export default function TripMap({ points }: { points: MapPoint[] }) {
  if (points.length === 0) return null

  // Consecutive days in the same spot share one marker
  const grouped: { lat: number; lng: number; name: string; days: MapPoint[] }[] = []
  for (const p of points) {
    const last = grouped[grouped.length - 1]
    if (last && Math.abs(last.lat - p.lat) < 0.0001 && Math.abs(last.lng - p.lng) < 0.0001) {
      last.days.push(p)
    } else {
      grouped.push({ lat: p.lat, lng: p.lng, name: p.name, days: [p] })
    }
  }

  const positions = grouped.map(g => [g.lat, g.lng] as [number, number])
  const bounds = latLngBounds(positions).pad(0.2)

  return (
    <MapContainer
      bounds={bounds}
      scrollWheelZoom={false}
      style={{ height: 360, width: '100%', borderRadius: 16, zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {positions.length > 1 && (
        <Polyline positions={positions} pathOptions={{ color: '#2563eb', weight: 3, dashArray: '6 8', opacity: 0.7 }} />
      )}
      {grouped.map((g, i) => {
        const label = g.days.length > 1
          ? `${g.days[0].dayNumber}-${g.days[g.days.length - 1].dayNumber}`
          : String(g.days[0].dayNumber)
        return (
          <Marker
            key={`${g.lat}-${g.lng}-${i}`}
            position={[g.lat, g.lng]}
            icon={divIcon({
              className: '',
              html: `<div style="background:#2563eb;color:#fff;border-radius:9999px;min-width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);padding:0 4px;">${label}</div>`,
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            })}
          >
            <Popup>
              <div style={{ direction: 'rtl', textAlign: 'right', minWidth: 140 }}>
                <strong>📍 {g.name}</strong>
                {g.days.map(d => (
                  <div key={d.date} style={{ fontSize: 12, marginTop: 4 }}>
                    יום {d.dayNumber} · {d.date.split('-').reverse().join('/')}
                    {d.title ? <div style={{ color: '#666' }}>{d.title}</div> : null}
                  </div>
                ))}
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
