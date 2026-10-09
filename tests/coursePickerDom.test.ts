import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CoursePicker, coursePickerOwnsGlobalKey, type CoursePickerItem } from '../src/ui/CoursePicker'

/** Minimal native-element test adapter; no browser, layout engine, or world boot. */
class TestElement {
  className = ''
  hidden = false
  disabled = false
  open = false
  value = ''
  tabIndex = 0
  dataset: { courseId?: string } = {}
  parent: TestElement | null = null
  children: TestElement[] = []
  private text = ''
  private attributes = new Map<string, string>()
  private listeners = new Map<string, Set<(event: unknown) => void>>()
  readonly scrollIntoView = vi.fn()
  readonly focus = vi.fn(() => { documentState.activeElement = this })
  readonly classList = {
    toggle: (name: string, force: boolean) => {
      const names = new Set(this.className.split(/\s+/))
      if (force) names.add(name)
      else names.delete(name)
      this.className = [...names].join(' ')
    },
  }

  get textContent(): string { return this.text + this.children.map(child => child.textContent).join('') }
  set textContent(value: string) { this.text = value; this.replaceChildren() }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value) }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null }
  addEventListener(type: string, handler: (event: unknown) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(handler)
  }
  removeEventListener(type: string, handler: (event: unknown) => void): void { this.listeners.get(type)?.delete(handler) }
  dispatch(type: string, event: unknown): void { for (const handler of this.listeners.get(type) ?? []) handler(event) }
  append(...children: TestElement[]): void {
    for (const child of children) { child.remove(); child.parent = this; this.children.push(child) }
  }
  insertBefore(child: TestElement, reference: TestElement): void {
    child.remove(); child.parent = this; this.children.splice(this.children.indexOf(reference), 0, child)
  }
  replaceChildren(...children: TestElement[]): void {
    for (const child of this.children) child.parent = null
    this.children = []; this.append(...children)
  }
  replaceWith(child: TestElement): void { const parent = this.parent; if (parent) { parent.insertBefore(child, this); this.remove() } }
  remove(): void {
    if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1)
    this.parent = null
  }
  contains(child: TestElement): boolean { return child === this || this.children.some(node => node.contains(child)) }
  private matches(selector: string): boolean {
    if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1))
    return selector.match(/^\[data-course-id="(.+)"\]$/)?.[1] === this.dataset.courseId
  }
  closest<T = TestElement>(selector: string): T | null {
    return this.matches(selector) ? this as unknown as T : this.parent?.closest<T>(selector) ?? null
  }
  querySelectorAll<T = TestElement>(selector: string): T[] {
    const found: TestElement[] = []
    for (const child of this.children) {
      if (child.matches(selector)) found.push(child)
      found.push(...child.querySelectorAll<TestElement>(selector))
    }
    return found as unknown as T[]
  }
  querySelector<T = TestElement>(selector: string): T | null { return this.querySelectorAll<T>(selector)[0] ?? null }
}

const documentState: { activeElement: TestElement | null } = { activeElement: null }
let root: TestElement
let picker: CoursePicker
let tracks: string
const courses: CoursePickerItem[] = [
  { id: 'training', label: 'Training', detail: 'Gentle orbit', meta: 'LONG META', stats: 'FULL LOG · 1:00 · FUEL 72%', difficulty: 'relaxed', weather: 'clear', runs: 2, score: 76_000 },
  { id: 'ridge', label: 'Ridge', detail: 'Mountain climb', meta: '', stats: '', difficulty: 'technical' },
  { id: 'storm', label: 'Storm', detail: 'Low visibility', meta: '', stats: '', difficulty: 'technical' },
  { id: 'free', label: 'Free flight', detail: 'Explore', meta: '', stats: '', freeFlight: true },
]
const missionItems: CoursePickerItem[] = [
  { ...courses[0], id: 'training-orbit', label: 'Training orbit' },
  { ...courses[1], id: 'random', label: 'Random world' },
  { ...courses[2], id: 'daily-ops', label: 'Daily challenge', category: 'ops' },
  { ...courses[3], id: 'free-flight' },
  { ...courses[2], id: 'weekly-ops', label: 'Weekly ops', category: 'ops' },
  { ...courses[2], id: 'monthly-ops', label: 'Monthly ops', category: 'ops' },
  courses[1], courses[2],
]
const element = (selector: string): TestElement => root.querySelector(selector)!
const options = (): TestElement[] => element('.course-picker-list').querySelectorAll('.course-option')
const key = (name: string, target: TestElement) => {
  const event = { key: name, target, preventDefault: vi.fn() }
  element('.course-picker-list').dispatch('keydown', event)
  return event
}

beforeEach(() => {
  tracks = '240px 240px'
  documentState.activeElement = null
  vi.stubGlobal('HTMLElement', TestElement)
  vi.stubGlobal('Element', TestElement)
  vi.stubGlobal('getComputedStyle', () => ({ gridTemplateColumns: tracks }))
  vi.stubGlobal('document', { createElement: () => new TestElement(), get activeElement() { return documentState.activeElement } })
  root = new TestElement()
  root.className = 'course-picker'
  for (const name of ['course-picker-list', 'course-picker-detail', 'course-picker-stats']) {
    const child = new TestElement(); child.className = name; root.append(child)
  }
  picker = new CoursePicker(root as unknown as HTMLElement)
  picker.setItems(courses, 'training')
})
afterEach(() => { picker.dispose(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('course picker interaction', () => {
  it('features modes in fixed order, pins Random world, and filters/counts only ordinary missions', () => {
    picker.setItems(missionItems, 'training-orbit')
    expect(element('.course-picker-featured').children.map(node => node.dataset.courseId))
      .toEqual(['free-flight', 'training-orbit', 'daily-ops'])
    expect(element('.course-picker-grid').children.map(node => node.dataset.courseId)).toEqual(['random', 'ridge', 'storm'])
    expect(options().some(node => ['weekly-ops', 'monthly-ops'].includes(node.dataset.courseId!))).toBe(false)
    expect(element('.course-picker-category').children.some(node => node.value === 'ops')).toBe(false)
    expect(element('.course-picker-category').children[0].textContent).toBe('All courses (2)')
    picker.setBrowseState('ops', 'name')
    expect(element('.course-picker-category').value).toBe('all')
    expect(element('.course-picker-grid').children[0].dataset.courseId).toBe('random')
    picker.setFilter('no matches')
    expect(options().map(node => node.dataset.courseId)).toEqual(['free-flight', 'training-orbit', 'daily-ops', 'random'])
    expect(element('.course-picker-empty').hidden).toBe(false)
    expect(element('.course-picker-filter-status').textContent).toBe('0 MATCHES')
    expect(options().filter(node => node.getAttribute('aria-checked') === 'true').map(node => node.dataset.courseId))
      .toEqual(['training-orbit'])
  })

  it('updates just the countdown text without replacing cards, selection, or focus', () => {
    picker.setItems(missionItems, 'daily-ops')
    const timer = element('.course-daily-timer')
    const daily = options()[2]
    daily.focus()
    picker.updateDailyCountdown(Date.parse('2026-10-09T04:59:59Z'))
    expect(timer.textContent).toBe('Resets in 00:00:01')
    picker.updateDailyCountdown(Date.parse('2026-10-09T05:00:00Z'))
    expect(timer.textContent).toBe('Resets in 24:00:00')
    expect(element('.course-daily-timer')).toBe(timer)
    expect(options()[2]).toBe(daily)
    expect(documentState.activeElement).toBe(daily)
    expect(picker.value).toBe('daily-ops')
  })

  it('preserves card focus through shared catalog/record refreshes', () => {
    picker.setItems(missionItems, 'training-orbit')
    options()[1].focus()
    picker.setItems(missionItems, 'training-orbit')
    expect(documentState.activeElement).toBe(options()[1])
    expect(options()[1].getAttribute('aria-checked')).toBe('true')
  })

  it('keeps a single selection across featured/grid rows and leaves typing to the filter', () => {
    picker.setItems(missionItems, 'training-orbit')
    key('ArrowDown', options()[1])
    expect(picker.value).toBe('ridge')
    key('Home', options()[4])
    expect(picker.value).toBe('free-flight')
    options()[1].focus()
    key('Home', options()[1])
    expect(documentState.activeElement).toBe(options()[0])
    key('End', options()[0])
    expect(picker.value).toBe('storm')
    expect(options().filter(node => node.getAttribute('aria-checked') === 'true')).toHaveLength(1)
    const event = key('f', element('.course-picker-filter'))
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('delegates native activation and nonempty search Escape before global launch/pause capture', () => {
    const filter = element('.course-picker-filter')
    for (const code of ['Enter', 'NumpadEnter', 'Space']) {
      expect(coursePickerOwnsGlobalKey({ code, target: options()[0] as unknown as EventTarget })).toBe(true)
      expect(coursePickerOwnsGlobalKey({ code, target: filter as unknown as EventTarget })).toBe(true)
    }
    expect(coursePickerOwnsGlobalKey({ code: 'Escape', target: filter as unknown as EventTarget })).toBe(false)
    filter.value = 'ridge'
    expect(coursePickerOwnsGlobalKey({ code: 'Escape', target: filter as unknown as EventTarget })).toBe(true)
    expect(coursePickerOwnsGlobalKey({ code: 'Escape', target: options()[0] as unknown as EventTarget })).toBe(false)
    expect(coursePickerOwnsGlobalKey({ code: 'Enter', target: new TestElement() as unknown as EventTarget })).toBe(false)
    expect(coursePickerOwnsGlobalKey({ code: 'Enter', target: null })).toBe(false)
  })
  it('uses short scan cards while retaining selected details and native expandable records', () => {
    expect(options()[0].textContent).toBe('TrainingRELAXED · CLEARPB 76,000 · SILVER')
    expect(options()[0].getAttribute('aria-label')).not.toContain('FULL LOG')
    expect(element('.course-picker-detail').textContent).toBe('Training - Gentle orbit')
    expect(element('.course-picker-goal').textContent).toContain('GOLD · 88,000')
    expect(element('.course-picker-records').hidden).toBe(false)
    expect(element('.course-picker-records').open).toBe(false)
    expect(element('.course-picker-records').children[0].getAttribute('tabindex')).toBe('0')
    expect(element('.course-picker-stats').textContent).toContain('FULL LOG')
    expect(element('.course-picker-stats').textContent).toContain('LONG META')
    picker.setValue('free')
    expect(element('.course-picker-goal').textContent).toContain('No checkpoint clock')
    expect(element('.course-picker-records').hidden).toBe(true)
  })

  it('keeps a tab stop and identifies the actual selected course when it is filtered out', () => {
    const onChange = vi.fn()
    picker.onChange(onChange)
    picker.setFilter('mountain')
    expect(picker.value).toBe('training')
    expect(options()).toHaveLength(1)
    expect(options()[0].tabIndex).toBe(0)
    expect(options()[0].getAttribute('aria-checked')).toBe('false')
    expect(element('.course-picker-filter-status').textContent).toBe('1 MATCH · SELECTED COURSE OUTSIDE FILTER')
    picker.setValue('training')
    expect(element('.course-picker-filter-status').textContent).toBe('1 MATCH · SELECTED COURSE OUTSIDE FILTER')
    expect(onChange).not.toHaveBeenCalled()
    element('.course-picker-list').dispatch('click', { target: options()[0].children[0] })
    expect(picker.value).toBe('ridge')
    expect(onChange).toHaveBeenCalledExactlyOnceWith('ridge')
    expect(options()[0].getAttribute('aria-checked')).toBe('true')
  })

  it('does not reannounce unchanged mission targets on search or sort changes', () => {
    const [title, detail] = element('.course-picker-goal').children
    expect(title.textContent).toMatch(/^NEXT MISSION · /)
    const titleWrites = vi.spyOn(title, 'textContent', 'set')
    const detailWrites = vi.spyOn(detail, 'textContent', 'set')
    picker.setFilter('mountain')
    picker.setBrowseState('technical', 'name')
    picker.setValue('training')
    expect(titleWrites).not.toHaveBeenCalled()
    expect(detailWrites).not.toHaveBeenCalled()
    picker.setValue('ridge')
    expect(titleWrites).toHaveBeenCalledOnce()
    expect(detailWrites).toHaveBeenCalledOnce()
  })

  it('matches vertical arrows to the rendered column count and keeps keyboard choices in view', () => {
    const onChange = vi.fn(); picker.onChange(onChange)
    key('ArrowDown', options()[0])
    expect(picker.value).toBe('storm')
    expect(options()[2].scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
    tracks = '480px'
    key('ArrowUp', options()[2])
    expect(picker.value).toBe('ridge')
    key('End', options()[1])
    expect(picker.value).toBe('free')
    expect(onChange.mock.calls.map(([id]) => id)).toEqual(['storm', 'ridge', 'free'])
  })

  it('navigates from the focused card rather than a hidden selection', () => {
    picker.setBrowseState('technical', 'catalog')
    tracks = '480px'
    key('ArrowDown', options()[0])
    expect(picker.value).toBe('storm')
    expect(options()[1].tabIndex).toBe(0)
    expect(options()[0].tabIndex).toBe(-1)
  })

  it('emits one shared-search clear on Escape without silently changing the course', () => {
    const onFilter = vi.fn(); picker.onFilter(onFilter)
    picker.setFilter('no matches')
    expect(options()).toHaveLength(0)
    const filter = element('.course-picker-filter')
    const event = { key: 'Escape', preventDefault: vi.fn() }
    filter.dispatch('keydown', event)
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(onFilter).toHaveBeenCalledExactlyOnceWith('')
    expect(picker.value).toBe('training')
    expect(options()).toHaveLength(4)
  })

  it('removes controls/listeners and restores record markup on repeatable disposal', () => {
    const filter = element('.course-picker-filter')
    const onFilter = vi.fn(); picker.onFilter(onFilter)
    picker.dispose(); picker.dispose()
    filter.value = 'ridge'; filter.dispatch('input', {})
    expect(onFilter).not.toHaveBeenCalled()
    expect(root.querySelector('.course-picker-browse')).toBeNull()
    expect(root.querySelector('.course-picker-goal')).toBeNull()
    expect(root.querySelector('.course-picker-records')).toBeNull()
    expect(element('.course-picker-stats').parent).toBe(root)
  })
})
