import { describe, expect, it } from 'vitest'
import { createEngineState, resolveEngineState } from '../src/aircraft/EngineState'
import { flightConfig as C } from '../src/aircraft/flightConfig'

describe('resolveEngineState', () => {
  it('does not light afterburner with a closed throttle', () => {
    const out = createEngineState()
    resolveEngineState({ throttle: 0, boost: true }, out)
    expect(out.afterburnerRequested).toBe(true)
    expect(out.afterburnerActive).toBe(false)
    expect(out.targetSpeed).toBe(0)
    expect(out.maxSpeed).toBe(C.maxSpeed)
  })

  it('scales the speed command from the lever, even with afterburner', () => {
    const out = createEngineState()
    resolveEngineState({ throttle: 0.5, boost: true }, out)
    expect(out.afterburnerActive).toBe(true)
    expect(out.targetSpeed).toBeCloseTo(0.5 * C.maxSpeedBoost)
    expect(out.maxSpeed).toBe(C.maxSpeedBoost)
  })

  it('contains malformed engine controls at a safe idle state', () => {
    const out = createEngineState()
    resolveEngineState({ throttle: Number.NaN, boost: 1 as unknown as boolean }, out)
    expect(out.lever).toBe(0)
    expect(out.afterburnerRequested).toBe(false)
    expect(out.afterburnerActive).toBe(false)
    expect(out.targetSpeed).toBe(0)
    expect(Number.isFinite(out.effectivePower)).toBe(true)
  })
})
