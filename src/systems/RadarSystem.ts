import type { RenderQuality } from '../core/RenderQuality'

export type RadarContactKind = 'gate' | 'city' | 'village'

export interface RadarLandmark {
  x: number
  y: number
  z: number
  kind: 'city' | 'village'
}

export interface RadarContact {
  kind: RadarContactKind
  distance: number
  bearing: number
  label: string
}

export interface RadarGate {
  x: number
  y: number
  z: number
}

export const RADAR_RANGE_METERS = 8_000
export const MAX_RADAR_CONTACTS = 6

/**
 * Reusable, low-cost navigation sweep for the HUD. Contacts are rebuilt only
 * when the HUD asks for them, not from the render loop itself.
 */
export class RadarSystem {
  private readonly contactPool: RadarContact[] = Array.from(
    { length: MAX_RADAR_CONTACTS },
    () => ({ kind: 'village', distance: 0, bearing: 0, label: '' }),
  )
  private readonly contacts: RadarContact[] = []
  private visibleContactLimit = MAX_RADAR_CONTACTS

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
    for (const landmark of landmarks) {
      if (this.contacts.length >= this.visibleContactLimit) break
      this.addContact(landmark.kind, landmark.x, landmark.y, landmark.z, safeX, safeZ, safeHeading)
    }
    this.contacts.sort((a, b) => {
      const priority = radarKindPriority(a.kind) - radarKindPriority(b.kind)
      return priority || a.distance - b.distance
    })
    return this.contacts
  }

  private addContact(
    kind: RadarContactKind,
    x: number,
    _y: number,
    z: number,
    px: number,
    pz: number,
    heading: number,
  ): void {
    if (this.contacts.length >= this.visibleContactLimit) return
    if (!Number.isFinite(x) || !Number.isFinite(z)) return
    const dx = x - px
    const dz = z - pz
    const distance = Math.hypot(dx, dz)
    if (!Number.isFinite(distance) || distance > RADAR_RANGE_METERS) return
    const bearing = wrapAngle(Math.atan2(dx, dz) - heading)
    const contact = this.contactPool[this.contacts.length]!
    contact.kind = normalizeRadarKind(kind)
    contact.distance = distance
    contact.bearing = bearing
    contact.label = radarContactLabel(contact.kind)
    this.contacts.push(contact)
  }
}

export function radarContactLabel(kind: RadarContactKind): string {
  if (kind === 'gate') return 'GATE'
  if (kind === 'city') return 'CITY'
  return 'VILLAGE'
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

function radarKindPriority(kind: RadarContactKind): number {
  return kind === 'gate' ? 0 : kind === 'city' ? 1 : 2
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
