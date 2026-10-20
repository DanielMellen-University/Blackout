/** Physics/route compatibility, independent of terrain generation. */
export const FLIGHT_REVISION = 31
export const FLIGHT_REVISION_TAG = `r${FLIGHT_REVISION}`

/** Keep pre-b20 keys byte-for-byte intact; every new record has its own family. */
export function flightRecordId(id: string): string {
  return id.replace(/^(seed:-?\d+:[a-z-]+|random-world|free-flight)(?=:|$)/, `$1:${FLIGHT_REVISION_TAG}`)
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
    const id = legacyFlightRecordId(currentId)
    const score = Number(storage?.getItem(`blackout.best.${id}`) ?? 0)
    const rawHistory = storage?.getItem(`blackout.history.${id}`)
    const history = rawHistory ? JSON.parse(rawHistory) as { completionCount?: number } : null
    const parts = [Number.isFinite(score) && score > 0 ? `BEST ${Math.floor(score)}` : '',
      Number.isFinite(history?.completionCount) && history!.completionCount! > 0 ? `${Math.floor(history!.completionCount!)} COMPLETE` : '',
      storage?.getItem(`blackout.ghost.${id}`) ? 'GHOST SAVED' : ''].filter(Boolean)
    return parts.length ? `PRE-B20 ${parts.join(' / ')}` : ''
  } catch { return '' }
}
