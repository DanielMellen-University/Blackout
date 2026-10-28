/** Time-weighted flying bonuses for gated runs. Speeds are m/s and heights metres. */
export class FlyingScore {
  /** Clearance where terrain proximity reaches zero: the gate line, at least 100 m. */
  private readonly terrainZeroM: number
  private duration = 0
  private low = 0
  private terrain = 0
  private speed = 0

  constructor(gateLineClearanceM = 0) {
    this.terrainZeroM = Number.isFinite(gateLineClearanceM)
      ? Math.max(MIN_TERRAIN_ZERO_M, Math.min(MAX_TERRAIN_ZERO_M, gateLineClearanceM * TERRAIN_ZERO_SCALE))
      : MIN_TERRAIN_ZERO_M
  }

  sample(dt: number, altitudeM: number, clearanceM: number, speedMps: number): void {
    if (!Number.isFinite(dt) || dt <= 0 || !Number.isFinite(altitudeM) ||
        !Number.isFinite(clearanceM) || !Number.isFinite(speedMps)) return
    const low = clamp01((300 - Math.max(0, altitudeM)) / 300)
    const terrain = clamp01((this.terrainZeroM - Math.max(0, clearanceM)) / this.terrainZeroM)
    const speed = clamp01((speedMps - 100) / 150)
    this.duration += dt
    this.low += low * dt
    this.terrain += terrain * dt
    this.speed += speed * dt
  }

  bonuses(): { lowScore: number; terrainScore: number; speedScore: number } {
    const duration = this.duration || 1
    return {
      lowScore: Math.round(10_000 * this.low / duration),
      terrainScore: Math.round(10_000 * this.terrain / duration),
      speedScore: Math.round(10_000 * this.speed / duration),
    }
  }
}

/** Terrain proximity is full at 0 m and zero at TERRAIN_ZERO_SCALE x the median gate clearance. */
const TERRAIN_ZERO_SCALE = 1.25
const MIN_TERRAIN_ZERO_M = 100
const MAX_TERRAIN_ZERO_M = 400

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
