/** Slow, bounded resolution changes keep sustained GPU load near a 60 Hz budget. */
export class AdaptiveResolution {
  maximum: number
  ratio: number
  private elapsed = 0
  private total = 0
  private frames = 0
  private readonly deviceRatio: number
  constructor(deviceRatio: number, ceiling = 1.5) {
    this.deviceRatio = Math.max(.75, Number.isFinite(deviceRatio) ? deviceRatio : 1)
    this.maximum = Math.min(this.deviceRatio, Math.max(.75, ceiling))
    this.ratio = this.maximum
  }

  /** Change the user-selected ceiling without jumping above device limits. */
  setCeiling(ceiling: number): number {
    this.maximum = Math.min(
      this.deviceRatio,
      Math.max(.75, Number.isFinite(ceiling) ? ceiling : 1.5),
    )
    this.ratio = Math.min(this.ratio, this.maximum)
    this.elapsed = this.total = this.frames = 0
    return this.ratio
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
