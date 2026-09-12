import { describe, expect, it, vi } from 'vitest'
import { RunResults } from '../src/ui/RunResults'

class FakeClassList {
  private readonly values = new Set<string>()

  add(...names: string[]): void {
    for (const name of names) this.values.add(name)
  }

  remove(...names: string[]): void {
    for (const name of names) this.values.delete(name)
  }

  toggle(name: string, force?: boolean): boolean {
    const next = force ?? !this.values.has(name)
    if (next) this.values.add(name)
    else this.values.delete(name)
    return next
  }
}

class FakeElement {
  hidden = false
  tabIndex = 0
  disabled = false
  textContent = ''
  isConnected = true
  readonly classList = new FakeClassList()
  readonly focus = vi.fn()
  private readonly lists = new Map<string, FakeElement[]>()
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>()

  setList(selector: string, elements: FakeElement[]): void {
    this.lists.set(selector, elements)
  }

  querySelectorAll<T>(selector: string): T[] {
    return (this.lists.get(selector) ?? []) as unknown as T[]
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    let set = this.listeners.get(type)
    if (!set) {
      set = new Set()
      this.listeners.set(type, set)
    }
    set.add(listener)
  }

  removeEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(listener)
  }

  dispatch(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }

  closest(selector: string): FakeElement | null {
    return selector === '[hidden]' && this.hidden ? this : null
  }

  setAttribute(): void {}
}

class FakeDocument {
  activeElement: FakeElement | null = null

  constructor(private readonly elements: Map<string, FakeElement>) {}

  getElementById(id: string): FakeElement | null {
    return this.elements.get(id) ?? null
  }
}

function resultsFixture(): {
  root: FakeElement
  retry: FakeElement
  newWorld: FakeElement
  source: FakeElement
  document: FakeDocument
} {
  const root = new FakeElement()
  const retry = new FakeElement()
  const newWorld = new FakeElement()
  const source = new FakeElement()
  const elements = new Map<string, FakeElement>([
    ['run-results', root],
    ['result-title', new FakeElement()],
    ['result-score', new FakeElement()],
    ['result-time', new FakeElement()],
    ['result-landing', new FakeElement()],
    ['result-gates', new FakeElement()],
    ['result-best', new FakeElement()],
    ['btn-retry', retry],
  ])
  root.setList(
    'button:not([hidden]):not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    [retry, newWorld],
  )
  const document = new FakeDocument(elements)
  document.activeElement = source
  return { root, retry, newWorld, source, document }
}

const result = {
  elapsedSec: 42,
  gateScore: 20_000,
  timeScore: 70_000,
  landingScore: 10_000,
  landingQuality: 1,
  totalScore: 100_000,
  medal: 'gold' as const,
  bestScore: 100_000,
  isNewBest: true,
}

describe('run results focus flow', () => {
  it('traps Tab and restores the flight focus target when hidden', () => {
    vi.stubGlobal('HTMLElement', FakeElement)
    const fixture = resultsFixture()
    vi.stubGlobal('document', fixture.document)
    const results = new RunResults(fixture.document as unknown as Document)

    results.show(result)
    expect(fixture.retry.focus).toHaveBeenCalledWith({ preventScroll: true })

    fixture.document.activeElement = fixture.newWorld
    const forward = { key: 'Tab', shiftKey: false, preventDefault: vi.fn() }
    fixture.root.dispatch('keydown', forward)
    expect(forward.preventDefault).toHaveBeenCalled()
    expect(fixture.retry.focus).toHaveBeenCalledTimes(2)

    fixture.document.activeElement = fixture.retry
    const backward = { key: 'Tab', shiftKey: true, preventDefault: vi.fn() }
    fixture.root.dispatch('keydown', backward)
    expect(backward.preventDefault).toHaveBeenCalled()
    expect(fixture.newWorld.focus).toHaveBeenCalledWith({ preventScroll: true })

    results.hide()
    expect(fixture.source.focus).toHaveBeenCalledWith({ preventScroll: true })
    results.dispose()

    const afterDispose = { key: 'Tab', shiftKey: false, preventDefault: vi.fn() }
    fixture.root.dispatch('keydown', afterDispose)
    expect(afterDispose.preventDefault).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
