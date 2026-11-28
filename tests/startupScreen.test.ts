import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  finishStartupScreen,
  revealStartupFailure,
  showStartupScreen,
  startupFadeMs,
} from '../src/ui/StartupScreen'

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

class FakeClassList {
  readonly names = new Set<string>()
  add(name: string): void { this.names.add(name) }
  remove(name: string): void { this.names.delete(name) }
  contains(name: string): boolean { return this.names.has(name) }
  toggle(name: string, force?: boolean): boolean {
    const on = force ?? !this.names.has(name)
    if (on) this.names.add(name)
    else this.names.delete(name)
    return on
  }
}

class FakeElement {
  hidden = false
  readonly classList = new FakeClassList()
  readonly attributes = new Map<string, string>()
  readonly caption = { textContent: 'Ready' }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value) }
  removeAttribute(name: string): void { this.attributes.delete(name) }
  querySelector(): { textContent: string } { return this.caption }
}

function stubStartupDom(): { root: FakeElement; screen: FakeElement; app: FakeElement } {
  const root = new FakeElement()
  const screen = new FakeElement()
  const app = new FakeElement()
  vi.stubGlobal('document', {
    documentElement: root,
    getElementById: (id: string) => id === 'startup-screen' ? screen : id === 'app' ? app : null,
  })
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => setTimeout(callback, 16))
  return { root, screen, app }
}

describe('startup screen transitions', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('hides the screen and restores the app when startup fails', () => {
    const { root, screen, app } = stubStartupDom()
    root.classList.add('startup-loading')
    app.setAttribute('inert', '')
    app.setAttribute('aria-hidden', 'true')
    revealStartupFailure()
    expect(screen.hidden).toBe(true)
    expect(root.classList.contains('startup-loading')).toBe(false)
    expect(app.attributes.has('inert')).toBe(false)
    expect(app.attributes.has('aria-hidden')).toBe(false)
  })

  it('fades out after the remaining minimum time and two paints', async () => {
    vi.useFakeTimers()
    const { screen, app } = stubStartupDom()
    app.setAttribute('inert', '')
    const done = finishStartupScreen(1000)
    await vi.advanceTimersByTimeAsync(999)
    expect(screen.classList.contains('startup-leaving')).toBe(false)
    await vi.advanceTimersByTimeAsync(40)
    expect(screen.classList.contains('startup-leaving')).toBe(true)
    expect(screen.hidden).toBe(false)
    await vi.advanceTimersByTimeAsync(500)
    await done
    expect(screen.hidden).toBe(true)
    expect(screen.classList.contains('startup-leaving')).toBe(false)
    expect(app.attributes.has('inert')).toBe(false)
  })

  it('blocks the app while a launch transition shows the loading caption', async () => {
    vi.useFakeTimers()
    const { root, screen, app } = stubStartupDom()
    screen.hidden = true
    const done = showStartupScreen(300)
    expect(screen.hidden).toBe(false)
    expect(screen.caption.textContent).toBe('Loading')
    expect(root.classList.contains('startup-loading')).toBe(true)
    expect(app.attributes.get('inert')).toBe('')
    expect(app.attributes.get('aria-hidden')).toBe('true')
    await vi.advanceTimersByTimeAsync(300 + 40 + 500)
    await done
    expect(screen.hidden).toBe(true)
    expect(root.classList.contains('startup-loading')).toBe(false)
    expect(app.attributes.has('aria-hidden')).toBe(false)
  })
})
