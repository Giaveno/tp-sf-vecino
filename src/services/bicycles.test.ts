import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBicycleSource } from './bicycles'

describe('simulated bicycle availability', () => {
  afterEach(() => vi.useRealTimers())
  it('updates without reloading while preserving capacity and timestamps', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-28T12:00:00Z'))
    const source = createBicycleSource([{ id: 'test', capacity: 12, bicycles: 6 }], () => 0.9)
    const received: ReturnType<typeof source.snapshot>[] = []
    const cancel = source.subscribe((value) => received.push(value))
    vi.advanceTimersByTime(10_000)
    expect(received.at(-1)?.[0].bicycles).toBe(7)
    expect(received.at(-1)?.[0].freeDocks).toBe(5)
    expect(received.at(-1)?.[0].updatedAt).toBe('2026-10-28T12:00:10.000Z')
    cancel(); const count = received.length; vi.advanceTimersByTime(20_000)
    expect(received).toHaveLength(count)
  })
  it('never exceeds capacity or goes negative over many updates', () => {
    vi.useFakeTimers()
    const full = createBicycleSource([{ id: 'test', capacity: 2, bicycles: 2 }], () => 1)
    const empty = createBicycleSource([{ id: 'test', capacity: 2, bicycles: 0 }], () => 0)
    const stopFull = full.subscribe(() => {}), stopEmpty = empty.subscribe(() => {})
    vi.advanceTimersByTime(200_000)
    expect(full.snapshot()[0].bicycles).toBe(2)
    expect(empty.snapshot()[0].bicycles).toBe(0)
    expect(empty.snapshot()[0].freeDocks).toBe(2)
    stopFull(); stopEmpty()
  })
})
