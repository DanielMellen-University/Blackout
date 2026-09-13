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

/** Event-driven touch input, normalized to the same ranges as ControlState. */
export interface TouchInputState {
  pitch: number
  yaw: number
  roll: number
  throttle: number
  boost: boolean
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
])

/** Touch screens and coarse pointers should get the optional control deck. */
export function touchInputSupported(maxTouchPoints: number, coarsePointer: boolean): boolean {
  return (Number.isFinite(maxTouchPoints) && maxTouchPoints > 0) || coarsePointer
}

/**
 * Maps held pointer buttons into flight axes without adding work to the RAF
 * loop. Pointer releases are listened for on window so a finger leaving the
 * button cannot leave an axis latched.
 */
export class TouchControls {
  private readonly root: HTMLElement
  private readonly onChange: (state: TouchInputState) => void
  private readonly activePointers = new Map<number, TouchAction>()
  private visible = false
  private disposed = false

  constructor(root: HTMLElement, onChange: (state: TouchInputState) => void) {
    this.root = root
    this.onChange = onChange
    root.hidden = true
    root.setAttribute('aria-hidden', 'true')
    root.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('pointercancel', this.onPointerUp)
  }

  setVisible(visible: boolean): void {
    if (this.disposed || this.visible === visible) return
    this.visible = visible
    this.root.hidden = !visible
    this.root.setAttribute('aria-hidden', visible ? 'false' : 'true')
    if (!visible) {
      this.activePointers.clear()
      this.clearButtonStates()
      this.emit()
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.root.removeEventListener('pointerdown', this.onPointerDown)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('pointercancel', this.onPointerUp)
    this.activePointers.clear()
    this.clearButtonStates()
    this.root.hidden = true
    this.root.setAttribute('aria-hidden', 'true')
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (this.disposed || !this.visible) return
    const action = this.actionForTarget(event.target)
    if (!action) return
    event.preventDefault()
    this.activePointers.set(event.pointerId, action)
    this.setButtonState(action, true)
    this.emit()
  }

  private onPointerUp = (event: PointerEvent): void => {
    if (this.disposed) return
    const action = this.activePointers.get(event.pointerId)
    if (!action) return
    this.activePointers.delete(event.pointerId)
    if (!this.activePointersHasAction(action)) this.setButtonState(action, false)
    this.emit()
  }

  private actionForTarget(target: EventTarget | null): TouchAction | null {
    if (typeof Element === 'undefined' || !(target instanceof Element)) return null
    const button = target.closest<HTMLElement>('[data-touch-action]')
    if (!button || !this.root.contains(button)) return null
    const action = button.dataset.touchAction
    return action && TOUCH_ACTIONS.has(action) ? action as TouchAction : null
  }

  private activePointersHasAction(action: TouchAction): boolean {
    for (const active of this.activePointers.values()) {
      if (active === action) return true
    }
    return false
  }

  private setButtonState(action: TouchAction, held: boolean): void {
    const button = this.root.querySelector<HTMLElement>(`[data-touch-action="${action}"]`)
    if (!button) return
    button.classList.toggle('is-held', held)
    button.setAttribute('aria-pressed', held ? 'true' : 'false')
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
    for (const action of this.activePointers.values()) {
      if (action === 'pitch-up') pitch += 1
      if (action === 'pitch-down') pitch -= 1
      if (action === 'yaw-right') yaw += 1
      if (action === 'yaw-left') yaw -= 1
      if (action === 'roll-right') roll += 1
      if (action === 'roll-left') roll -= 1
      if (action === 'throttle-up') throttle += 1
      if (action === 'throttle-down') throttle -= 1
      if (action === 'boost') boost = true
    }
    this.onChange({
      pitch: clampAxis(pitch),
      yaw: clampAxis(yaw),
      roll: clampAxis(roll),
      throttle: clampAxis(throttle),
      boost,
    })
  }
}

function clampAxis(value: number): number {
  return Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0))
}
