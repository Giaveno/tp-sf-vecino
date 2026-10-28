export interface StationAvailability { id: string; capacity: number; bicycles: number; freeDocks: number; updatedAt: string }
export interface BicycleSource { snapshot(): StationAvailability[]; subscribe(listener: (stations: StationAvailability[]) => void): () => void }

export function createBicycleSource(seeds: { id: string; capacity: number; bicycles: number }[], random = Math.random): BicycleSource {
  let stations = seeds.map((seed) => ({ ...seed, bicycles: Math.max(0, Math.min(seed.capacity, seed.bicycles)), freeDocks: seed.capacity - Math.max(0, Math.min(seed.capacity, seed.bicycles)), updatedAt: new Date().toISOString() }))
  const listeners = new Set<(value: StationAvailability[]) => void>()
  let timer: ReturnType<typeof setInterval> | undefined
  const snapshot = () => stations.map((station) => ({ ...station }))
  return {
    snapshot,
    subscribe(listener) {
      listeners.add(listener); listener(snapshot())
      timer ??= setInterval(() => {
        stations = stations.map((station) => {
          const bicycles = Math.max(0, Math.min(station.capacity, station.bicycles + (random() < 0.5 ? -1 : 1)))
          return { ...station, bicycles, freeDocks: station.capacity - bicycles, updatedAt: new Date().toISOString() }
        })
        listeners.forEach((notify) => notify(snapshot()))
      }, 10_000)
      return () => { listeners.delete(listener); if (!listeners.size) { clearInterval(timer); timer = undefined } }
    },
  }
}
export const bicycleSource = createBicycleSource([{ id: 'tecnoteca', capacity: 12, bicycles: 8 }, { id: 'terminal', capacity: 12, bicycles: 3 }])
