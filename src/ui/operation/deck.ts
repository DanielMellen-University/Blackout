import { OperationSession as Session, type OperationSceneSnapshot, type OperationSession } from './session'
import { browserOperationStore } from './store'
import { operationTracePath } from './trace'
import { operationStepsPerFrame, operationReplayStepsPerFrame, operationStickStepsPerFrame } from './pace'
import { OPERATION_PLAY_SEED } from './playSeed'
import { operationDeckView, type OperationDeckView } from './view'
import { OperationStickInput } from './stickInput'
import { OPERATION_DT_SEC } from '../../systems/operation/layout'

export interface OperationSceneFrame extends OperationSceneSnapshot {
  active: boolean
}

export interface OperationClock {
  reducedMotion: boolean
  request(callback: () => void): void
}

export interface OperationDeckElements {
  root: HTMLElement
  title: HTMLElement
  stage: HTMLElement
  brief: HTMLElement
  speed: HTMLElement
  clearance: HTMLElement
  progress: HTMLElement
  score: HTMLElement
  best: HTMLElement
  airborne: HTMLElement
  trace: Element
  controls: HTMLElement
  modeStick: HTMLButtonElement
  modeModel: HTMLButtonElement
  stick: HTMLElement
  guide: HTMLElement
  choices: HTMLElement
  results: HTMLElement
  resultTitle: HTMLElement
  resultScore: HTMLElement
  resultMedal: HTMLElement
  resultPath: HTMLElement
  resultBest: HTMLElement
  resultTime: HTMLElement
  resultSummary: HTMLElement
  resultStages: HTMLElement
  replay: HTMLButtonElement
  again: HTMLButtonElement
  close: HTMLButtonElement
}

const DECK_IDS = [
  'operation-title', 'operation-stage', 'operation-brief', 'operation-speed', 'operation-clearance',
  'operation-progress', 'operation-score', 'operation-best', 'operation-airborne', 'operation-trace',
  'operation-controls', 'operation-mode-stick', 'operation-mode-model', 'operation-stick', 'operation-guide',
  'operation-choices', 'operation-results', 'operation-result-title', 'operation-result-score',
  'operation-result-medal', 'operation-result-path', 'operation-result-best', 'operation-result-time',
  'operation-result-summary', 'operation-result-stages', 'operation-replay', 'operation-again', 'operation-close',
] as const

function must(root: ParentNode, id: string): HTMLElement {
  const found = root.querySelector<HTMLElement>(`#${id}`)
  if (!found) throw new Error(`#${id} missing`)
  return found
}

export function bindOperationDeck(root: HTMLElement): OperationDeckElements {
  return {
    root,
    title: must(root, 'operation-title'),
    stage: must(root, 'operation-stage'),
    brief: must(root, 'operation-brief'),
    speed: must(root, 'operation-speed'),
    clearance: must(root, 'operation-clearance'),
    progress: must(root, 'operation-progress'),
    score: must(root, 'operation-score'),
    best: must(root, 'operation-best'),
    airborne: must(root, 'operation-airborne'),
    trace: must(root, 'operation-trace'),
    controls: must(root, 'operation-controls'),
    modeStick: must(root, 'operation-mode-stick') as HTMLButtonElement,
    modeModel: must(root, 'operation-mode-model') as HTMLButtonElement,
    stick: must(root, 'operation-stick'),
    guide: must(root, 'operation-guide'),
    choices: must(root, 'operation-choices'),
    results: must(root, 'operation-results'),
    resultTitle: must(root, 'operation-result-title'),
    resultScore: must(root, 'operation-result-score'),
    resultMedal: must(root, 'operation-result-medal'),
    resultPath: must(root, 'operation-result-path'),
    resultBest: must(root, 'operation-result-best'),
    resultTime: must(root, 'operation-result-time'),
    resultSummary: must(root, 'operation-result-summary'),
    resultStages: must(root, 'operation-result-stages'),
    replay: must(root, 'operation-replay') as HTMLButtonElement,
    again: must(root, 'operation-again') as HTMLButtonElement,
    close: must(root, 'operation-close') as HTMLButtonElement,
  }
}

export function paintOperationDeck(els: OperationDeckElements, view: OperationDeckView, tracePath: string): void {
  els.root.hidden = !view.visible
  els.title.textContent = view.title
  els.stage.textContent = view.stage
  els.brief.textContent = view.brief
  els.speed.textContent = view.speed
  els.clearance.textContent = view.clearance
  els.progress.textContent = view.progress
  els.score.textContent = view.score
  els.best.textContent = view.best
  els.airborne.textContent = view.airborne
  els.choices.hidden = !view.showChoices
  els.choices.setAttribute('aria-label', view.prompt || 'Decisions')
  els.choices.replaceChildren(...view.choices.map(choice => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'operation-choice'
    button.dataset.choice = choice.id
    button.textContent = choice.label
    button.disabled = choice.disabled
    button.setAttribute('aria-pressed', choice.pressed ? 'true' : 'false')
    return button
  }))
  els.results.hidden = !view.showResults
  els.resultTitle.textContent = view.resultTitle
  els.resultScore.textContent = view.resultScore
  els.resultMedal.textContent = view.resultMedal
  els.resultMedal.dataset.medal = view.resultMedalId
  els.resultMedal.setAttribute('data-medal', view.resultMedalId)
  els.resultPath.textContent = view.resultPath
  els.resultBest.textContent = view.resultBest
  els.resultTime.textContent = view.resultTime
  els.resultSummary.textContent = view.resultSummary
  els.resultStages.replaceChildren(...view.resultStages.map(stage => {
    const item = document.createElement('li')
    item.dataset.stage = stage.id
    item.textContent = stage.text
    return item
  }))
  els.modeStick.setAttribute('aria-pressed', view.controlMode === 'stick' ? 'true' : 'false')
  els.modeModel.setAttribute('aria-pressed', view.controlMode === 'model' ? 'true' : 'false')
  els.stick.textContent = view.stickLabel
  els.guide.textContent = view.guide
  els.replay.hidden = !view.showReplay
  const path = els.trace.querySelector('path')
  if (path) path.setAttribute('d', tracePath)
}

function defaultClock(): OperationClock {
  return {
    get reducedMotion() {
      return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    },
    request(callback: () => void) {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => callback())
    },
  }
}

/** Operation deck on the flight-plan screen. */
export class OperationDeck {
  private queued = false
  private paintedStatus = ''
  private armedStage = ''
  private readonly els: OperationDeckElements
  private readonly session: OperationSession
  private readonly clock: OperationClock
  private readonly stickInput: OperationStickInput
  private sceneListener: ((frame: OperationSceneFrame) => void) | null = null
  private sceneClock = 0

  constructor(els: OperationDeckElements, session: OperationSession, clock: OperationClock = defaultClock(), stickInput?: OperationStickInput) {
    this.els = els
    this.session = session
    this.clock = clock
    this.stickInput = stickInput ?? new OperationStickInput(typeof window === 'undefined' ? null : window)
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', 'currentColor')
    path.setAttribute('stroke-width', '2')
    this.els.trace.append(path)
    this.els.close.addEventListener('click', () => this.close())
    this.els.again.addEventListener('click', () => this.flyAgain())
    this.els.replay.addEventListener('click', () => this.replay())
    this.els.choices.addEventListener('click', (event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const button = target.closest<HTMLElement>('.operation-choice')
      const choice = button?.dataset.choice
      if (!choice || this.session.status !== 'choice') return
      this.session.choose(choice)
      this.paint()
      this.queue()
    })
    this.els.controls.addEventListener('click', (event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const button = target.closest<HTMLElement>('[data-mode]')
      const mode = button?.dataset.mode
      if (mode !== 'stick' && mode !== 'model') return
      this.session.setControlMode(mode)
      this.paint()
      this.queue()
    })
  }

  /** Tell the 3D scene whenever the stage, the pose or the visibility changes. */
  bindScene(listener: ((frame: OperationSceneFrame) => void) | null): void {
    this.sceneListener = listener
    this.notifyScene()
  }

  open(): void {
    this.armedStage = ''
    this.markSceneClock()
    this.stickInput.attach()
    this.session.start()
    this.els.root.hidden = false
    this.paint()
    this.queue()
  }

  close(): void {
    this.stickInput.detach()
    this.armedStage = ''
    this.sceneClock = 0
    this.session.close()
    this.els.root.hidden = true
    this.paintedStatus = ''
    this.setDeckClass(false, false)
    this.notifyScene()
  }

  flyAgain(): void {
    this.armedStage = ''
    this.markSceneClock()
    this.stickInput.attach()
    this.session.start()
    this.paint()
    this.queue()
  }

  replay(): void {
    if (!this.session.replay()) return
    this.paint()
    this.queue()
  }

  /** One animation frame. Tests call this directly. */
  tick(): void {
    if (this.els.root.hidden) return
    this.stickInput.setCapture(this.session.status === 'flying' && this.session.controlMode === 'stick')
    if (this.session.status === 'flying' && this.session.controlMode === 'stick') {
      const stage = this.session.currentStage()
      if (stage && stage !== this.armedStage) {
        this.stickInput.setThrottle(this.session.briefedThrottle())
        this.armedStage = stage
      }
      this.session.setStick(this.stickInput.sample(OPERATION_DT_SEC))
      this.session.advance(this.sceneListener ? this.sceneSteps() : operationStickStepsPerFrame())
    } else if (this.session.status === 'flying') {
      this.session.advance(this.sceneListener ? this.sceneSteps() : operationStepsPerFrame(this.clock.reducedMotion))
    }
    else if (this.session.status === 'replay') this.session.advanceReplay(operationReplayStepsPerFrame(this.clock.reducedMotion))
    this.paint()
    if (this.session.status === 'flying' || this.session.status === 'replay') this.queue()
  }

  private queue(): void {
    if (this.queued || this.els.root.hidden) return
    if (this.session.status !== 'flying' && this.session.status !== 'replay') return
    this.queued = true
    this.clock.request(() => {
      this.queued = false
      this.tick()
    })
  }

  private paint(): void {
    const view = operationDeckView(this.session)
    paintOperationDeck(this.els, view, operationTracePath(this.session.trace))
    this.setDeckClass(this.sceneListener !== null && !this.els.root.hidden, view.showResults)
    if (view.showChoices && this.paintedStatus !== 'choice') {
      this.els.choices.querySelector<HTMLElement>('.operation-choice')?.focus()
    }
    this.paintedStatus = this.session.status
    this.notifyScene()
  }

  /** Real time while the cockpit is up. A late frame catches up by at most eight steps. */
  private sceneSteps(): number {
    const now = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : 0
    const elapsed = this.sceneClock > 0 ? Math.max(0, now - this.sceneClock) : 16
    this.sceneClock = now
    const steps = Math.round(elapsed / (1000 / 60))
    if (!Number.isFinite(steps)) return 1
    return Math.max(1, Math.min(8, steps))
  }

  private markSceneClock(): void {
    this.sceneClock = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : 0
  }

  private setDeckClass(cockpit: boolean, results: boolean): void {
    const names = new Set(this.els.root.className.split(/\s+/).filter(Boolean))
    if (cockpit) names.add('operation-cockpit')
    else names.delete('operation-cockpit')
    if (results) names.add('is-results')
    else names.delete('is-results')
    this.els.root.className = [...names].join(' ')
  }

  private notifyScene(): void {
    if (!this.sceneListener) return
    const snap = this.session.snapshot()
    this.sceneListener({
      active: !this.els.root.hidden && this.session.status !== 'idle',
      ...snap,
    })
  }
}

export function mountOperationDeck(
  root: HTMLElement,
  session = new Session(browserOperationStore(), OPERATION_PLAY_SEED, 36, 'stick'),
  clock?: OperationClock,
): OperationDeck {
  return new OperationDeck(bindOperationDeck(root), session, clock)
}

export function operationDeckIsOpen(doc: Pick<Document, 'getElementById'> = document): boolean {
  const deck = doc.getElementById('operation-deck')
  return !!deck && deck.hidden === false
}

export const OPERATION_DECK_IDS = DECK_IDS
