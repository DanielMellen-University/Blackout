import { describe, expect, it, vi } from 'vitest'
import { Scene } from 'three'
import { DebugOverlay } from '../src/debug/DebugOverlay'

class FakePre {
  id = ''
  textContent = ''
  style = { cssText: '' }
  readonly remove = vi.fn()
}

describe('debug overlay teardown', () => {
  it('releases optional DOM and marker resources idempotently', () => {
    const el = new FakePre()
    vi.stubGlobal('document', {
      createElement: vi.fn(() => el),
      body: { appendChild: vi.fn() },
    })
    const debug = new DebugOverlay(new Scene())

    debug.dispose()
    debug.dispose()
    debug.syncPad()

    expect(el.remove).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})
