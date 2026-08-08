import { createDefaultControls, type ControlState } from './types'

/**
 * Maps keyboard into ControlState for arcade flight.
 * W/S pitch, A/D roll, Q/E yaw, Space boost, Shift/Ctrl throttle, G gear.
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

  /** Prefer sampleWithDt for smooth throttle. */
  sample(): ControlState {
    return this.sampleWithDt(1 / 60)
  }

  sampleWithDt(dt: number): ControlState {
    this.controls.pitch = this.axis('KeyW', 'KeyS')
    // A/D yaw, Q/E roll (swapped from classic flight layout)
    this.controls.yaw = this.axis('KeyD', 'KeyA')
    this.controls.roll = this.axis('KeyE', 'KeyQ')
    this.controls.boost = this.keys.has('Space')

    const thrRate = 0.55
    if (this.keys.has('Digit1') || this.keys.has('ControlLeft') || this.keys.has('ControlRight')) {
      this.controls.throttle = Math.max(0, this.controls.throttle - thrRate * dt)
    }
    if (this.keys.has('Digit2') || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) {
      this.controls.throttle = Math.min(1, this.controls.throttle + thrRate * dt)
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
