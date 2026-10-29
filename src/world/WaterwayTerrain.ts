import type { TerrainProfile } from './TerrainProfile'
import type { RiverReach, WaterBasin } from './Hydrology'
import { registerRiverSurface } from './RiverSurface'

/** Recipe-local drainage using the ordinary carved basins and river ribbons. */
export function waterwayDrainage(profile: Readonly<TerrainProfile>): { basins: WaterBasin[]; reaches: RiverReach[] } {
  const point = (right: number, forward: number) => ({
    x: profile.originX + Math.cos(profile.yaw) * right + Math.sin(profile.yaw) * forward,
    z: profile.originZ - Math.sin(profile.yaw) * right + Math.cos(profile.yaw) * forward,
  })
  const level = profile.baseHeight - 8
  const basins: WaterBasin[] = [{ ...point(2100, 3300), radius: 1050, aspect: 1.05,
    angle: -profile.yaw, phase: profile.phase, level, sea: false, pond: false, id: 'waterway:lake' }]
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
