import { createDefaultControls, type ControlState } from './types'

/**
 * Maps keyboard (and later mouse/gamepad) into a neutral ControlState.
 * Phase 0: free-fly axes (WASD + QE altitude) rather than true flight surfaces.
 */
export class InputManager {
  private keys = new Set<string>()
  private readonly controls: ControlState = createDefaultControls()

  /** One-shot actions consumed by the main loop. */
  cameraToggleQueued = false
  resetQueued = false

  constructor(target: Window = window) {
    target.addEventListener('keydown', this.onKeyDown)
    target.addEventListener('keyup', this.onKeyUp)
    // Prevent page scroll on space / arrows when focused on game
    target.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault()
      }
    })
  }

  dispose(target: Window = window): void {
    target.removeEventListener('keydown', this.onKeyDown)
    target.removeEventListener('keyup', this.onKeyUp)
  }

  /** Read current control snapshot (mutates internal state for axes). */
  sample(): ControlState {
    const forward = this.axis('KeyW', 'KeyS')
    const strafe = this.axis('KeyD', 'KeyA')
    const vertical = this.axis('KeyE', 'KeyQ')

    // Phase 0 free-fly mapping: pitch/roll/yaw double as move intents
    this.controls.pitch = forward
    this.controls.roll = strafe
    this.controls.yaw = vertical
    this.controls.boost = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')

    // Throttle nudge with 1 / 2 (optional fine control)
    if (this.keys.has('Digit1')) this.controls.throttle = Math.max(0, this.controls.throttle - 0.01)
    if (this.keys.has('Digit2')) this.controls.throttle = Math.min(1, this.controls.throttle + 0.01)

    return this.controls
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

  private axis(positive: string, negative: string): number {
    const p = this.keys.has(positive) ? 1 : 0
    const n = this.keys.has(negative) ? 1 : 0
    return p - n
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) {
      this.keys.add(e.code)
      return
    }
    this.keys.add(e.code)

    if (e.code === 'KeyC') this.cameraToggleQueued = true
    if (e.code === 'KeyR') this.resetQueued = true
    if (e.code === 'KeyG') this.controls.gearDown = !this.controls.gearDown
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code)
  }
}
