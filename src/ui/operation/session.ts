import { stageThrottle } from '../../systems/operation/bands'
import {
  chooseOperationEnergy,
  chooseOperationRoute,
  closeOperationFlight,
  openOperationFlight,
  operationFlightTranscript,
  stepOperationFlight,
  type OperationFlight,
} from '../../systems/operation/flight'
import { OPERATION_STAGES, type OperationStageId } from '../../systems/operation/identity'
import type { OperationTranscript } from '../../systems/operation/replay'
import { replayOperation } from '../../systems/operation/replay'
import type { FlightSample } from '../../systems/operation/samples'
import {
  clearActive,
  commitAttempt,
  emptyProgress,
  loadProgress,
  writeProgress,
  type OperationProgress,
  type OperationStore,
} from '../../systems/operation/save'
import { normalizeOperationSeed } from '../../systems/operation/seed'
import { clampOperationStick, neutralOperationStick, type OperationStick } from '../../systems/operation/stick'
import { formatOperationScore } from './format'
import { operationHudModel, type OperationHudModel } from './hud'
import { operationReplayCues, operationReplayHud, type OperationReplayCue } from './playback'
import { OPERATION_PLAY_SEED } from './playSeed'
import { operationResultModel, type OperationResultModel } from './results'

export type OperationPlayStatus = 'idle' | 'flying' | 'choice' | 'results' | 'replay'
export type OperationControlMode = 'model' | 'stick'

function copySamples(flight: OperationFlight): FlightSample[] {
  return OPERATION_STAGES.flatMap(id => flight.samples[id])
}

function liveStage(phase: string): OperationStageId | null {
  if (phase === 'ingress' || phase === 'transit' || phase === 'egress') return phase
  return null
}

/** Plays the ridge relay one stage at a time and keeps the best result. */
export class OperationSession {
  status: OperationPlayStatus = 'idle'
  hud: OperationHudModel | null = null
  result: OperationResultModel | null = null
  trace: FlightSample[] = []
  controlMode: OperationControlMode
  stick: OperationStick = neutralOperationStick()
  private progress: OperationProgress
  private flight: OperationFlight | null = null
  private frozen: FlightSample[] = []
  private cues: OperationReplayCue[] = []
  private replayIndex = 0
  private hold = 0
  private readonly seed: number
  private readonly replayHold: number
  private readonly store: OperationStore

  constructor(store: OperationStore, seed = OPERATION_PLAY_SEED, replayHold = 36, control: OperationControlMode = 'model') {
    this.store = store
    this.controlMode = control === 'stick' ? 'stick' : 'model'
    const loaded = loadProgress(store)
    this.progress = loaded ?? emptyProgress()
    this.seed = normalizeOperationSeed(seed)
    this.replayHold = Number.isFinite(replayHold) ? Math.max(0, Math.floor(replayHold)) : 0
  }

  setControlMode(mode: string): void {
    if (mode === 'stick' || mode === 'model') this.controlMode = mode
  }

  setStick(stick: Partial<OperationStick> | null): void {
    this.stick = clampOperationStick(stick)
  }

  /** The stage currently being flown, if the aircraft is moving. */
  currentStage(): OperationStageId | null {
    return liveStage(this.flight?.attempt.phase ?? '')
  }

  /** Power the scripted brief uses for the live stage. Stick mode starts there. */
  briefedThrottle(): number {
    const attempt = this.flight?.attempt
    const stage = this.currentStage()
    if (!attempt || !stage) return 0.5
    return stageThrottle(stage, attempt.route, attempt.energy)
  }

  start(): void {
    this.stopFlight()
    this.flight = openOperationFlight(this.seed)
    this.frozen = []
    this.cues = []
    this.replayIndex = 0
    this.hold = 0
    this.result = null
    this.status = 'flying'
    this.refreshLive()
  }

  /** Fly the current stage. A full budget still stops when the stage ends. */
  advance(steps: number): void {
    if (this.status !== 'flying' || !this.flight) return
    stepOperationFlight(this.flight, steps, this.controlMode === 'stick' ? this.stick : null)
    const phase = this.flight.attempt.phase
    if (phase === 'route-choice' || phase === 'energy-choice') this.status = 'choice'
    else if (phase === 'complete' || phase === 'failed') {
      this.finish()
      return
    } else this.status = 'flying'
    this.refreshLive()
  }

  choose(choice: string): void {
    if (this.status !== 'choice' || !this.flight) return
    const step = this.flight.attempt.phase === 'route-choice'
      ? chooseOperationRoute(this.flight, choice)
      : chooseOperationEnergy(this.flight, choice)
    if (!step.ok) return
    this.status = 'flying'
    this.refreshLive()
  }

  /** Play the saved transcript. Returns false when nothing has been stored. */
  replay(): boolean {
    const transcript = this.progress.replay
    if (!transcript) return false
    this.stopFlight()
    this.cues = operationReplayCues(transcript)
    this.replayIndex = 0
    this.hold = 0
    this.result = null
    this.status = 'replay'
    this.advanceReplay(1)
    return true
  }

  /** Move through the transcript. A decision holds so the HUD can show it. */
  advanceReplay(count: number): void {
    if (this.status !== 'replay') return
    if (this.hold > 0) {
      const step = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
      if (step > 0) this.hold -= 1
      this.refreshReplay()
      return
    }
    const step = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
    const transcript = this.progress.replay
    if (!transcript || step === 0) return
    let moved = 0
    while (moved < step && this.replayIndex < this.cues.length) {
      const cue = this.cues[this.replayIndex]
      if (!cue) break
      this.replayIndex += 1
      moved += 1
      if (cue.kind === 'choice') {
        this.hold = this.replayHold
        break
      }
    }
    if (this.replayIndex >= this.cues.length) {
      this.trace = this.cues.flatMap(item => item.kind === 'sample' ? [item.sample] : [])
      this.finishReplay(transcript)
    } else this.refreshReplay()
  }

  close(): void {
    this.stopFlight()
    this.cues = []
    this.status = 'idle'
    this.hud = null
    this.result = null
    this.trace = []
  }

  private finish(): void {
    if (!this.flight) return
    const attempt = this.flight.attempt
    this.frozen = copySamples(this.flight)
    const transcript = operationFlightTranscript(this.flight)
    const before = this.progress.best
    this.progress = clearActive(commitAttempt(this.progress, attempt, transcript))
    writeProgress(this.store, this.progress)
    this.result = operationResultModel(attempt, this.progress.best, before, transcript != null)
    this.stopFlight()
    this.status = 'results'
    this.trace = this.frozen
    this.hud = operationHudModel(attempt, this.frozen[this.frozen.length - 1] ?? null, { bestLabel: this.bestLabel() })
  }

  private finishReplay(transcript: OperationTranscript): void {
    const scored = replayOperation(transcript)
    this.result = operationResultModel(scored.attempt, this.progress.best, this.progress.best, true)
    this.status = 'results'
    this.hud = operationHudModel(scored.attempt, this.trace[this.trace.length - 1] ?? null, {
      bestLabel: this.bestLabel(),
      scoreLabel: this.result.scoreLabel,
    })
  }

  private refreshLive(): void {
    if (!this.flight) return
    this.trace = copySamples(this.flight)
    this.hud = operationHudModel(this.flight.attempt, this.flight.live, { bestLabel: this.bestLabel() })
  }

  private refreshReplay(): void {
    const transcript = this.progress.replay
    const cue = this.cues[this.replayIndex - 1]
    if (!transcript || !cue) return
    const shown = this.cues.slice(0, this.replayIndex)
    this.trace = shown.flatMap(item => item.kind === 'sample' ? [item.sample] : [])
    const live = cue.kind === 'sample' ? cue.sample : this.trace[this.trace.length - 1] ?? null
    this.hud = {
      ...operationReplayHud(transcript, cue, live),
      bestLabel: this.bestLabel(),
    }
  }

  private bestLabel(): string {
    return this.progress.best ? `Best ${formatOperationScore(this.progress.best.score)}` : 'No best yet'
  }

  private stopFlight(): void {
    if (!this.flight) return
    closeOperationFlight(this.flight)
    this.flight = null
  }
}
