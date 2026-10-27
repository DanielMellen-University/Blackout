/** Time-weighted flying bonuses for gated runs. Speeds are m/s and heights metres. */
export class FlyingScore {
  private duration = 0
  private low = 0
  private terrain = 0
  private speed = 0

  sample(dt: number, altitudeM: number, clearanceM: number, speedMps: number): void {
    if (!Number.isFinite(dt) || dt <= 0 || !Number.isFinite(altitudeM) ||
        !Number.isFinite(clearanceM) || !Number.isFinite(speedMps)) return
    const low = clamp01((300 - Math.max(0, altitudeM)) / 300)
    const terrain = clamp01((100 - Math.max(0, clearanceM)) / 100)
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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
