import { describe, expect, it } from 'vitest'
import { shouldReenterFullscreen } from '../src/core/suppressBrowserUi'

describe('browser fullscreen safety', () => {
  it('only arms recovery for an unexpected flight-owned exit', () => {
    expect(shouldReenterFullscreen(false, true)).toBe(true)
    expect(shouldReenterFullscreen(true, true)).toBe(false)
    expect(shouldReenterFullscreen(false, false)).toBe(false)
  })
})
