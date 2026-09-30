/** The actions exposed by the optional live-flight touch deck. */
export type TouchAction =
  | 'pitch-up'
  | 'pitch-down'
  | 'yaw-left'
  | 'yaw-right'
  | 'roll-left'
  | 'roll-right'
  | 'throttle-up'
  | 'throttle-down'
  | 'boost'
  | 'airbrake'
  | 'camera-toggle'
  | 'gear-toggle'
  | 'stability-toggle'

/** Event-driven touch input, normalized to the same ranges as ControlState. */
export interface TouchInputState {
  pitch: number
  yaw: number
  roll: number
  throttle: number
  boost: boolean
  airbrake?: boolean
  cameraToggle?: boolean
  gearToggle?: boolean
  stabilityAssistToggle?: boolean
}

const TOUCH_ACTIONS: ReadonlySet<string> = new Set<TouchAction>([
  'pitch-up',
  'pitch-down',
  'yaw-left',
  'yaw-right',
  'roll-left',
  'roll-right',
  'throttle-up',
  'throttle-down',
  'boost',
  'airbrake',
  'camera-toggle',
  'gear-toggle',
  'stability-toggle',
])

interface ActiveTouchPointer {
  action: TouchAction
  button: HTMLElement
}

/** Touch screens and coarse pointers should get the optional control deck. */
export function touchInputSupported(maxTouchPoints: number, coarsePointer: boolean): boolean {
  return (Number.isFinite(maxTouchPoints) && maxTouchPoints > 0) || coarsePointer
}

/**
 * Maps held pointer buttons into flight axes without adding work to the RAF
 * loop. Pointer releases and focus-loss cleanup prevent a finger leaving the
 * button or tab from leaving an axis latched.
 */
export class TouchControls {
  private readonly root: HTMLElement
  private readonly onChange: (state: TouchInputState) => void
  private readonly activePointers = new Map<number, ActiveTouchPointer>()
  private visible = false
  private disposed = false

  constructor(root: HTMLElement, onChange: (state: TouchInputState) => void) {
    this.root = root
    this.onChange = onChange
    root.hidden = true
    root.setAttribute('aria-hidden', 'true')
    root.addEventListener('pointerdown', this.onPointerDown)
    root.addEventListener('lostpointercapture', this.onLostPointerCapture)
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('pointercancel', this.onPointerUp)
    window.addEventListener('blur', this.onFocusLost)
    document.addEventListener('visibilitychange', this.onVisibilityChange)
  }

  setVisible(visible: boolean): void {
    if (this.disposed || this.visible === visible) return
    this.visible = visible
    this.root.hidden = !visible
    this.root.setAttribute('aria-hidden', visible ? 'false' : 'true')
    if (!visible) {
      this.clearActivePointers()
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.root.removeEventListener('pointerdown', this.onPointerDown)
    this.root.removeEventListener('lostpointercapture', this.onLostPointerCapture)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('pointercancel', this.onPointerUp)
    window.removeEventListener('blur', this.onFocusLost)
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    this.clearActivePointers()
    this.root.hidden = true
    this.root.setAttribute('aria-hidden', 'true')
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (this.disposed || !this.visible) return
    const control = this.controlForTarget(event.target)
    if (!control) return
    event.preventDefault()
    const previous = this.activePointers.get(event.pointerId)
    if (previous) {
      this.activePointers.delete(event.pointerId)
      this.releasePointer(previous.button, event.pointerId)
      if (!this.activePointersHasAction(previous.action)) this.setButtonState(previous.button, false)
    }
    this.activePointers.set(event.pointerId, control)
    this.capturePointer(control.button, event.pointerId)
    this.setButtonState(control.button, true)
    this.emit()
  }

  private onPointerUp = (event: PointerEvent): void => {
    if (this.disposed) return
    const active = this.activePointers.get(event.pointerId)
    if (!active) return
    this.activePointers.delete(event.pointerId)
    if (!this.activePointersHasAction(active.action)) this.setButtonState(active.button, false)
    this.releasePointer(active.button, event.pointerId)
    this.emit()
  }

  private onLostPointerCapture = (event: PointerEvent): void => {
    this.onPointerUp(event)
  }

  private onFocusLost = (): void => {
    this.clearActivePointers()
  }

  private onVisibilityChange = (): void => {
    if (document.hidden) this.clearActivePointers()
  }

  private clearActivePointers(): void {
    if (this.activePointers.size === 0) return
    const activePointers = [...this.activePointers.entries()]
    this.activePointers.clear()
    this.clearButtonStates()
    for (const [pointerId, active] of activePointers) {
      this.releasePointer(active.button, pointerId)
    }
    this.emit()
  }

  private controlForTarget(target: EventTarget | null): ActiveTouchPointer | null {
    if (typeof Element === 'undefined' || !(target instanceof Element)) return null
    const button = target.closest<HTMLElement>('[data-touch-action]')
    if (!button || !this.root.contains(button)) return null
    const action = button.dataset.touchAction
    return action && TOUCH_ACTIONS.has(action) ? { action: action as TouchAction, button } : null
  }

  private activePointersHasAction(action: TouchAction): boolean {
    for (const active of this.activePointers.values()) {
      if (active.action === action) return true
    }
    return false
  }

  private setButtonState(button: HTMLElement, held: boolean): void {
    button.classList.toggle('is-held', held)
    button.setAttribute('aria-pressed', held ? 'true' : 'false')
  }

  private capturePointer(button: HTMLElement, pointerId: number): void {
    try {
      button.setPointerCapture(pointerId)
    } catch {
      // Some browsers reject capture after a pointer has already ended.
    }
  }

  private releasePointer(button: HTMLElement, pointerId: number): void {
    try {
      if (button.hasPointerCapture(pointerId)) button.releasePointerCapture(pointerId)
    } catch {
      // Pointer cancellation and focus changes can invalidate the capture.
    }
  }

  private clearButtonStates(): void {
    this.root.querySelectorAll<HTMLElement>('[data-touch-action]').forEach((button) => {
      button.classList.remove('is-held')
      button.setAttribute('aria-pressed', 'false')
    })
  }

  private emit(): void {
    let pitch = 0
    let yaw = 0
    let roll = 0
    let throttle = 0
    let boost = false
    let airbrake = false
    let cameraToggle = false
    let gearToggle = false
    let stabilityAssistToggle = false
    for (const { action } of this.activePointers.values()) {
      if (action === 'pitch-up') pitch += 1
      if (action === 'pitch-down') pitch -= 1
      if (action === 'yaw-right') yaw += 1
      if (action === 'yaw-left') yaw -= 1
      if (action === 'roll-right') roll += 1
      if (action === 'roll-left') roll -= 1
      if (action === 'throttle-up') throttle += 1
      if (action === 'throttle-down') throttle -= 1
      if (action === 'boost') boost = true
      if (action === 'airbrake') airbrake = true
      if (action === 'camera-toggle') cameraToggle = true
      if (action === 'gear-toggle') gearToggle = true
      if (action === 'stability-toggle') stabilityAssistToggle = true
    }
    this.onChange({
      pitch: clampAxis(pitch),
      yaw: clampAxis(yaw),
      roll: clampAxis(roll),
      throttle: clampAxis(throttle),
      boost,
      airbrake,
      cameraToggle,
      gearToggle,
      stabilityAssistToggle,
    })
  }
}

function clampAxis(value: number): number {
  return Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0))
}
