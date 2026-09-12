import { describe, expect, it } from 'vitest'
import { InputManager } from '../src/core/InputManager'

type Listener = (event: {
  code: string
  repeat?: boolean
  preventDefault(): void
}) => void

function fakeWindow(): { target: Window; fire(type: string, code: string): void } {
  const listeners = new Map<string, Listener>()
  const target = {
    addEventListener(type: string, listener: Listener): void {
      listeners.set(type, listener)
    },
    removeEventListener(type: string): void {
      listeners.delete(type)
    },
  } as unknown as Window
  return {
    target,
    fire(type, code) {
      listeners.get(type)?.({ code, preventDefault() {} })
    },
  }
}

describe('flight input one-shot controls', () => {
  it('queues the audio toggle only during live flight', () => {
    const fake = fakeWindow()
    const input = new InputManager(fake.target)

    fake.fire('keydown', 'KeyM')
    expect(input.consumeAudioToggle()).toBe(false)

    input.flightLive = true
    fake.fire('keydown', 'KeyM')
    expect(input.consumeAudioToggle()).toBe(true)
    expect(input.consumeAudioToggle()).toBe(false)

    input.dispose()
  })

  it('clears queued one-shot controls when focus leaves the window', () => {
    const fake = fakeWindow()
    const input = new InputManager(fake.target)
    input.flightLive = true
    fake.fire('keydown', 'KeyM')
    fake.fire('blur', '')
    expect(input.consumeAudioToggle()).toBe(false)
    input.dispose()
  })
})
