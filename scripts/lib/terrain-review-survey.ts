// Review pilot only. Never imported by the shipped game.
import { CATCHMENT_SIZE, hydrologyPreparedAt, prepareHydrologyInBoundsSteps } from '../../src/world/Hydrology'
import { sampleTerrainSurfaceHeightFast } from '../../src/world/terrainSample'

/** Keep exact analytic look-ahead queries off the synchronous cold-cache path.
 * Only advance() constructs drainage; the runner calls it once per RAF, not
 * once per fixed physics step. Until ready, the pilot keeps its last target. */
export class TerrainReviewSurvey {
  private pending: { cx: number, cz: number, steps: Generator<unknown, void> } | null = null
  deferred = 0
  slices = 0
  maxSliceMs = 0

  reset(): void {
    this.pending?.steps.return()
    this.pending = null
    this.deferred = this.slices = this.maxSliceMs = 0
  }

  advance(): void {
    if (!this.pending) return
    const start = performance.now()
    try {
      do {
        if (this.pending.steps.next().done) {
          this.pending = null
          break
        }
      } while (performance.now() - start < 1)
    } finally {
      this.slices++
      this.maxSliceMs = Math.max(this.maxSliceMs, performance.now() - start)
    }
  }

  sample(x: number, z: number, yaw: number, clearance: number, distances: readonly number[]): number | null {
    const sx = Math.sin(yaw), sz = Math.cos(yaw)
    // Check every point before any analytic sampling. A cold miss must never
    // drain catchment() synchronously, even if earlier points are resident.
    for (const d of distances) {
      const px = x + sx * d, pz = z + sz * d
      if (hydrologyPreparedAt(px, pz)) continue
      const cx = Math.floor(px / CATCHMENT_SIZE), cz = Math.floor(pz / CATCHMENT_SIZE)
      if (!this.pending || this.pending.cx !== cx || this.pending.cz !== cz) {
        this.pending?.steps.return()
        this.pending = { cx, cz, steps: prepareHydrologyInBoundsSteps(px, pz, px, pz) }
      }
      this.deferred++
      return null
    }
    this.pending?.steps.return()
    this.pending = null
    let target = -Infinity
    for (const d of distances)
      target = Math.max(target, sampleTerrainSurfaceHeightFast(x + sx * d, z + sz * d) + clearance - d * .025)
    return target
  }
}
