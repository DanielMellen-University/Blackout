import { afterEach, describe, expect, it, vi } from 'vitest'
import { memoryOperationStore } from '../src/systems/operation/save'
import { mountOperationDeck, operationDeckIsOpen, type OperationClock } from '../src/ui/operation/deck'
import { OperationSession } from '../src/ui/operation/session'

class TestElement {
  id = ''
  tag = 'div'
  className = ''
  hidden = false
  disabled = false
  type = ''
  dataset: Record<string, string> = {}
  parent: TestElement | null = null
  children: TestElement[] = []
  private text = ''
  private attributes = new Map<string, string>()
  private listeners = new Map<string, Set<(event: { target?: TestElement }) => void>>()
  readonly focus = vi.fn()

  get textContent(): string { return this.text + this.children.map(child => child.textContent).join('') }
  set textContent(value: string) { this.text = value; this.replaceChildren() }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value) }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null }
  addEventListener(type: string, handler: (event: { target?: TestElement }) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(handler)
  }
  dispatch(type: string, event: { target?: TestElement }): void {
    for (const handler of this.listeners.get(type) ?? []) handler(event)
  }
  append(...children: TestElement[]): void {
    for (const child of children) {
      child.remove()
      child.parent = this
      this.children.push(child)
    }
  }
  replaceChildren(...children: TestElement[]): void {
    for (const child of this.children) child.parent = null
    this.children = []
    this.append(...children)
  }
  remove(): void {
    if (!this.parent) return
    this.parent.children.splice(this.parent.children.indexOf(this), 1)
    this.parent = null
  }
  private matches(selector: string): boolean {
    if (selector.startsWith('#')) return this.id === selector.slice(1)
    if (selector.startsWith('.')) return this.className.split(/\s+/).filter(Boolean).includes(selector.slice(1))
    const choice = selector.match(/^\[data-choice="([^"]+)"\]$/)
    if (choice) return this.dataset.choice === choice[1]
    return selector === this.tag
  }
  closest(selector: string): TestElement | null {
    return this.matches(selector) ? this : this.parent?.closest(selector) ?? null
  }
  querySelectorAll(selector: string): TestElement[] {
    const found: TestElement[] = []
    for (const child of this.children) {
      if (child.matches(selector)) found.push(child)
      found.push(...child.querySelectorAll(selector))
    }
    return found
  }
  querySelector(selector: string): TestElement | null { return this.querySelectorAll(selector)[0] ?? null }
}

const IDS = [
  'operation-title', 'operation-stage', 'operation-brief', 'operation-speed', 'operation-clearance',
  'operation-progress', 'operation-score', 'operation-best', 'operation-airborne', 'operation-trace',
  'operation-controls', 'operation-mode-stick', 'operation-mode-model', 'operation-stick', 'operation-guide',
  'operation-choices', 'operation-results', 'operation-result-title', 'operation-result-score',
  'operation-result-medal', 'operation-result-path', 'operation-result-best', 'operation-result-time',
  'operation-result-summary', 'operation-result-stages', 'operation-replay', 'operation-again', 'operation-close',
]

function buildRoot(): TestElement {
  const root = new TestElement()
  root.id = 'operation-deck'
  root.hidden = true
  for (const id of IDS) {
    const child = new TestElement()
    child.id = id
    if (id === 'operation-trace') child.tag = 'svg'
    root.append(child)
  }
  return root
}

const clock: OperationClock = { reducedMotion: false, request() {} }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('operation deck', () => {
  it('shows the stage HUD, the two decisions, the result and a replay', () => {
    const root = buildRoot()
    vi.stubGlobal('Element', TestElement)
    vi.stubGlobal('HTMLElement', TestElement)
    vi.stubGlobal('document', {
      createElement: () => new TestElement(),
      createElementNS: () => {
        const path = new TestElement()
        path.tag = 'path'
        return path
      },
      getElementById: (id: string) => id === 'operation-deck' ? root : null,
    })
    const session = new OperationSession(memoryOperationStore(), 42, 0)
    const deck = mountOperationDeck(root as unknown as HTMLElement, session, clock)
    deck.open()
    expect(operationDeckIsOpen({ getElementById: (id) => id === 'operation-deck' ? root as unknown as HTMLElement : null })).toBe(true)
    const tickUntil = (ready: () => boolean) => {
      for (let n = 0; n < 2000 && !ready(); n += 1) deck.tick()
    }
    tickUntil(() => session.status === 'choice')
    expect(root.querySelector('#operation-stage')!.textContent).toContain('valley or ridge')
    expect(root.querySelector('#operation-choices')!.hidden).toBe(false)
    const labels = root.querySelector('#operation-choices')!.children.map(child => child.textContent)
    expect(labels).toEqual(['Valley', 'Ridge'])
    root.querySelector('#operation-choices')!.dispatch('click', { target: root.querySelector('[data-choice="valley"]')! })
    expect(session.status).toBe('flying')
    tickUntil(() => session.status === 'choice')
    expect(root.querySelector('#operation-choices')!.children.map(child => child.textContent)).toEqual(['Conserve', 'Commit'])
    root.querySelector('#operation-choices')!.dispatch('click', { target: root.querySelector('[data-choice="commit"]')! })
    tickUntil(() => session.status === 'results')
    expect(root.querySelector('#operation-result-title')!.textContent).toBe('Ridge relay complete')
    expect(root.querySelector('#operation-result-score')!.textContent).toContain('Score')
    expect(root.querySelector('#operation-result-medal')!.textContent).toBe('Gold')
    expect(root.querySelector('#operation-result-medal')!.getAttribute('data-medal')).toBe('gold')
    expect(root.querySelector('#operation-result-path')!.textContent).toBe('Valley then commit')
    expect(root.querySelector('#operation-result-stages')!.textContent).toContain('Ingress')
    expect(root.querySelector('#operation-result-stages')!.textContent).toContain('Transit')
    expect(root.querySelector('#operation-result-stages')!.textContent).toContain('Egress')
    expect(root.querySelector('#operation-result-stages')!.textContent).toContain('path')
    expect(root.querySelector('#operation-stick')!.textContent).toBe('The model flew the legs')
    expect(root.querySelector('#operation-result-best')!.textContent).toContain('Best')
    expect(root.querySelector('#operation-replay')!.hidden).toBe(false)
    expect(root.querySelector('#operation-trace')!.querySelector('path')!.getAttribute('d')).toContain('M')
    root.querySelector('#operation-replay')!.dispatch('click', {})
    expect(session.status).toBe('replay')
    tickUntil(() => session.status === 'results')
    expect(root.querySelector('#operation-result-medal')!.textContent).toBe('Gold')
    root.querySelector('#operation-again')!.dispatch('click', {})
    expect(session.status).toBe('flying')
    expect(root.querySelector('#operation-stage')!.textContent).toContain('Stage 1 of 3')
    deck.close()
    expect(root.hidden).toBe(true)
    expect(session.status).toBe('idle')
  })
})
