import { Euler, Vector3 } from 'three'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Aircraft } from '../src/aircraft/Aircraft'
import { FlightModel } from '../src/aircraft/FlightModel'
import { flightConfig as C } from '../src/aircraft/flightConfig'
import { setContactHeightSampler } from '../src/world/ground'

describe('light delayed flight assist', () => {
  const aircraft: Aircraft[] = []
  beforeEach(() => setContactHeightSampler(() => 0))
  afterEach(() => {
    for (const a of aircraft) a.dispose()
    aircraft.length = 0
    setContactHeightSampler(null)
  })
  function create(assist = true): Aircraft {
    const a = new Aircraft()
    a.position.set(0, 2000, 0)
    a.velocity.set(0, 0, 200)
    a.orientation.setFromEuler(new Euler(-.34, 0, -.42))
    a.controls.gearDown = false
    a.controls.stabilityAssist = assist
    aircraft.push(a)
    return a
  }

  it('halves pitch and bank correction without changing pilot rates', () => {
    expect(C.stabilityAssistPitch).toBe(1.15 * .5)
    expect(C.stabilityAssistRoll).toBe(1.8 * .5)
    const a = create(), dt = 1 / 60
    const fwd = new Vector3(0, 0, 1).applyQuaternion(a.orientation)
    const right = new Vector3(1, 0, 0).applyQuaternion(a.orientation)
    const up = new Vector3(0, 1, 0).applyQuaternion(a.orientation)
    const damping = Math.exp(-C.angularDamping * dt)
    new FlightModel().step(a, dt)
    expect(a.angularVelocity.x).toBeCloseTo(fwd.y * .575 * (1 - Math.exp(-C.pitchResponse * dt)) * damping, 10)
    expect(a.angularVelocity.z).toBeCloseTo(-Math.atan2(right.y, up.y) * .9 * (1 - Math.exp(-C.angularResponse * dt)) * damping, 10)
  })

  for (const axis of ['yaw', 'roll'] as const) it(`waits two seconds after releasing ${axis}, including a held input`, () => {
    const a = create(), manual = create(false)
    const assistedModel = new FlightModel(), manualModel = new FlightModel()
    a.controls[axis] = manual.controls[axis] = .35
    for (let i = 0; i < 180; i++) {
      assistedModel.step(a, 1 / 60); manualModel.step(manual, 1 / 60)
      expect(a.angularVelocity.distanceTo(manual.angularVelocity)).toBeLessThan(1e-12)
    }
    a.controls[axis] = manual.controls[axis] = 0
    for (let i = 0; i < 119; i++) {
      assistedModel.step(a, 1 / 60); manualModel.step(manual, 1 / 60)
      expect(a.angularVelocity.distanceTo(manual.angularVelocity)).toBeLessThan(1e-12)
    }
    assistedModel.step(a, 1 / 60); manualModel.step(manual, 1 / 60)
    expect(a.angularVelocity.distanceTo(manual.angularVelocity)).toBeGreaterThan(1e-5)
  })

  it('does not advance its delay during no-op or invalid steps and resets cleanly', () => {
    const a = create(), model = new FlightModel()
    a.controls.yaw = .4
    model.step(a, 1 / 60)
    a.controls.yaw = 0
    for (const dt of [0, -1, NaN, Infinity]) model.step(a, dt)
    a.angularVelocity.set(0, 0, 0)
    model.step(a, 1)
    expect(a.angularVelocity.x).toBe(0); expect(a.angularVelocity.z).toBe(0)
    model.reset()
    model.step(a, 1 / 60)
    expect(Math.abs(a.angularVelocity.x)).toBeGreaterThan(0)
    expect(Math.abs(a.angularVelocity.z)).toBeGreaterThan(0)
  })

  it('ignores neutral stick noise and leaves disabled assist manual', () => {
    const a = create(), disabled = create(false)
    a.controls.yaw = disabled.controls.yaw = C.stabilityAssistDeadzone * .5
    new FlightModel().step(a, 1 / 60)
    new FlightModel().step(disabled, 1 / 60)
    expect(Math.abs(a.angularVelocity.x)).toBeGreaterThan(0)
    expect(Math.abs(a.angularVelocity.z)).toBeGreaterThan(0)
    expect(disabled.angularVelocity.x).toBe(0)
    expect(disabled.angularVelocity.z).toBe(0)
  })
})
