import { normalizeRenderQuality, type RenderQuality } from '../core/RenderQuality'

export type RadarContactKind = 'gate' | 'city' | 'village' | 'traffic'

export interface RadarLandmark {
  x: number
  y: number
  z: number
  kind: 'city' | 'village' | 'traffic'
  /** Stable generated name for settlement landmarks; absent on traffic. */
  name?: string
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
  /** Signed world-space separation from the aircraft, when supplied. */
  vertical?: number
  name?: string
  id?: string
  biome?: string
  selected?: boolean
}

/** Internal extension for pooled contacts so stable names are normalized once. */
interface RadarContactBuffer extends RadarContact {
  distanceSquared: number
  sourceName: string
}

export interface RadarGate {
  x: number
  y: number
  z: number
}

export const RADAR_RANGE_METERS = 8_000
const RADAR_RANGE_SQUARED = RADAR_RANGE_METERS * RADAR_RANGE_METERS
export const MAX_RADAR_CONTACTS = 6
/** Radar labels and target positions remain readable at a bounded 10 Hz sweep. */
export const RADAR_UPDATE_INTERVAL_MS = 100
/** Bound source work even if a caller hands radar an unexpectedly large list. */
export const MAX_RADAR_LANDMARK_SCAN = 128
/** Keep long exploratory sorties from retaining every streamed landmark forever. */
export const MAX_RADAR_DISCOVERED = 512
const EMPTY_RADAR_LANDMARKS: readonly RadarLandmark[] = []

/**
 * Remember a newly discovered landmark while keeping the session ledger
 * bounded. The order array is caller-owned so the hot render path keeps its
 * existing Set lookup and the eviction bookkeeping allocates only on an
 * actual first-time discovery.
 */
export function rememberRadarDiscovery(
  seen: Set<string>,
  order: string[],
  id: unknown,
  limit = MAX_RADAR_DISCOVERED,
): boolean {
  if (typeof id !== 'string' || id.length === 0 || seen.has(id)) return false
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : MAX_RADAR_DISCOVERED
  seen.add(id)
  order.push(id)
  while (order.length > safeLimit) {
    const evicted = order.shift()
    if (evicted !== undefined) seen.delete(evicted)
  }
  return true
}

export type RadarVerticalCue = 'ABOVE' | 'BELOW' | 'LEVEL'

/** Keep vertical traffic guidance consistent between the marker and text HUD. */
export function radarVerticalLabel(vertical: number, deadband = 80): RadarVerticalCue {
  const safe = Number.isFinite(vertical) ? vertical : 0
  const safeDeadband = Number.isFinite(deadband) && deadband >= 0 ? deadband : 80
  if (Math.abs(safe) <= safeDeadband) return 'LEVEL'
  return safe > 0 ? 'ABOVE' : 'BELOW'
}

export function radarUpdateDue(nowMs: number, nextUpdateMs: number): boolean {
  if (!Number.isFinite(nowMs) || !Number.isFinite(nextUpdateMs)) return true
  return nowMs >= nextUpdateMs
}

/**
 * Reusable, low-cost navigation sweep for the HUD. Contacts are rebuilt only
 * when the HUD asks for them, not from the render loop itself.
 */
export class RadarSystem {
  private readonly contactPool: RadarContactBuffer[] = Array.from(
    { length: MAX_RADAR_CONTACTS },
    () => ({ kind: 'village', distance: 0, distanceSquared: 0, bearing: 0, label: '', x: 0, y: 0, z: 0, vertical: 0, name: '', id: '', biome: '', selected: false, sourceName: '' }),
  )
  private readonly contacts: RadarContactBuffer[] = []
  private visibleContactLimit = MAX_RADAR_CONTACTS
  private selectedTargetId = ''
  private lockLostPending = false

  /** Reduce label crowding on constrained render and motion settings. */
  setRenderQuality(quality: RenderQuality): void {
    this.visibleContactLimit = normalizeRenderQuality(quality) === 'low' ? 3 : this.reducedMotion ? 4 : MAX_RADAR_CONTACTS
  }

  /** Keep the compact radar calm when the browser requests less motion. */
  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced === true
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
    traffic: readonly RadarLandmark[] = EMPTY_RADAR_LANDMARKS,
    py = 0,
  ): readonly RadarContact[] {
    this.contacts.length = 0
    const safeX = finiteOr(px, 0)
    const safeZ = finiteOr(pz, 0)
    const safeY = finiteOr(py, 0)
    const safeHeading = finiteOr(heading, 0)
    if (gate) this.addContact('gate', gate.x, gate.y, gate.z, safeX, safeY, safeZ, safeHeading)
    const landmarkLimit = Math.min(MAX_RADAR_LANDMARK_SCAN, landmarks.length)
    for (let index = 0; index < landmarkLimit; index += 1) {
      const landmark = landmarks[index]!
      this.addContact(
        landmark.kind,
        landmark.x,
        landmark.y,
        landmark.z,
        safeX,
        safeY,
        safeZ,
        safeHeading,
        landmark.id,
        landmark.biome,
        landmark.name,
      )
    }
    const trafficLimit = Math.min(MAX_RADAR_LANDMARK_SCAN, traffic.length)
    for (let index = 0; index < trafficLimit; index += 1) {
      const landmark = traffic[index]!
      this.addContact(
        'traffic',
        landmark.x,
        landmark.y,
        landmark.z,
        safeX,
        safeY,
        safeZ,
        safeHeading,
        landmark.id,
        landmark.biome,
        landmark.name,
      )
    }
    sortRadarContacts(this.contacts)
    for (const contact of this.contacts) contact.distance = Math.sqrt(contact.distanceSquared)
    let selectedPresent = this.selectedTargetId === ''
    for (const contact of this.contacts) {
      contact.selected = contact.id !== '' && contact.id === this.selectedTargetId
      selectedPresent ||= contact.selected
    }
    if (this.selectedTargetId !== '' && !selectedPresent) {
      this.selectedTargetId = ''
      this.lockLostPending = true
    }
    return this.contacts
  }

  /** Consume one bounded cue when a previously selected contact leaves range. */
  consumeLockLost(): boolean {
    if (!this.lockLostPending) return false
    this.lockLostPending = false
    return true
  }

  /** Cycle the selected settlement target in the current fixed contact pool. */
  cycleTarget(): RadarContact | null {
    let first: RadarContact | null = null
    let next: RadarContact | null = null
    let foundSelected = false
    for (const contact of this.contacts) {
      if (!contact.id || contact.kind === 'gate' || contact.kind === 'traffic') continue
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
  selectedTarget(): (RadarContact & { kind: 'city' | 'village' }) | null {
    if (!this.selectedTargetId) return null
    for (const contact of this.contacts) {
      if (contact.id === this.selectedTargetId && (contact.kind === 'city' || contact.kind === 'village')) {
        return contact as RadarContact & { kind: 'city' | 'village' }
      }
    }
    return null
  }

  clearTarget(): void {
    this.selectedTargetId = ''
    this.lockLostPending = false
    for (const contact of this.contacts) contact.selected = false
  }

  private addContact(
    kind: RadarContactKind,
    x: number,
    y: number,
    z: number,
    px: number,
    py: number,
    pz: number,
    heading: number,
    id?: string,
    biome?: string,
    name?: string,
  ): void {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return
    const dx = x - px
    const dz = z - pz
    const distanceSquared = dx * dx + dz * dz
    if (!Number.isFinite(distanceSquared) || distanceSquared > RADAR_RANGE_SQUARED) return
    const bearing = wrapAngle(Math.atan2(dx, dz) - heading)
    const normalizedKind = normalizeRadarKind(kind)
    const candidatePriority = radarKindPriority(normalizedKind)
    let contactIndex = this.contacts.length
    if (contactIndex >= this.visibleContactLimit) {
      let worstIndex = 0
      for (let index = 1; index < this.contacts.length; index += 1) {
        const current = this.contacts[index]!
        const worst = this.contacts[worstIndex]!
        if (contactIsWorse(current, worst, this.selectedTargetId)) worstIndex = index
      }
      const worst = this.contacts[worstIndex]!
      if (!candidateBeats(
        candidatePriority,
        distanceSquared,
        id,
        x,
        z,
        worst,
        this.selectedTargetId,
      )) return
      contactIndex = worstIndex
    } else {
      this.contacts.push(this.contactPool[contactIndex]!)
    }
    const contact = this.contacts[contactIndex]!
    contact.kind = normalizedKind
    contact.distanceSquared = distanceSquared
    contact.bearing = bearing
    contact.x = x
    contact.y = Number.isFinite(y) ? y : 0
    contact.z = z
    contact.vertical = contact.y - py
    const sourceName = typeof name === 'string' ? name : ''
    const buffered = contact as RadarContactBuffer
    if (buffered.sourceName !== sourceName) {
      buffered.sourceName = sourceName
      contact.name = safeRadarName(sourceName)
    }
    contact.id = typeof id === 'string' ? id : ''
    contact.biome = typeof biome === 'string' ? biome : ''
    contact.label = radarContactLabelFromSafeName(contact.kind, contact.name ?? '')
  }
}

export function radarContactLabel(kind: RadarContactKind, name?: string): string {
  return radarContactLabelFromSafeName(kind, safeRadarName(name))
}

function radarContactLabelFromSafeName(kind: RadarContactKind, name: string): string {
  if (kind === 'gate') return 'GATE'
  if (kind === 'city') return name || 'CITY'
  if (kind === 'traffic') return 'TRAFFIC'
  return name || 'VILLAGE'
}

/** One-shot exploration copy for a newly entered city or village range. */
export function radarDiscoveryLabel(kind: RadarContactKind, biome: unknown, name?: string): string {
  if (kind === 'gate' || kind === 'traffic') return ''
  const label = radarContactLabel(kind)
  const landmark = safeRadarName(name)
  const safeBiome = typeof biome === 'string' && /^[a-z]+$/.test(biome)
    ? biome.toUpperCase()
    : 'UNKNOWN'
  return `${label} CONTACT${landmark ? ` · ${landmark}` : ''} · ${safeBiome} TERRAIN`
}

function safeRadarName(value: unknown): string {
  if (typeof value !== 'string') return ''
  const safe = value.trim().replace(/[^a-z0-9 ]/gi, '').replace(/\s+/g, ' ')
  return safe.slice(0, 24).toUpperCase()
}

export function radarBearingArrow(bearing: number): string {
  const safe = wrapAngle(bearing)
  if (Math.abs(safe) < Math.PI / 8) return '↑'
  if (safe > 0 && safe < Math.PI * .375) return '↗'
  if (safe < 0 && safe > -Math.PI * .375) return '↖'
  if (Math.abs(safe) >= Math.PI * .875) return '↓'
  if (safe > Math.PI * .625) return '↘'
  if (safe < -Math.PI * .625) return '↙'
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
  return kind === 'gate' ? 0 : kind === 'city' ? 1 : kind === 'village' ? 2 : 3
}

/** Stable bounded ordering without invoking Array.sort on every radar sweep. */
function sortRadarContacts(contacts: RadarContactBuffer[]): void {
  for (let index = 1; index < contacts.length; index++) {
    const candidate = contacts[index]!
    let insert = index
    while (insert > 0 && compareRadarContacts(candidate, contacts[insert - 1]!) < 0) {
      contacts[insert] = contacts[insert - 1]!
      insert--
    }
    if (insert !== index) contacts[insert] = candidate
  }
}

function compareRadarContacts(a: RadarContactBuffer, b: RadarContactBuffer): number {
  return radarKindPriority(a.kind) - radarKindPriority(b.kind) ||
    a.distanceSquared - b.distanceSquared ||
    compareRadarIdentity(a.id, a.x, a.z, b.id, b.x, b.z) ||
    (a.y ?? 0) - (b.y ?? 0)
}

function contactIsWorse(candidate: RadarContactBuffer, currentWorst: RadarContactBuffer, selectedId: string): boolean {
  const candidateSelected = candidate.id !== '' && candidate.id === selectedId
  const currentSelected = currentWorst.id !== '' && currentWorst.id === selectedId
  if (candidateSelected !== currentSelected) return !candidateSelected
  return compareRadarContacts(candidate, currentWorst) > 0
}

function candidateBeats(
  priority: number,
  distanceSquared: number,
  id: string | undefined,
  x: number,
  z: number,
  currentWorst: RadarContactBuffer,
  selectedId: string,
): boolean {
  const candidateSelected = typeof id === 'string' && id !== '' && id === selectedId
  const currentSelected = currentWorst.id !== '' && currentWorst.id === selectedId
  if (currentSelected) return false
  if (candidateSelected) return true
  const worstPriority = radarKindPriority(currentWorst.kind)
  if (priority !== worstPriority) return priority < worstPriority
  if (distanceSquared !== currentWorst.distanceSquared) return distanceSquared < currentWorst.distanceSquared
  return compareRadarIdentity(id, x, z, currentWorst.id, currentWorst.x, currentWorst.z) < 0
}

/**
 * Stable final ordering for generated landmarks that share a radar tier and
 * range. Streamed settlement order can change as chunks enter and leave the
 * bounded view, so relying on source order makes labels and target cycling
 * appear to jump even when the world has not moved.
 */
function compareRadarIdentity(
  aId: string | undefined,
  aX: number | undefined,
  aZ: number | undefined,
  bId: string | undefined,
  bX: number | undefined,
  bZ: number | undefined,
): number {
  const a = typeof aId === 'string' ? aId : ''
  const b = typeof bId === 'string' ? bId : ''
  if (a !== b) {
    // Identified streamed landmarks are more useful than anonymous fallback
    // contacts when every other ranking key is tied.
    if (!a) return 1
    if (!b) return -1
    return a < b ? -1 : 1
  }
  const xOrder = finiteTieValue(aX) - finiteTieValue(bX)
  if (xOrder !== 0) return xOrder
  return finiteTieValue(aZ) - finiteTieValue(bZ)
}

function finiteTieValue(value: number | undefined): number {
  return Number.isFinite(value) ? value! : 0
}

function normalizeRadarKind(value: unknown): RadarContactKind {
  return value === 'gate' || value === 'city' || value === 'traffic' ? value : 'village'
}

function wrapAngle(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.atan2(Math.sin(value), Math.cos(value))
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}
