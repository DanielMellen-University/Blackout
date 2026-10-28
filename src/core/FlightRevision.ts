/** Physics/route compatibility, independent of terrain generation. */
export const FLIGHT_REVISION = 32
export const FLIGHT_REVISION_TAG = `r${FLIGHT_REVISION}`

/** s2 (11.025): gated runs scored under the 11.024 time allowance and terrain bonus. */
export const SCORE_REVISION_TAG = 's2'
/** Earlier score families, kept stored and shown read-only beside current records. */
const PREVIOUS_SCORE_REVISIONS: readonly (readonly [tag: string, label: string])[] = [['s1', 'S1 SCORE']]

/** A new score family, while retaining the existing physics and route identity. */
export function scoreRecordId(id: string): string {
  return `${id}:${SCORE_REVISION_TAG}`
}

/** Keep historical keys byte-for-byte intact; every new record has its own family. */
export function flightRecordId(id: string): string {
  return id.replace(/:r\d+(?=:|$)/, '').replace(/^(seed:-?\d+:[a-z-]+|random-world|free-flight)(?=:|$)/, `$1:${FLIGHT_REVISION_TAG}`)
}

export function legacyFlightRecordId(id: string): string {
  return id.replace(`:${FLIGHT_REVISION_TAG}`, '')
}

export function isCurrentFlightRecord(id: string): boolean {
  return id.split(':').includes(FLIGHT_REVISION_TAG)
}

/** Historical display is read-only, including malformed/denied browser storage. */
export function legacyFlightRecordLabel(storage: Pick<Storage, 'getItem'> | null, currentId: string): string {
  try {
    const previousScoreId = currentId.replace(`:${SCORE_REVISION_TAG}`, '')
    const base = legacyFlightRecordId(previousScoreId)
    // b30 and M0 spacing change only routes. Retain the existing read-only
    // pre-b30 historical UI for both route generations.
    const oldRoute = previousScoreId.replace(/:q(1?[45][6-9])(?=:|$)/, (_, q: string) =>
      `:q${Number(q) - (Number(q) % 100 >= 56 ? 20 : 10)}`)
    const scored = currentId.includes(`:${SCORE_REVISION_TAG}`)
    const previousScores = scored
      ? PREVIOUS_SCORE_REVISIONS.map(([tag, label]) => [currentId.replace(`:${SCORE_REVISION_TAG}`, `:${tag}`), label])
      : []
    return [...previousScores, ...(oldRoute !== previousScoreId ? [[oldRoute, 'PRE-B30']] : []), [base, 'PRE-B20'], [base.replace(/^(seed:-?\d+:[a-z-]+|random-world|free-flight)(?=:|$)/, '$1:r31'), 'B20 R31']].map(([id, label]) => {
      const score = Number(storage?.getItem(`blackout.best.${id}`) ?? 0)
      const rawHistory = storage?.getItem(`blackout.history.${id}`)
      const history = rawHistory ? JSON.parse(rawHistory) as { completionCount?: number } : null
      const parts = [Number.isFinite(score) && score > 0 ? `BEST ${Math.floor(score)}` : '',
        Number.isFinite(history?.completionCount) && history!.completionCount! > 0 ? `${Math.floor(history!.completionCount!)} COMPLETE` : '',
        storage?.getItem(`blackout.ghost.${id}`) ? 'GHOST SAVED' : ''].filter(Boolean)
      return parts.length ? `${label} ${parts.join(' / ')}` : ''
    }).filter(Boolean).join(' | ')
  } catch { return '' }
}
