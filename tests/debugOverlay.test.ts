import { describe, expect, it, vi } from 'vitest'
import { Scene } from 'three'
import { DebugOverlay, debugTargetSpeedKnots } from '../src/debug/DebugOverlay'

class FakePre {
  id = ''
  textContent = ''
  style = { cssText: '' }
  readonly remove = vi.fn()
}

describe('debug overlay teardown', () => {
  it('releases optional DOM and marker resources idempotently', () => {
    const el = new FakePre()
    vi.stubGlobal('document', {
      createElement: vi.fn(() => el),
      body: { appendChild: vi.fn() },
    })
    const debug = new DebugOverlay(new Scene())

    debug.dispose()
    debug.dispose()
    debug.syncPad()

    expect(el.remove).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})

describe('debug engine telemetry', () => {
  it('uses the resolved engine target instead of a linear throttle guess', () => {
    expect(debugTargetSpeedKnots({ targetSpeed: 340 })).toBeCloseTo(660.9056)
    expect(debugTargetSpeedKnots({ targetSpeed: Number.NaN })).toBe(0)
    expect(debugTargetSpeedKnots({ targetSpeed: -20 })).toBe(0)
  })
})
