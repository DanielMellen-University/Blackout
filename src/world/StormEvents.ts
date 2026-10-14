export interface StormPoint { x: number; y: number; z: number }
export interface StormSource extends StormPoint { strength: number }
const DURATION = .6
function smooth01(value: number): number {
  const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t)
}

export function lightningFlashEnvelope(age: number, peak: number): number {
  if (!Number.isFinite(age) || age <= 0 || age >= DURATION) return 0
  return Math.max(0, Math.min(.18, Number.isFinite(peak) ? peak : 0)) *
    smooth01(age / .1) * (1 - smooth01((age - .1) / .5))
}

export function lightningCooldown(strength: number, variation: number): number {
  const safeStrength = Math.max(.35, Math.min(1, Number.isFinite(strength) ? strength : .35))
  const pulse = Math.max(0, Math.min(1, Number.isFinite(variation) ? variation : .5))
  return (18 + pulse * 18) / (.5 + safeStrength * .5)
}

export function thunderGainAtDistance(distance: number): number {
  if (!Number.isFinite(distance) || distance >= 30000) return 0
  const scaled = Math.max(0, distance) / 6500
  return 1 / (1 + scaled * scaled)
}

/** One spatial flash and one pending thunder, with no timers, queues, scene
 * objects or runtime allocations. Simulation time owns delay and cooldown. */
export class StormEvents {
  readonly position: StormPoint = { x: 0, y: 0, z: 0 }
  flash = 0
  private age = Infinity
  private peak = 0
  private cooldown = 24
  private pendingDelay = -1
  private readyGain = 0
  private seed = 1
  private sequence = 0
  private reducedMotion = false

  get active(): boolean { return !this.reducedMotion && this.age < DURATION }
  get thunderPending(): boolean { return this.pendingDelay >= 0 || this.readyGain > 0 }

  reset(seed: number): void {
    this.seed = Number.isFinite(seed) ? Math.round(seed * 1000000) : 1
    this.sequence = 0; this.flash = 0; this.age = Infinity
    this.pendingDelay = -1; this.readyGain = 0
    this.cooldown = 18 + this.random() * 18
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled
    if (enabled) this.clearFlash()
  }

  /** A manual weather change cancels illumination, not already travelling sound. */
  clearFlash(): void { this.flash = 0; this.age = Infinity }

  update(dt: number, source: StormSource, listener: StormPoint): void {
    if (!Number.isFinite(dt) || dt <= 0) return
    this.age += dt
    this.flash = this.reducedMotion ? 0 : lightningFlashEnvelope(this.age, this.peak)
    if (this.pendingDelay >= 0) {
      this.pendingDelay -= dt
      if (this.pendingDelay <= 0) {
        this.pendingDelay = -1
        this.readyGain = thunderGainAtDistance(Math.hypot(listener.x - this.position.x,
          listener.y - this.position.y, listener.z - this.position.z))
      }
    }
    this.cooldown = Math.max(0, this.cooldown - dt)
    if (this.cooldown > 0 || this.thunderPending || source.strength < .35 ||
      !Number.isFinite(source.strength + source.x + source.y + source.z + listener.x + listener.y + listener.z)) return
    const distance = Math.hypot(source.x - listener.x, source.y - listener.y, source.z - listener.z)
    if (distance > 20000) return
    this.position.x = source.x; this.position.y = source.y; this.position.z = source.z
    this.peak = .10 + this.random() * .08
    this.age = this.reducedMotion ? Infinity : 0; this.flash = 0
    this.pendingDelay = distance / 343
    this.cooldown = lightningCooldown(source.strength, this.random())
  }

  consumeThunder(): number {
    const gain = this.readyGain
    this.readyGain = 0
    return gain
  }

  private random(): number {
    let n = this.seed ^ Math.imul(++this.sequence, 0x9e3779b9)
    n = Math.imul(n ^ (n >>> 16), 0x7feb352d)
    n = Math.imul(n ^ (n >>> 15), 0x846ca68b)
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296
  }
}
