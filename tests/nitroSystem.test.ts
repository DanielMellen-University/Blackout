import { describe, expect, it } from 'vitest'
import { createNitroState, refillNitroAtGate, resetNitro, updateNitro } from '../src/aircraft/NitroSystem'
import { flightConfig as C } from '../src/aircraft/flightConfig'
import { Aircraft } from '../src/aircraft/Aircraft'
import { setContactHeightSampler } from '../src/world/ground'
import { Scene } from 'three'
import { MissionSystem } from '../src/systems/Mission'

describe('b36 nitro with b21 safety', () => {
  it('drains a full reserve linearly in five seconds of actual boost', () => {
    const s = createNitroState()
    for (let i = 0; i < 300; i++) updateNitro(s, 1 / 120, true)
    expect(s.fraction).toBeCloseTo(.5, 8)
    for (let i = 0; i < 300; i++) updateNitro(s, 1 / 120, true)
    expect(s.fraction).toBe(0)
    expect(s.depleted).toBe(true)
  })
  it('refills slowly to full linearly in twenty seconds without burning', () => {
    const s = createNitroState(); s.fraction = 0; s.depleted = true
    for (let i = 0; i < 1200; i++) updateNitro(s, 1 / 120, false)
    expect(s.fraction).toBeCloseTo(.5, 8)
    for (let i = 0; i < 1200; i++) updateNitro(s, 1 / 120, false)
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
    for (let i = 0; i < 300; i++) expect(updateNitro(s, 1 / 120, true)).toBe(false)
    expect(s.fraction).toBeLessThan(C.nitroRestartFraction)
    while (s.fraction < C.nitroRestartFraction) updateNitro(s, 1 / 120, true)
    expect(updateNitro(s, 1 / 120, true)).toBe(true)
  })
  it('ignores invalid time without corrupting the reserve', () => {
    const s = createNitroState()
    for (const dt of [-1, NaN, Infinity]) expect(updateNitro(s, dt, true)).toBe(false)
    expect(updateNitro(s, 0, true)).toBe(true)
    expect(s.fraction).toBe(1)
  })
  it('delivers the stronger thrust through production physics and cuts all feedback at empty', () => {
    setContactHeightSampler(() => 0)
    const a = new Aircraft()
    try {
      a.position.set(0, 20000, 0); a.velocity.set(0, 0, 340)
      Object.assign(a.controls, { throttle: 1, boost: true, gearDown: false, stabilityAssist: false })
      a.step(1 / 120)
      expect(a.engineState.maxAcceleration * C.mass).toBeCloseTo(3508650.5190, 2)
      expect((a.speed - 340) * 120).toBeGreaterThan(300)
      for (let i = 1; i < 480; i++) a.step(1 / 120)
      expect(a.speed).toBeGreaterThan(850)
      a.nitro.fraction = .0001; a.step(1 / 120)
      expect(a.engineState.afterburnerActive).toBe(false)
      expect(a.engineState.maxAcceleration).toBe(C.milAccel)
      a.controls.throttle = 0; a.nitro.fraction = .5; a.nitro.depleted = false
      a.step(1); expect(a.nitro.fraction).toBeGreaterThan(.5)
    } finally { a.dispose(); setContactHeightSampler(null) }
  })
})

// Full burn and release use production motion; terrain and gates use swept checks.
it.each([1 / 60, 1 / 120])('keeps a full uncapped burn finite and sweeps terrain and gates at dt=%s', dt => {
  setContactHeightSampler(() => 0)
  const a = new Aircraft(), mission = new MissionSystem(new Scene())
  try {
    a.position.set(0, 20000, 0); a.velocity.set(0, 0, 340)
    Object.assign(a.controls, { throttle: 1, boost: true, gearDown: false, stabilityAssist: false })
    let peak = a.speed
    for (let i = 0; i < Math.round(5 / dt); i++) {
      const before = a.speed
      a.step(dt)
      if (a.engineState.afterburnerActive) expect(a.speed).toBeGreaterThan(before)
      peak = Math.max(peak, a.speed)
      expect([...a.position.toArray(), ...a.velocity.toArray(), ...a.orientation.toArray()].every(Number.isFinite)).toBe(true)
    }
    expect(a.nitro.fraction).toBe(0)
    expect(peak).toBeGreaterThan(880)
    expect(a.engineState.afterburnerActive).toBe(false)
    expect(a.speed).toBeGreaterThan(680)
    expect(peak - a.speed).toBeLessThan(8)
    const released = a.speed
    a.controls.boost = false; a.step(dt)
    expect(a.speed).toBeLessThan(released)
    expect(a.speed).toBeGreaterThan(680)
    console.info(`b36 full burn dt=${dt}: peak ${peak.toFixed(3)} m/s`)

    mission.start(0, 20000, 0, 0, 'orbit')
    const gate = mission.gates[0]!, travel = peak * dt
    const beforeGate = gate.pos.clone().addScaledVector(gate.fwd, -travel / 2)
    const afterGate = gate.pos.clone().addScaledVector(gate.fwd, travel / 2)
    expect(mission.update(beforeGate.x, beforeGate.y, beforeGate.z)).toBe('none')
    expect(mission.update(afterGate.x, afterGate.y, afterGate.z)).toBe('pass')

    setContactHeightSampler((_x, z) => z >= 5 && z <= 8 ? 150 : 0)
    a.position.set(0, 100, 0); a.velocity.set(0, 0, peak)
    a.step(1 / 60)
    expect(a.impact).not.toBeNull()
    expect(a.position.z).toBeLessThan(8)
    expect([...a.position.toArray(), ...a.velocity.toArray()].every(Number.isFinite)).toBe(true)
  } finally { a.dispose(); mission.dispose(); setContactHeightSampler(null) }
})
