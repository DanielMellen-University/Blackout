import type { MissionRoutePoint } from '../systems/Mission'
import type { TerrainProfile } from './TerrainProfile'

export const PERFECT_LINE_SEED = 32026
export const PERFECT_LINE_SPEED = 150
export const PERFECT_LINE_LENGTH = 11200
// One authored, monotonic corridor. Cubic lead-ins vary the bend radii without
// a circuit, sharp corners or changes to aircraft handling.
const bends = [[0, 0], [1800, -500], [3400, 650], [5100, -300],
  [7000, -650], [8700, 500], [10300, 200], [12000, 700]] as const

export function perfectLineCenter(z: number): number {
  let i = 0
  while (i < bends.length - 2 && z > bends[i + 1]![0]) i++
  const a = bends[i]!, b = bends[i + 1]!
  const t = Math.max(0, Math.min(1, (z - a[0]) / (b[0] - a[0])))
  return a[1] + (b[1] - a[1]) * t * t * (3 - 2 * t)
}

export function perfectLineFloor(z: number): number {
  return 180 + 90 * Math.exp(-(((z - 4900) / 850) ** 2))
    + 110 * Math.exp(-(((z - 8900) / 1000) ** 2))
}

export function perfectLineHeight(x: number, z: number): number {
  const distance = Math.abs(x - perfectLineCenter(z))
  // Two breathing spaces open before the saddles. Walls remain continuous
  // outside the timed line so the ordinary streamer needs no special bounds.
  const width = 170 + 110 * Math.exp(-(((z - 6000) / 850) ** 2))
    + 100 * Math.exp(-(((z - 10800) / 700) ** 2))
  const t = Math.max(0, Math.min(1, (distance - width) / 560))
  const wall = t * t * (3 - 2 * t)
  const ridge = 480 + 120 * Math.sin(z / 1400) ** 2
  return perfectLineFloor(z) + wall * ridge
}

export function buildPerfectLine() {
  const terrain: TerrainProfile = { theme: 'mountain-valley-run', landscapeRevision: 320,
    routeRevision: 320, originX: 0, originZ: 0, yaw: 0, baseHeight: 180,
    relief: 600, valleyHalfWidth: 170, phase: 0, dry: true, perfectLine: true }
  const start = { x: 0, y: 420, z: 0, yaw: 0, biome: 'mountain' }
  const course: MissionRoutePoint[] = Array.from({ length: 15 }, (_, i) => {
    const z = (i + 1) * PERFECT_LINE_LENGTH / 15
    const dx = perfectLineCenter(z + 10) - perfectLineCenter(z - 10)
    const length = Math.hypot(dx, 20)
    return { x: perfectLineCenter(z), y: perfectLineFloor(z) + 160, z,
      fwdX: dx / length, fwdZ: 20 / length }
  })
  return { seed: PERFECT_LINE_SEED, terrain, start, course }
}
