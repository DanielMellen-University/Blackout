import type { RenderQuality } from '../core/RenderQuality'

export type RadarContactKind = 'gate' | 'city' | 'village'

export interface RadarLandmark {
  x: number
  y: number
  z: number
  kind: 'city' | 'village'
  /** Stable streamed id used for one-shot discovery feedback. */
  id?: string
  /** Source biome keeps the discovery cue tied to the generated world. */
  biome?: string
}

export interface RadarContact {
  kind: RadarContactKind
  distance: number
  bearing: number
  label: string
  /** World position is retained for optional navigation target handoff. */
  x?: number
  y?: number
  z?: number
  id?: string
  biome?: string
  selected?: boolean
}

export interface RadarGate {
  x: number
  y: number
  z: number
}

export const RADAR_RANGE_METERS = 8_000
export const MAX_RADAR_CONTACTS = 6
/** Bound source work even if a caller hands radar an unexpectedly large list. */
export const MAX_RADAR_LANDMARK_SCAN = 128

/**
 * Reusable, low-cost navigation sweep for the HUD. Contacts are rebuilt only
 * when the HUD asks for them, not from the render loop itself.
 */
export class RadarSystem {
  private readonly contactPool: RadarContact[] = Array.from(
    { length: MAX_RADAR_CONTACTS },
    () => ({ kind: 'village', distance: 0, bearing: 0, label: '', x: 0, y: 0, z: 0, id: '', biome: '', selected: false }),
  )
  private readonly contacts: RadarContact[] = []
  private visibleContactLimit = MAX_RADAR_CONTACTS
  private selectedTargetId = ''

  /** Reduce label crowding on constrained render and motion settings. */
  setRenderQuality(quality: RenderQuality): void {
    this.visibleContactLimit = quality === 'low' ? 3 : this.reducedMotion ? 4 : MAX_RADAR_CONTACTS
  }

  /** Keep the compact radar calm when the browser requests less motion. */
  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced
    this.visibleContactLimit = this.reducedMotion
      ? Math.min(this.visibleContactLimit, 4)
      : this.visibleContactLimit === 4 ? MAX_RADAR_CONTACTS : this.visibleContactLimit
  }

  private reducedMotion = false

  update(
    px: number,
    pz: number,
    heading: number,
    gate: RadarGate | null,
    landmarks: readonly RadarLandmark[],
  ): readonly RadarContact[] {
    this.contacts.length = 0
    const safeX = finiteOr(px, 0)
    const safeZ = finiteOr(pz, 0)
    const safeHeading = finiteOr(heading, 0)
    if (gate) this.addContact('gate', gate.x, gate.y, gate.z, safeX, safeZ, safeHeading)
    const landmarkLimit = Math.min(MAX_RADAR_LANDMARK_SCAN, landmarks.length)
    for (let index = 0; index < landmarkLimit; index += 1) {
      const landmark = landmarks[index]!
      this.addContact(
        landmark.kind,
        landmark.x,
        landmark.y,
        landmark.z,
        safeX,
        safeZ,
        safeHeading,
        landmark.id,
        landmark.biome,
      )
    }
    this.contacts.sort((a, b) => {
      const priority = radarKindPriority(a.kind) - radarKindPriority(b.kind)
      return priority || a.distance - b.distance
    })
    for (const contact of this.contacts) {
      contact.selected = contact.id !== '' && contact.id === this.selectedTargetId
    }
    return this.contacts
  }

  /** Cycle the selected settlement target in the current fixed contact pool. */
  cycleTarget(): RadarContact | null {
    let first: RadarContact | null = null
    let next: RadarContact | null = null
    let foundSelected = false
    for (const contact of this.contacts) {
      if (!contact.id || contact.kind === 'gate') continue
      if (!first) first = contact
      if (foundSelected && !next) next = contact
      if (contact.id === this.selectedTargetId) foundSelected = true
    }
    const target = next ?? first
    if (!target || !target.id) {
      this.selectedTargetId = ''
      return null
    }
    this.selectedTargetId = target.id
    for (const contact of this.contacts) contact.selected = contact.id === this.selectedTargetId
    return target
  }

  /** Return the selected settlement only while it remains in the current range. */
  selectedTarget(): RadarContact | null {
    if (!this.selectedTargetId) return null
    for (const contact of this.contacts) {
      if (contact.id === this.selectedTargetId && contact.kind !== 'gate') return contact
    }
    return null
  }

  clearTarget(): void {
    this.selectedTargetId = ''
    for (const contact of this.contacts) contact.selected = false
  }

  private addContact(
    kind: RadarContactKind,
    x: number,
    y: number,
    z: number,
    px: number,
    pz: number,
    heading: number,
    id?: string,
    biome?: string,
  ): void {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return
    const dx = x - px
    const dz = z - pz
    const distance = Math.hypot(dx, dz)
    if (!Number.isFinite(distance) || distance > RADAR_RANGE_METERS) return
    const bearing = wrapAngle(Math.atan2(dx, dz) - heading)
    const normalizedKind = normalizeRadarKind(kind)
    const candidatePriority = radarKindPriority(normalizedKind)
    let contactIndex = this.contacts.length
    if (contactIndex >= this.visibleContactLimit) {
      let worstIndex = 0
      for (let index = 1; index < this.contacts.length; index += 1) {
        const current = this.contacts[index]!
        const worst = this.contacts[worstIndex]!
        if (contactIsWorse(current, worst)) worstIndex = index
      }
      const worst = this.contacts[worstIndex]!
      if (!candidateBeats(candidatePriority, distance, worst)) return
      contactIndex = worstIndex
    } else {
      this.contacts.push(this.contactPool[contactIndex]!)
    }
    const contact = this.contacts[contactIndex]!
    contact.kind = normalizedKind
    contact.distance = distance
    contact.bearing = bearing
    contact.label = radarContactLabel(contact.kind)
    contact.x = x
    contact.y = Number.isFinite(y) ? y : 0
    contact.z = z
    contact.id = typeof id === 'string' ? id : ''
    contact.biome = typeof biome === 'string' ? biome : ''
  }
}

export function radarContactLabel(kind: RadarContactKind): string {
  if (kind === 'gate') return 'GATE'
  if (kind === 'city') return 'CITY'
  return 'VILLAGE'
}

/** One-shot exploration copy for a newly entered city or village range. */
export function radarDiscoveryLabel(kind: RadarContactKind, biome: unknown): string {
  if (kind === 'gate') return ''
  const label = radarContactLabel(kind)
  const safeBiome = typeof biome === 'string' && /^[a-z]+$/.test(biome)
    ? biome.toUpperCase()
    : 'UNKNOWN'
  return `${label} CONTACT · ${safeBiome} TERRAIN`
}

export function radarBearingArrow(bearing: number): string {
  const safe = wrapAngle(bearing)
  if (Math.abs(safe) < Math.PI / 8) return '↑'
  if (safe > 0 && safe < Math.PI * .375) return '↗'
  if (safe < 0 && safe > -Math.PI * .375) return '↖'
  return safe > 0 ? '→' : '←'
}

export function radarDistanceLabel(distance: number): string {
  const safe = Number.isFinite(distance) ? Math.max(0, distance) : 0
  if (safe < 1000) return `${Math.round(safe)}M`
  return `${(safe / 1000).toFixed(safe < 10_000 ? 1 : 0)}K`
}

/** Keep settlement arrival readable without requiring a landing or scene scan. */
export function radarTargetArrivalRadius(kind: RadarContactKind): number {
  if (kind === 'city') return 900
  if (kind === 'village') return 420
  return 0
}

/** One-shot destination copy for a selected radar settlement. */
export function radarTargetArrivalLabel(kind: RadarContactKind): string {
  if (kind === 'city') return 'CITY DESTINATION REACHED'
  if (kind === 'village') return 'VILLAGE DESTINATION REACHED'
  return ''
}

function radarKindPriority(kind: RadarContactKind): number {
  return kind === 'gate' ? 0 : kind === 'city' ? 1 : 2
}

function contactIsWorse(candidate: RadarContact, currentWorst: RadarContact): boolean {
  const candidatePriority = radarKindPriority(candidate.kind)
  const worstPriority = radarKindPriority(currentWorst.kind)
  return candidatePriority > worstPriority ||
    (candidatePriority === worstPriority && candidate.distance > currentWorst.distance)
}

function candidateBeats(priority: number, distance: number, currentWorst: RadarContact): boolean {
  const worstPriority = radarKindPriority(currentWorst.kind)
  return priority < worstPriority || (priority === worstPriority && distance < currentWorst.distance)
}

function normalizeRadarKind(value: unknown): RadarContactKind {
  return value === 'gate' || value === 'city' ? value : 'village'
}

function wrapAngle(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.atan2(Math.sin(value), Math.cos(value))
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}
