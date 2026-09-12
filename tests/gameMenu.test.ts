import { describe, expect, it, vi } from 'vitest'
import { GameMenu } from '../src/ui/GameMenu'

class FakeElement {
  hidden = false
  tabIndex = 0
  textContent = ''
  isConnected = true
  readonly focus = vi.fn()
  private readonly nodes = new Map<string, FakeElement>()

  set(selector: string, element: FakeElement): void {
    this.nodes.set(selector, element)
  }

  querySelector(selector: string): FakeElement | null {
    return this.nodes.get(selector) ?? null
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
    menu.close()
    expect(source.focus).toHaveBeenCalledWith({ preventScroll: true })
    vi.unstubAllGlobals()
  })
})
