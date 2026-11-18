import { describe, expect, it } from 'vitest'
import { InputManager } from '../src/core/InputManager'

type KeyEvent = { code: string; repeat?: boolean; metaKey?: boolean; altKey?: boolean; ctrlKey?: boolean; preventDefault(): void }
type Listener = (event: KeyEvent) => void

function fakeWindow() {
  const listeners = new Map<string, Listener>()
  const target = {
    addEventListener(type: string, listener: Listener) { listeners.set(type, listener) },
    removeEventListener(type: string) { listeners.delete(type) },
  } as unknown as Window
  const fire = (type: string, code: string, modifiers: Partial<KeyEvent> = {}) =>
    listeners.get(type)?.({ code, preventDefault() {}, ...modifiers })
  return { target, fire }
}

describe('keyboard modifier chords', () => {
  it('does not queue flight shortcuts for Cmd or Alt chords', () => {
    const win = fakeWindow()
    const input = new InputManager(win.target)
    input.setFlightLive(true)
    win.fire('keydown', 'KeyC', { metaKey: true })
    win.fire('keydown', 'KeyN', { altKey: true })
    win.fire('keydown', 'KeyP', { metaKey: true })
    win.fire('keydown', 'KeyG', { altKey: true })
    expect(input.consumeCameraToggle()).toBe(false)
    expect(input.consumeWeatherCycle()).toBe(false)
    expect(input.consumePauseToggle()).toBe(false)
    expect(input.consumeGearToggle()).toBe(false)
    input.dispose()
  })

  it('still queues shortcuts pressed plainly or while Ctrl is held for throttle', () => {
    const win = fakeWindow()
    const input = new InputManager(win.target)
    input.setFlightLive(true)
    win.fire('keydown', 'KeyC')
    expect(input.consumeCameraToggle()).toBe(true)
    win.fire('keydown', 'KeyN', { ctrlKey: true })
    expect(input.consumeWeatherCycle()).toBe(true)
    input.dispose()
  })
})
