import type { MapPoint } from '../modules/city'

// POI coordinates from OpenStreetMap, not official docking positions or live municipal data.
export const CITY_CENTER: [number, number] = [-31.4249815, -62.0840299]
export const BICYCLE_STATIONS: MapPoint[] = [
  { id: 'tecnoteca', name: 'Tecnoteca', zone: 'centro', latitude: -31.430426875, longitude: -62.0858364 },
  { id: 'terminal', name: 'Terminal', zone: 'terminal', latitude: -31.429307, longitude: -62.0912835 },
]
export const ALARM_POINTS: MapPoint[] = [
  { id: 'centro', name: 'Alarma Centro (demo)', zone: 'centro', latitude: -31.425, longitude: -62.083 },
  { id: 'terminal', name: 'Alarma Terminal (demo)', zone: 'terminal', latitude: -31.429, longitude: -62.092 },
  { id: 'plaza', name: 'Alarma Plaza (demo)', zone: 'plaza', latitude: -31.419, longitude: -62.089 },
]
export const PARKING_AREAS = [
  { id: 'centro', name: 'Centro (zona simulada)', bounds: [[-31.427, -62.087], [-31.423, -62.081]] },
  { id: 'terminal', name: 'Terminal (zona simulada)', bounds: [[-31.432, -62.094], [-31.428, -62.09]] },
  { id: 'plaza', name: 'Plaza (zona simulada)', bounds: [[-31.421, -62.092], [-31.417, -62.087]] },
] as const
