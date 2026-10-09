import { MODAL_FOCUSABLE_SELECTOR } from '../src/ui/ModalFocus'
import { describe, expect, it, vi } from 'vitest'
import { GameMenu, pauseReasonLabel } from '../src/ui/GameMenu'

class FakeElement {
  hidden = false
  scrollTop = 0
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

  closest(): FakeElement | null {
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
    MODAL_FOCUSABLE_SELECTOR,
    [resume, close],
  )
  return { root, resume, state }
}

describe('menu focus flow', () => {
  it('navigates between pilot references, returns to the opener, and preserves pause', () => {
    vi.stubGlobal('HTMLElement', FakeElement)
    const opener = new FakeElement()
    vi.stubGlobal('document', { activeElement: opener, fullscreenElement: null })
    const fixture = menuFixture()
    const controls = new FakeElement(), manual = new FakeElement()
    controls.setAttribute('data-guide-view', 'controls')
    manual.setAttribute('data-guide-view', 'info')
    fixture.root.setList('[data-guide-view]', [controls, manual])
    const menu = new GameMenu(fixture.root as unknown as HTMLElement)
    try {
      menu.showTitlePage('controls')
      manual.dispatch('click', {})
      expect(fixture.root.querySelector('#menu-info')!.hidden).toBe(false)
      expect(fixture.root.getAttribute('aria-labelledby')).toBe('menu-info-heading')
      controls.dispatch('click', {})
      expect(fixture.root.querySelector('#menu-controls')!.hidden).toBe(false)
      menu.back()
      expect(menu.open).toBe(false)
      expect(opener.focus).toHaveBeenCalled()

      menu.openPause()
      menu.showView('info')
      expect(menu.paused).toBe(true)
      controls.dispatch('click', {})
      expect(menu.paused).toBe(true)
      menu.back()
      expect(menu.paused).toBe(true)
      expect(fixture.root.querySelector('#menu-root')!.hidden).toBe(false)
      const show = vi.spyOn(menu, 'showView')
      menu.dispose()
      manual.dispatch('click', {})
      expect(show).not.toHaveBeenCalled()
    } finally { menu.dispose(); vi.unstubAllGlobals() }
  })

  it('Escape closes a title reference instead of taking the player to settings', () => {
    vi.stubGlobal('HTMLElement', FakeElement)
    vi.stubGlobal('document', { activeElement: null, fullscreenElement: null })
    const fixture = menuFixture(), menu = new GameMenu(fixture.root as unknown as HTMLElement)
    try {
      menu.showTitlePage('info')
      menu.handleEscape()
      expect(menu.open).toBe(false)
    } finally { menu.dispose(); vi.unstubAllGlobals() }
  })
  it('shows one category, preserves control nodes, rejects unknown pages, and removes navigation listeners', () => {
    vi.stubGlobal('HTMLElement', FakeElement)
    const fixture = menuFixture()
    const panels = ['general', 'controls', 'camera', 'course'].map(category => {
      const panel = new FakeElement()
      panel.setAttribute('data-settings-panel', category)
      return panel
    })
    const buttons = ['general', 'controls', 'camera', 'course'].map(category => {
      const button = new FakeElement()
      button.setAttribute('data-settings-tab', category)
      return button
    })
    const savedControl = new FakeElement()
    savedControl.textContent = 'persisted value'
    panels[1]!.set('#preference', savedControl)
    fixture.root.setList('[data-settings-panel]', panels)
    fixture.root.setList('[data-settings-tab]', buttons)
    const content = new FakeElement()
    fixture.root.set('.settings-content', content)
    const menu = new GameMenu(fixture.root as unknown as HTMLElement)
    expect(panels.map(panel => panel.hidden)).toEqual([false, true, true, true])
    content.scrollTop = 300
    buttons[1]!.dispatch('click', {})
    expect(content.scrollTop).toBe(0)
    expect(panels.map(panel => panel.hidden)).toEqual([true, false, true, true])
    expect(buttons.map(button => button.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false', 'false'])
    menu.showSettingsCategory('unknown')
    expect(panels[1]!.hidden).toBe(false)
    buttons[0]!.dispatch('click', {})
    buttons[1]!.dispatch('click', {})
    expect(panels[1]!.querySelector('#preference')).toBe(savedControl)
    expect(savedControl.textContent).toBe('persisted value')
    menu.dispose()
    buttons[2]!.dispatch('click', {})
    menu.showSettingsCategory('course')
    expect(panels.map(panel => panel.hidden)).toEqual([true, false, true, true])
    vi.unstubAllGlobals()
  })

  it('keeps disclosure summaries in the trap but excludes controls inside hidden sections', () => {
    vi.stubGlobal('HTMLElement', FakeElement)
    const documentState = { activeElement: null as FakeElement | null, fullscreenElement: null }
    vi.stubGlobal('document', documentState)
    const fixture = menuFixture()
    const summary = new FakeElement()
    const hiddenSummary = new FakeElement()
    vi.spyOn(hiddenSummary, 'closest').mockReturnValue(new FakeElement())
    const last = new FakeElement()
    fixture.root.querySelector('#menu-root')!.setList(
      MODAL_FOCUSABLE_SELECTOR,
      [fixture.resume, summary, last, hiddenSummary],
    )
    const menu = new GameMenu(fixture.root as unknown as HTMLElement)
    menu.openPause()
    documentState.activeElement = summary
    const middle = vi.fn()
    fixture.root.dispatch('keydown', { key: 'Tab', shiftKey: false, preventDefault: middle })
    expect(middle).not.toHaveBeenCalled()
    documentState.activeElement = fixture.resume
    fixture.root.dispatch('keydown', { key: 'Tab', shiftKey: true, preventDefault: vi.fn() })
    expect(last.focus).toHaveBeenCalled()
    expect(hiddenSummary.focus).not.toHaveBeenCalled()
    menu.dispose()
    vi.unstubAllGlobals()
  })
  it('returns focus to the control that opened pause', () => {
    vi.stubGlobal('HTMLElement', FakeElement)
    const source = new FakeElement()
    vi.stubGlobal('document', { activeElement: source, fullscreenElement: null })
    const fixture = menuFixture()
    const menu = new GameMenu(fixture.root as unknown as HTMLElement)

    menu.openPause()
    expect(fixture.resume.focus).toHaveBeenCalled()
    expect(fixture.state.textContent).toBe('Simulation paused')
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

  it('returns focus to the flight canvas when pause opened after focus was lost', () => {
    vi.stubGlobal('HTMLElement', FakeElement)
    const body = new FakeElement()
    const canvas = new FakeElement()
    vi.stubGlobal('document', { activeElement: body, body, fullscreenElement: null })
    const fixture = menuFixture()
    const menu = new GameMenu(
      fixture.root as unknown as HTMLElement,
      canvas as unknown as HTMLElement,
    )

    menu.openPause('focus')
    menu.close()

    expect(canvas.focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(body.focus).not.toHaveBeenCalled()
    menu.dispose()
    vi.unstubAllGlobals()
  })

  it('explains why an automatic pause was triggered', () => {
    expect(pauseReasonLabel('focus')).toBe('Window focus lost')
    expect(pauseReasonLabel('fullscreen')).toBe('Exited fullscreen')
    expect(pauseReasonLabel('graphics')).toBe('Graphics recovering')
    expect(pauseReasonLabel('manual')).toBe('Simulation paused')
  })
})
