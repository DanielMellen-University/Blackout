import { getTerrainProfile } from './TerrainProfile'
import { fbm, smoothstep, valueNoise } from './noise'

/** Global signed coast field. Shared by relief, water clipping and drainage. */
export function coastField(x: number, z: number): number {
  const profile = getTerrainProfile()
  if (profile?.theme === 'coastal-island-run') {
    const dx = x - profile.originX, dz = z - profile.originZ
    const right = dx * Math.cos(profile.yaw) - dz * Math.sin(profile.yaw)
    const forward = dx * Math.sin(profile.yaw) + dz * Math.cos(profile.yaw)
    // One home island and two separated neighbors. The same signed shoreline
    // drives land relief, ocean clipping, water contact and worker geometry.
    let field = -1
    for (let island = 0; island < 3; island++) {
      const cx = island === 0 ? -650 : island === 1 ? -500 : 4400
      const cz = island === 0 ? -1900 : island === 1 ? 4300 : 700
      const rx = island === 0 ? 2900 : island === 1 ? 2300 : 1750
      const rz = island === 0 ? 2900 : island === 1 ? 1850 : 2350
      const u = (right - cx) / rx, v = (forward - cz) / rz
      const angle = Math.atan2(v, u)
      const outline = 1 + Math.sin(angle * 3 + profile.phase + island) * .065
        + Math.sin(angle * 7 - profile.phase * 1.3 + island) * .025
      field = Math.max(field, (outline - Math.hypot(u, v)) * .2)
    }
    return field
  }
  if (profile?.dry || profile?.theme === 'waterway-run') return 1
  const wx = x + (valueNoise(x / 19000 + 711, z / 19000 - 93) - .5) * 9000
  const wz = z + (valueNoise(x / 19000 - 207, z / 19000 + 431) - .5) * 9000
  // Regional embayments plus smaller headlands/islands, never basin ellipses.
  // Keep seas exceptional: about a quarter of the previous water coverage.
  return fbm(wx / 22000 + 517, wz / 22000 - 319, 3, 2, .48) - .249
}

/** Blend inland relief into shelves, coastal lowlands and a true seabed. */
export function coastalRelief(height: number, field: number): number {
  const inland = smoothstep(.015, .14, field)
  const shore = field * 1800
  return shore + Math.max(0, height - 90) * inland
}
