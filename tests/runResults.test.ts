import { describe, expect, it, vi } from 'vitest'
import { resultFuelBandClass, RunResults } from '../src/ui/RunResults'

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
  const shareReplay = new FakeElement()
  const source = new FakeElement()
  const elements = new Map<string, FakeElement>([
    ['run-results', root],
    ['result-title', new FakeElement()],
    ['result-summary', new FakeElement()],
    ['result-score', new FakeElement()],
    ['result-time', new FakeElement()],
    ['result-landing', new FakeElement()],
    ['result-landing-detail', new FakeElement()],
    ['result-gates', new FakeElement()],
    ['result-streak', new FakeElement()],
    ['result-streak-detail', new FakeElement()],
    ['result-fuel', new FakeElement()],
    ['result-fuel-detail', new FakeElement()],
    ['result-score-detail', new FakeElement()],
    ['result-badges', new FakeElement()],
    ['result-splits', new FakeElement()],
    ['result-best', new FakeElement()],
    ['btn-retry', retry],
    ['btn-share-replay', shareReplay],
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
  it('classifies result fuel bands without leaking malformed values', () => {
    expect(resultFuelBandClass(72)).toBe('fuel-healthy')
    expect(resultFuelBandClass(25)).toBe('fuel-low')
    expect(resultFuelBandClass(10)).toBe('fuel-critical')
    expect(resultFuelBandClass(Number.NaN)).toBe('fuel-critical')
  })

  it('traps Tab and restores the flight focus target when hidden', () => {
    vi.stubGlobal('HTMLElement', FakeElement)
    const fixture = resultsFixture()
    vi.stubGlobal('document', fixture.document)
    const results = new RunResults(fixture.document as unknown as Document)

    results.show(result)
    expect(fixture.retry.focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toBe(
      'GATE +20,000 · TIME +70,000 · LAND +10,000',
    )
    expect(elementsFor(fixture.document, 'result-summary')?.textContent).toBe(
      'NEW COURSE BEST · SCORE 100,000 · FUEL 100% LEFT · ENTER RETRY · R NEW WORLD',
    )

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
    results.dispose()
    results.show(result)
    results.hide()
    expect(results.open).toBe(false)
    vi.unstubAllGlobals()
  })

  it('dispatches replay sharing through a disposable results action', () => {
    vi.stubGlobal('HTMLElement', FakeElement)
    const fixture = resultsFixture()
    vi.stubGlobal('document', fixture.document)
    const results = new RunResults(fixture.document as unknown as Document)
    const share = elementsFor(fixture.document, 'btn-share-replay')!
    const handler = vi.fn()
    results.setShareReplayHandler(handler)
    share.dispatch('click', {})
    expect(handler).toHaveBeenCalledTimes(1)
    results.dispose()
    share.dispatch('click', {})
    expect(handler).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it('renders the saved split comparison only on the results card', () => {
    vi.stubGlobal('HTMLElement', FakeElement)
    const fixture = resultsFixture()
    vi.stubGlobal('document', fixture.document)
    const results = new RunResults(fixture.document as unknown as Document)

    results.show({
      ...result,
      gateSplits: [1, 2],
      bestGateSplits: [1.5, 2.5],
      paceLabel: 'AHEAD 0.50S',
      completionCount: 3,
      bestTimeSec: 38.4,
      fuelRemainingPercent: 72,
      fuelUsedPercent: 28,
      scoringFocus: 'pace',
      masteryBadges: ['first-flight', 'landing-ace'],
      newMasteryBadges: ['landing-ace'],
      bestPrecisionStreak: 3,
      courseBestPrecisionStreak: 4,
      peakSpeedKts: 962,
      peakAltitudeM: 1_240,
      altitudeMilestoneM: 1_500,
      bestCombo: 4,
      comboScore: 900,
      fuelScore: 720,
      approachScore: 500,
      weatherScore: 400,
      nightScore: 350,
      destinationScore: 1_200,
      destinationCount: 3,
      courseBestDestinationCount: 4,
      runStreak: 3,
      courseBestRunStreak: 4,
      contractKind: 'fuel',
      contractLabel: 'FUEL SAVER',
      contractDetail: 'LAND WITH 75% FUEL',
      contractComplete: true,
      contractProgress: 1,
      contractScore: 2_000,
      contractStreakBonus: 250,
      contractWins: 3,
      courseBestContractWins: 4,
      contractStreak: 3,
      courseBestContractStreak: 4,
      deadstickScore: 1_500,
      courseMasteryTier: 'ace',
      courseMasteryTierLabel: 'ACE',
      courseBestApproachScore: 650,
      courseBestCombo: 6,
      courseBestPeakSpeedKts: 1_020,
      courseBestPeakAltitudeM: 1_800,
      landingLabel: 'BUTTER',
    })
    expect(elementsFor(fixture.document, 'result-splits')?.textContent).toBe(
      'G1 0:01.00 -0.50 · G2 0:02.00 -0.50',
    )
    expect(elementsFor(fixture.document, 'result-best')?.textContent).toBe(
      'NEW BEST · 100,000 · RUN 3 · FASTEST 0:38.40',
    )
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('PACE FOCUS')
    expect(elementsFor(fixture.document, 'result-badges')?.textContent).toBe('NEW BADGE · LANDING ACE')
    expect(elementsFor(fixture.document, 'result-fuel')?.textContent).toBe('72%')
    expect(elementsFor(fixture.document, 'result-fuel-detail')?.textContent).toBe('28% USED')
    expect(elementsFor(fixture.document, 'result-streak')?.textContent).toBe('X3')
    expect(elementsFor(fixture.document, 'result-streak-detail')?.textContent).toBe('COURSE BEST X4')
    expect(elementsFor(fixture.document, 'result-landing-detail')?.textContent).toBe('BUTTER')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('TOP 962KT')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('ALT 1,240M')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('CLIMB 1,500M')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('COMBO X4')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('COMBO +900')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('FUEL +720')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('APPROACH +500')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('WEATHER +400')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('NIGHT +350')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('DEST X3')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('DEST +1,200')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('COURSE DEST X4')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('RUN STREAK X3')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('COURSE RUN STREAK X4')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('CONTRACT COMPLETE · FUEL SAVER')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('LAND WITH 75% FUEL')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('CONTRACT +2,000')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('CHAIN +250')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('DEADSTICK +1,500')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('CONTRACT WINS X3')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('COURSE CONTRACTS X4')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('CONTRACT STREAK X3')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('COURSE CONTRACT STREAK X4')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('COURSE TIER ACE')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('COURSE APPROACH +650')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('COURSE COMBO X6')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('COURSE TOP 1,020KT')
    expect(elementsFor(fixture.document, 'result-score-detail')?.textContent).toContain('COURSE ALT 1,800M')
    expect(elementsFor(fixture.document, 'result-summary')?.textContent).toBe(
      'NEW COURSE BEST · SCORE 100,000 · FUEL 72% LEFT · ENTER RETRY · R NEW WORLD',
    )
    results.dispose()
    vi.unstubAllGlobals()
  })

  it('celebrates new course flight records without replacing badge feedback', () => {
    vi.stubGlobal('HTMLElement', FakeElement)
    const fixture = resultsFixture()
    vi.stubGlobal('document', fixture.document)
    const results = new RunResults(fixture.document as unknown as Document)

    results.show({
      ...result,
      newPeakSpeedRecord: true,
      newPeakAltitudeRecord: true,
      newComboRecord: true,
      newApproachRecord: true,
      newDestinationRecord: true,
      newRunStreakRecord: true,
      newContractRecord: true,
      newContractStreakRecord: true,
      newMasteryBadges: ['streak-hunter'],
      masteryBadges: ['streak-hunter'],
    })
    expect(elementsFor(fixture.document, 'result-badges')?.textContent).toBe(
      'NEW BADGE · STREAK HUNTER · NEW RECORDS · SPEED / ALTITUDE / COMBO / APPROACH / DESTINATIONS / RUN STREAK / CONTRACTS / CONTRACT STREAK',
    )
    results.dispose()
    vi.unstubAllGlobals()
  })

  it('labels a newly earned approach ace badge', () => {
    vi.stubGlobal('HTMLElement', FakeElement)
    const fixture = resultsFixture()
    vi.stubGlobal('document', fixture.document)
    const results = new RunResults(fixture.document as unknown as Document)

    results.show({
      ...result,
      newMasteryBadges: ['approach-ace'],
      masteryBadges: ['approach-ace'],
    })
    expect(elementsFor(fixture.document, 'result-badges')?.textContent).toBe('NEW BADGE · APPROACH ACE')
    results.dispose()
    vi.unstubAllGlobals()
  })

  it('labels a free-flight result as a scenic sortie', () => {
    vi.stubGlobal('HTMLElement', FakeElement)
    const fixture = resultsFixture()
    vi.stubGlobal('document', fixture.document)
    const results = new RunResults(fixture.document as unknown as Document)

    results.show({ ...result, freeFlight: true })
    expect(elementsFor(fixture.document, 'result-title')?.textContent).toBe('FREE FLIGHT COMPLETE')
    expect(elementsFor(fixture.document, 'result-summary')?.textContent).toContain('SCENIC SORTIE COMPLETE')
    results.dispose()
    vi.unstubAllGlobals()
  })
})

function elementsFor(document: FakeDocument, id: string): FakeElement | null {
  return document.getElementById(id)
}
