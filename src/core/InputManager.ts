import { flightConfig } from '../aircraft/flightConfig'
import { createDefaultControls, type ControlState } from './types'

/** Keep controller latency below one frame budget without polling every step. */
export const GAMEPAD_POLL_INTERVAL = 1 / 30

/**
 * Maps keyboard into ControlState for arcade flight.
 * W/S pitch, A/D yaw, Q/E roll, Space boost, Shift/Ctrl throttle. Gear is automatic.
 *
 * Throttle is a held continuous setpoint (0–1): Shift raises, Ctrl lowers
 * every frame so the ENG bar can track live.
 */
export class InputManager {
  private readonly keys = new Set<string>()
  private readonly controls: ControlState = createDefaultControls()
  private readonly target: Window
  private gamepadPollIn = 0
  private gamepadPitch = 0
  private gamepadRoll = 0
  private gamepadYaw = 0
  private gamepadThrottle = 0
  private gamepadBoost = false

  cameraToggleQueued = false
  resetQueued = false
  weatherCycleQueued = false
  audioToggleQueued = false
  /**
   * When false, keys are still tracked for stick continuity but C/R/N are not
   * queued and browser-default suppression is left to the UI capture flag.
   */
  flightLive = false

  constructor(target: Window = window) {
    this.target = target
    target.addEventListener('keydown', this.onKeyDown)
    target.addEventListener('keyup', this.onKeyUp)
    target.addEventListener('blur', this.onBlur)
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onKeyDown)
    this.target.removeEventListener('keyup', this.onKeyUp)
    this.target.removeEventListener('blur', this.onBlur)
    this.keys.clear()
    this.clearGamepadState()
  }

  sampleWithDt(dt: number): ControlState {
    const step = Math.max(0, Math.min(dt, 0.05))
    if (this.flightLive) this.updateGamepad(step)
    else this.clearGamepadState()

    this.controls.pitch = mergeAxis(this.axis('KeyW', 'KeyS'), this.gamepadPitch)
    this.controls.yaw = mergeAxis(this.axis('KeyD', 'KeyA'), this.gamepadYaw)
    this.controls.roll = mergeAxis(this.axis('KeyQ', 'KeyE'), this.gamepadRoll)
    this.controls.boost = this.keys.has('Space') || this.gamepadBoost

    // Engine power: Shift up, Ctrl down
    const thrRate = flightConfig.throttleRate
    let thr = this.controls.throttle
    if (this.keys.has('Digit1') || this.keys.has('ControlLeft') || this.keys.has('ControlRight')) {
      thr -= thrRate * step
    }
    if (this.keys.has('Digit2') || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) {
      thr += thrRate * step
    }
    thr += this.gamepadThrottle * thrRate * step
    this.controls.throttle = thr < 0 ? 0 : thr > 1 ? 1 : thr

    return this.controls
  }

  /** Sync throttle/gear when the aircraft is reset to the runway. */
  resetFlightControls(throttle = 0): void {
    this.controls.throttle = throttle
    this.controls.boost = false
    this.controls.pitch = 0
    this.controls.roll = 0
    this.controls.yaw = 0
    this.controls.gearDown = true
  }

  /** Forget one-shot C / R / N / M so the title screen cannot leak into Play. */
  clearQueued(): void {
    this.cameraToggleQueued = false
    this.resetQueued = false
    this.weatherCycleQueued = false
    this.audioToggleQueued = false
  }

  /** Drop a single code (e.g. Space used to start) without killing held stick. */
  release(code: string): void {
    this.keys.delete(code)
  }

  /** Full key wipe — window blur only. */
  clearKeys(): void {
    this.keys.clear()
    this.clearGamepadState()
    this.controls.boost = false
    this.controls.pitch = 0
    this.controls.roll = 0
    this.controls.yaw = 0
    this.clearQueued()
  }

  consumeCameraToggle(): boolean {
    if (!this.cameraToggleQueued) return false
    this.cameraToggleQueued = false
    return true
  }

  consumeReset(): boolean {
    if (!this.resetQueued) return false
    this.resetQueued = false
    return true
  }

  consumeWeatherCycle(): boolean {
    if (!this.weatherCycleQueued) return false
    this.weatherCycleQueued = false
    return true
  }

  consumeAudioToggle(): boolean {
    if (!this.audioToggleQueued) return false
    this.audioToggleQueued = false
    return true
  }

  private axis(positive: string, negative: string): number {
    return (this.keys.has(positive) ? 1 : 0) - (this.keys.has(negative) ? 1 : 0)
  }

  /** Poll a connected standard gamepad at 10 Hz to keep flight input cheap. */
  private updateGamepad(dt: number): void {
    this.gamepadPollIn -= dt
    if (this.gamepadPollIn > 0) return
    this.gamepadPollIn = GAMEPAD_POLL_INTERVAL
    this.clearGamepadState()

    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return
    let pads: readonly (Gamepad | null)[]
    try {
      pads = navigator.getGamepads()
    } catch {
      return
    }
    let pad: Gamepad | null = null
    for (let i = 0; i < pads.length; i++) {
      const candidate = pads[i]
      if (candidate?.connected) {
        pad = candidate
        break
      }
    }
    if (!pad) return

    // Standard mapping: left stick pitch/roll, right stick X yaw.
    this.gamepadRoll = normalizeGamepadAxis(pad.axes[0] ?? 0)
    this.gamepadPitch = -normalizeGamepadAxis(pad.axes[1] ?? 0)
    this.gamepadYaw = normalizeGamepadAxis(pad.axes[2] ?? 0)
    // LT brakes throttle, RT advances it, and A/ Cross is afterburner.
    const leftTrigger = pad.buttons[6]?.value ?? 0
    const rightTrigger = pad.buttons[7]?.value ?? 0
    this.gamepadThrottle = Math.max(0, Math.min(1, rightTrigger)) -
      Math.max(0, Math.min(1, leftTrigger))
    this.gamepadBoost = pad.buttons[0]?.pressed ?? false
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.flightLive && this.shouldPreventBrowserDefault(e)) {
      e.preventDefault()
    }

    this.keys.add(e.code)
    if (e.repeat) return
    if (!this.flightLive) return

    if (e.code === 'KeyC') this.cameraToggleQueued = true
    if (e.code === 'KeyR') this.resetQueued = true
    if (e.code === 'KeyN') this.weatherCycleQueued = true
    if (e.code === 'KeyM') this.audioToggleQueued = true
  }

  private shouldPreventBrowserDefault(e: KeyboardEvent): boolean {
    return (
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      e.code === 'Space' ||
      e.code === 'Tab' ||
      e.code === 'ArrowUp' ||
      e.code === 'ArrowDown' ||
      e.code === 'ArrowLeft' ||
      e.code === 'ArrowRight' ||
      e.code === 'ShiftLeft' ||
      e.code === 'ShiftRight' ||
      e.code === 'ControlLeft' ||
      e.code === 'ControlRight' ||
      e.code === 'KeyW' ||
      e.code === 'KeyA' ||
      e.code === 'KeyS' ||
      e.code === 'KeyD' ||
      e.code === 'KeyQ' ||
      e.code === 'KeyE' ||
      e.code === 'KeyR' ||
      e.code === 'KeyG' ||
      e.code === 'KeyC' ||
      e.code === 'KeyN' ||
      e.code === 'KeyM' ||
      e.code === 'F5'
    )
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code)
  }

  private onBlur = (): void => {
    this.keys.clear()
    this.clearGamepadState()
    this.clearQueued()
  }

  private clearGamepadState(): void {
    this.gamepadPollIn = 0
    this.gamepadPitch = 0
    this.gamepadRoll = 0
    this.gamepadYaw = 0
    this.gamepadThrottle = 0
    this.gamepadBoost = false
  }
}

/** Apply a centered dead zone and rescale the remaining stick travel. */
export function normalizeGamepadAxis(value: number, deadzone = 0.14): number {
  if (!Number.isFinite(value)) return 0
  const safeDeadzone = Math.max(0, Math.min(0.9, deadzone))
  const clamped = Math.max(-1, Math.min(1, value))
  const magnitude = Math.abs(clamped)
  if (magnitude <= safeDeadzone) return 0
  const scaled = (magnitude - safeDeadzone) / (1 - safeDeadzone)
  return Math.sign(clamped) * scaled
}

function mergeAxis(keyboard: number, gamepad: number): number {
  return Math.abs(keyboard) > 0.001 ? keyboard : gamepad
}
