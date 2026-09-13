import { describe, expect, it } from 'vitest'
import {
  createEngineHeatState,
  resetEngineHeat,
  updateEngineHeat,
} from '../src/aircraft/EngineHeatSystem'

describe('arcade engine heat system', () => {
  it('builds heat faster with afterburner than dry power', () => {
    const dry = createEngineHeatState()
    const boost = createEngineHeatState()
    updateEngineHeat(dry, 2, 1, false)
    updateEngineHeat(boost, 2, 1, true)
    expect(boost.fraction).toBeGreaterThan(dry.fraction)
    expect(dry.fraction).toBeGreaterThan(0)
    expect(boost.afterburnerLocked).toBe(false)
  })

  it('cools at idle and clamps malformed steps and state', () => {
    const state = createEngineHeatState()
    state.fraction = 0.8
    updateEngineHeat(state, 2, 0, false)
    expect(state.fraction).toBeLessThan(0.8)
    updateEngineHeat(state, Number.NaN, Number.NaN, true)
    expect(Number.isFinite(state.fraction)).toBe(true)
    state.fraction = 0.9
    resetEngineHeat(state)
    expect(state.fraction).toBe(0)
  })

  it('bounds long afterburner runs without runaway values', () => {
    const state = createEngineHeatState()
    for (let i = 0; i < 200; i += 1) updateEngineHeat(state, 0.25, 1, true)
    expect(state.fraction).toBe(1)
    expect(state.afterburnerLocked).toBe(true)
    expect(Number.isFinite(state.fraction)).toBe(true)
  })

  it('re-enables afterburner only after hysteretic cool-down', () => {
    const state = createEngineHeatState()
    for (let i = 0; i < 30; i += 1) updateEngineHeat(state, 0.25, 1, true)
    expect(state.afterburnerLocked).toBe(true)
    for (let i = 0; i < 30; i += 1) updateEngineHeat(state, 0.25, 0, false)
    expect(state.fraction).toBeLessThan(0.58)
    expect(state.afterburnerLocked).toBe(false)
  })
})
