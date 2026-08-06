import { createDefaultControls, type ControlState } from './types'

/**
 * Maps keyboard into a neutral ControlState.
 * Phase 0 free-fly reuses pitch/roll/yaw as move / turn / vertical axes.
 */
export class InputManager {
  private readonly keys = new Set<string>()
  private readonly controls: ControlState = createDefaultControls()
  private readonly target: Window

  cameraToggleQueued = false
  resetQueued = false

  constructor(target: Window = window) {
    this.target = target
    target.addEventListener('keydown', this.onKeyDown)
    target.addEventListener('keyup', this.onKeyUp)
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onKeyDown)
    this.target.removeEventListener('keyup', this.onKeyUp)
    this.keys.clear()
  }

  /** Current control snapshot (reused object - copy if you need to stash it). */
  sample(): ControlState {
    // Phase 0 free-fly: pitch=W/S, roll=A/D turn, yaw=Q/E vertical
    this.controls.pitch = this.axis('KeyW', 'KeyS')
    this.controls.roll = this.axis('KeyD', 'KeyA')
    this.controls.yaw = this.axis('KeyE', 'KeyQ')
    // Space for boost (not Shift) so Shift+RMB never pairs with look
    this.controls.boost = this.keys.has('Space')

    if (this.keys.has('Digit1')) {
      this.controls.throttle = Math.max(0, this.controls.throttle - 0.01)
    }
    if (this.keys.has('Digit2')) {
      this.controls.throttle = Math.min(1, this.controls.throttle + 0.01)
    }

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
    return (this.keys.has(positive) ? 1 : 0) - (this.keys.has(negative) ? 1 : 0)
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault()
    }

    this.keys.add(e.code)
    if (e.repeat) return

    if (e.code === 'KeyC') this.cameraToggleQueued = true
    if (e.code === 'KeyR') this.resetQueued = true
    if (e.code === 'KeyG') this.controls.gearDown = !this.controls.gearDown
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code)
  }
}
