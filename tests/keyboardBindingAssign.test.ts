import { describe, expect, it } from 'vitest'
import {
  assignKeyboardBinding,
  DEFAULT_KEYBOARD_BINDINGS,
  type KeyboardBindings,
} from '../src/core/FlightPreferences'

describe('assigning a utility key', () => {
  it('moves an action to a free key', () => {
    expect(assignKeyboardBinding(DEFAULT_KEYBOARD_BINDINGS, 'gear', 'KeyH'))
      .toEqual({ boost: 'Space', airbrake: 'KeyB', gear: 'KeyH' })
  })

  it('swaps with the action that already had the key, whichever action changes', () => {
    // Duplicate repair alone kept the earlier action and silently undid a
    // later action's choice, so picking B for gear left gear on G.
    expect(assignKeyboardBinding(DEFAULT_KEYBOARD_BINDINGS, 'gear', 'KeyB'))
      .toEqual({ boost: 'Space', airbrake: 'KeyG', gear: 'KeyB' })
    expect(assignKeyboardBinding(DEFAULT_KEYBOARD_BINDINGS, 'boost', 'KeyG'))
      .toEqual({ boost: 'KeyG', airbrake: 'KeyB', gear: 'Space' })
    expect(assignKeyboardBinding(DEFAULT_KEYBOARD_BINDINGS, 'airbrake', 'Space'))
      .toEqual({ boost: 'KeyB', airbrake: 'Space', gear: 'KeyG' })
  })

  it('keeps every key unique after a swap', () => {
    const custom: KeyboardBindings = { boost: 'KeyJ', airbrake: 'KeyK', gear: 'KeyL' }
    const next = assignKeyboardBinding(custom, 'boost', 'KeyL')
    expect(next).toEqual({ boost: 'KeyL', airbrake: 'KeyK', gear: 'KeyJ' })
    expect(new Set(Object.values(next)).size).toBe(3)
  })

  it('ignores unknown keys and actions without dropping current bindings', () => {
    expect(assignKeyboardBinding(DEFAULT_KEYBOARD_BINDINGS, 'gear', 'KeyW')).toEqual(DEFAULT_KEYBOARD_BINDINGS)
    expect(assignKeyboardBinding(DEFAULT_KEYBOARD_BINDINGS, 'gear', 42)).toEqual(DEFAULT_KEYBOARD_BINDINGS)
    expect(assignKeyboardBinding(DEFAULT_KEYBOARD_BINDINGS, 'nope' as keyof KeyboardBindings, 'KeyH'))
      .toEqual(DEFAULT_KEYBOARD_BINDINGS)
  })

  it('repairs malformed current bindings before assigning', () => {
    const broken = { boost: 'KeyB', airbrake: 'KeyB', gear: 'Escape' } as unknown as KeyboardBindings
    const next = assignKeyboardBinding(broken, 'gear', 'KeyU')
    expect(next.gear).toBe('KeyU')
    expect(new Set(Object.values(next)).size).toBe(3)
  })
})
