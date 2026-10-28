import { useEffect, useRef, useState } from 'react'
import type * as Leaflet from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ALARM_POINTS, BICYCLE_STATIONS, CITY_CENTER, PARKING_AREAS } from '../data/geography'
import { distanceKm, type Coordinates } from '../modules/city'

type MapMode = 'bicycles' | 'alarms' | 'parking'
export function CityMap({ mode = 'alarms', selected, onSelect, statuses, position }: { mode?: MapMode; selected: string; onSelect: (id: string) => void; statuses?: Record<string, string>; position?: Coordinates }) {
  const element = useRef<HTMLDivElement>(null), instance = useRef<Leaflet.Map | null>(null), library = useRef<typeof Leaflet | null>(null)
  const callback = useRef(onSelect)
  useEffect(() => { callback.current = onSelect }, [onSelect])
  const [ready, setReady] = useState(false), [tileError, setTileError] = useState(!navigator.onLine)
  const points = mode === 'bicycles' ? BICYCLE_STATIONS : ALARM_POINTS
  useEffect(() => {
    let cancelled = false
    void import('leaflet').then((L) => {
      if (cancelled || !element.current) return
      library.current = L
      const map = L.map(element.current).setView(CITY_CENTER, 14)
      instance.current = map
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' })
        .on('tileerror', () => setTileError(true)).addTo(map)
      setReady(true)
    }).catch(() => setTileError(true))
    return () => { cancelled = true; instance.current?.remove(); instance.current = null }
  }, [])
  useEffect(() => {
    const L = library.current, map = instance.current
    if (!ready || !L || !map) return
    const group = L.layerGroup().addTo(map)
    const tooltip = (name: string) => { const node = document.createElement('span'); node.textContent = name; return node }
    if (mode === 'parking') PARKING_AREAS.forEach((area) => {
      const bounds = area.bounds.map(([lat, lon]) => [lat, lon]) as [number, number][]
      L.rectangle(bounds, { color: selected === area.id ? '#174783' : '#47765e', weight: selected === area.id ? 4 : 2, fillOpacity: .2 })
        .bindTooltip(tooltip(area.name)).on('click', () => callback.current(area.id)).addTo(group)
    })
    else points.forEach((point) => {
      const active = statuses?.[point.id] === 'activa'
      L.circleMarker([point.latitude, point.longitude], { radius: selected === point.id ? 13 : 9, color: active ? '#a32525' : '#315c4c', weight: selected === point.id ? 4 : 2, fillOpacity: .85 })
        .bindTooltip(tooltip(`${point.name}${statuses?.[point.id] ? ` · ${statuses[point.id]}` : ''}`)).on('click', () => callback.current(point.id)).addTo(group)
    })
    if (position) L.circleMarker([position.latitude, position.longitude], { radius: 7, color: '#174783', fillOpacity: 1 }).bindTooltip(tooltip('Tu ubicación')).addTo(group)
    return () => { group.remove() }
  }, [ready, mode, selected, statuses, position, points])
  const choices = mode === 'parking' ? PARKING_AREAS : points
  return <figure className="city-map"><figcaption>Mapa de San Francisco · {mode === 'parking' ? 'zonas de estacionamiento simuladas' : mode === 'bicycles' ? 'estaciones de demostración' : 'alarmas simuladas'}</figcaption>
    <div className="geographic-map" ref={element} role="region" aria-label="Mapa geográfico interactivo de San Francisco" />
    {tileError && <p role="status">El mapa base necesita conexión. Podés usar la lista y las ubicaciones de demostración.</p>}
    <div className="map-legend">{choices.map((point) => <button type="button" key={point.id} aria-pressed={selected === point.id} onClick={() => onSelect(point.id)}>{point.name}{position && 'latitude' in point ? ` · ${distanceKm(position, point).toFixed(2)} km` : ''}</button>)}</div>
    <small>{mode === 'bicycles' ? 'Posiciones aproximadas referidas a puntos de interés de OpenStreetMap; no son coordenadas oficiales de anclajes. Disponibilidad simulada.' : 'Ubicaciones y límites ficticios para el TP; no usar para estacionamiento real ni emergencias.'} No se descarga el mapa completo para uso sin conexión.</small></figure>
}
