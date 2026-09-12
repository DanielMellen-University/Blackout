import { describe, expect, it, vi } from 'vitest'
import {
  setFlightKeyCapture,
  shouldReenterFullscreen,
  suppressBrowserUi,
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
