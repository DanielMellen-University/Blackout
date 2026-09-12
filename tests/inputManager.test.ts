import { describe, expect, it, vi } from 'vitest'
import { InputManager, normalizeGamepadAxis } from '../src/core/InputManager'

type Listener = (event: {
  code: string
  repeat?: boolean
  preventDefault(): void
}) => void

function fakeWindow(): { target: Window; fire(type: string, code: string): void } {
  const listeners = new Map<string, Listener>()
  const target = {
    addEventListener(type: string, listener: Listener): void {
      listeners.set(type, listener)
    },
    removeEventListener(type: string): void {
      listeners.delete(type)
    },
  } as unknown as Window
  return {
    target,
    fire(type, code) {
      listeners.get(type)?.({ code, preventDefault() {} })
    },
  }
}

describe('flight input one-shot controls', () => {
  it('queues the audio toggle only during live flight', () => {
    const fake = fakeWindow()
    const input = new InputManager(fake.target)

    fake.fire('keydown', 'KeyM')
    expect(input.consumeAudioToggle()).toBe(false)

    input.flightLive = true
    fake.fire('keydown', 'KeyM')
    expect(input.consumeAudioToggle()).toBe(true)
    expect(input.consumeAudioToggle()).toBe(false)

    input.dispose()
  })

  it('clears queued one-shot controls when focus leaves the window', () => {
    const fake = fakeWindow()
    const input = new InputManager(fake.target)
    input.flightLive = true
    fake.fire('keydown', 'KeyM')
    fake.fire('blur', '')
    expect(input.consumeAudioToggle()).toBe(false)
    input.dispose()
  })

  it('reads a standard gamepad with dead zones and trigger throttle', () => {
    vi.stubGlobal('navigator', {
      getGamepads: () => [{
        connected: true,
        axes: [.6, -.7, .4],
        buttons: [
          { pressed: true, value: 1 },
          {}, {}, {}, {}, {},
          { pressed: false, value: 0.1 },
          { pressed: false, value: 0.8 },
        ],
      }],
    })
    const fake = fakeWindow()
    const input = new InputManager(fake.target)
    input.flightLive = true
    const controls = input.sampleWithDt(1)
    expect(controls.roll).toBeGreaterThan(0.5)
    expect(controls.pitch).toBeGreaterThan(0.5)
    expect(controls.yaw).toBeGreaterThan(0.2)
    expect(controls.boost).toBe(true)
    expect(controls.throttle).toBeCloseTo(.01386, 5)
    fake.fire('keydown', 'KeyW')
    expect(input.sampleWithDt(.05).pitch).toBe(1)
    input.dispose()
    vi.unstubAllGlobals()
  })

  it('normalizes gamepad axes without leaking invalid values', () => {
    expect(normalizeGamepadAxis(0.1)).toBe(0)
    expect(normalizeGamepadAxis(1)).toBe(1)
    expect(normalizeGamepadAxis(-1)).toBe(-1)
    expect(normalizeGamepadAxis(Number.NaN)).toBe(0)
  })
})
