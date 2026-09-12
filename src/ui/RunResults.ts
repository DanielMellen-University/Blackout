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
  private readonly best: HTMLElement

  constructor(root: Document = document) {
    this.root = must(root, 'run-results')
    this.title = must(root, 'result-title')
    this.score = must(root, 'result-score')
    this.time = must(root, 'result-time')
    this.landing = must(root, 'result-landing')
    this.gates = must(root, 'result-gates')
    this.best = must(root, 'result-best')
  }

  get open(): boolean {
    return !this.root.hidden
  }

  show(result: ChallengeResult): void {
    for (const className of MEDAL_CLASSES) this.root.classList.remove(className)
    this.root.classList.add(resultMedalClass(result.medal))
    this.title.textContent = `${result.medal.toUpperCase()} RUN`
    this.score.textContent = result.totalScore.toLocaleString()
    this.time.textContent = formatTime(result.elapsedSec)
    this.landing.textContent = `${Math.round(result.landingQuality * 100)}%`
    this.gates.textContent = result.gateScore.toLocaleString()
    this.best.textContent = result.isNewBest
      ? `NEW BEST · ${result.bestScore.toLocaleString()}`
      : `BEST · ${result.bestScore.toLocaleString()}`
    this.best.classList.toggle('new-best', result.isNewBest)
    this.root.hidden = false
    document.getElementById('btn-retry')?.focus({ preventScroll: true })
  }

  hide(): void {
    this.root.hidden = true
  }
}

function must(root: Document, id: string): HTMLElement {
  const el = root.getElementById(id)
  if (!el) throw new Error(`results missing #${id}`)
  return el
}
