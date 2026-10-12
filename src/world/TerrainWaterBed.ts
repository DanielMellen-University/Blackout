interface BedSample { height: number; waterLevel: number }
export interface ShoreBed {
  heights: Float32Array
  stride: number
}

/** Correct only coarse triangles that intrude into analytic water. A two-cell
 * halo gives both tiles the same correction and the same normal at a shared
 * vertex. No mesh subdivision, per-frame probes or persistent cache is added. */
export function* shoreBedSteps(
  heights: Float32Array, levels: Float32Array, segs: number, span: number,
  originX: number, originZ: number, sample: (out: BedSample, x: number, z: number) => void,
  waterLevelAt: (x: number, z: number) => number,
  preserve?: (x: number, z: number) => boolean,
): Generator<void, ShoreBed, void> {
  const stride = segs + 5, cell = span / segs
  const ground = new Float32Array(stride * stride), water = new Float32Array(ground.length)
  const corrections = new Float32Array(ground.length), probe: BedSample = { height: 0, waterLevel: 0 }
  const index = (x: number, z: number): number => (z + 2) * stride + x + 2
  for (let z = -2; z <= segs + 2; z++) {
    for (let x = -2; x <= segs + 2; x++) {
      const i = index(x, z)
      if (x >= 0 && x <= segs && z >= 0 && z <= segs) {
        const source = z * (segs + 1) + x
        ground[i] = heights[source]!; water[i] = levels[source]!
      } else {
        sample(probe, originX + x * cell, originZ + z * cell)
        ground[i] = probe.height; water[i] = probe.waterLevel
      }
    }
    yield
  }
  for (let z = -2; z <= segs + 1; z++) {
    for (let x = -2; x <= segs + 1; x++) {
      const a = index(x, z), b = a + 1, c = a + stride, d = c + 1
      const wa = ground[a]! < water[a]! - .01, wb = ground[b]! < water[b]! - .01
      const wc = ground[c]! < water[c]! - .01, wd = ground[d]! < water[d]! - .01
      // Flat water interiors and dry cells need no extra geography probes.
      // Different river/lake grades can meet within one coarse wet cell.
      const levelRange = Math.max(water[a]!, water[b]!, water[c]!, water[d]!) -
        Math.min(water[a]!, water[b]!, water[c]!, water[d]!)
      const minDepth = Math.min(water[a]! - ground[a]!, water[b]! - ground[b]!,
        water[c]! - ground[c]!, water[d]! - ground[d]!)
      if ((wa && wb && wc && wd && (levelRange < .05 || minDepth > levelRange + .15)) || !(wa || wb || wc || wd)) continue
      let lowering = 0
      const check = (u: number, v: number, interpolated: number): void => {
        const level = waterLevelAt(originX + (x + u) * cell, originZ + (z + v) * cell)
        if (!Number.isFinite(level)) return
        lowering = Math.max(lowering, interpolated - (level - .15))
      }
      check(.5, 0, (ground[a]! + ground[b]!) * .5)
      check(0, .5, (ground[a]! + ground[c]!) * .5)
      check(1, .5, (ground[b]! + ground[d]!) * .5)
      check(.5, 1, (ground[c]! + ground[d]!) * .5)
      // PlaneGeometry's shared diagonal joins the top-right/bottom-left.
      check(.5, .5, (ground[b]! + ground[c]!) * .5)
      if (cell > 40) {
        check(.25, .25, ground[a]! * .5 + (ground[b]! + ground[c]!) * .25)
        check(.75, .25, ground[b]! * .75 + ground[c]! * .25)
        check(.25, .75, ground[b]! * .25 + ground[c]! * .75)
        check(.75, .75, ground[d]! * .5 + (ground[b]! + ground[c]!) * .25)
      }
      if (lowering <= 0) continue
      // A small conservative allowance covers the curve between probes.
      lowering += Math.max(.2, lowering * .25)
      corrections[a] = Math.max(corrections[a]!, lowering)
      corrections[b] = Math.max(corrections[b]!, lowering)
      corrections[c] = Math.max(corrections[c]!, lowering)
      corrections[d] = Math.max(corrections[d]!, lowering)
    }
    yield
  }
  for (let z = -2; z <= segs + 2; z++) for (let x = -2; x <= segs + 2; x++) {
    if (preserve?.(originX + x * cell, originZ + z * cell)) continue
    const i = index(x, z)
    ground[i] = ground[i]! - corrections[i]!
  }
  return { heights: ground, stride }
}
