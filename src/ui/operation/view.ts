import { operationChoiceLabel } from './format'
import type { OperationDecision } from './hud'
import type { OperationSession } from './session'

export interface OperationChoiceButton {
  id: OperationDecision
  label: string
  pressed: boolean
  disabled: boolean
}

export interface OperationDeckView {
  visible: boolean
  title: string
  stage: string
  brief: string
  speed: string
  clearance: string
  progress: string
  score: string
  best: string
  airborne: string
  prompt: string
  traceSamples: number
  choices: readonly OperationChoiceButton[]
  showChoices: boolean
  showResults: boolean
  resultTitle: string
  resultScore: string
  resultMedal: string
  resultMedalId: string
  resultPath: string
  resultBest: string
  resultTime: string
  resultSummary: string
  showReplay: boolean
}

const EMPTY: OperationDeckView = {
  visible: false,
  title: 'Ridge relay',
  stage: '',
  brief: '',
  speed: '—',
  clearance: '—',
  progress: '—',
  score: '0',
  best: 'No best yet',
  airborne: '—',
  prompt: '',
  traceSamples: 0,
  choices: [],
  showChoices: false,
  showResults: false,
  resultTitle: '',
  resultScore: '',
  resultMedal: '',
  resultMedalId: 'none',
  resultPath: '',
  resultBest: '',
  resultTime: '',
  resultSummary: '',
  showReplay: false,
}

/** What the operation deck should show for the current session. */
export function operationDeckView(session: OperationSession): OperationDeckView {
  if (session.status === 'idle') return EMPTY
  const hud = session.hud
  const result = session.result
  const showResults = session.status === 'results' && result != null
  const choices = (hud?.decisions ?? []).map(id => ({
    id,
    label: operationChoiceLabel(id),
    pressed: hud?.chosen === id,
    disabled: session.status !== 'choice',
  }))
  return {
    ...EMPTY,
    visible: true,
    title: hud?.title ?? 'Ridge relay',
    stage: hud?.stageLabel ?? '',
    brief: showResults ? result.summary : (hud?.brief ?? ''),
    speed: hud?.speedLabel ?? '—',
    clearance: hud?.clearanceLabel ?? '—',
    progress: hud?.progressLabel ?? '—',
    score: showResults ? result.scoreLabel : (hud?.scoreLabel ?? '0'),
    best: showResults ? result.bestLabel : (hud?.bestLabel ?? 'No best yet'),
    airborne: hud?.airborneLabel ?? '—',
    prompt: hud?.prompt ?? '',
    traceSamples: session.trace.length,
    choices,
    showChoices: !showResults && choices.length > 0,
    showResults,
    resultTitle: result?.title ?? '',
    resultScore: result ? `Score ${result.scoreLabel}` : '',
    resultMedal: result?.medalLabel ?? '',
    resultMedalId: result?.medal ?? 'none',
    resultPath: result?.pathLabel ?? '',
    resultBest: result?.bestLabel ?? '',
    resultTime: result?.timeLabel ?? '',
    resultSummary: result?.summary ?? '',
    showReplay: showResults && result.canReplay,
  }
}
