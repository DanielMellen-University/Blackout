import { describe, expect, it } from 'vitest'
import { clampOperationStick, neutralOperationStick } from '../src/systems/operation/stick'
import { OperationStickInput } from '../src/ui/operation/stickInput'

class FakeTarget {
  private listeners = new Map<string, Set<(event: { code: string; preventDefault: () => void }) => void>>()
  addEventListener(type: string, handler: (event: { code: string; preventDefault: () => void }) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(handler)
  }
  removeEventListener(type: string, handler: (event: { code: string; preventDefault: () => void }) => void): void {
    this.listeners.get(type)?.delete(handler)
  }
  dispatch(type: string, code: string): { defaultPrevented: boolean } {
    let defaultPrevented = false
    const event = { code, preventDefault: () => { defaultPrevented = true } }
    for (const handler of this.listeners.get(type) ?? []) handler(event)
    return { defaultPrevented }
  }
}

describe('operation stick', () => {
  it('clamps a partial command', () => {
    expect(clampOperationStick({ pitch: 4, roll: Number.NaN, throttle: 2, boost: true })).toEqual({
      pitch: 1, roll: 0, yaw: 0, throttle: 1, boost: true, airbrake: false,
    })
    expect(neutralOperationStick().throttle).toBe(0.5)
  })

  it('maps the stick, rudder and power keys', () => {
    const target = new FakeTarget()
    const input = new OperationStickInput(target as unknown as Window)
    input.attach()
    input.setCapture(true)
    expect(target.dispatch('keydown', 'KeyW').defaultPrevented).toBe(true)
    target.dispatch('keydown', 'KeyA')
    target.dispatch('keydown', 'KeyQ')
    target.dispatch('keydown', 'ShiftLeft')
    target.dispatch('keydown', 'Space')
    const held = input.sample(0.5, [])
    expect(held.pitch).toBe(1)
    expect(held.roll).toBe(-1)
    expect(held.yaw).toBe(-1)
    expect(held.throttle).toBeGreaterThan(0.5)
    expect(held.boost).toBe(true)
    target.dispatch('keyup', 'KeyW')
    target.dispatch('keyup', 'KeyA')
    target.dispatch('keyup', 'KeyQ')
    target.dispatch('keydown', 'KeyS')
    target.dispatch('keydown', 'KeyD')
    target.dispatch('keydown', 'KeyE')
    target.dispatch('keydown', 'KeyB')
    const opposite = input.sample(0, [])
    expect(opposite.pitch).toBe(-1)
    expect(opposite.roll).toBe(1)
    expect(opposite.yaw).toBe(1)
    expect(opposite.airbrake).toBe(true)
    input.detach()
    expect(target.dispatch('keydown', 'KeyW').defaultPrevented).toBe(false)
  })

  it('lets the gamepad fly when the keys are up', () => {
    const input = new OperationStickInput(null)
    input.setThrottle(0.4)
    const stick = input.sample(1 / 60, [{
      connected: true,
      mapping: 'standard',
      axes: [0.8, -0.8, 0.5, 0],
      buttons: [
        { pressed: true, value: 1 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: true, value: 1 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: true, value: 1 },
      ],
    }])
    expect(stick.roll).toBeGreaterThan(0.5)
    expect(stick.pitch).toBeGreaterThan(0.5)
    expect(stick.yaw).toBeGreaterThan(0.3)
    expect(stick.boost).toBe(true)
    expect(stick.airbrake).toBe(true)
    expect(stick.throttle).toBeGreaterThan(0.4)
  })

  it('keeps a held key ahead of the gamepad on the same axis', () => {
    const target = new FakeTarget()
    const input = new OperationStickInput(target as unknown as Window)
    input.attach()
    target.dispatch('keydown', 'KeyD')
    const stick = input.sample(0, [{
      connected: true,
      mapping: 'standard',
      axes: [-1, 0, 0],
      buttons: [],
    }])
    expect(stick.roll).toBe(1)
  })
})
