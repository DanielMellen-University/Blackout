import type { TerrainProfile } from './TerrainProfile'
import { basinDistance, type RiverReach, type WaterBasin } from './Hydrology'
import { refineLakeShore } from './LakeShore'
import { registerRiverSurface } from './RiverSurface'

/** Recipe-local drainage using the ordinary carved basins and river ribbons. */
export function waterwayDrainage(profile: Readonly<TerrainProfile>): { basins: WaterBasin[]; reaches: RiverReach[] } {
  const point = (right: number, forward: number) => ({
    x: profile.originX + Math.cos(profile.yaw) * right + Math.sin(profile.yaw) * forward,
    z: profile.originZ - Math.sin(profile.yaw) * right + Math.cos(profile.yaw) * forward,
  })
  // Lake and channel share one level 8 m under the profile base height, so the river
  // joins the lake without a step.
  const level = profile.baseHeight - 8
  const basins: WaterBasin[] = [{ ...point(2100, 3300), radius: 1050, aspect: 1.05,
    angle: -profile.yaw, phase: profile.phase, level, sea: false, pond: false, id: 'waterway:lake' }]
  fixLakeShore(basins[0]!)
  const reaches: RiverReach[] = []
  // A broad meandering channel crosses the outbound route and joins the lake.
  // The airfield and the aligned final stay on the dry western floodplain.
  for (let i = 0; i < 22; i++) {
    const forward = -6500 + i * 500
    const right = (f: number) => 1100 + Math.sin(f / 1600 + profile.phase) * 130
    const tangent = (f: number) => {
      const slope = Math.cos(f / 1600 + profile.phase) * 130 / 1600
      const x = Math.cos(profile.yaw) * slope + Math.sin(profile.yaw)
      const z = -Math.sin(profile.yaw) * slope + Math.cos(profile.yaw)
      const length = Math.hypot(x, z)
      return { x: x / length, z: z / length }
    }
    const a = point(right(forward), forward), b = point(right(forward + 500), forward + 500)
    const ta = tangent(forward), tb = tangent(forward + 500)
    const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz)
    const reach: RiverReach = { ax: a.x, az: a.z, bx: b.x, bz: b.z, dx, dz, length, lengthSq: length * length,
      wa: 250, wb: 250, ya: level, yb: level, source: i === 0, terminal: i === 21,
      tangentAX: ta.x, tangentAZ: ta.z, tangentBX: tb.x, tangentBZ: tb.z,
      id: `waterway:river:${i}` }
    registerRiverSurface(reach, basins)
    reaches.push(reach)
  }
  return { basins, reaches }
}

/** Resolve the warped analytic outline once into the same cached radial
 * contour generated lakes use. Carving, collision and the water surface then
 * share one exact polygon. Before, the surface bisected each ray to about 5 m
 * and drew chords inside the warped curve, so carved bed below the lake level
 * showed as a thin dry line around half of the Waterway shore. */
function fixLakeShore(basin: WaterBasin): void {
  const radii = new Float32Array(128)
  let outer = 0
  for (let i = 0; i < radii.length; i++) {
    const angle = i / radii.length * Math.PI * 2, cos = Math.cos(angle), sin = Math.sin(angle)
    let low = 0, high = basin.radius * 2.5
    for (let expand = 0; expand < 3 && basinDistance(basin, basin.x + cos * high, basin.z + sin * high) < 0; expand++) high *= 1.35
    for (let pass = 0; pass < 24; pass++) {
      const radius = (low + high) * .5
      if (basinDistance(basin, basin.x + cos * radius, basin.z + sin * radius) < 0) low = radius
      else high = radius
    }
    radii[i] = low
    outer = Math.max(outer, low)
  }
  basin.shoreRadii = refineLakeShore(radii)
  basin.boundsRadius = Math.max(basin.radius * 1.75, outer * 1.02)
}
