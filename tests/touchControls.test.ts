import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TouchControls, touchInputSupported, type TouchInputState } from '../src/core/TouchControls'

type Listener = (event: any) => void

class TestEventHub {
  private readonly listeners = new Map<string, Set<Listener>>()

  addEventListener(type: string, listener: Listener): void {
    let listeners = this.listeners.get(type)
    if (!listeners) {
      listeners = new Set()
      this.listeners.set(type, listeners)
    }
    listeners.add(listener)
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener)
  }

  dispatch(type: string, event: Record<string, unknown>): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
}

class TestElement extends TestEventHub {
  readonly dataset: Record<string, string> = {}
  readonly attributes = new Map<string, string>()
  readonly classes = new Set<string>()
  readonly captures = new Set<number>()
  readonly children: TestElement[] = []
  hidden = false
  parent: TestElement | null = null

  constructor(action?: string) {
    super()
    if (action) this.dataset.touchAction = action
  }

  appendChild(child: TestElement): void {
    child.parent = this
    this.children.push(child)
  }

  contains(candidate: TestElement): boolean {
    return this.children.some((child) => child === candidate || child.contains(candidate))
  }

  closest<T>(_selector: string): T | null {
    return this.dataset.touchAction ? this as unknown as T : null
  }

  querySelector<T>(_selector: string): T | null {
    return this.children.find((child) => child.dataset.touchAction) as unknown as T ?? null
  }

  querySelectorAll<T>(_selector: string): T[] {
    return this.children.filter((child) => child.dataset.touchAction) as unknown as T[]
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value)
  }

  get classList(): { toggle: (name: string, force: boolean) => void; remove: (name: string) => void } {
    return {
      toggle: (name, force) => {
        if (force) this.classes.add(name)
        else this.classes.delete(name)
      },
      remove: (name) => this.classes.delete(name),
    }
  }

  setPointerCapture(pointerId: number): void {
    this.captures.add(pointerId)
  }

  hasPointerCapture(pointerId: number): boolean {
    return this.captures.has(pointerId)
  }

  releasePointerCapture(pointerId: number): void {
    this.captures.delete(pointerId)
  }
}

let testWindow: TestEventHub
let testDocument: TestEventHub & { hidden: boolean }
let previousWindow: unknown
let previousDocument: unknown
let previousElement: unknown

beforeEach(() => {
  previousWindow = (globalThis as Record<string, unknown>).window
  previousDocument = (globalThis as Record<string, unknown>).document
  previousElement = (globalThis as Record<string, unknown>).Element
  testWindow = new TestEventHub()
  testDocument = Object.assign(new TestEventHub(), { hidden: false })
  ;(globalThis as Record<string, unknown>).window = testWindow
  ;(globalThis as Record<string, unknown>).document = testDocument
  ;(globalThis as Record<string, unknown>).Element = TestElement
})

afterEach(() => {
  ;(globalThis as Record<string, unknown>).window = previousWindow
  ;(globalThis as Record<string, unknown>).document = previousDocument
  ;(globalThis as Record<string, unknown>).Element = previousElement
})

function createHarness(): { root: TestElement; pitch: TestElement; controls: TouchControls; changes: TouchInputState[] } {
  const root = new TestElement()
  const pitch = new TestElement('pitch-up')
  root.appendChild(pitch)
  const changes: TouchInputState[] = []
  const controls = new TouchControls(root as unknown as HTMLElement, (state) => changes.push(state))
  controls.setVisible(true)
  return { root, pitch, controls, changes }
}

function pointerEvent(target: TestElement, pointerId: number): { target: TestElement; pointerId: number; preventDefault: () => void; prevented: () => boolean } {
  let didPrevent = false
  return {
    target,
    pointerId,
    preventDefault: () => { didPrevent = true },
    prevented: () => didPrevent,
  }
}

describe('touch flight controls support detection', () => {
  it('accepts touch points or a coarse pointer', () => {
    expect(touchInputSupported(5, false)).toBe(true)
    expect(touchInputSupported(0, true)).toBe(true)
    expect(touchInputSupported(0, false)).toBe(false)
  })

  it('rejects malformed touch point counts without hiding coarse devices', () => {
    expect(touchInputSupported(Number.NaN, false)).toBe(false)
    expect(touchInputSupported(Number.POSITIVE_INFINITY, false)).toBe(false)
    expect(touchInputSupported(-1, false)).toBe(false)
    expect(touchInputSupported(Number.NaN, true)).toBe(true)
  })

  it('captures a held control and releases it on pointerup', () => {
    const { root, pitch, controls, changes } = createHarness()
    const down = pointerEvent(pitch, 7)

    root.dispatch('pointerdown', down)

    expect(down.prevented()).toBe(true)
    expect(pitch.captures.has(7)).toBe(true)
    expect(pitch.attributes.get('aria-pressed')).toBe('true')
    expect(changes.at(-1)?.pitch).toBe(1)

    testWindow.dispatch('pointerup', pointerEvent(pitch, 7))

    expect(pitch.captures.has(7)).toBe(false)
    expect(pitch.attributes.get('aria-pressed')).toBe('false')
    expect(changes.at(-1)?.pitch).toBe(0)
    controls.dispose()
  })

  it('keeps a shared action held until every finger leaves it', () => {
    const { root, pitch, controls, changes } = createHarness()

    root.dispatch('pointerdown', pointerEvent(pitch, 1))
    root.dispatch('pointerdown', pointerEvent(pitch, 2))
    testWindow.dispatch('pointerup', pointerEvent(pitch, 1))

    expect(pitch.attributes.get('aria-pressed')).toBe('true')
    expect(changes.at(-1)?.pitch).toBe(1)

    testWindow.dispatch('pointerup', pointerEvent(pitch, 2))
    expect(pitch.attributes.get('aria-pressed')).toBe('false')
    expect(changes.at(-1)?.pitch).toBe(0)
    controls.dispose()
  })

  it('clears captures when focus or visibility is lost', () => {
    const { root, pitch, controls, changes } = createHarness()

    root.dispatch('pointerdown', pointerEvent(pitch, 3))
    testWindow.dispatch('blur', {})
    expect(pitch.captures.size).toBe(0)
    expect(changes.at(-1)?.pitch).toBe(0)

    root.dispatch('pointerdown', pointerEvent(pitch, 4))
    testDocument.hidden = true
    testDocument.dispatch('visibilitychange', {})
    expect(pitch.captures.size).toBe(0)
    expect(changes.at(-1)?.pitch).toBe(0)
    controls.dispose()
  })

  it('treats lost pointer capture as a release', () => {
    const { root, pitch, controls, changes } = createHarness()

    root.dispatch('pointerdown', pointerEvent(pitch, 9))
    root.dispatch('lostpointercapture', pointerEvent(pitch, 9))

    expect(pitch.attributes.get('aria-pressed')).toBe('false')
    expect(changes.at(-1)?.pitch).toBe(0)
    controls.dispose()
  })

  it('emits edge-trigger actions for camera, landing gear, and assist toggles', () => {
    const root = new TestElement()
    const camera = new TestElement('camera-toggle')
    const gear = new TestElement('gear-toggle')
    const assist = new TestElement('stability-toggle')
    root.appendChild(camera)
    root.appendChild(gear)
    root.appendChild(assist)
    const changes: TouchInputState[] = []
    const controls = new TouchControls(root as unknown as HTMLElement, state => changes.push(state))
    controls.setVisible(true)

    root.dispatch('pointerdown', pointerEvent(camera, 11))
    expect(changes.at(-1)?.cameraToggle).toBe(true)
    testWindow.dispatch('pointerup', pointerEvent(camera, 11))
    expect(changes.at(-1)?.cameraToggle).toBe(false)

    root.dispatch('pointerdown', pointerEvent(gear, 12))
    expect(changes.at(-1)?.gearToggle).toBe(true)
    testWindow.dispatch('pointerup', pointerEvent(gear, 12))
    expect(changes.at(-1)?.gearToggle).toBe(false)

    root.dispatch('pointerdown', pointerEvent(assist, 14))
    expect(changes.at(-1)?.stabilityAssistToggle).toBe(true)
    testWindow.dispatch('pointerup', pointerEvent(assist, 14))
    expect(changes.at(-1)?.stabilityAssistToggle).toBe(false)
    controls.dispose()
  })

  it('holds and releases the speed brake like the other flight axes', () => {
    const root = new TestElement()
    const brake = new TestElement('airbrake')
    root.appendChild(brake)
    const changes: TouchInputState[] = []
    const controls = new TouchControls(root as unknown as HTMLElement, state => changes.push(state))
    controls.setVisible(true)

    root.dispatch('pointerdown', pointerEvent(brake, 13))
    expect(changes.at(-1)?.airbrake).toBe(true)
    testWindow.dispatch('pointerup', pointerEvent(brake, 13))
    expect(changes.at(-1)?.airbrake).toBe(false)
    controls.dispose()
  })
})
