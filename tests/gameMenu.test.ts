import { describe, expect, it, vi } from 'vitest'
import { GameMenu } from '../src/ui/GameMenu'

class FakeElement {
  hidden = false
  tabIndex = 0
  disabled = false
  textContent = ''
  isConnected = true
  readonly focus = vi.fn()
  private readonly nodes = new Map<string, FakeElement>()
  private readonly lists = new Map<string, FakeElement[]>()
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

  setAttribute(): void {}
}

function menuFixture(): { root: FakeElement; resume: FakeElement } {
  const root = new FakeElement()
  const panelRoot = new FakeElement()
  const panelControls = new FakeElement()
  const panelInfo = new FakeElement()
  const resume = new FakeElement()
  const heading = new FakeElement()
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
  return { root, resume }
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
    const preventDefault = vi.fn()
    fixture.root.dispatch('keydown', { key: 'Tab', shiftKey: false, preventDefault })
    expect(preventDefault).toHaveBeenCalled()
    menu.close()
    expect(source.focus).toHaveBeenCalledWith({ preventScroll: true })
    menu.dispose()
    menu.dispose()
    menu.openPause()
    menu.showView('controls')
    expect(menu.open).toBe(false)
    vi.unstubAllGlobals()
  })
})
