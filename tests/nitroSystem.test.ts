import { describe, expect, it } from 'vitest'
import { createNitroState, refillNitroAtGate, resetNitro, updateNitro } from '../src/aircraft/NitroSystem'
import { flightConfig as C } from '../src/aircraft/flightConfig'
import { Aircraft } from '../src/aircraft/Aircraft'
import { setContactHeightSampler } from '../src/world/ground'

describe('b21 nitro', () => {
  it('drains a full reserve in twelve seconds of actual boost', () => {
    const s = createNitroState()
    for (let i = 0; i < 720; i++) updateNitro(s, 1 / 120, true)
    expect(s.fraction).toBeCloseTo(.5, 8)
    for (let i = 0; i < 720; i++) updateNitro(s, 1 / 120, true)
    expect(s.fraction).toBe(0)
    expect(s.depleted).toBe(true)
  })
  it('refills slowly to full in forty-five seconds without burning', () => {
    const s = createNitroState(); s.fraction = 0; s.depleted = true
    for (let i = 0; i < 5400; i++) updateNitro(s, 1 / 120, false)
    expect(s.fraction).toBeCloseTo(1, 8)
    updateNitro(s, 10, false); expect(s.fraction).toBe(1)
  })
  it('adds a bounded quarter reserve per gate and unlocks a depleted burner', () => {
    const s = createNitroState(); s.fraction = 0; s.depleted = true
    refillNitroAtGate(s)
    expect(s.fraction).toBe(C.nitroGateRefill); expect(s.depleted).toBe(false)
    expect(s.gateRefills).toBe(1); expect(updateNitro(s, 1 / 120, true)).toBe(true)
    for (let i = 0; i < 5; i++) refillNitroAtGate(s)
    expect(s.fraction).toBe(1)
    resetNitro(s); expect(s).toEqual(createNitroState())
  })
  it('cuts at empty and stays off while held until the restart threshold', () => {
    const s = createNitroState(); s.fraction = .0001
    expect(updateNitro(s, 1 / 120, true)).toBe(false)
    for (let i = 0; i < 800; i++) expect(updateNitro(s, 1 / 120, true)).toBe(false)
    expect(s.fraction).toBeLessThan(C.nitroRestartFraction)
    while (s.fraction < C.nitroRestartFraction) updateNitro(s, 1 / 120, true)
    expect(updateNitro(s, 1 / 120, true)).toBe(true)
  })
  it('ignores invalid time without corrupting the reserve', () => {
    const s = createNitroState()
    for (const dt of [0, -1, NaN, Infinity]) expect(updateNitro(s, dt, true)).toBe(false)
    expect(s.fraction).toBe(1)
  })
  it('delivers the stronger thrust through production physics and cuts all feedback at empty', () => {
    setContactHeightSampler(() => 0)
    const a = new Aircraft()
    try {
      a.position.set(0, 20000, 0); a.velocity.set(0, 0, 340)
      Object.assign(a.controls, { throttle: 1, boost: true, gearDown: false, stabilityAssist: false })
      a.step(1 / 120)
      expect(a.engineState.maxAcceleration * C.mass).toBeCloseTo(1754325.2595, 2)
      expect((a.speed - 340) * 120).toBeGreaterThan(125)
      for (let i = 1; i < 1200; i++) a.step(1 / 120)
      expect(a.speed).toBeGreaterThan(635); expect(a.speed).toBeLessThan(651)
      a.nitro.fraction = .0001; a.step(1 / 120)
      expect(a.engineState.afterburnerActive).toBe(false)
      expect(a.engineState.maxAcceleration).toBe(C.milAccel)
      a.controls.throttle = 0; a.nitro.fraction = .5; a.nitro.depleted = false
      a.step(1); expect(a.nitro.fraction).toBeGreaterThan(.5)
    } finally { a.dispose(); setContactHeightSampler(null) }
  })
})
