import { getWorldSeed, hash2 } from './noise'
import { getOpsPad, sampleClimate } from './terrainSample'
import type { Biome, Climate } from './terrainSample'

export const SETTLEMENT_CELL_SIZE = 24000

export interface SettlementBuilding {
  x: number; y: number; z: number
  width: number; depth: number; height: number; yaw: number
  shape: 'block' | 'slab' | 'tower' | 'stepped' | 'hangar'
  roof: 'pitched' | 'flat'; wallColor: number; roofColor: number
}
export interface SettlementRoad { points: { x: number; y: number; z: number; bridge?: boolean; leftY?: number; rightY?: number;
  leftX?: number; leftZ?: number; rightX?: number; rightZ?: number }[]; width: number }
export interface SettlementPlan {
  id: string; x: number; y: number; z: number; radius: number
  kind: 'city' | 'village'; biome: Biome
  buildings: SettlementBuilding[]; roads: SettlementRoad[]
}

const cache = new Map<string, SettlementPlan | null>()
let cacheContext = ''
const cityBiomes = new Set<Biome>(['plains', 'forest', 'desert', 'savanna', 'saltflat', 'hills'])

function dry(c: Climate): boolean {
  return c.biome !== 'water' && c.biome !== 'ocean' && c.height > (c.waterLevel ?? 0) + 2
}

function palette(biome: Biome): { walls: number[]; roofs: number[]; roof: 'flat' | 'pitched' } {
  if (['desert', 'mesa', 'savanna', 'saltflat'].includes(biome)) {
    return {
      walls: [0xc9b592, 0xe0cbb1, 0xb79372, 0xd3b78d, 0xa98970],
      roofs: [0x997659, 0xb9a186, 0x76584b, 0xc08b63], roof: 'flat',
    }
  }
  if (['tundra', 'snow', 'mountain', 'volcanic'].includes(biome)) {
    return {
      walls: [0x929793, 0xb7b4a9, 0x726e65, 0x82949a, 0xc2b8a5],
      roofs: [0x465461, 0x624641, 0x34404a, 0x8a6559], roof: 'pitched',
    }
  }
  if (['rainforest', 'swamp'].includes(biome)) {
    return {
      walls: [0xb5a784, 0x93866e, 0xc7bea1, 0x7f9c8e, 0xd0c39a],
      roofs: [0x6d786b, 0x897654, 0x4f6258, 0x9d6f50], roof: 'pitched',
    }
  }
  return {
    walls: [0xc5c3b3, 0xb0aba2, 0xd1c4ad, 0x8e9ba2, 0xb8c7c4, 0x9d8f86],
    roofs: [0x8b5343, 0x545f64, 0x705d51, 0x3e5668, 0xa35d45], roof: 'pitched',
  }
}

/** One stable candidate per large cell; no world flattening or water filling. */
export function settlementForCell(cx: number, cz: number): SettlementPlan | null {
  const pad = getOpsPad()
  const context = `${getWorldSeed()}:${pad?.x}:${pad?.z}:${pad?.y}`
  if (context !== cacheContext) { cache.clear(); cacheContext = context }
  const id = `${cx},${cz}`
  if (cache.has(id)) return cache.get(id)!
  const roll = hash2(cx * 131 + 8129, cz * 139 - 4513)
  // Settlements are landmarks, not a blanket grid. Cities are deliberately
  // exceptional while villages still seed enough of the world to reward
  // exploration across otherwise empty provinces.
  const kind = roll < .03 ? 'city' : 'village'
  let result: SettlementPlan | null = null
  if (roll < .22) {
    const rand = (n: number) => hash2(cx * 673 + n * 97 + 2843, cz * 701 - n * 131 - 9571)
    const radius = kind === 'city' ? 8500 + rand(1) * 1500 : 1050 + rand(1) ** .72 * 3950
    const margin = radius + 300
    // Huge city footprints need a broader site search now that mountain and
    // foothill provinces have stronger relief. Rarity stays unchanged because
    // only the original 5 percent of settlement cells can attempt a city.
    const siteAttempts = kind === 'city' ? 32 : 8
    for (let attempt = 0; attempt < siteAttempts; attempt++) {
      const x = cx * SETTLEMENT_CELL_SIZE + margin + rand(10 + attempt * 2) * (SETTLEMENT_CELL_SIZE - margin * 2)
      const z = cz * SETTLEMENT_CELL_SIZE + margin + rand(11 + attempt * 2) * (SETTLEMENT_CELL_SIZE - margin * 2)
      if (pad && Math.hypot(x - pad.x, z - pad.z) < radius + 500) continue
      const c = sampleClimate(x, z)
      if (!dry(c) || (kind === 'city' && !cityBiomes.has(c.biome))) continue
      let min = c.height, max = c.height, suitable = true, drySamples = 1
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4
        const s = sampleClimate(x + Math.cos(angle) * radius * .8, z + Math.sin(angle) * radius * .8)
        if (!dry(s)) {
          if (kind === 'village') { suitable = false; break }
          continue
        }
        drySamples++
        min = Math.min(min, s.height); max = Math.max(max, s.height)
        if (max - min > (kind === 'city' ? 350 : 260)) { suitable = false; break }
      }
      if (kind === 'city' && drySamples < 4) suitable = false
      if (!suitable) continue
      const plan: SettlementPlan = { id, x, z, y: c.height, radius, kind, biome: c.biome, buildings: [], roads: [] }
      populate(plan, rand)
      if (plan.buildings.length < (kind === 'city' ? 650 : 8)) continue
      result = plan
      break
    }
  }
  // Bounded including empty cells; revisiting reconstructs exactly the same plan.
  if (cache.size >= 192) cache.delete(cache.keys().next().value!)
  cache.set(id, result)
  return result
}

function populate(plan: SettlementPlan, rand: (n: number) => number): void {
  const angle = rand(30) * Math.PI * 2, cos = Math.cos(angle), sin = Math.sin(angle)
  const style = palette(plan.biome)
  const world = (x: number, z: number) => ({ x: plan.x + cos * x + sin * z, z: plan.z - sin * x + cos * z })
  const occupied = new Map<string, { x: number; z: number; hx: number; hz: number; yaw: number; width: number; depth: number }[]>()
  const streets: { a: { x: number; z: number }; b: { x: number; z: number }; width: number }[] = []
  let serial = 100
  const building = (lx: number, lz: number, width: number, depth: number, height: number, yaw = angle) => {
    const { x, z } = world(lx, lz)
    const districtCore = Math.max(0, 1 - Math.hypot(lx, lz) / (plan.radius * .65))
    const bc = Math.cos(yaw), bs = Math.sin(yaw)
    const hx = (Math.abs(bc) * width + Math.abs(bs) * depth) / 2 + 5
    const hz = (Math.abs(bs) * width + Math.abs(bc) * depth) / 2 + 5
    if (Math.hypot(lx, lz) + Math.hypot(width, depth) / 2 > plan.radius * .97) return
    const keys: string[] = []
    for (let bx = Math.floor((x - hx) / 400); bx <= Math.floor((x + hx) / 400); bx++) {
      for (let bz = Math.floor((z - hz) / 400); bz <= Math.floor((z + hz) / 400); bz++) {
        const key = `${bx},${bz}`
        for (const other of occupied.get(key) ?? []) {
          if (Math.abs(x - other.x) >= hx + other.hx || Math.abs(z - other.z) >= hz + other.hz) continue
          const separate = [yaw, yaw + Math.PI / 2, other.yaw, other.yaw + Math.PI / 2].some(a => {
            const ux = Math.cos(a), uz = -Math.sin(a)
            const extent = (rotation: number, w: number, d: number) =>
              Math.abs(ux * Math.cos(rotation) - uz * Math.sin(rotation)) * w / 2 +
              Math.abs(ux * Math.sin(rotation) + uz * Math.cos(rotation)) * d / 2
            return Math.abs((x - other.x) * ux + (z - other.z) * uz) >=
              extent(yaw, width, depth) + extent(other.yaw, other.width, other.depth) + 10
          })
          if (!separate) return
        }
        keys.push(key)
      }
    }
    let min = Infinity, max = -Infinity
    // Corners, edge midpoints and center reject water or steep individual lots.
    for (const dx of [-width / 2, 0, width / 2]) for (const dz of [-depth / 2, 0, depth / 2]) {
      const c = sampleClimate(x + bc * dx + bs * dz, z - bs * dx + bc * dz)
      if (!dry(c)) return
      min = Math.min(min, c.height); max = Math.max(max, c.height)
    }
    const reliefLimit = plan.kind === 'city' ? Math.min(60, Math.min(width, depth) * .22)
      : Math.min(35, Math.min(width, depth) * .15)
    if (max - min > reliefLimit) return
    for (const key of keys) {
      const bucket = occupied.get(key) ?? []
      bucket.push({ x, z, hx, hz, yaw, width, depth }); occupied.set(key, bucket)
    }
    const n = serial++
    const shapeRoll = rand(n + 2000)
    // High-rise forms are a small inner-district accent. The old height-first
    // test made most city lots cylinders whenever the relief generator raised
    // the skyline, erasing the slab, hall, and block silhouettes around them.
    // Keep a few towers and stepped landmarks in the core, then let the outer
    // districts carry the broader low-rise forms.
    const shape: SettlementBuilding['shape'] = plan.kind === 'city'
      ? shapeRoll < .11 && districtCore > .42 ? 'stepped'
        : shapeRoll < .25 && districtCore > .24 ? 'tower'
          : shapeRoll < .48 ? 'slab' : shapeRoll < .61 ? 'hangar' : 'block'
      : shapeRoll < .28 ? 'hangar' : shapeRoll < .5 ? 'slab' : shapeRoll < .94 ? 'block' : 'tower'
    const finalHeight = plan.kind === 'city'
      ? shape === 'hangar'
        ? Math.min(height, 300 + rand(n + 3000) * 120)
        : shape === 'block' || shape === 'slab'
          ? Math.min(height, 260 + rand(n + 3000) * 220 + districtCore * (480 + rand(n + 3001) * 760))
          : height
      : height
    const flatRoof = shape === 'tower' || shape === 'stepped'
      || (plan.kind === 'city' && shapeRoll < .58)
    plan.buildings.push({ x, z, y: min - 1, width, depth, height: finalHeight + max - min + 1,
      shape,
      yaw, roof: flatRoof ? 'flat' : style.roof,
      wallColor: style.walls[Math.floor(rand(n) * style.walls.length)]!,
      roofColor: style.roofs[Math.floor(rand(n + 1000) * style.roofs.length)]! })
  }
  const road = (local: { x: number; z: number }[], width: number) => {
    let points: SettlementRoad['points'] = []
    const flush = () => { if (points.length > 1) plan.roads.push({ points, width }); points = [] }
    for (let segment = 1; segment < local.length; segment++) {
      const a = local[segment - 1]!, b = local[segment]!
      streets.push({ a, b, width })
      const length = Math.hypot(b.x - a.x, b.z - a.z)
      // The terrain's broad forms are smooth at this scale. Sampling arterial
      // shoulders every 72 m keeps kilometre-wide cities cheap to plan while
      // retaining enough points for curved, terrain-following road ribbons.
      const steps = Math.ceil(length / (plan.kind === 'city' ? 72 : 40))
      for (let j = segment === 1 ? 0 : 1; j <= steps; j++) {
        const p = world(a.x + (b.x - a.x) * j / steps, a.z + (b.z - a.z) * j / steps)
        const c = sampleClimate(p.x, p.z)
        // Shoulder samples keep the entire ribbon on dry land, not just its center.
        const sx = -(b.z - a.z) / length * width / 2, sz = (b.x - a.x) / length * width / 2
        const left = world(a.x + (b.x - a.x) * j / steps + sx, a.z + (b.z - a.z) * j / steps + sz)
        const right = world(a.x + (b.x - a.x) * j / steps - sx, a.z + (b.z - a.z) * j / steps - sz)
        const leftClimate = sampleClimate(left.x, left.z), rightClimate = sampleClimate(right.x, right.z)
        const previous = points.at(-1)
        if (!dry(c) || !dry(leftClimate) || !dry(rightClimate) ||
          (previous && Math.abs(c.height + .25 - previous.y) > Math.hypot(p.x - previous.x, p.z - previous.z) * .22)) {
          flush(); continue
        }
        points.push({ ...p, y: c.height + .25, leftY: leftClimate.height + .35, rightY: rightClimate.height + .35,
          leftX: left.x, leftZ: left.z, rightX: right.x, rightZ: right.z })
      }
    }
    flush()
  }
  const city = plan.kind === 'city'
  // Village morphology is chosen independently from footprint size. This
  // keeps settlements from reading as repeated radial templates or a grid.
  const villageProfile = city ? 'basin' : (rand(43) < .24 ? 'hamlet'
    : rand(44) < .5 ? 'ribbon' : rand(45) < .78 ? 'crossroads' : 'basin')
  const phase = rand(40) * Math.PI * 2
  const aspect = city ? .78 + rand(41) * .2
    : villageProfile === 'hamlet' ? .55 + rand(41) * .25
      : villageProfile === 'ribbon' ? .28 + rand(41) * .28
        : villageProfile === 'crossroads' ? .64 + rand(41) * .3
          : .82 + rand(41) * .4
  // Unequal lobes, asymmetric stretches and branched streets replace grids.
  const boundary = (a: number) => .77 + .11 * Math.sin(a * 3 + phase) + .065 * Math.sin(a * 5 - phase)
  const polar = (a: number, distance: number) => ({ x: Math.cos(a) * distance, z: Math.sin(a) * distance * aspect })
  const arms = city ? 4 + Math.floor(rand(42) * 3)
    : villageProfile === 'hamlet' ? 2
      : villageProfile === 'ribbon' ? 2 + Math.floor(rand(42) * 2)
        : villageProfile === 'crossroads' ? 3 + Math.floor(rand(42) * 2)
          : 4 + Math.floor(rand(42) * 2)
  for (let arm = 0; arm < arms; arm++) {
    const direction = arm / arms * Math.PI * 2 + (rand(50 + arm) - .5) * .65
    const reach = plan.radius * boundary(direction)
    const spine: { x: number; z: number }[] = [{ x: 0, z: 0 }]
    for (let step = 1; step <= 6; step++) {
      const t = step / 6
      spine.push(polar(direction + Math.sin(t * 4 + phase + arm) * .19, reach * t))
    }
    road(spine, city ? 42 + rand(70 + arm) * 25 : 25 + rand(70 + arm) * 20)
    // Dead-end neighborhoods branch irregularly off the main approaches.
    for (let step = 2; step < 6; step += 2) {
      const base = spine[step]!
      const side = rand(90 + arm * 8 + step) < .5 ? -1 : 1
      const heading = direction + side * (1 + rand(140 + arm * 8 + step) * .5)
      const length = reach * (city ? .22 : .18)
      const end = { x: base.x + Math.cos(heading) * length, z: base.z + Math.sin(heading) * length }
      road([base, { x: (base.x + end.x) / 2 + Math.sin(heading) * length * .12,
        z: (base.z + end.z) / 2 - Math.cos(heading) * length * .12 }, end], city ? 30 : 22)
    }
  }
  if (!city && villageProfile !== 'hamlet') {
    // A bent neighborhood loop gives larger villages a memorable spine while
    // preserving gaps and cul-de-sacs between the buildings.
    const loopPoints: { x: number; z: number }[] = []
    const loopRadius = plan.radius * (villageProfile === 'ribbon' ? .34 : .48)
    const loopCount = villageProfile === 'ribbon' ? 5 : 7
    for (let i = 0; i <= loopCount; i++) {
      const a = phase + i / loopCount * Math.PI * 1.65
      loopPoints.push(polar(a, loopRadius * (1 + .15 * Math.sin(a * 2 + phase))))
    }
    road(loopPoints, 18 + rand(180) * 12)
  }
  if (city) {
    // Broken, warped district connectors have neither circular nor square outlines.
    for (let ring = 0; ring < 1; ring++) {
      const points: { x: number; z: number }[] = []
      for (let i = 0; i <= 18; i++) {
        const a = phase + i / 18 * Math.PI * (1.35 + rand(180 + ring) * .5)
        points.push(polar(a, plan.radius * .52 * (1 + .16 * Math.sin(a * 3 + ring))))
      }
      road(points, 32)
    }
  }
  const target = city ? 660 + Math.floor(rand(200) * 620)
    : villageProfile === 'hamlet' ? 8 + Math.floor(rand(201) * 8)
      : villageProfile === 'ribbon' ? 12 + Math.floor(rand(201) * 20)
        : villageProfile === 'crossroads' ? 18 + Math.floor(rand(201) * 28)
          : 28 + Math.floor(rand(201) * 38)
  for (let attempt = 0; attempt < target * (city ? 80 : 32) && plan.buildings.length < target; attempt++) {
    const n = 10000 + attempt * 9
    const a = rand(n) * Math.PI * 2
    const distance = Math.sqrt(rand(n + 1)) * plan.radius * boundary(a)
    const p = polar(a, distance)
    // Buildings are intentionally oversized relative to the aircraft, but
    // each village profile gets its own scale band. A few landmark lots are
    // much larger again, preventing a uniform settlement silhouette.
    const villageScale = villageProfile === 'hamlet' ? .78
      : villageProfile === 'ribbon' ? .92 : villageProfile === 'crossroads' ? 1.12 : 1.3
    const landmarkScale = !city && rand(n + 8) < .08 ? 1.8 : 1
    const width = city ? 160 + rand(n + 2) * 180
      : Math.max(180, (220 + rand(n + 2) * 240) * villageScale * landmarkScale)
    const depth = city ? 160 + rand(n + 3) * 180
      : Math.max(180, (220 + rand(n + 3) * 240) * villageScale * landmarkScale)
    let nearest = Infinity, yaw = angle + a, clear = true
    for (const street of streets) {
      const dx = street.b.x - street.a.x, dz = street.b.z - street.a.z
      const t = Math.max(0, Math.min(1, ((p.x - street.a.x) * dx + (p.z - street.a.z) * dz) / (dx * dx + dz * dz)))
      const d = Math.hypot(p.x - street.a.x - dx * t, p.z - street.a.z - dz * t)
      if (d < Math.hypot(width, depth) / 2 + street.width / 2 + 8) { clear = false; break }
      if (d < nearest) { nearest = d; yaw = angle + Math.atan2(dx, dz) }
    }
    if (!clear || (!city && nearest > 420)) continue
    const core = Math.max(0, 1 - distance / (plan.radius * .65))
    const height = city ? 180 + rand(n + 4) * 260 + core ** 2 * (760 + rand(n + 5) * 1250) : 150 + rand(n + 4) * 240
    building(p.x, p.z, width, depth, height, yaw + (rand(n + 6) - .5) * .35)
  }
}
