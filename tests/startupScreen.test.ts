import { afterEach, describe, expect, it, vi } from 'vitest'
import { startupFadeMs } from '../src/ui/StartupScreen'

function stubRoot(classes: string[]): void {
  vi.stubGlobal('document', {
    documentElement: { classList: { contains: (name: string) => classes.includes(name) } },
  })
}

describe('startup screen fade', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses the normal fade without any reduced motion preference', () => {
    stubRoot([])
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    expect(startupFadeMs()).toBe(500)
  })

  it('shortens the fade for the system preference', () => {
    stubRoot([])
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }))
    expect(startupFadeMs()).toBe(120)
  })

  it('shortens the fade for the in-game setting even when the system has no preference', () => {
    stubRoot(['reduced-motion'])
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    expect(startupFadeMs()).toBe(120)
  })

  it('falls back to the normal fade when matchMedia is missing or throws', () => {
    stubRoot([])
    vi.stubGlobal('matchMedia', undefined)
    expect(startupFadeMs()).toBe(500)
    vi.stubGlobal('matchMedia', () => { throw new Error('unsupported') })
    expect(startupFadeMs()).toBe(500)
  })
})
