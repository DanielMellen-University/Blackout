import { createDefaultControls, type ControlState } from './types'

/**
 * Maps keyboard into ControlState for arcade flight.
 * W/S pitch, A/D roll, Q/E yaw, Space boost, Shift/Ctrl throttle, G gear.
 *
 * Throttle is a held continuous setpoint (0–1): Shift raises, Ctrl lowers
 * every frame so the ENG bar can track live.
 */
export class InputManager {
  private readonly keys = new Set<string>()
  private readonly controls: ControlState = createDefaultControls()
  private readonly target: Window

  cameraToggleQueued = false
  resetQueued = false
  weatherCycleQueued = false

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
  }

  /** Prefer sampleWithDt for smooth throttle. */
  sample(): ControlState {
    return this.sampleWithDt(1 / 60)
  }

  sampleWithDt(dt: number): ControlState {
    const step = Math.max(0, Math.min(dt, 0.05))

    this.controls.pitch = this.axis('KeyW', 'KeyS')
    // A/D yaw, Q/E roll (inverted: Q roll right, E roll left)
    this.controls.yaw = this.axis('KeyD', 'KeyA')
    this.controls.roll = this.axis('KeyQ', 'KeyE')
    this.controls.boost = this.keys.has('Space')

    // Engine power: Shift up, Ctrl down (fast spool so airbrake engages quickly)
    const thrRate = 0.95
    let thr = this.controls.throttle
    if (this.keys.has('Digit1') || this.keys.has('ControlLeft') || this.keys.has('ControlRight')) {
      thr -= thrRate * step
    }
    if (this.keys.has('Digit2') || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) {
      thr += thrRate * step
    }
    this.controls.throttle = thr < 0 ? 0 : thr > 1 ? 1 : thr

    return this.controls
  }

  /** Current engine power setpoint 0–1 (same object the HUD samples). */
  get throttle(): number {
    return this.controls.throttle
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

  private axis(positive: string, negative: string): number {
    return (this.keys.has(positive) ? 1 : 0) - (this.keys.has(negative) ? 1 : 0)
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    // Block browser defaults for flight keys + any Ctrl/Cmd combo (Ctrl+W closes tab)
    if (
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
      e.code === 'F5'
    ) {
      e.preventDefault()
    }

    this.keys.add(e.code)
    if (e.repeat) return

    if (e.code === 'KeyC') this.cameraToggleQueued = true
    if (e.code === 'KeyR') this.resetQueued = true
    if (e.code === 'KeyN') this.weatherCycleQueued = true
    if (e.code === 'KeyG') this.controls.gearDown = !this.controls.gearDown
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code)
  }

  private onBlur = (): void => {
    this.keys.clear()
  }
}
