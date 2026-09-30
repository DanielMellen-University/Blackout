import { flightConfig } from '../aircraft/flightConfig'
import { createDefaultControls, type ControlState } from './types'
import {
  DEFAULT_KEYBOARD_YAW,
  normalizeKeyboardYawPreference,
  normalizeKeyboardRollPreference,
  normalizeKeyboardPitchPreference,
  normalizeKeyboardBindings,
  type KeyboardBindings,
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
  private gamepadAirbrake = false
  private gamepadCameraHeld = false
  private gamepadGearHeld = false
  private gamepadWeatherHeld = false
  private gamepadAudioHeld = false
  private gamepadRadarHeld = false
  private gamepadStabilityHeld = false
  private gamepadGhostHeld = false
  private touchPitch = 0
  private touchRoll = 0
  private touchYaw = 0
  private touchThrottle = 0
  private touchBoost = false
  private touchAirbrake = false
  private touchCameraToggle = false
  private touchGearToggle = false
  private touchStabilityAssistToggle = false
  private touchRadarTargetCycle = false
  private touchWeatherCycle = false
  private touchAudioToggle = false
  private keyboardYawPreference: KeyboardYawPreference = DEFAULT_KEYBOARD_YAW
  private keyboardRollPreference: KeyboardRollPreference = 'q-right'
  private keyboardPitchPreference: KeyboardPitchPreference = 'w-up'
  private keyboardBindings: KeyboardBindings = {
    boost: 'Space',
    airbrake: 'KeyB',
    gear: 'KeyG',
  }
  private disposed = false

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
    if (this.disposed) return
    this.keyboardYawPreference = normalizeKeyboardYawPreference(preference)
  }

  get keyboardYaw(): KeyboardYawPreference {
    return this.keyboardYawPreference
  }

  setKeyboardRollPreference(preference: KeyboardRollPreference): void {
    if (this.disposed) return
    this.keyboardRollPreference = normalizeKeyboardRollPreference(preference)
  }

  get keyboardRoll(): KeyboardRollPreference {
    return this.keyboardRollPreference
  }

  setKeyboardPitchPreference(preference: KeyboardPitchPreference): void {
    if (this.disposed) return
    this.keyboardPitchPreference = normalizeKeyboardPitchPreference(preference)
  }

  setStabilityAssist(enabled: boolean): void {
    if (this.disposed) return
    this.stabilityAssist = enabled === true
    this.controls.stabilityAssist = this.stabilityAssist
  }

  get stabilityAssistEnabled(): boolean {
    return this.stabilityAssist
  }

  get keyboardPitch(): KeyboardPitchPreference {
    return this.keyboardPitchPreference
  }

  setKeyboardBindings(bindings: KeyboardBindings): void {
    if (this.disposed) return
    this.keyboardBindings = normalizeKeyboardBindings(bindings)
  }

  get bindings(): KeyboardBindings {
    return this.keyboardBindings
  }

  /**
   * Enter or leave the live-flight input context.
   *
   * Menu, pause, results, and focus-loss transitions must not carry held
   * controls into the next flight. The runtime uses this guarded transition
   * so keyboard, gamepad, and touch state are cleared at the boundary.
   */
  setFlightLive(enabled: boolean): void {
    if (this.disposed) return
    const next = enabled === true
    if (this.flightLive === next) {
      if (!next) {
        this.keys.clear()
        this.clearFlightState()
        this.clearQueued()
      }
      return
    }
    this.flightLive = next
    this.keys.clear()
    this.clearFlightState()
    this.clearQueued()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.target.removeEventListener('keydown', this.onKeyDown)
    this.target.removeEventListener('keyup', this.onKeyUp)
    this.target.removeEventListener('blur', this.onBlur)
    this.keys.clear()
    this.clearGamepadState()
    this.clearTouchState()
  }

  sampleWithDt(dt: number): ControlState {
    if (this.disposed) {
      this.keys.clear()
      this.clearFlightState()
      this.clearQueued()
      this.controls.throttle = 0
      return this.controls
    }
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
    this.controls.boost = this.keys.has(this.keyboardBindings.boost) || this.gamepadBoost || this.touchBoost
    this.controls.airbrake = this.keys.has(this.keyboardBindings.airbrake) || this.gamepadAirbrake || this.touchAirbrake
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
    if (this.disposed) return
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
    if (this.disposed) return
    this.touchPitch = clampAxis(state?.pitch)
    this.touchYaw = clampAxis(state?.yaw)
    this.touchRoll = clampAxis(state?.roll)
    this.touchThrottle = clampAxis(state?.throttle)
    this.touchBoost = state?.boost === true
    this.touchAirbrake = state?.airbrake === true
    const cameraToggle = state?.cameraToggle === true
    const gearToggle = state?.gearToggle === true
    const stabilityAssistToggle = state?.stabilityAssistToggle === true
    const radarTargetCycle = state?.radarTargetCycle === true
    const weatherCycle = state?.weatherCycle === true
    const audioToggle = state?.audioToggle === true
    if (this.flightLive && cameraToggle && !this.touchCameraToggle) this.cameraToggleQueued = true
    if (this.flightLive && gearToggle && !this.touchGearToggle) this.gearToggleQueued = true
    if (this.flightLive && stabilityAssistToggle && !this.touchStabilityAssistToggle) {
      this.stabilityAssistToggleQueued = true
    }
    if (this.flightLive && radarTargetCycle && !this.touchRadarTargetCycle) {
      this.radarTargetCycleQueued = true
    }
    if (this.flightLive && weatherCycle && !this.touchWeatherCycle) this.weatherCycleQueued = true
    if (this.flightLive && audioToggle && !this.touchAudioToggle) this.audioToggleQueued = true
    this.touchCameraToggle = cameraToggle
    this.touchGearToggle = gearToggle
    this.touchStabilityAssistToggle = stabilityAssistToggle
    this.touchRadarTargetCycle = radarTargetCycle
    this.touchWeatherCycle = weatherCycle
    this.touchAudioToggle = audioToggle
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
    if (this.disposed) return
    this.keys.delete(code)
  }

  /** Full key wipe — window blur only. */
  clearKeys(): void {
    if (this.disposed) return
    this.keys.clear()
    this.clearFlightState()
    this.clearQueued()
  }

  private clearFlightState(): void {
    this.clearGamepadState()
    this.clearTouchState()
    this.controls.boost = false
    this.controls.airbrake = false
    this.controls.pitch = 0
    this.controls.roll = 0
    this.controls.yaw = 0
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
    this.gamepadRoll = 0
    this.gamepadPitch = 0
    this.gamepadYaw = 0
    this.gamepadThrottle = 0
    this.gamepadBoost = false
    this.gamepadAirbrake = false

    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      this.clearGamepadEdges()
      return
    }
    let pads: readonly (Gamepad | null)[]
    try {
      pads = navigator.getGamepads()
    } catch {
      this.clearGamepadEdges()
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
    if (!pad) {
      this.clearGamepadEdges()
      return
    }

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
    this.gamepadAirbrake = pad.buttons[4]?.pressed ?? false

    // Standard mapping: X toggles gear, Y toggles the camera, B toggles trim
    // assist, View mutes, and the D-pad drives weather, ghost, and radar.
    // Queue only on press edges so held buttons cannot repeat at poll cadence.
    const cameraHeld = pad.buttons[3]?.pressed === true
    const gearHeld = pad.buttons[2]?.pressed === true
    const stabilityHeld = pad.buttons[1]?.pressed === true
    const audioHeld = pad.buttons[8]?.pressed === true
    const weatherHeld = pad.buttons[12]?.pressed === true
    const ghostHeld = pad.buttons[14]?.pressed === true
    const radarHeld = pad.buttons[15]?.pressed === true
    if (cameraHeld && !this.gamepadCameraHeld) this.cameraToggleQueued = true
    if (gearHeld && !this.gamepadGearHeld) this.gearToggleQueued = true
    if (stabilityHeld && !this.gamepadStabilityHeld) this.stabilityAssistToggleQueued = true
    if (audioHeld && !this.gamepadAudioHeld) this.audioToggleQueued = true
    if (weatherHeld && !this.gamepadWeatherHeld) this.weatherCycleQueued = true
    if (ghostHeld && !this.gamepadGhostHeld) this.ghostToggleQueued = true
    if (radarHeld && !this.gamepadRadarHeld) this.radarTargetCycleQueued = true
    this.gamepadCameraHeld = cameraHeld
    this.gamepadGearHeld = gearHeld
    this.gamepadStabilityHeld = stabilityHeld
    this.gamepadAudioHeld = audioHeld
    this.gamepadWeatherHeld = weatherHeld
    this.gamepadGhostHeld = ghostHeld
    this.gamepadRadarHeld = radarHeld
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.disposed) return
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
    if (e.code === this.keyboardBindings.gear) this.gearToggleQueued = true
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
      e.code === this.keyboardBindings.boost ||
      e.code === this.keyboardBindings.airbrake ||
      e.code === this.keyboardBindings.gear ||
      e.code === 'F5'
    )
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    if (this.disposed) return
    this.keys.delete(e.code)
  }

  private onBlur = (): void => {
    if (this.disposed) return
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
    this.gamepadAirbrake = false
    this.clearGamepadEdges()
  }

  private clearGamepadEdges(): void {
    this.gamepadCameraHeld = false
    this.gamepadGearHeld = false
    this.gamepadWeatherHeld = false
    this.gamepadAudioHeld = false
    this.gamepadRadarHeld = false
    this.gamepadStabilityHeld = false
    this.gamepadGhostHeld = false
  }

  private clearTouchState(): void {
    this.touchPitch = 0
    this.touchRoll = 0
    this.touchYaw = 0
    this.touchThrottle = 0
    this.touchBoost = false
    this.touchAirbrake = false
    this.touchCameraToggle = false
    this.touchGearToggle = false
    this.touchStabilityAssistToggle = false
    this.touchRadarTargetCycle = false
    this.touchWeatherCycle = false
    this.touchAudioToggle = false
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
