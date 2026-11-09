import { flightConfig } from '../../aircraft/flightConfig'
import { normalizeGamepadAxis } from '../../core/InputManager'
import type { OperationStick } from '../../systems/operation/stick'

interface PadButton {
  pressed?: boolean
  value?: number
}

interface StandardPad {
  connected?: boolean
  mapping?: string
  axes?: readonly number[]
  buttons?: readonly PadButton[]
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function mergeAxis(keyboard: number, gamepad: number): number {
  if (Math.abs(keyboard) > 0.001) return keyboard
  if (Number.isFinite(gamepad) && Math.abs(gamepad) > 0.001) return gamepad
  return 0
}

function trigger(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value!)) : 0
}

/** Standard-mapping pad. Missing or malformed devices contribute nothing. */
export function readOperationPad(pads: readonly (StandardPad | null)[] | null | undefined): StandardPad | null {
  if (!pads) return null
  for (const candidate of pads) {
    if (candidate && candidate.connected === true && candidate.mapping === 'standard') return candidate
  }
  return null
}

/**
 * Keyboard and gamepad for the ridge relay.
 * W/S pitch, A/D roll (A left), Q/E rudder, Shift/Ctrl power, Space nitro, B brake.
 * The left stick is pitch and roll, the right stick is rudder, and the triggers move power.
 */
export class OperationStickInput {
  private readonly keys = new Set<string>()
  private throttle = 0.5
  private attached = false
  private captureKeys = false
  private readonly target: Pick<Window, 'addEventListener' | 'removeEventListener'> | null
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.captureKeys && this.isStickKey(event.code)) event.preventDefault()
    this.keys.add(event.code)
  }
  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code)
  }
  private readonly onBlur = (): void => {
    this.keys.clear()
  }

  constructor(target: Pick<Window, 'addEventListener' | 'removeEventListener'> | null = null) {
    this.target = target
  }

  attach(): void {
    if (this.attached || !this.target || typeof this.target.addEventListener !== 'function') return
    this.attached = true
    this.target.addEventListener('keydown', this.onKeyDown as EventListener)
    this.target.addEventListener('keyup', this.onKeyUp as EventListener)
    this.target.addEventListener('blur', this.onBlur as EventListener)
  }

  detach(): void {
    if (!this.attached || !this.target) return
    this.attached = false
    this.target.removeEventListener('keydown', this.onKeyDown as EventListener)
    this.target.removeEventListener('keyup', this.onKeyUp as EventListener)
    this.target.removeEventListener('blur', this.onBlur as EventListener)
    this.keys.clear()
  }

  /** While flying, flight keys stay on the stick instead of activating a focused button. */
  setCapture(capture: boolean): void {
    this.captureKeys = capture
  }

  setThrottle(value: number): void {
    this.throttle = clamp01(value)
  }

  sample(dt: number, pads?: readonly (StandardPad | null)[] | null): OperationStick {
    const step = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.05)) : 0
    const pad = pads === undefined ? this.pollPad() : readOperationPad(pads)
    const axes = Array.isArray(pad?.axes) ? pad.axes : []
    const buttons = Array.isArray(pad?.buttons) ? pad.buttons : []
    const gamepadRoll = normalizeGamepadAxis(axes[0] ?? 0)
    const pitched = normalizeGamepadAxis(axes[1] ?? 0)
    const gamepadPitch = pitched === 0 ? 0 : -pitched
    const gamepadYaw = normalizeGamepadAxis(axes[2] ?? 0)
    const rate = flightConfig.throttleRate * step
    if (this.keys.has('Digit1') || this.keys.has('ControlLeft') || this.keys.has('ControlRight')) this.throttle -= rate
    if (this.keys.has('Digit2') || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) this.throttle += rate
    this.throttle += (trigger(buttons[7]?.value) - trigger(buttons[6]?.value)) * rate
    this.throttle = clamp01(this.throttle)
    return {
      pitch: mergeAxis(this.axis('KeyW', 'KeyS'), gamepadPitch),
      roll: mergeAxis(this.axis('KeyD', 'KeyA'), gamepadRoll),
      yaw: mergeAxis(this.axis('KeyE', 'KeyQ'), gamepadYaw),
      throttle: this.throttle,
      boost: this.keys.has('Space') || buttons[0]?.pressed === true,
      airbrake: this.keys.has('KeyB') || buttons[4]?.pressed === true,
    }
  }

  private pollPad(): StandardPad | null {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return null
    try {
      const raw = navigator.getGamepads()
      return readOperationPad(Array.isArray(raw) ? raw : [])
    } catch {
      return null
    }
  }

  private axis(positive: string, negative: string): number {
    return (this.keys.has(positive) ? 1 : 0) - (this.keys.has(negative) ? 1 : 0)
  }

  private isStickKey(code: string): boolean {
    return code === 'KeyW' || code === 'KeyA' || code === 'KeyS' || code === 'KeyD' ||
      code === 'KeyQ' || code === 'KeyE' || code === 'Space' || code === 'KeyB' ||
      code === 'ShiftLeft' || code === 'ShiftRight' || code === 'ControlLeft' || code === 'ControlRight' ||
      code === 'Digit1' || code === 'Digit2'
  }
}
