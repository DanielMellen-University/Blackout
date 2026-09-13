import { describe, expect, it, vi } from 'vitest'
import { GameMenu, pauseReasonLabel } from '../src/ui/GameMenu'

class FakeElement {
  hidden = false
  tabIndex = 0
  disabled = false
  textContent = ''
  isConnected = true
  readonly focus = vi.fn()
  private readonly nodes = new Map<string, FakeElement>()
  private readonly lists = new Map<string, FakeElement[]>()
  private readonly attributes = new Map<string, string>()
  private readonly listeners = new Map<string, Set<(...args: never[]) => void>>()

  set(selector: string, element: FakeElement): void {
    this.nodes.set(selector, element)
  }

  querySelector(selector: string): FakeElement | null {
    return this.nodes.get(selector) ?? null
  }

  querySelectorAll(selector: string): FakeElement[] {
    return this.lists.get(selector) ?? []
  }

  setList(selector: string, elements: FakeElement[]): void {
    this.lists.set(selector, elements)
  }

  addEventListener(type: string, listener: (...args: never[]) => void): void {
    let set = this.listeners.get(type)
    if (!set) {
      set = new Set()
      this.listeners.set(type, set)
    }
    set.add(listener)
  }

  removeEventListener(type: string, listener: (...args: never[]) => void): void {
    this.listeners.get(type)?.delete(listener)
  }

  dispatch(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event as never)
  }

  closest(): null {
    return null
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value)
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name)
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null
  }
}

function menuFixture(): { root: FakeElement; resume: FakeElement; state: FakeElement } {
  const root = new FakeElement()
  const panelRoot = new FakeElement()
  const panelControls = new FakeElement()
  const panelInfo = new FakeElement()
  const resume = new FakeElement()
  const heading = new FakeElement()
  const state = new FakeElement()
  const fs = new FakeElement()
  const fsState = new FakeElement()
  const quit = new FakeElement()
  const retry = new FakeElement()
  const newWorld = new FakeElement()
  const close = new FakeElement()
  panelRoot.set('h2', heading)
  panelControls.set('h2', new FakeElement())
  panelInfo.set('h2', new FakeElement())
  root.set('#menu-root', panelRoot)
  root.set('#menu-controls', panelControls)
  root.set('#menu-info', panelInfo)
  root.set('#menu-heading', heading)
  root.set('#menu-state', state)
  root.set('#menu-resume', resume)
  root.set('#menu-quit', quit)
  root.set('#menu-retry', retry)
  root.set('#menu-new-world', newWorld)
  root.set('#menu-fullscreen', fs)
  root.set('#menu-fs-state', fsState)
  root.set('#menu-close', close)
  panelRoot.setList(
    'button:not([hidden]):not([disabled]), select:not([hidden]), input:not([hidden]), [href], [tabindex]:not([tabindex="-1"])',
    [resume, close],
  )
  return { root, resume, state }
}

describe('menu focus flow', () => {
  it('returns focus to the control that opened pause', () => {
    vi.stubGlobal('HTMLElement', FakeElement)
    const source = new FakeElement()
    vi.stubGlobal('document', { activeElement: source, fullscreenElement: null })
    const fixture = menuFixture()
    const menu = new GameMenu(fixture.root as unknown as HTMLElement)

    menu.openPause()
    expect(fixture.resume.focus).toHaveBeenCalled()
    expect(fixture.state.textContent).toBe('FLIGHT PAUSED · SIMULATION HOLD')
    expect(fixture.state.hidden).toBe(false)
    expect(fixture.root.getAttribute('aria-describedby')).toBe('menu-state')
    expect(fixture.root.getAttribute('aria-labelledby')).toBe('menu-heading')
    const preventDefault = vi.fn()
    fixture.root.dispatch('keydown', { key: 'Tab', shiftKey: false, preventDefault })
    expect(preventDefault).toHaveBeenCalled()
    menu.showView('controls')
    expect(fixture.state.hidden).toBe(true)
    expect(fixture.root.getAttribute('aria-describedby')).toBeNull()
    expect(fixture.root.getAttribute('aria-labelledby')).toBe('menu-controls-heading')
    menu.back()
    expect(fixture.state.hidden).toBe(false)
    expect(fixture.root.getAttribute('aria-describedby')).toBe('menu-state')
    expect(fixture.root.getAttribute('aria-labelledby')).toBe('menu-heading')
    menu.close()
    expect(fixture.state.hidden).toBe(true)
    expect(source.focus).toHaveBeenCalledWith({ preventScroll: true })
    menu.dispose()
    menu.dispose()
    menu.openPause()
    menu.showView('controls')
    expect(menu.open).toBe(false)
    vi.unstubAllGlobals()
  })

  it('keeps the pause status out of the title settings view', () => {
    vi.stubGlobal('HTMLElement', FakeElement)
    vi.stubGlobal('document', { activeElement: null, fullscreenElement: null })
    const fixture = menuFixture()
    const menu = new GameMenu(fixture.root as unknown as HTMLElement)

    menu.openPause()
    menu.showTitlePage('controls')
    expect(fixture.state.textContent).toBe('')
    expect(fixture.state.hidden).toBe(true)
    expect(fixture.root.getAttribute('aria-describedby')).toBeNull()
    expect(fixture.root.getAttribute('aria-labelledby')).toBe('menu-controls-heading')
    menu.dispose()
    vi.unstubAllGlobals()
  })

  it('explains why an automatic pause was triggered', () => {
    expect(pauseReasonLabel('focus')).toBe('FLIGHT PAUSED · WINDOW FOCUS LOST')
    expect(pauseReasonLabel('fullscreen')).toBe('FLIGHT PAUSED · FULLSCREEN EXITED')
    expect(pauseReasonLabel('graphics')).toBe('FLIGHT PAUSED · GRAPHICS RECOVERING')
    expect(pauseReasonLabel('manual')).toBe('FLIGHT PAUSED · SIMULATION HOLD')
  })
})
