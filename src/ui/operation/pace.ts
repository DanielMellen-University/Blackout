/** Physics steps advanced on one animation frame while the player watches. */
export function operationStepsPerFrame(reducedMotion: boolean): number {
  return reducedMotion ? 480 : 8
}

/** Replay samples advanced on one animation frame. */
export function operationReplayStepsPerFrame(reducedMotion: boolean): number {
  return reducedMotion ? 240 : 20
}
