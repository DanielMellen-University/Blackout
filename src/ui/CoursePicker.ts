import {
  courseMasteryTierForProgress,
  courseMasteryTierLabel,
  formatTime,
  MASTERY_BADGE_COUNT,
  type CourseHistory,
} from '../systems/ChallengeRun'
import type { CourseDefinition } from '../systems/CourseLibrary'

export interface CoursePickerItem {
  id: string
  label: string
  detail: string
  meta: string
  stats: string
}

export interface CoursePickerCopyInput {
  course: Pick<CourseDefinition, 'seed' | 'profile' | 'detail'>
  history: CourseHistory | null
  bestScore: number
  badgeCount: number
  bestPrecisionStreak: number
}

/** Compact card meta plus a selected-world stats line, never a stuffed option label. */
export function coursePickerCopy(input: CoursePickerCopyInput): {
  detail: string
  meta: string
  stats: string
} {
  const detail = input.course.detail.trim() || 'Choose a world'
  const runs = finiteCount(input.history?.completionCount)
  const bestScore = finiteCount(input.bestScore)
  const badgeCount = finiteCount(input.badgeCount)
  const streak = finiteCount(input.bestPrecisionStreak)
  const contractStreak = finiteCount(input.history?.contractStreakRecord)
  const tier = courseMasteryTierForProgress({
    completionCount: runs,
    bestScore,
    badgeCount,
    contractWins: input.history?.contractWins,
  })
  const tierLabel = tier === 'rookie' ? '' : courseMasteryTierLabel(tier)

  let meta = 'NEW'
  if (runs > 0) {
    meta = `${runs} RUN${runs === 1 ? '' : 'S'}`
    if (tierLabel) meta += ` · ${tierLabel}`
  } else if (input.course.profile === 'free') {
    meta = 'EXPLORE'
  } else if (input.course.seed === null) {
    meta = 'INFINITE'
  }

  const statsParts: string[] = []
  if (runs > 0) {
    statsParts.push(`${runs} RUN${runs === 1 ? '' : 'S'}`)
    const bestTime = input.history?.bestTimeSec
    statsParts.push(Number.isFinite(bestTime) ? formatTime(bestTime!) : 'NO TIME')
  }
  if (bestScore > 0) statsParts.push(`BEST ${bestScore.toLocaleString()}`)
  if (streak >= 2) statsParts.push(`STREAK X${streak}`)
  if (contractStreak >= 2) statsParts.push(`CONTRACT X${contractStreak}`)
  if (tierLabel) statsParts.push(tierLabel)
  if (badgeCount > 0) statsParts.push(`${badgeCount}/${MASTERY_BADGE_COUNT} BADGES`)

  return { detail, meta, stats: statsParts.join(' · ') }
}

/**
 * Title and pause world picker: radio cards, short labels, selected-world copy.
 */
export class CoursePicker {
  private readonly list: HTMLElement
  private readonly detail: HTMLElement
  private readonly stats: HTMLElement
  private items: CoursePickerItem[] = []
  private selectedId = ''
  private changeHandler: ((id: string) => void) | null = null
  private disposed = false

  constructor(root: HTMLElement) {
    this.list = must(root, '.course-picker-list')
    this.detail = must(root, '.course-picker-detail')
    this.stats = must(root, '.course-picker-stats')
    this.list.setAttribute('role', 'radiogroup')
    this.list.addEventListener('click', this.onClick)
    this.list.addEventListener('keydown', this.onKeyDown)
  }

  get value(): string {
    return this.selectedId
  }

  onChange(handler: ((id: string) => void) | null): void {
    this.changeHandler = handler
  }

  setItems(items: readonly CoursePickerItem[], selectedId: string): void {
    if (this.disposed) return
    this.items = items.slice()
    this.list.replaceChildren(...this.items.map((item) => this.createOption(item)))
    this.setValue(selectedId)
  }

  setValue(id: string): void {
    if (this.disposed) return
    const next = this.items.some((item) => item.id === id)
      ? id
      : (this.items[0]?.id ?? '')
    this.selectedId = next
    this.syncSelection()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.changeHandler = null
    this.list.removeEventListener('click', this.onClick)
    this.list.removeEventListener('keydown', this.onKeyDown)
    this.items = []
  }

  private createOption(item: CoursePickerItem): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'course-option'
    button.dataset.courseId = item.id
    button.setAttribute('role', 'radio')
    button.setAttribute('aria-label', item.meta ? `${item.label}, ${item.meta}` : item.label)
    const name = document.createElement('span')
    name.className = 'course-option-name'
    name.textContent = item.label
    const meta = document.createElement('span')
    meta.className = 'course-option-meta'
    meta.textContent = item.meta
    button.append(name, meta)
    return button
  }

  private syncSelection(): void {
    const selected = this.items.find((item) => item.id === this.selectedId)
    for (const option of Array.from(this.list.querySelectorAll<HTMLElement>('.course-option'))) {
      const on = option.dataset.courseId === this.selectedId
      option.setAttribute('aria-checked', on ? 'true' : 'false')
      option.tabIndex = on ? 0 : -1
      option.classList.toggle('is-selected', on)
    }
    this.detail.textContent = selected?.detail ?? ''
    this.stats.textContent = selected?.stats ?? ''
    this.stats.hidden = !selected?.stats
  }

  private select(id: string, persist: boolean): void {
    if (this.disposed || !id || id === this.selectedId) {
      this.syncSelection()
      return
    }
    this.selectedId = id
    this.syncSelection()
    const option = this.list.querySelector<HTMLElement>(`[data-course-id="${cssEscape(id)}"]`)
    option?.focus({ preventScroll: true })
    if (persist) this.changeHandler?.(id)
  }

  private onClick = (event: Event): void => {
    const target = event.target
    if (!(target instanceof Element)) return
    const option = target.closest('.course-option')
    if (!(option instanceof HTMLElement) || !this.list.contains(option)) return
    const id = option.dataset.courseId
    if (id) this.select(id, true)
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.disposed || this.items.length === 0) return
    const index = Math.max(0, this.items.findIndex((item) => item.id === this.selectedId))
    let next = index
    switch (event.key) {
      case 'ArrowRight':
        next = Math.min(this.items.length - 1, index + 1)
        break
      case 'ArrowLeft':
        next = Math.max(0, index - 1)
        break
      case 'ArrowDown':
        next = Math.min(this.items.length - 1, index + 2)
        break
      case 'ArrowUp':
        next = Math.max(0, index - 2)
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = this.items.length - 1
        break
      default:
        return
    }
    event.preventDefault()
    const item = this.items[next]
    if (item) this.select(item.id, true)
  }
}

function finiteCount(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value!)) : 0
}

function must(root: HTMLElement, sel: string): HTMLElement {
  const el = root.querySelector(sel)
  if (!(el instanceof HTMLElement)) throw new Error(`course picker missing ${sel}`)
  return el
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value)
  return value.replace(/["\\]/g, '\\$&')
}
