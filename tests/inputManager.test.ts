import { describe, expect, it, vi } from 'vitest'
import { GAMEPAD_POLL_INTERVAL, InputManager, normalizeGamepadAxis } from '../src/core/InputManager'

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
  it('maps A to yaw right and D to yaw left', () => {
    const fake = fakeWindow()
    const input = new InputManager(fake.target)

    fake.fire('keydown', 'KeyA')
    expect(input.sampleWithDt(0).yaw).toBe(1)
    fake.fire('keyup', 'KeyA')
    fake.fire('keydown', 'KeyD')
    expect(input.sampleWithDt(0).yaw).toBe(-1)

    input.dispose()
  })

  it('supports the persisted A-left / D-right keyboard preference', () => {
    const fake = fakeWindow()
    const input = new InputManager(fake.target)
    input.setKeyboardYawPreference('a-left')

    fake.fire('keydown', 'KeyA')
    expect(input.sampleWithDt(0).yaw).toBe(-1)
    fake.fire('keyup', 'KeyA')
    fake.fire('keydown', 'KeyD')
    expect(input.sampleWithDt(0).yaw).toBe(1)

    input.dispose()
  })

  it('supports the persisted Q-left / E-right keyboard preference', () => {
    const fake = fakeWindow()
    const input = new InputManager(fake.target)
    input.setKeyboardRollPreference('q-left')

    fake.fire('keydown', 'KeyQ')
    expect(input.sampleWithDt(0).roll).toBe(-1)
    fake.fire('keyup', 'KeyQ')
    fake.fire('keydown', 'KeyE')
    expect(input.sampleWithDt(0).roll).toBe(1)

    input.dispose()
  })

  it('supports the persisted W-down / S-up keyboard preference', () => {
    const fake = fakeWindow()
    const input = new InputManager(fake.target)
    input.setKeyboardPitchPreference('w-down')

    fake.fire('keydown', 'KeyW')
    expect(input.sampleWithDt(0).pitch).toBe(-1)
    fake.fire('keyup', 'KeyW')
    fake.fire('keydown', 'KeyS')
    expect(input.sampleWithDt(0).pitch).toBe(1)

    input.dispose()
  })

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

  it('queues radar target cycling only during live flight', () => {
    const fake = fakeWindow()
    const input = new InputManager(fake.target)
    fake.fire('keydown', 'KeyT')
    expect(input.consumeRadarTargetCycle()).toBe(false)

    input.flightLive = true
    fake.fire('keydown', 'KeyT')
    expect(input.consumeRadarTargetCycle()).toBe(true)
    expect(input.consumeRadarTargetCycle()).toBe(false)

    input.dispose()
  })

  it('queues world-seed sharing only during live flight', () => {
    const fake = fakeWindow()
    const input = new InputManager(fake.target)

    fake.fire('keydown', 'KeyY')
    expect(input.consumeWorldSeedCopy()).toBe(false)

    input.flightLive = true
    fake.fire('keydown', 'KeyY')
    expect(input.consumeWorldSeedCopy()).toBe(true)
    expect(input.consumeWorldSeedCopy()).toBe(false)

    input.dispose()
  })

  it('queues best-run ghost visibility toggles only during live flight', () => {
    const fake = fakeWindow()
    const input = new InputManager(fake.target)

    fake.fire('keydown', 'KeyX')
    expect(input.consumeGhostToggle()).toBe(false)

    input.flightLive = true
    fake.fire('keydown', 'KeyX')
    expect(input.consumeGhostToggle()).toBe(true)
    expect(input.consumeGhostToggle()).toBe(false)

    input.dispose()
  })

  it('queues landing-gear toggles only during live flight', () => {
    const fake = fakeWindow()
    const input = new InputManager(fake.target)
    fake.fire('keydown', 'KeyG')
    expect(input.consumeGearToggle()).toBe(false)

    input.flightLive = true
    fake.fire('keydown', 'KeyG')
    expect(input.consumeGearToggle()).toBe(true)
    expect(input.consumeGearToggle()).toBe(false)

    input.dispose()
  })

  it('toggles stability assist only during live flight', () => {
    const fake = fakeWindow()
    const input = new InputManager(fake.target)

    fake.fire('keydown', 'KeyV')
    expect(input.consumeStabilityAssistToggle()).toBe(null)

    input.flightLive = true
    fake.fire('keydown', 'KeyV')
    expect(input.consumeStabilityAssistToggle()).toBe(true)
    expect(input.sampleWithDt(0).stabilityAssist).toBe(true)
    expect(input.consumeStabilityAssistToggle()).toBe(null)

    fake.fire('keyup', 'KeyV')
    fake.fire('keydown', 'KeyV')
    expect(input.consumeStabilityAssistToggle()).toBe(false)
    expect(input.sampleWithDt(0).stabilityAssist).toBe(false)
    input.dispose()
  })

  it('holds and releases the opt-in speed brake without changing default controls', () => {
    const fake = fakeWindow()
    const input = new InputManager(fake.target)
    input.flightLive = true

    expect(input.sampleWithDt(0).airbrake).toBe(false)
    fake.fire('keydown', 'KeyB')
    expect(input.sampleWithDt(0).airbrake).toBe(true)
    fake.fire('keyup', 'KeyB')
    expect(input.sampleWithDt(0).airbrake).toBe(false)

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

  it('merges event-driven touch controls after keyboard and gamepad input', () => {
    const fake = fakeWindow()
    const input = new InputManager(fake.target)
    input.flightLive = true
    input.setTouchState({ pitch: 1, yaw: -1, roll: 0.5, throttle: 1, boost: true })

    const touch = input.sampleWithDt(0)
    expect(touch.pitch).toBe(1)
    expect(touch.yaw).toBe(-1)
    expect(touch.roll).toBeCloseTo(0.5)
    expect(touch.boost).toBe(true)
    expect(input.sampleWithDt(0.05).throttle).toBeCloseTo(0.0198, 5)

    fake.fire('keydown', 'KeyS')
    expect(input.sampleWithDt(0).pitch).toBe(-1)
    fake.fire('keyup', 'KeyS')
    input.setTouchState(null)
    expect(input.sampleWithDt(0).boost).toBe(false)
    expect(input.sampleWithDt(0).yaw).toBe(0)
    input.dispose()
  })

  it('clears stale controller axes immediately when focus leaves', () => {
    vi.stubGlobal('navigator', {
      getGamepads: () => [{
        connected: true,
        axes: [.8, -.8, .8],
        buttons: [{ pressed: true, value: 1 }, {}, {}, {}, {}, {}, {}, { value: 1 }],
      }],
    })
    const fake = fakeWindow()
    const input = new InputManager(fake.target)
    input.flightLive = true
    const active = input.sampleWithDt(0)
    expect(active.roll).toBeGreaterThan(0.7)
    expect(active.boost).toBe(true)

    fake.fire('blur', '')
    input.flightLive = false
    const cleared = input.sampleWithDt(GAMEPAD_POLL_INTERVAL * 0.25)
    expect(cleared.roll).toBe(0)
    expect(cleared.pitch).toBe(0)
    expect(cleared.yaw).toBe(0)
    expect(cleared.boost).toBe(false)
    input.dispose()
    vi.unstubAllGlobals()
  })

  it('normalizes gamepad axes without leaking invalid values', () => {
    expect(normalizeGamepadAxis(0.1)).toBe(0)
    expect(normalizeGamepadAxis(1)).toBe(1)
    expect(normalizeGamepadAxis(-1)).toBe(-1)
    expect(normalizeGamepadAxis(Number.NaN)).toBe(0)
    expect(normalizeGamepadAxis(0.5, Number.NaN)).toBeCloseTo(normalizeGamepadAxis(0.5))
  })

  it('contains malformed frame and controller telemetry', () => {
    vi.stubGlobal('navigator', {
      getGamepads: () => [{
        connected: true,
        axes: [Number.NaN, Number.POSITIVE_INFINITY, Number.NaN],
        buttons: [{ pressed: false, value: false }, {}, {}, {}, {}, {},
          { pressed: false, value: Number.NaN },
          { pressed: false, value: Number.POSITIVE_INFINITY }],
      }],
    })
    const fake = fakeWindow()
    const input = new InputManager(fake.target)
    input.flightLive = true
    const controls = input.sampleWithDt(Number.NaN)

    expect(controls.pitch).toBe(0)
    expect(controls.roll).toBe(0)
    expect(controls.yaw).toBe(0)
    expect(controls.throttle).toBe(0)
    expect(Number.isFinite(controls.throttle)).toBe(true)

    input.resetFlightControls(Number.NaN)
    expect(input.sampleWithDt(Number.POSITIVE_INFINITY).throttle).toBe(0)
    input.dispose()
    vi.unstubAllGlobals()
  })
})
