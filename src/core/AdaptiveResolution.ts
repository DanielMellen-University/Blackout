/** Slow, bounded resolution changes keep sustained GPU load near a 60 Hz budget. */
export class AdaptiveResolution {
  readonly maximum: number
  ratio: number
  private elapsed = 0
  private total = 0
  private frames = 0
  constructor(deviceRatio: number) {
    this.maximum = Math.min(1.5, Math.max(.75, deviceRatio))
    this.ratio = this.maximum
  }
  update(frameMs: number, active: boolean): number {
    if (!active || !Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 150) {
      this.elapsed = this.total = this.frames = 0
      return this.ratio
    }
    this.elapsed += frameMs
    this.total += frameMs
    this.frames++
    if (this.elapsed < 2000) return this.ratio
    const mean = this.total / this.frames
    if (mean > 21) this.ratio = Math.max(.75, this.ratio - .15)
    else if (mean < 17.5) this.ratio = Math.min(this.maximum, this.ratio + .05)
    this.elapsed = this.total = this.frames = 0
    return this.ratio
  }
}
