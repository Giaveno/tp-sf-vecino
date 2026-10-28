import { useEffect, useState } from 'react'
import type { Coordinates } from './modules/city'

export function useLocalData(): number {
  const [version, setVersion] = useState(0)
  useEffect(() => { const refresh = () => setVersion((value) => value + 1); window.addEventListener('sf-data', refresh); window.addEventListener('storage', refresh); return () => { window.removeEventListener('sf-data', refresh); window.removeEventListener('storage', refresh) } }, [])
  return version
}
export function useUserLocation() {
  const [position, setPosition] = useState<Coordinates>(), [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
  function locate(): void {
    if (!navigator.geolocation) { setMessage('Este navegador no ofrece geolocalización. Podés seleccionar una ubicación del mapa.'); return }
    setBusy(true); setMessage('Buscando tu ubicación…')
    navigator.geolocation.getCurrentPosition(({ coords }) => { setPosition({ latitude: coords.latitude, longitude: coords.longitude }); setMessage('Distancias calculadas desde tu ubicación. Los puntos del mapa son de demostración.'); setBusy(false) }, () => { setMessage('No se pudo obtener la ubicación. Revisá el permiso o usá la selección manual.'); setBusy(false) }, { timeout: 8000, maximumAge: 60_000, enableHighAccuracy: false })
  }
  return { position, message, busy, locate }
}
