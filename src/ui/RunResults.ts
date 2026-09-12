import { formatTime, resultMedalClass, type ChallengeResult } from '../systems/ChallengeRun'

const MEDAL_CLASSES = ['medal-gold', 'medal-silver', 'medal-bronze', 'medal-complete'] as const

/** Results screen for the takeoff → circuit → landing challenge loop. */
export class RunResults {
  private readonly root: HTMLElement
  private readonly title: HTMLElement
  private readonly score: HTMLElement
  private readonly time: HTMLElement
  private readonly landing: HTMLElement
  private readonly gates: HTMLElement
  private readonly scoreDetail: HTMLElement
  private readonly best: HTMLElement
  private returnFocus: HTMLElement | null = null
  private disposed = false
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.disposed || !this.open || event.key !== 'Tab') return
    const focusable = this.activeFocusable()
    if (focusable.length === 0) return

    const active = document.activeElement
    const index = active instanceof HTMLElement ? focusable.indexOf(active) : -1
    if (event.shiftKey && index <= 0) {
      event.preventDefault()
      focusable[focusable.length - 1]!.focus({ preventScroll: true })
    } else if (!event.shiftKey && (index < 0 || index === focusable.length - 1)) {
      event.preventDefault()
      focusable[0]!.focus({ preventScroll: true })
    }
  }

  constructor(root: Document = document) {
    this.root = must(root, 'run-results')
    this.title = must(root, 'result-title')
    this.score = must(root, 'result-score')
    this.time = must(root, 'result-time')
    this.landing = must(root, 'result-landing')
    this.gates = must(root, 'result-gates')
    this.scoreDetail = must(root, 'result-score-detail')
    this.best = must(root, 'result-best')
    this.root.setAttribute('role', 'dialog')
    this.root.setAttribute('aria-modal', 'true')
    this.root.setAttribute('aria-labelledby', 'result-title')
    this.root.addEventListener('keydown', this.onKeyDown)
  }

  get open(): boolean {
    return !this.disposed && !this.root.hidden
  }

  show(result: ChallengeResult): void {
    if (this.disposed) return
    const active = document.activeElement
    this.returnFocus = active instanceof HTMLElement ? active : null
    for (const className of MEDAL_CLASSES) this.root.classList.remove(className)
    this.root.classList.add(resultMedalClass(result.medal))
    this.title.textContent = `${result.medal.toUpperCase()} RUN`
    this.score.textContent = result.totalScore.toLocaleString()
    this.time.textContent = formatTime(result.elapsedSec)
    this.landing.textContent = `${Math.round(result.landingQuality * 100)}%`
    this.gates.textContent = result.gateScore.toLocaleString()
    this.scoreDetail.textContent = [
      `GATE +${result.gateScore.toLocaleString()}`,
      `TIME +${result.timeScore.toLocaleString()}`,
      `LAND +${result.landingScore.toLocaleString()}`,
    ].join(' · ')
    this.best.textContent = result.isNewBest
      ? `NEW BEST · ${result.bestScore.toLocaleString()}`
      : `BEST · ${result.bestScore.toLocaleString()}`
    this.best.classList.toggle('new-best', result.isNewBest)
    this.root.hidden = false
    document.getElementById('btn-retry')?.focus({ preventScroll: true })
  }

  hide(): void {
    if (this.disposed) return
    this.root.hidden = true
    const target = this.returnFocus
    this.returnFocus = null
    if (target?.isConnected && !target.closest('[hidden]')) {
      target.focus({ preventScroll: true })
    }
  }

  /** Release the results-owned keyboard trap during runtime teardown. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.root.removeEventListener('keydown', this.onKeyDown)
    this.returnFocus = null
  }

  private activeFocusable(): HTMLElement[] {
    return Array.from(this.root.querySelectorAll<HTMLElement>(
      'button:not([hidden]):not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    )).filter((element) => !element.hidden && element.tabIndex >= 0)
  }
}

function must(root: Document, id: string): HTMLElement {
  const el = root.getElementById(id)
  if (!el) throw new Error(`results missing #${id}`)
  return el
}
