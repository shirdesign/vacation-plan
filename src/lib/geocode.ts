// Free geocoding via OpenStreetMap Nominatim (no API key).
// Keep requests polite: one at a time, identify the app.
export async function geocodeLocation(name: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(name)}`,
      { headers: { 'Accept-Language': 'he,en' } }
    )
    if (!res.ok) return null
    const results = (await res.json()) as { lat: string; lon: string }[]
    if (!results.length) return null
    return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) }
  } catch {
    return null
  }
}
