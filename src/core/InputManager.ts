import { flightConfig } from '../aircraft/flightConfig'
import { createDefaultControls, type ControlState } from './types'
import {
  DEFAULT_KEYBOARD_YAW,
  normalizeKeyboardYawPreference,
  normalizeKeyboardRollPreference,
  normalizeKeyboardPitchPreference,
  normalizeKeyboardBindings,
  normalizeKeyboardControlScheme,
  type KeyboardBindings,
  type KeyboardControlScheme,
  type KeyboardPitchPreference,
  type KeyboardRollPreference,
  type KeyboardYawPreference,
} from './FlightPreferences'
import type { FlightInputSource } from './FlightBriefing'

const FLIGHT_KEYS = new Set([
  'KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight',
  'ControlLeft', 'ControlRight', 'Digit1', 'Digit2', 'KeyC', 'KeyR', 'KeyP',
  'KeyN', 'KeyM', 'KeyT', 'KeyV', 'KeyX', 'KeyY',
])

/** Keep controller latency below one frame budget without polling every step. */
export const GAMEPAD_POLL_INTERVAL = 1 / 30

/**
 * Maps keyboard into ControlState for arcade flight.
 * W/S pitch, selectable A/D yaw + Q/E roll or conventional A/D roll + Q/E yaw,
 * Space boost, B speed brake, G gear, V trim assist, Shift/Ctrl throttle.
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
  private gamepadPauseHeld = false
  private gamepadResetHeld = false
  private gamepadConnected = false
  private gamepadMissingPolls = 0
  private gamepadConnectionQueued: 'connected' | 'disconnected' | null = null
  private keyboardYawPreference: KeyboardYawPreference = DEFAULT_KEYBOARD_YAW
  private keyboardRollPreference: KeyboardRollPreference = 'q-right'
  private keyboardPitchPreference: KeyboardPitchPreference = 'w-up'
  private keyboardControlScheme: KeyboardControlScheme = 'arcade'
  private keyboardBindings: KeyboardBindings = {
    boost: 'Space',
    airbrake: 'KeyB',
    gear: 'KeyG',
  }
  private disposed = false
  private inputSourceValue: FlightInputSource | null = null

  /** Last meaningful control source. Idle devices and menu typing do not steal hints. */
  get inputSource(): FlightInputSource | null {
    return this.inputSourceValue
  }

  cameraToggleQueued = false
  resetQueued = false
  pauseToggleQueued = false
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

  setKeyboardControlScheme(scheme: KeyboardControlScheme): void {
    if (this.disposed) return
    this.keyboardControlScheme = normalizeKeyboardControlScheme(scheme)
  }

  get keyboardScheme(): KeyboardControlScheme {
    return this.keyboardControlScheme
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
   * so keyboard and gamepad state are cleared at the boundary.
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
    this.controls.pitch = mergeAxis(keyboardPitch, this.gamepadPitch)
    const yawFirst = this.keyboardControlScheme === 'conventional' ? 'KeyQ' : 'KeyA'
    const yawSecond = this.keyboardControlScheme === 'conventional' ? 'KeyE' : 'KeyD'
    const keyboardYaw = this.keyboardYawPreference === 'a-left'
      ? this.axis(yawSecond, yawFirst)
      : this.axis(yawFirst, yawSecond)
    this.controls.yaw = mergeAxis(keyboardYaw, this.gamepadYaw)
    const rollFirst = this.keyboardControlScheme === 'conventional' ? 'KeyA' : 'KeyQ'
    const rollSecond = this.keyboardControlScheme === 'conventional' ? 'KeyD' : 'KeyE'
    const keyboardRoll = this.keyboardRollPreference === 'q-left'
      ? this.axis(rollSecond, rollFirst)
      : this.axis(rollFirst, rollSecond)
    this.controls.roll = mergeAxis(keyboardRoll, this.gamepadRoll)
    this.controls.boost = this.keys.has(this.keyboardBindings.boost) || this.gamepadBoost
    this.controls.airbrake = this.keys.has(this.keyboardBindings.airbrake) || this.gamepadAirbrake
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
    this.controls.throttle = clamp01(thr)

    // Keyboard wins the same mixed-input frames in which it owns the controls.
    if (this.flightLive) {
      for (const code of this.keys) {
        if (this.isFlightKey(code)) {
          this.inputSourceValue = 'keyboard'
          break
        }
      }
    }

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

  /** Forget one-shot P / C / R / N / M / T / G / V / X / Y so the title screen cannot leak into Play. */
  clearQueued(): void {
    this.cameraToggleQueued = false
    this.resetQueued = false
    this.pauseToggleQueued = false
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

  consumePauseToggle(): boolean {
    if (!this.pauseToggleQueued) return false
    this.pauseToggleQueued = false
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

  /** Consume a debounced controller link transition for a user-facing cue. */
  consumeGamepadConnection(): 'connected' | 'disconnected' | null {
    const transition = this.gamepadConnectionQueued
    this.gamepadConnectionQueued = null
    return transition
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
      this.markGamepadMissing()
      return
    }
    let pads: readonly (Gamepad | null)[]
    try {
      const rawPads = navigator.getGamepads()
      pads = Array.isArray(rawPads) ? rawPads : []
    } catch {
      this.markGamepadMissing()
      return
    }
    let pad: Gamepad | null = null
    for (let i = 0; i < pads.length; i++) {
      const candidate = pads[i]
      if (candidate && typeof candidate === 'object' && candidate.connected === true) {
        pad = candidate
        break
      }
    }
    if (!pad) {
      this.markGamepadMissing()
      return
    }
    this.markGamepadPresent()

    // Browsers normally expose both arrays, but a disconnect during polling
    // can briefly hand back a partial object. Treat malformed arrays as an
    // empty device so stale controls are cleared instead of crashing RAF.
    const rawAxes = (pad as unknown as { axes?: unknown }).axes
    const rawButtons = (pad as unknown as { buttons?: unknown }).buttons
    const axes: readonly number[] = Array.isArray(rawAxes) ? rawAxes as readonly number[] : []
    const buttons: readonly { pressed?: boolean; value?: number }[] =
      Array.isArray(rawButtons) ? rawButtons as readonly { pressed?: boolean; value?: number }[] : []

    // Standard mapping: left stick pitch/roll, right stick X yaw.
    this.gamepadRoll = normalizeGamepadAxis(axes[0] ?? 0)
    const pitch = normalizeGamepadAxis(axes[1] ?? 0)
    this.gamepadPitch = pitch === 0 ? 0 : -pitch
    this.gamepadYaw = normalizeGamepadAxis(axes[2] ?? 0)
    // LT brakes throttle, RT advances it, and A/ Cross is afterburner.
    const leftTrigger = normalizeGamepadTrigger(buttons[6]?.value ?? 0)
    const rightTrigger = normalizeGamepadTrigger(buttons[7]?.value ?? 0)
    this.gamepadThrottle = rightTrigger - leftTrigger
    this.gamepadBoost = buttons[0]?.pressed === true
    this.gamepadAirbrake = buttons[4]?.pressed === true

    // Standard mapping: X toggles gear, Y toggles the camera, B toggles trim
    // assist, View mutes, Start pauses, and the D-pad drives reset, weather,
    // ghost, and radar.
    // Queue only on press edges so held buttons cannot repeat at poll cadence.
    const cameraHeld = buttons[3]?.pressed === true
    const gearHeld = buttons[2]?.pressed === true
    const stabilityHeld = buttons[1]?.pressed === true
    const audioHeld = buttons[8]?.pressed === true
    const weatherHeld = buttons[12]?.pressed === true
    const resetHeld = buttons[13]?.pressed === true
    const ghostHeld = buttons[14]?.pressed === true
    const radarHeld = buttons[15]?.pressed === true
    const pauseHeld = buttons[9]?.pressed === true
    if (this.gamepadPitch !== 0 || this.gamepadRoll !== 0 || this.gamepadYaw !== 0 ||
      this.gamepadThrottle !== 0 || this.gamepadBoost || this.gamepadAirbrake || cameraHeld || gearHeld ||
      stabilityHeld || audioHeld || weatherHeld || resetHeld || ghostHeld || radarHeld || pauseHeld) {
      this.inputSourceValue = 'gamepad'
    }
    if (cameraHeld && !this.gamepadCameraHeld) this.cameraToggleQueued = true
    if (gearHeld && !this.gamepadGearHeld) this.gearToggleQueued = true
    if (stabilityHeld && !this.gamepadStabilityHeld) this.stabilityAssistToggleQueued = true
    if (audioHeld && !this.gamepadAudioHeld) this.audioToggleQueued = true
    if (weatherHeld && !this.gamepadWeatherHeld) this.weatherCycleQueued = true
    if (resetHeld && !this.gamepadResetHeld) this.resetQueued = true
    if (ghostHeld && !this.gamepadGhostHeld) this.ghostToggleQueued = true
    if (radarHeld && !this.gamepadRadarHeld) this.radarTargetCycleQueued = true
    if (pauseHeld && !this.gamepadPauseHeld) this.pauseToggleQueued = true
    this.gamepadCameraHeld = cameraHeld
    this.gamepadGearHeld = gearHeld
    this.gamepadStabilityHeld = stabilityHeld
    this.gamepadAudioHeld = audioHeld
    this.gamepadWeatherHeld = weatherHeld
    this.gamepadResetHeld = resetHeld
    this.gamepadGhostHeld = ghostHeld
    this.gamepadRadarHeld = radarHeld
    this.gamepadPauseHeld = pauseHeld
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.disposed) return
    if (this.flightLive && this.shouldPreventBrowserDefault(e)) {
      e.preventDefault()
    }

    this.keys.add(e.code)
    if (this.flightLive && this.isFlightKey(e.code)) this.inputSourceValue = 'keyboard'
    if (e.repeat) return
    if (!this.flightLive) return

    if (e.code === 'KeyC') this.cameraToggleQueued = true
    if (e.code === 'KeyP') this.pauseToggleQueued = true
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
      e.code === 'KeyP' ||
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

  private isFlightKey(code: string): boolean {
    return FLIGHT_KEYS.has(code) || code === this.keyboardBindings.boost ||
      code === this.keyboardBindings.airbrake || code === this.keyboardBindings.gear
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    if (this.disposed) return
    this.keys.delete(e.code)
  }

  private onBlur = (): void => {
    if (this.disposed) return
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
    this.gamepadAirbrake = false
    this.gamepadConnected = false
    this.gamepadMissingPolls = 0
    this.gamepadConnectionQueued = null
    this.clearGamepadEdges()
  }

  private markGamepadPresent(): void {
    this.gamepadMissingPolls = 0
    if (this.gamepadConnected) return
    this.gamepadConnected = true
    this.gamepadConnectionQueued = 'connected'
  }

  private markGamepadMissing(): void {
    this.gamepadMissingPolls = Math.min(2, this.gamepadMissingPolls + 1)
    this.clearGamepadEdges()
    if (this.gamepadMissingPolls < 2 || !this.gamepadConnected) return
    this.gamepadConnected = false
    this.gamepadConnectionQueued = 'disconnected'
    if (this.inputSourceValue === 'gamepad') this.inputSourceValue = null
  }

  private clearGamepadEdges(): void {
    this.gamepadCameraHeld = false
    this.gamepadGearHeld = false
    this.gamepadWeatherHeld = false
    this.gamepadAudioHeld = false
    this.gamepadRadarHeld = false
    this.gamepadStabilityHeld = false
    this.gamepadGhostHeld = false
    this.gamepadPauseHeld = false
    this.gamepadResetHeld = false
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

function mergeAxis(keyboard: number, gamepad: number): number {
  if (Math.abs(keyboard) > 0.001) return keyboard
  if (Number.isFinite(gamepad) && Math.abs(gamepad) > 0.001) return gamepad
  return 0
}

function normalizeGamepadTrigger(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}
