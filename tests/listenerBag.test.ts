import { describe, expect, it, vi } from 'vitest'
import { ListenerBag } from '../src/core/ListenerBag'

function target() {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as EventTarget
}

describe('listener lifecycle', () => {
  it('releases every listener once and ignores late additions', () => {
    const first = target()
    const second = target()
    const bag = new ListenerBag()
    const onFirst = () => undefined
    const onSecond = () => undefined
    bag.add(first, 'click', onFirst)
    bag.add(second, 'input', onSecond, { capture: true })
    expect(bag.size).toBe(2)

    bag.dispose()
    bag.dispose()
    bag.add(first, 'change', () => undefined)

    expect(first.removeEventListener).toHaveBeenCalledTimes(1)
    expect(second.removeEventListener).toHaveBeenCalledTimes(1)
    expect(bag.size).toBe(0)
    expect(first.addEventListener).toHaveBeenCalledTimes(1)
  })
})
