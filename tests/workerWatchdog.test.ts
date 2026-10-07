import { describe, expect, it } from 'vitest'
import { WORKER_STALL_SECONDS, WorkerWatchdog } from '../src/core/WorkerWatchdog'

describe('active worker watchdog', () => {
  it('ignores idle clocks and paused or malformed updates', () => {
    const watchdog = new WorkerWatchdog()
    expect(watchdog.advance(1000)).toBe(false)
    watchdog.begin()
    expect(watchdog.advance(WORKER_STALL_SECONDS - 1)).toBe(false)
    for (const delta of [0, -1, Number.NaN, Infinity]) expect(watchdog.advance(delta)).toBe(false)
    expect(watchdog.advance(1)).toBe(true)
    watchdog.clear()
    expect(watchdog.advance(1000)).toBe(false)
  })

  it('gives a replacement job a fresh budget', () => {
    const watchdog = new WorkerWatchdog()
    watchdog.begin()
    watchdog.advance(WORKER_STALL_SECONDS - 1)
    watchdog.begin()
    expect(watchdog.advance(1)).toBe(false)
    expect(watchdog.advance(WORKER_STALL_SECONDS - 1)).toBe(true)
  })
})
