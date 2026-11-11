import { OPERATION_STAGES } from './identity'
import { serializeOperationReplayFile } from './replayFile'
import type { OperationProgress } from './save'

/** Latest completed run, even when an older run remains best. No storage or DOM writes. */
export function exportLatestOperationReplay(progress: OperationProgress): string | null {
  const transcript = progress.replay
  const result = progress.history.at(-1)
  if (!transcript || !result || result.seed !== transcript.seed || result.id !== transcript.id
    || result.route !== transcript.route || result.energy !== transcript.energy) return null
  try {
    const stages = Object.fromEntries(OPERATION_STAGES.map(id => [id, result.stages[id].score])) as Record<typeof OPERATION_STAGES[number], number>
    return serializeOperationReplayFile(transcript, { stages, total: result.score })
  } catch {
    // Browser saves predate strict file validation and may contain an unusable trace.
    return null
  }
}
