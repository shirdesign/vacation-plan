'use client'
import { useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip } from 'react-leaflet'
import { divIcon, latLngBounds, type Map as LeafletMap, type Marker as LeafletMarker } from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type MapPoint = {
  date: string
  dayNumber: number
  lat: number
  lng: number
  name: string
  title?: string
}

type Stop = { lat: number; lng: number; name: string; days: MapPoint[] }

function daysLabel(stop: Stop) {
  const first = stop.days[0].dayNumber
  const last = stop.days[stop.days.length - 1].dayNumber
  return first === last
    ? <>יום <span dir="ltr">{first}</span></>
    : <>ימים <span dir="ltr">{first}–{last}</span></>
}

function shortDate(iso: string) {
  return iso.slice(5).split('-').reverse().join('/')
}

export default function TripMap({ points }: { points: MapPoint[] }) {
  const mapRef = useRef<LeafletMap | null>(null)
  const markerRefs = useRef<(LeafletMarker | null)[]>([])
  const [focused, setFocused] = useState<number | null>(null)

  if (points.length === 0) return null

  // Consecutive days in the same spot form one numbered stop
  const stops: Stop[] = []
  for (const p of points) {
    const last = stops[stops.length - 1]
    if (last && Math.abs(last.lat - p.lat) < 0.0001 && Math.abs(last.lng - p.lng) < 0.0001) {
      last.days.push(p)
    } else {
      stops.push({ lat: p.lat, lng: p.lng, name: p.name, days: [p] })
    }
  }

  const positions = stops.map(s => [s.lat, s.lng] as [number, number])
  const bounds = latLngBounds(positions).pad(0.2)

  // Initial view skips far-away outliers (e.g. the flight home) so the trip
  // region fills the map; "כל המסלול" still fits everything.
  const clustered = positions.length >= 3
    ? positions.filter((p, i) =>
        positions.some((q, j) =>
          i !== j && Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) < 15
        )
      )
    : positions
  const initialBounds = clustered.length >= 2 ? latLngBounds(clustered).pad(0.2) : bounds

  function focusStop(i: number) {
    setFocused(i)
    const map = mapRef.current
    if (!map) return
    map.flyTo(positions[i], Math.max(map.getZoom(), 9), { duration: 0.8 })
    markerRefs.current[i]?.openPopup()
  }

  function showAll() {
    setFocused(null)
    mapRef.current?.closePopup()
    mapRef.current?.flyToBounds(bounds, { duration: 0.8 })
  }

  return (
    <div>
      <MapContainer
        ref={mapRef}
        bounds={initialBounds}
        scrollWheelZoom={false}
        style={{ height: 380, width: '100%', borderRadius: 16, zIndex: 0 }}
      >
        {/* CARTO Voyager: place names in Latin/English (default OSM tiles label Thailand/Vietnam in local script) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />
        {positions.length > 1 && (
          <Polyline positions={positions} pathOptions={{ color: '#2563eb', weight: 3, dashArray: '6 8', opacity: 0.7 }} />
        )}
        {stops.map((stop, i) => (
          <Marker
            key={`${stop.lat}-${stop.lng}-${i}`}
            position={[stop.lat, stop.lng]}
            ref={el => { markerRefs.current[i] = el }}
            zIndexOffset={i}
            icon={divIcon({
              className: '',
              html: `<div style="background:${focused === i ? '#1d4ed8' : '#2563eb'};color:#fff;border-radius:9999px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);">${i + 1}</div>`,
              iconSize: [30, 30],
              iconAnchor: [15, 15],
            })}
            eventHandlers={{ click: () => setFocused(i) }}
          >
            <Tooltip direction="top" offset={[0, -16]}>
              <span style={{ fontWeight: 600 }}>{stop.name}</span>
            </Tooltip>
            <Popup>
              <div style={{ direction: 'rtl', textAlign: 'right', minWidth: 150 }}>
                <strong>📍 {stop.name}</strong>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  {daysLabel(stop)}
                  {' · '}
                  <span dir="ltr">
                    {stop.days.length > 1
                      ? `${shortDate(stop.days[0].date)}–${shortDate(stop.days[stop.days.length - 1].date)}`
                      : shortDate(stop.days[0].date)}
                  </span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Stop legend — makes the numbered markers readable even on long trips */}
      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        {stops.map((stop, i) => (
          <button
            key={`legend-${i}`}
            onClick={() => focusStop(i)}
            className={`flex items-center gap-1.5 rounded-full pl-3 pr-1 py-1 text-xs border transition ${
              focused === i
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-blue-50 border-blue-100 text-gray-700 hover:bg-blue-100'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${
              focused === i ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'
            }`}>
              {i + 1}
            </span>
            <span className="font-medium">{stop.name}</span>
            <span className={focused === i ? 'text-blue-100' : 'text-gray-400'}>{daysLabel(stop)}</span>
          </button>
        ))}
        {stops.length > 1 && (
          <button
            onClick={showAll}
            className="rounded-full px-3 py-1 text-xs border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition"
          >
            🔍 כל המסלול
          </button>
        )}
      </div>
    </div>
  )
}
