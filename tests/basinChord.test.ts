import { describe, expect, it } from 'vitest'
import { basinDistance, type WaterBasin } from '../src/world/Hydrology'

// Water rendering draws straight chords between cached shore radii. Carving
// and collision must use that same polygon, or coves leave water outside the
// collision shoreline (or dry ground inside the drawn lake).
function contour(count: number): WaterBasin {
  const shoreRadii = new Float32Array(count)
  for (let i = 0; i < count; i++) shoreRadii[i] = 600 + 180 * Math.sin(i * .7) + 90 * Math.cos(i * 1.9)
  return { x: 1200, z: -800, radius: 600, aspect: 1, angle: 0, phase: 0, level: 50,
    sea: false, pond: true, shoreRadii, id: 'chord-test' }
}

describe('cached shoreline chords', () => {
  it('puts every shore vertex and chord point exactly on the surface edge', () => {
    for (const count of [32, 128, 512]) {
      const basin = contour(count), radii = basin.shoreRadii!
      const angle = Math.PI * 2 / count
      for (let i = 0; i < count; i++) {
        const a = radii[i]!, b = radii[(i + 1) % count]!
        const ax = Math.cos(i * angle) * a, az = Math.sin(i * angle) * a
        const bx = Math.cos((i + 1) * angle) * b, bz = Math.sin((i + 1) * angle) * b
        for (const t of [0, .25, .5, .9]) {
          const x = basin.x + ax + (bx - ax) * t, z = basin.z + az + (bz - az) * t
          expect(Math.abs(basinDistance(basin, x, z)), `${count}:${i}:${t}`).toBeLessThan(1e-3)
        }
      }
    }
  })

  it('reads negative inside and positive outside along every spoke', () => {
    const basin = contour(128), radii = basin.shoreRadii!
    for (let i = 0; i < 128; i += 3) {
      const theta = (i + .5) / 128 * Math.PI * 2, r = Math.min(radii[i]!, radii[(i + 1) % 128]!)
      const inside = basinDistance(basin, basin.x + Math.cos(theta) * (r - 5), basin.z + Math.sin(theta) * (r - 5))
      const outside = basinDistance(basin, basin.x + Math.cos(theta) * (r + 300), basin.z + Math.sin(theta) * (r + 300))
      expect(inside).toBeLessThan(0)
      expect(outside).toBeGreaterThan(0)
    }
  })

  it('wraps the last chord back to the first radius', () => {
    const basin = contour(64), radii = basin.shoreRadii!
    // Just below a full turn the ray falls in the closing chord.
    const theta = Math.PI * 2 - 1e-7, last = radii[63]!, first = radii[0]!
    const expected = Math.min(last, first)
    const d = basinDistance(basin, basin.x + Math.cos(theta) * expected * .5, basin.z + Math.sin(theta) * expected * .5)
    expect(d).toBeCloseTo(expected * .5 - first, 0)
  })
})
