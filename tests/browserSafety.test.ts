import { describe, expect, it, vi } from 'vitest'
import {
  enterGameFullscreenFromGesture,
  setFlightKeyCapture,
  shouldPauseForFullscreenExit,
  shouldReenterFullscreen,
  suppressBrowserUi,
  toggleGameFullscreen,
  tryReenterFullscreenFromClick,
} from '../src/core/suppressBrowserUi'

interface FakeTarget {
  listeners: Map<string, Set<unknown>>
  addEventListener(type: string, listener: unknown): void
  removeEventListener(type: string, listener: unknown): void
}

function fakeTarget(): FakeTarget {
  const listeners = new Map<string, Set<unknown>>()
  return {
    listeners,
    addEventListener(type, listener) {
      let set = listeners.get(type)
      if (!set) {
        set = new Set()
        listeners.set(type, set)
      }
      set.add(listener)
    },
    removeEventListener(type, listener) {
      const set = listeners.get(type)
      set?.delete(listener)
      if (set?.size === 0) listeners.delete(type)
    },
  }
}

describe('browser fullscreen safety', () => {
  it('only arms recovery for an unexpected flight-owned exit', () => {
    expect(shouldReenterFullscreen(false, true)).toBe(true)
    expect(shouldReenterFullscreen(true, true)).toBe(false)
    expect(shouldReenterFullscreen(false, false)).toBe(false)
  })

  it('pauses only when fullscreen is lost during active flight', () => {
    expect(shouldPauseForFullscreenExit(false, true, false, false)).toBe(true)
    expect(shouldPauseForFullscreenExit(false, true, true, false)).toBe(false)
    expect(shouldPauseForFullscreenExit(false, true, false, true)).toBe(false)
    expect(shouldPauseForFullscreenExit(true, true, false, false)).toBe(false)
    expect(shouldPauseForFullscreenExit(false, false, false, false)).toBe(false)
  })

  it('returns an idempotent browser-UI teardown that restores host state', () => {
    const fakeWindow = Object.assign(fakeTarget(), { oncontextmenu: 'window-old' })
    const documentElement = fakeTarget()
    const body = Object.assign(fakeTarget(), { oncontextmenu: 'body-old' })
    const fakeDocument = Object.assign(fakeTarget(), {
      documentElement,
      body,
      fullscreenElement: null,
      oncontextmenu: 'document-old',
    })
    const canvas = Object.assign(fakeTarget(), {
      focus: vi.fn(),
      oncontextmenu: 'canvas-old',
      style: { outline: '2px solid red' },
      tabIndex: 7,
    }) as unknown as HTMLCanvasElement

    vi.stubGlobal('window', fakeWindow)
    vi.stubGlobal('document', fakeDocument)
    const release = suppressBrowserUi(canvas)
    setFlightKeyCapture(true)

    expect(fakeWindow.listeners.get('keydown')?.size).toBe(1)
    expect(fakeDocument.listeners.get('fullscreenchange')?.size).toBe(1)
    expect(canvas.tabIndex).toBe(0)
    expect(canvas.style.outline).toBe('none')

    release()
    release()

    expect(fakeWindow.listeners.size).toBe(0)
    expect(fakeDocument.listeners.size).toBe(0)
    expect(documentElement.listeners.size).toBe(0)
    expect(body.listeners.size).toBe(0)
    expect(fakeWindow.oncontextmenu).toBe('window-old')
    expect(fakeDocument.oncontextmenu).toBe('document-old')
    expect(body.oncontextmenu).toBe('body-old')
    expect(canvas.oncontextmenu).toBe('canvas-old')
    expect(canvas.tabIndex).toBe(7)
    expect(canvas.style.outline).toBe('2px solid red')
    vi.unstubAllGlobals()
  })
})

function installFlightPage(): {
  keydown: (event: Partial<KeyboardEvent>) => boolean
  mouse: (type: string, button: number) => boolean
  release: () => void
} {
  class FakeHtmlElement {
    constructor(readonly tagName: string, readonly isContentEditable = false) {}
  }
  const fakeWindow = Object.assign(fakeTarget(), { oncontextmenu: null })
  const fakeDocument = Object.assign(fakeTarget(), {
    documentElement: fakeTarget(),
    body: Object.assign(fakeTarget(), { oncontextmenu: null }),
    fullscreenElement: null,
    oncontextmenu: null,
  })
  const canvas = Object.assign(fakeTarget(), {
    focus: vi.fn(), oncontextmenu: null, style: { outline: '' }, tabIndex: -1,
  }) as unknown as HTMLCanvasElement
  vi.stubGlobal('HTMLElement', FakeHtmlElement)
  vi.stubGlobal('window', fakeWindow)
  vi.stubGlobal('document', fakeDocument)
  const release = suppressBrowserUi(canvas)
  const dispatch = (type: string, event: object): boolean => {
    let prevented = false
    const full = { preventDefault: () => { prevented = true }, stopPropagation: () => {}, ...event }
    for (const listener of fakeWindow.listeners.get(type) ?? []) (listener as (e: object) => void)(full)
    return prevented
  }
  return {
    keydown: event => dispatch('keydown', {
      key: '', code: '', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, target: null, ...event,
    }),
    mouse: (type, button) => dispatch(type, { button }),
    release: () => { release(); vi.unstubAllGlobals() },
  }
}

describe('browser shortcut filter', () => {
  it('blocks flight keys and tab shortcuts only while flight owns the keyboard', () => {
    const page = installFlightPage()
    try {
      expect(page.keydown({ key: 'w', code: 'KeyW' })).toBe(false)
      setFlightKeyCapture(true)
      expect(page.keydown({ key: 'w', code: 'KeyW' })).toBe(true)
      expect(page.keydown({ key: 'w', code: 'KeyW', ctrlKey: true })).toBe(true)
      expect(page.keydown({ key: 't', code: 'KeyT', metaKey: true })).toBe(true)
      expect(page.keydown({ key: 'PageDown', code: 'PageDown', ctrlKey: true })).toBe(true)
      expect(page.keydown({ key: 'ArrowLeft', code: 'ArrowLeft', altKey: true })).toBe(true)
      expect(page.keydown({ key: 'F5', code: 'F5' })).toBe(true)
      expect(page.keydown({ key: 'F10', code: 'F10', shiftKey: true })).toBe(true)
      expect(page.keydown({ key: 'ContextMenu', code: 'ContextMenu' })).toBe(true)
      expect(page.keydown({ key: 'p', code: 'KeyP' })).toBe(false)
      expect(page.keydown({ key: 'F12', code: 'F12' })).toBe(false)
    } finally {
      page.release()
    }
  })

  it('lets text fields keep their own typing during flight', () => {
    const page = installFlightPage()
    try {
      setFlightKeyCapture(true)
      const Element = globalThis.HTMLElement as unknown as new (tag: string, editable?: boolean) => object
      expect(page.keydown({ key: 'w', code: 'KeyW', target: new Element('INPUT') as EventTarget })).toBe(false)
      expect(page.keydown({ key: 'a', code: 'KeyA', target: new Element('TEXTAREA') as EventTarget })).toBe(false)
      expect(page.keydown({ key: 's', code: 'KeyS', target: new Element('DIV', true) as EventTarget })).toBe(false)
      expect(page.keydown({ key: 'w', code: 'KeyW', target: new Element('CANVAS') as EventTarget })).toBe(true)
    } finally {
      page.release()
    }
  })

  it('suppresses right-button menus and middle-click autoscroll but not left clicks', () => {
    const page = installFlightPage()
    try {
      expect(page.mouse('mousedown', 2)).toBe(true)
      expect(page.mouse('auxclick', 2)).toBe(true)
      expect(page.mouse('mousedown', 1)).toBe(true)
      expect(page.mouse('pointerdown', 2)).toBe(true)
      expect(page.mouse('mousedown', 0)).toBe(false)
    } finally {
      page.release()
    }
  })
})

describe('fullscreen gesture recovery', () => {
  function stubFullscreen(request: () => Promise<void> | undefined): {
    doc: { fullscreenElement: object | null; exitFullscreen: ReturnType<typeof vi.fn> }
    requestFullscreen: ReturnType<typeof vi.fn>
    lock: ReturnType<typeof vi.fn>
    unlock: ReturnType<typeof vi.fn>
  } {
    const requestFullscreen = vi.fn(request)
    const doc = {
      fullscreenElement: null as object | null,
      documentElement: { requestFullscreen },
      exitFullscreen: vi.fn(() => Promise.resolve()),
    }
    const lock = vi.fn(() => Promise.resolve())
    const unlock = vi.fn()
    vi.stubGlobal('document', doc)
    vi.stubGlobal('navigator', { keyboard: { lock, unlock } })
    return { doc, requestFullscreen, lock, unlock }
  }

  it('arms a click retry when the browser refuses the fullscreen gesture', async () => {
    const page = stubFullscreen(() => Promise.reject(new Error('gesture')))
    try {
      enterGameFullscreenFromGesture()
      await Promise.resolve()
      await Promise.resolve()
      expect(page.requestFullscreen).toHaveBeenCalledTimes(1)
      tryReenterFullscreenFromClick()
      expect(page.requestFullscreen).toHaveBeenCalledTimes(2)
      // Without a fresh refusal the click path stays disarmed.
      page.requestFullscreen.mockImplementation(() => Promise.resolve())
      enterGameFullscreenFromGesture()
      await Promise.resolve()
      tryReenterFullscreenFromClick()
      expect(page.requestFullscreen).toHaveBeenCalledTimes(3)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('locks keys when already fullscreen and arms re-entry after a toggle out', () => {
    const page = stubFullscreen(() => Promise.resolve())
    try {
      page.doc.fullscreenElement = {}
      enterGameFullscreenFromGesture()
      expect(page.requestFullscreen).not.toHaveBeenCalled()
      expect(page.lock).toHaveBeenCalledTimes(1)
      toggleGameFullscreen()
      expect(page.unlock).toHaveBeenCalledTimes(1)
      expect(page.doc.exitFullscreen).toHaveBeenCalledTimes(1)
      page.doc.fullscreenElement = null
      tryReenterFullscreenFromClick()
      expect(page.requestFullscreen).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
