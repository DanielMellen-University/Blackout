/** Physics/route compatibility, independent of terrain generation. */
export const FLIGHT_REVISION = 32
export const FLIGHT_REVISION_TAG = `r${FLIGHT_REVISION}`

export const SCORE_REVISION_TAG = 's1'

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
    // b30 changes only routes. Retain the existing read-only historical UI.
    const oldRoute = previousScoreId.replace(/:q(1?4[6-9])(?=:|$)/, (_, q: string) => `:q${Number(q) - 10}`)
    return [...(oldRoute !== previousScoreId ? [[oldRoute, 'PRE-B30']] : []), [base, 'PRE-B20'], [base.replace(/^(seed:-?\d+:[a-z-]+|random-world|free-flight)(?=:|$)/, '$1:r31'), 'B20 R31']].map(([id, label]) => {
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
