import { describe, expect, it } from 'vitest'
import {
  createEngineHeatState,
  resetEngineHeat,
  updateEngineHeat,
} from '../src/aircraft/EngineHeatSystem'

describe('arcade engine heat system', () => {
  it('does not build heat or lock the burner on dry power or afterburner', () => {
    const dry = createEngineHeatState()
    const boost = createEngineHeatState()
    dry.fraction = 0.4
    boost.fraction = 0.4
    boost.afterburnerLocked = true
    updateEngineHeat(dry, 2, 1, false)
    updateEngineHeat(boost, 2, 1, true)
    expect(dry.fraction).toBe(0)
    expect(boost.fraction).toBe(0)
    expect(dry.afterburnerLocked).toBe(false)
    expect(boost.afterburnerLocked).toBe(false)
  })

  it('clears leftover heat and ignores malformed steps', () => {
    const state = createEngineHeatState()
    state.fraction = 0.8
    state.afterburnerLocked = true
    updateEngineHeat(state, 2, 0, false)
    expect(state.fraction).toBe(0)
    expect(state.afterburnerLocked).toBe(false)
    updateEngineHeat(state, Number.NaN, Number.NaN, true)
    expect(state.fraction).toBe(0)
    expect(Number.isFinite(state.fraction)).toBe(true)
    state.fraction = 0.9
    resetEngineHeat(state)
    expect(state.fraction).toBe(0)
    expect(state.afterburnerLocked).toBe(false)
  })

  it('stays cold and unlocked across a long afterburner run', () => {
    const state = createEngineHeatState()
    for (let i = 0; i < 200; i += 1) updateEngineHeat(state, 0.25, 1, true)
    expect(state.fraction).toBe(0)
    expect(state.afterburnerLocked).toBe(false)
  })
})
