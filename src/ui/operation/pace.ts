/** Physics steps advanced on one animation frame while the model flies the leg. */
export function operationStepsPerFrame(reducedMotion: boolean): number {
  return reducedMotion ? 480 : 8
}

/** One physics step per frame so a stick input can still change the next one. */
export function operationStickStepsPerFrame(): number {
  return 1
}

/** Replay samples advanced on one animation frame. */
export function operationReplayStepsPerFrame(reducedMotion: boolean): number {
  return reducedMotion ? 240 : 20
}
