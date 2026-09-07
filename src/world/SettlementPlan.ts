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
export interface SettlementRoad { points: { x: number; y: number; z: number; leftY?: number; rightY?: number;
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
    return { walls: [0xc9b592, 0xe0cbb1, 0xb79372], roofs: [0x997659, 0xb9a186], roof: 'flat' }
  }
  if (['tundra', 'snow', 'mountain', 'volcanic'].includes(biome)) {
    return { walls: [0x929793, 0xb7b4a9, 0x726e65], roofs: [0x465461, 0x624641], roof: 'pitched' }
  }
  if (['rainforest', 'swamp'].includes(biome)) {
    return { walls: [0xb5a784, 0x93866e, 0xc7bea1], roofs: [0x6d786b, 0x897654], roof: 'pitched' }
  }
  return { walls: [0xc5c3b3, 0xb0aba2, 0xd1c4ad], roofs: [0x8b5343, 0x545f64, 0x705d51], roof: 'pitched' }
}

/** One stable candidate per large cell; no world flattening or water filling. */
export function settlementForCell(cx: number, cz: number): SettlementPlan | null {
  const pad = getOpsPad()
  const context = `${getWorldSeed()}:${pad?.x}:${pad?.z}:${pad?.y}`
  if (context !== cacheContext) { cache.clear(); cacheContext = context }
  const id = `${cx},${cz}`
  if (cache.has(id)) return cache.get(id)!
  const roll = hash2(cx * 131 + 8129, cz * 139 - 4513)
  const kind = roll < .05 ? 'city' : 'village'
  let result: SettlementPlan | null = null
  if (roll < .18) {
    const rand = (n: number) => hash2(cx * 673 + n * 97 + 2843, cz * 701 - n * 131 - 9571)
    const radius = kind === 'city' ? 8500 + rand(1) * 2000 : 900 + rand(1) ** 1.4 * 1900
    const margin = radius + 300
    for (let attempt = 0; attempt < 6; attempt++) {
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
        if (max - min > (kind === 'city' ? 350 : 130)) { suitable = false; break }
      }
      if (kind === 'city' && drySamples < 5) suitable = false
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
    const shape: SettlementBuilding['shape'] = plan.kind === 'city'
      ? height > 620 && shapeRoll < .55 ? 'stepped'
        : height > 380 && shapeRoll < .78 ? 'tower'
          : shapeRoll < .28 ? 'slab' : 'block'
      : shapeRoll < .28 ? 'hangar' : shapeRoll < .5 ? 'slab' : shapeRoll < .94 ? 'block' : 'tower'
    plan.buildings.push({ x, z, y: min - 1, width, depth, height: height + max - min + 1,
      shape,
      yaw, roof: shape === 'tower' || shape === 'stepped' || (plan.kind === 'city' && height > 25) ? 'flat' : style.roof,
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
  const phase = rand(40) * Math.PI * 2
  const aspect = (plan.kind === 'city' ? .78 : .62) + rand(41) * (plan.kind === 'city' ? .2 : .35)
  // Unequal lobes, asymmetric stretches and branched streets replace grids.
  const boundary = (a: number) => .77 + .11 * Math.sin(a * 3 + phase) + .065 * Math.sin(a * 5 - phase)
  const polar = (a: number, distance: number) => ({ x: Math.cos(a) * distance, z: Math.sin(a) * distance * aspect })
  const arms = city ? 4 + Math.floor(rand(42) * 3) : 2 + Math.floor(rand(42) * 3)
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
  const target = city ? 700 + Math.floor(rand(200) * 900) : 8 + Math.floor(((plan.radius - 900) / 1900) * 62)
  for (let attempt = 0; attempt < target * (city ? 60 : 32) && plan.buildings.length < target; attempt++) {
    const n = 10000 + attempt * 9
    const a = rand(n) * Math.PI * 2
    const distance = Math.sqrt(rand(n + 1)) * plan.radius * boundary(a)
    const p = polar(a, distance)
    const width = city ? 220 + rand(n + 2) * 200 : 180 + rand(n + 2) * 145
    const depth = city ? 220 + rand(n + 3) * 200 : 180 + rand(n + 3) * 145
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
    const height = city ? 120 + rand(n + 4) * 220 + core ** 2 * (700 + rand(n + 5) * 1100) : 95 + rand(n + 4) * 105
    building(p.x, p.z, width, depth, height, yaw + (rand(n + 6) - .5) * .35)
  }
}
