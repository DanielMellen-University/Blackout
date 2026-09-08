import { fbm, getWorldSeed, hash2, smoothstep, valueNoise } from './noise'
import { sampleLandforms } from './Landforms'

export const CATCHMENT_SIZE = 32000
const BIN = 2000
const BINS = CATCHMENT_SIZE / BIN
interface Basin { x: number; z: number; radius: number; aspect: number; angle: number; phase: number; level: number; sea: boolean }
interface Reach { ax: number; az: number; bx: number; bz: number; wa: number; wb: number; ya: number; yb: number }
interface Catchment { basins: Basin[]; bins: Reach[][] }
let seed = Number.NaN
const cache = new Map<string, Catchment>()

/** Signed shore distance, warped in space and broken into coves and peninsulas. */
export function basinDistance(b: Basin, x: number, z: number): number {
  const scale = b.sea ? 2100 : 700
  const warp = b.sea ? 950 : 320
  const dx = x - b.x + (fbm(x / scale + 19, z / scale, 2) - .5) * warp
  const dz = z - b.z + (fbm(x / scale - 47, z / scale + 13, 2) - .5) * warp
  const u = (dx * Math.cos(b.angle) + dz * Math.sin(b.angle)) / b.radius
  const v = (-dx * Math.sin(b.angle) + dz * Math.cos(b.angle)) / (b.radius * b.aspect)
  const theta = Math.atan2(v, u)
  // Multiple low-frequency lobes make coves and peninsulas. A broad value
  // field breaks the last hint of a repeated ellipse without noisy shorelines.
  const shoreNoise = valueNoise(dx / (b.radius * .72) + b.phase * 1.7, dz / (b.radius * .72) - b.phase)
  const outline = 1 + .16 * Math.sin(theta * 2 + b.phase) +
    .12 * Math.sin(theta * 3 - b.phase * 1.7) +
    .09 * Math.cos(theta * 5 + b.phase) + (shoreNoise - .5) * .34
  return (Math.hypot(u, v) - outline) * b.radius * b.aspect
}

function catchment(cx: number, cz: number): Catchment {
  if (seed !== getWorldSeed()) { cache.clear(); seed = getWorldSeed() }
  const key = `${cx},${cz}`
  const previous = cache.get(key)
  if (previous) return previous
  const ox = cx * CATCHMENT_SIZE, oz = cz * CATCHMENT_SIZE
  const phase = hash2(cx + 79, cz - 41) * Math.PI * 2
  const sea: Basin = {
    x: ox + 16000 + (hash2(cx, cz + 41) - .5) * 1800,
    z: oz + 16000 + (hash2(cx + 41, cz) - .5) * 1800,
    radius: 3500 + hash2(cx - 23, cz + 61) * 1800,
    aspect: .62 + hash2(cx + 31, cz - 41) * .3, angle: phase, phase, level: 0, sea: true,
  }
  // Seas are landmarks, not the default catchment background.
  const hasSea = hash2(cx - 91, cz + 101) > .58
  const basins: Basin[] = hasSea ? [sea] : []
  const bins: Reach[][] = Array.from({ length: BINS * BINS }, () => [])
  function addReach(r: Reach): void {
    const margin = 1600 + Math.max(r.wa, r.wb)
    const minX = Math.max(0, Math.floor((Math.min(r.ax, r.bx) - margin - ox) / BIN))
    const maxX = Math.min(BINS - 1, Math.floor((Math.max(r.ax, r.bx) + margin - ox) / BIN))
    const minZ = Math.max(0, Math.floor((Math.min(r.az, r.bz) - margin - oz) / BIN))
    const maxZ = Math.min(BINS - 1, Math.floor((Math.max(r.az, r.bz) + margin - oz) / BIN))
    for (let ix = minX; ix <= maxX; ix++) for (let iz = minZ; iz <= maxZ; iz++) bins[iz * BINS + ix]!.push(r)
  }
  const lakeCount = 1 + Math.floor(hash2(cx - 17, cz + 73) * 3)
  for (let i = 0; i < lakeCount; i++) {
    const angle = phase + hash2(cx + i * 17, cz + 53) * Math.PI * 2
    const distance = 7200 + hash2(cx + i * 29, cz + 53) * 6200
    const x = sea.x + Math.cos(angle) * distance, z = sea.z + Math.sin(angle) * distance
    const land = sampleLandforms(x, z)
    if (land.highlands > .22) continue
    const lake: Basin = {
      x, z, radius: 700 + hash2(cx + i * 21, cz - 82) * 1050,
      aspect: .46 + hash2(cx - 82, cz + i * 21) * .46,
      angle: angle + .6 + (hash2(cx + i * 13, cz - 17) - .5) * .8,
      phase: phase + i * 1.71 + hash2(cx - i * 31, cz + 17) * 1.6,
      level: Math.max(55, land.height - 25), sea: false,
    }
    // Set the lake below its surrounding rim, so a hillside basin cannot spill
    // into an unrelated low area when the shoreline field stops influencing it.
    let rim = land.height
    for (let j = 0; j < 12; j++) {
      const a = j * Math.PI / 6
      rim = Math.min(rim, sampleLandforms(x + Math.cos(a) * lake.radius * 1.6,
        z + Math.sin(a) * lake.radius * 1.6).height)
    }
    lake.level = Math.max(45, rim - 18)
    basins.push(lake)
    if (!hasSea) continue
    const dx = sea.x - x, dz = sea.z - z, length = Math.hypot(dx, dz)
    const point = (t: number) => {
      const bend = Math.sin(Math.PI * t) * (Math.sin(t * 10 + lake.phase) * 900 + Math.sin(t * 23 + phase) * 320)
      return {
        x: x + dx * t - dz / length * bend, z: z + dz * t + dx / length * bend,
        width: (22 + valueNoise(t * 7 + i * 19, cx + cz * 7) * 25
          + smoothstep(.3, .72, valueNoise(t * 12 + i * 11, cz - cx * 3)) * 115) * (.65 + t * .9),
      }
    }
    const points = Array.from({ length: 73 }, (_, j) => point(j / 72))
    const exit = points.findIndex(p => basinDistance(lake, p.x, p.z) > 0) / 72
    const entry = points.findIndex(p => basinDistance(sea, p.x, p.z) < 0) / 72
    const start = Math.max(0, Math.min(exit + .035, entry - .1))
    const end = Math.max(start + .05, entry - .02)
    const elevation = (t: number) => lake.level * (1 - smoothstep(start, end, t))
    let a = points[0]!
    for (let j = 1; j <= 72; j++) {
      const b = points[j]!
      addReach({ ax: a.x, az: a.z, bx: b.x, bz: b.z, wa: a.width, wb: b.width, ya: elevation((j - 1) / 72), yb: elevation(j / 72) })
      a = b
    }

    // Side channels join the trunk from higher ground. They use the same
    // water-level resolver as the main river, so the branch remains a real
    // water surface and not a decorative blue line.
    if (i === 0 && hash2(cx + i * 89, cz - i * 47) > .18) {
      const joinT = .22 + hash2(cx - i * 31, cz + i * 67) * .48
      const join = point(joinT)
      const flowX = dx / length, flowZ = dz / length
      const side = hash2(cx + i * 53, cz + 11) < .5 ? -1 : 1
      const sideX = -flowZ * side
      const sideZ = flowX * side
      const sourceDistance = 1800 + hash2(cx + i * 73, cz - 19) * 2600
      const sourceX = join.x + sideX * sourceDistance
      const sourceZ = join.z + sideZ * sourceDistance
      if (basins.some(b => basinDistance(b, sourceX, sourceZ) < 0)) continue
      const sourceLevel = elevation(joinT) + 90 + hash2(cx - 13, cz + i * 23) * 150
      const branchSteps = 14
      const branch: { x: number; z: number; width: number; level: number }[] = [
        { x: sourceX, z: sourceZ, width: 8, level: sourceLevel },
      ]
      for (let j = 1; j <= branchSteps; j++) {
        const t = j / branchSteps
        const bend = Math.sin(Math.PI * t) * side *
          (160 + hash2(cx + j * 7, cz - i * 5) * 280)
        const q = {
          x: sourceX + (join.x - sourceX) * t + flowX * bend,
          z: sourceZ + (join.z - sourceZ) * t + flowZ * bend,
        }
        const width = 11 + valueNoise(t * 5 + i * 7, cx - cz * 3) * 21 + t * 14
        const level = sourceLevel + (elevation(joinT) - sourceLevel) * smoothstep(0, 1, t)
        branch.push({ x: q.x, z: q.z, width, level })
      }
      if (branch.some(p => basins.some(b => basinDistance(b, p.x, p.z) < 0))) continue
      for (let j = 1; j < branch.length; j++) {
        const a = branch[j - 1]!, b = branch[j]!
        addReach({
          ax: a.x, az: a.z, bx: b.x, bz: b.z,
          wa: Math.max(8, a.width * .72), wb: b.width,
          ya: a.level, yb: b.level,
        })
      }
    }
  }
  const result = { basins, bins }
  if (cache.size >= 128) cache.delete(cache.keys().next().value!)
  cache.set(key, result)
  return result
}

/** Lakes/seas have fixed levels. River reaches grade continuously downstream. */
export function sampleHydrology(x: number, z: number, ground: number) {
  const cx = Math.floor(x / CATCHMENT_SIZE), cz = Math.floor(z / CATCHMENT_SIZE)
  const region = catchment(cx, cz)
  const localX = x - cx * CATCHMENT_SIZE, localZ = z - cz * CATCHMENT_SIZE
  const edgeFade = smoothstep(0, 1600, Math.min(localX, localZ, CATCHMENT_SIZE - localX, CATCHMENT_SIZE - localZ))
  let height = ground, waterLevel = 0, river = 0, lake = 0, coastal = 0
  // Tiny negative coordinates can round their local remainder up to 32000.
  const binX = Math.max(0, Math.min(BINS - 1, Math.floor(localX / BIN)))
  const binZ = Math.max(0, Math.min(BINS - 1, Math.floor(localZ / BIN)))
  const reaches = region.bins[binZ * BINS + binX]!
  let nearest = Infinity, level = 0, width = 1
  for (const r of reaches) {
    const dx = r.bx - r.ax, dz = r.bz - r.az
    const t = Math.max(0, Math.min(1, ((x - r.ax) * dx + (z - r.az) * dz) / (dx * dx + dz * dz)))
    const w = r.wa + (r.wb - r.wa) * t
    const d = Math.hypot(x - r.ax - dx * t, z - r.az - dz * t) - w
    if (d < nearest) { nearest = d; level = r.ya + (r.yb - r.ya) * t; width = w }
  }
  // On an inside bend, the closest reach can switch between different river
  // elevations. Blend the dry valley shoulders to avoid a step at that switch.
  if (nearest > 0 && nearest < 1600) {
    let sum = 0, total = 0
    for (const r of reaches) {
      const dx = r.bx - r.ax, dz = r.bz - r.az
      const t = Math.max(0, Math.min(1, ((x - r.ax) * dx + (z - r.az) * dz) / (dx * dx + dz * dz)))
      const d = Math.hypot(x - r.ax - dx * t, z - r.az - dz * t) - r.wa - (r.wb - r.wa) * t
      const weight = Math.exp(-Math.max(0, d - nearest) / 160)
      sum += (r.ya + (r.yb - r.ya) * t) * weight
      total += weight
    }
    level += (sum / total - level) * smoothstep(0, 240, nearest)
  }
  if (nearest < 1600) {
    const d = nearest
    const blend = (1 - smoothstep(0, 1600, Math.max(0, d))) * edgeFade
    const bank = d < 0 ? -(5 + width * .04) * smoothstep(0, width, -d) : d * .075 + d * d * .00007
    height += (level + bank - height) * blend
    if (blend > 0) waterLevel = level
    river = 1 - smoothstep(0, 180, Math.max(0, d))
  }
  for (const basin of region.basins) {
    const limit = basin.radius * 1.65 + 2000
    if (Math.abs(x - basin.x) > limit || Math.abs(z - basin.z) > limit) continue
    const d = basinDistance(basin, x, z)
    const margin = basin.sea ? 2100 : 1400
    if (d >= margin) continue
    const blend = (1 - smoothstep(0, margin, Math.max(0, d))) * edgeFade
    const bed = d < 0
      ? -(basin.sea ? 150 : 32) * smoothstep(0, basin.sea ? 2300 : 500, -d) + d * .012
      : d * .065 + d * d * .000035
    const basinHeight = height + (basin.level + bed - height) * blend
    // Preserve an existing outlet through the bank instead of damming it shut.
    height = d > 0 ? basinHeight + (Math.min(height, basinHeight) - basinHeight) * river : basinHeight
    if (d <= 0 || nearest >= 1600) waterLevel = basin.level
    if (basin.sea) coastal = 1 - smoothstep(0, 180, Math.abs(d))
    else lake = 1 - smoothstep(0, 160, Math.max(0, d))
  }
  return { height, waterLevel, river, lake, coastal }
}

/** Read-only landmarks for repeatable visual review and hydrology tests. */
export function waterLandmarks(cx: number, cz: number): ReadonlyArray<Readonly<Basin>> {
  return catchment(cx, cz).basins
}

export function riverReaches(cx: number, cz: number): ReadonlyArray<Readonly<Reach>> {
  return [...new Set(catchment(cx, cz).bins.flat())]
}
