import { flightConfig } from '../aircraft/flightConfig'
import { createDefaultControls, type ControlState } from './types'
import {
  normalizeKeyboardYawPreference,
  normalizeKeyboardRollPreference,
  normalizeKeyboardPitchPreference,
  type KeyboardPitchPreference,
  type KeyboardRollPreference,
  type KeyboardYawPreference,
} from './FlightPreferences'
import type { TouchInputState } from './TouchControls'

/** Keep controller latency below one frame budget without polling every step. */
export const GAMEPAD_POLL_INTERVAL = 1 / 30

/**
 * Maps keyboard into ControlState for arcade flight.
 * W/S pitch, A/D yaw (configurable direction), Q/E roll, Space boost, B speed brake, G gear, V trim assist, Shift/Ctrl throttle.
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
  private touchPitch = 0
  private touchRoll = 0
  private touchYaw = 0
  private touchThrottle = 0
  private touchBoost = false
  private keyboardYawPreference: KeyboardYawPreference = 'a-right'
  private keyboardRollPreference: KeyboardRollPreference = 'q-right'
  private keyboardPitchPreference: KeyboardPitchPreference = 'w-up'

  cameraToggleQueued = false
  resetQueued = false
  weatherCycleQueued = false
  audioToggleQueued = false
  radarTargetCycleQueued = false
  gearToggleQueued = false
  stabilityAssistToggleQueued = false
  ghostToggleQueued = false
  worldSeedCopyQueued = false
  /**
   * When false, keys are still tracked for stick continuity but C/R/N are not
   * queued and browser-default suppression is left to the UI capture flag.
   */
  flightLive = false
  private stabilityAssist = false

  constructor(target: Window = window) {
    this.target = target
    target.addEventListener('keydown', this.onKeyDown)
    target.addEventListener('keyup', this.onKeyUp)
    target.addEventListener('blur', this.onBlur)
  }

  setKeyboardYawPreference(preference: KeyboardYawPreference): void {
    this.keyboardYawPreference = normalizeKeyboardYawPreference(preference)
  }

  get keyboardYaw(): KeyboardYawPreference {
    return this.keyboardYawPreference
  }

  setKeyboardRollPreference(preference: KeyboardRollPreference): void {
    this.keyboardRollPreference = normalizeKeyboardRollPreference(preference)
  }

  get keyboardRoll(): KeyboardRollPreference {
    return this.keyboardRollPreference
  }

  setKeyboardPitchPreference(preference: KeyboardPitchPreference): void {
    this.keyboardPitchPreference = normalizeKeyboardPitchPreference(preference)
  }

  get keyboardPitch(): KeyboardPitchPreference {
    return this.keyboardPitchPreference
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onKeyDown)
    this.target.removeEventListener('keyup', this.onKeyUp)
    this.target.removeEventListener('blur', this.onBlur)
    this.keys.clear()
    this.clearGamepadState()
    this.clearTouchState()
  }

  sampleWithDt(dt: number): ControlState {
    const step = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.05)) : 0
    if (this.flightLive) this.updateGamepad(step)
    else this.clearGamepadState()

    const keyboardPitch = this.keyboardPitchPreference === 'w-down'
      ? this.axis('KeyS', 'KeyW')
      : this.axis('KeyW', 'KeyS')
    this.controls.pitch = mergeAxis(keyboardPitch, this.gamepadPitch, this.touchPitch)
    const keyboardYaw = this.keyboardYawPreference === 'a-left'
      ? this.axis('KeyD', 'KeyA')
      : this.axis('KeyA', 'KeyD')
    this.controls.yaw = mergeAxis(keyboardYaw, this.gamepadYaw, this.touchYaw)
    const keyboardRoll = this.keyboardRollPreference === 'q-left'
      ? this.axis('KeyE', 'KeyQ')
      : this.axis('KeyQ', 'KeyE')
    this.controls.roll = mergeAxis(keyboardRoll, this.gamepadRoll, this.touchRoll)
    this.controls.boost = this.keys.has('Space') || this.gamepadBoost || this.touchBoost
    this.controls.airbrake = this.keys.has('KeyB')
    this.controls.stabilityAssist = this.stabilityAssist

    // Engine power: Shift up, Ctrl down
    const thrRate = flightConfig.throttleRate
    let thr = Number.isFinite(this.controls.throttle) ? this.controls.throttle : 0
    if (this.keys.has('Digit1') || this.keys.has('ControlLeft') || this.keys.has('ControlRight')) {
      thr -= thrRate * step
    }
    if (this.keys.has('Digit2') || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) {
      thr += thrRate * step
    }
    thr += this.gamepadThrottle * thrRate * step
    thr += this.touchThrottle * thrRate * step
    this.controls.throttle = clamp01(thr)

    return this.controls
  }

  /** Sync throttle/gear when the aircraft is reset to the runway. */
  resetFlightControls(throttle = 0): void {
    this.controls.throttle = clamp01(throttle)
    this.controls.boost = false
    this.controls.airbrake = false
    this.controls.pitch = 0
    this.controls.roll = 0
    this.controls.yaw = 0
    this.controls.gearDown = true
    this.controls.stabilityAssist = this.stabilityAssist
  }

  /** Feed the optional event-driven touch deck into the normal input sampler. */
  setTouchState(state: Partial<TouchInputState> | null): void {
    this.touchPitch = clampAxis(state?.pitch)
    this.touchYaw = clampAxis(state?.yaw)
    this.touchRoll = clampAxis(state?.roll)
    this.touchThrottle = clampAxis(state?.throttle)
    this.touchBoost = state?.boost === true
  }

  /** Forget one-shot C / R / N / M / T / G / V / X / Y so the title screen cannot leak into Play. */
  clearQueued(): void {
    this.cameraToggleQueued = false
    this.resetQueued = false
    this.weatherCycleQueued = false
    this.audioToggleQueued = false
    this.radarTargetCycleQueued = false
    this.gearToggleQueued = false
    this.stabilityAssistToggleQueued = false
    this.ghostToggleQueued = false
    this.worldSeedCopyQueued = false
  }

  /** Drop a single code (e.g. Space used to start) without killing held stick. */
  release(code: string): void {
    this.keys.delete(code)
  }

  /** Full key wipe — window blur only. */
  clearKeys(): void {
    this.keys.clear()
    this.clearGamepadState()
    this.clearTouchState()
    this.controls.boost = false
    this.controls.airbrake = false
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

  consumeRadarTargetCycle(): boolean {
    if (!this.radarTargetCycleQueued) return false
    this.radarTargetCycleQueued = false
    return true
  }

  consumeGearToggle(): boolean {
    if (!this.gearToggleQueued) return false
    this.gearToggleQueued = false
    return true
  }

  /** Consume the optional pitch and bank trim assist toggle, if queued. */
  consumeStabilityAssistToggle(): boolean | null {
    if (!this.stabilityAssistToggleQueued) return null
    this.stabilityAssistToggleQueued = false
    this.stabilityAssist = !this.stabilityAssist
    this.controls.stabilityAssist = this.stabilityAssist
    return this.stabilityAssist
  }

  consumeWorldSeedCopy(): boolean {
    if (!this.worldSeedCopyQueued) return false
    this.worldSeedCopyQueued = false
    return true
  }

  consumeGhostToggle(): boolean {
    if (!this.ghostToggleQueued) return false
    this.ghostToggleQueued = false
    return true
  }

  private axis(positive: string, negative: string): number {
    return (this.keys.has(positive) ? 1 : 0) - (this.keys.has(negative) ? 1 : 0)
  }

  /** Poll a connected standard gamepad at 30 Hz to keep flight input cheap. */
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
    const pitch = normalizeGamepadAxis(pad.axes[1] ?? 0)
    this.gamepadPitch = pitch === 0 ? 0 : -pitch
    this.gamepadYaw = normalizeGamepadAxis(pad.axes[2] ?? 0)
    // LT brakes throttle, RT advances it, and A/ Cross is afterburner.
    const leftTrigger = normalizeGamepadTrigger(pad.buttons[6]?.value ?? 0)
    const rightTrigger = normalizeGamepadTrigger(pad.buttons[7]?.value ?? 0)
    this.gamepadThrottle = rightTrigger - leftTrigger
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
    if (e.code === 'KeyT') this.radarTargetCycleQueued = true
    if (e.code === 'KeyG') this.gearToggleQueued = true
    if (e.code === 'KeyV') this.stabilityAssistToggleQueued = true
    if (e.code === 'KeyX') this.ghostToggleQueued = true
    if (e.code === 'KeyY') this.worldSeedCopyQueued = true
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
      e.code === 'KeyB' ||
      e.code === 'KeyT' ||
      e.code === 'KeyV' ||
      e.code === 'KeyX' ||
      e.code === 'KeyY' ||
      e.code === 'F5'
    )
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code)
  }

  private onBlur = (): void => {
    this.keys.clear()
    this.clearGamepadState()
    this.clearTouchState()
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

  private clearTouchState(): void {
    this.touchPitch = 0
    this.touchRoll = 0
    this.touchYaw = 0
    this.touchThrottle = 0
    this.touchBoost = false
  }
}

/** Apply a centered dead zone and rescale the remaining stick travel. */
export function normalizeGamepadAxis(value: number, deadzone = 0.14): number {
  if (!Number.isFinite(value)) return 0
  const safeDeadzone = Number.isFinite(deadzone)
    ? Math.max(0, Math.min(0.9, deadzone))
    : 0.14
  const clamped = Math.max(-1, Math.min(1, value))
  const magnitude = Math.abs(clamped)
  if (magnitude <= safeDeadzone) return 0
  const scaled = (magnitude - safeDeadzone) / (1 - safeDeadzone)
  return Math.sign(clamped) * scaled
}

function mergeAxis(keyboard: number, gamepad: number, touch: number): number {
  if (Math.abs(keyboard) > 0.001) return keyboard
  if (Number.isFinite(gamepad) && Math.abs(gamepad) > 0.001) return gamepad
  return Number.isFinite(touch) ? touch : 0
}

function clampAxis(value: number | undefined): number {
  const finite = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return Math.max(-1, Math.min(1, finite))
}

function normalizeGamepadTrigger(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}
