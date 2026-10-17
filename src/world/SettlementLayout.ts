import type { SettlementPlan, SettlementBuilding } from './SettlementPlan'
import type { RoadGroundSampler } from './RoadSurface'

export type BuildingUse = 'house' | 'apartment' | 'office' | 'shop' | 'warehouse' | 'workshop' | 'civic' | 'barn' | 'gas-station' | 'farmhouse' | 'rowhouse' | 'inn' | 'depot'
export type District = 'centre' | 'residential' | 'commercial' | 'industrial' | 'rural'
export type GroundUse = 'park' | 'plaza' | 'field' | 'forecourt' | 'path'
type Point = { x: number; z: number }
export interface LocalLot extends Point {
  width: number; depth: number; height: number; yaw: number
  use: BuildingUse; district: District; shape: SettlementBuilding['shape']
  farm?: number
}
export interface LocalSpace extends Point {
  width: number; depth: number; yaw: number; use: GroundUse; color: number
  farm?: number
  service?: boolean
}
export interface SettlementLayout {
  roads: { points: Point[]; width: number; gateway?: boolean }[]
  lots: LocalLot[]
  spaces: LocalSpace[]
  target: number
}

/** Metre-scale, road-led neighbourhoods. All proposals still pass the shared
 * water, slope, foundation and overlap validator before entering the world. */
export function settlementLayout(plan: SettlementPlan, rand: (n: number) => number, sample?: RoadGroundSampler): SettlementLayout {
  const city = plan.kind === 'city'
  const phase = rand(40) * Math.PI * 2
  const layout: SettlementLayout = { roads: [], lots: [], spaces: [],
    target: city ? 660 + Math.floor(rand(200) * 620) : 22 + Math.floor(rand(201) ** 1.3 * 43) }
  const point = (x: number, z: number, yaw: number, ox = 0, oz = 0): Point =>
    ({ x: ox + Math.cos(yaw) * x + Math.sin(yaw) * z,
      z: oz - Math.sin(yaw) * x + Math.cos(yaw) * z })
  const addRoad = (points: Point[], width: number, gateway?: boolean) => layout.roads.push({ points, width, gateway })
  const green: LocalSpace = { ...point(0, city ? 0 : 55, phase), width: city ? 110 : 44,
    depth: city ? 110 : 32, yaw: phase, use: 'plaza', color: 0x9b9688 }
  layout.spaces.push(green)
  if (!city) layout.spaces.push({ ...point(0, 20, phase), width: 3, depth: 40,
    yaw: phase, use: 'path', color: 0xb2a083 })

  function lot(x: number, z: number, yaw: number, use: BuildingUse, district: District, n: number) {
    const r = rand(n), s = rand(n + 1)
    const h = rand(n + 2)
    let width: number, depth: number, height: number
    switch (use) {
      case 'farmhouse': width = 16 + r * 9; depth = 18 + s * 10; height = 9 + h * 5; break
      case 'rowhouse': width = 29 + r * 13; depth = 13 + s * 5; height = 9 + h * 5; break
      case 'inn': width = 25 + r * 12; depth = 22 + s * 10; height = 15 + h * 9; break
      case 'depot': width = 34 + r * 20; depth = 20 + s * 12; height = 10 + h * 7; break
      case 'house': width = 13 + r * 12; depth = 14 + s * 14; height = 8 + h * 7; break
      case 'apartment': width = 25 + r * 26; depth = 23 + s * 24; height = 22 + h * 44; break
      case 'office': width = 32 + r * 42; depth = 28 + s * 42; height = 75 + h ** 1.5 * 220; break
      case 'shop': width = 19 + r * 20; depth = 17 + s * 22; height = 8 + h * 12; break
      case 'warehouse': width = 42 + r * 38; depth = 36 + s * 42; height = 12 + h * 14; break
      case 'workshop': width = 21 + r * 22; depth = 20 + s * 23; height = 9 + h * 10; break
      case 'civic': width = 24 + r * 20; depth = 24 + s * 24; height = city ? 30 + h * 50 : 16 + h * 10; break
      case 'barn': width = 26 + r * 24; depth = 30 + s * 28; height = 12 + h * 12; break
      case 'gas-station': width = 26 + r * 8; depth = 18 + s * 8; height = 8; break
    }
    const shape: SettlementBuilding['shape'] = use === 'office' ? r < .22 ? 'tower' : r < .43 ? 'stepped' : 'slab'
      : use === 'warehouse' || use === 'barn' || use === 'workshop' || use === 'depot' ? 'hangar'
        : use === 'civic' || use === 'inn' ? 'stepped' : use === 'apartment' ? 'slab' : 'block'
    layout.lots.push({ x, z, yaw, use, district, width, depth, height, shape })
  }

  // Country services and farmsteads get first refusal on their reserved lots.
  // No simulated traffic, vegetation, interiors or new dynamic lights.
  if (!city) {
    const farmCount = 1 + Math.floor(rand(250) * 3)
    const core = Math.max(200, Math.min(520, plan.radius * .15))
    const agricultural = !['snow', 'mountain', 'volcanic', 'swamp', 'saltflat'].includes(plan.biome)
    // Four sites per farm, nine terrain probes per parcel. Whole fields must
    // fit gentle dry land before they reserve lots or spend tessellation work.
    const gentle = (space: LocalSpace, slope: number): boolean => {
      if (!sample) return true
      let low = Infinity, high = -Infinity
      for (const x of [-.5, 0, .5]) for (const z of [-.5, 0, .5]) {
        const p = point(x * space.width, z * space.depth, space.yaw, space.x, space.z)
        const ground = sample(p.x, p.z)
        if (!Number.isFinite(ground.height) || ground.height <= (ground.waterLevel ?? 0) + 2) return false
        low = Math.min(low, ground.height); high = Math.max(high, ground.height)
      }
      return high - low <= Math.min(space.width, space.depth) * slope
    }
    for (let i = 0; i < farmCount; i++) {
      const laneHeading = phase + i / farmCount * Math.PI * 2 + .45
      const laneEnd = point(core * (1.8 + rand(251 + i) * .8), 0, laneHeading)
      // Retain the rural road skeleton even where cultivation is unsuitable.
      // These lanes also provide terrain-tested outward regional attachments.
      addRoad([{ x: 0, z: 0 }, point(laneEnd.x * .55, laneEnd.z * .55, 0), laneEnd], 6)
      if (!agricultural) continue
      for (let attempt = 0; attempt < 4; attempt++) {
        const a = phase + i / farmCount * Math.PI * 2 + .45 + attempt * .38
        const farm = point(core * (1.8 + rand(251 + i) * .8), 0, a)
        const fields: LocalSpace[] = [0, 1].map(j => ({
          ...point(j ? 150 : -150, 145, a, farm.x, farm.z),
          width: 135 + rand(360 + i * 4 + j) * 40, depth: 100 + rand(380 + i * 4 + j) * 40,
          yaw: a, use: 'field', color: j ? 0x98875a : 0x75704a, farm: i,
        }))
        const yard: LocalSpace = { ...farm, width: 85, depth: 170, yaw: a, use: 'path', color: 0xa59273 }
        if (!gentle(yard, .06) || fields.some(field => !gentle(field, .1))) continue
        if (attempt > 0) addRoad([{ x: 0, z: 0 }, point(farm.x * .55, farm.z * .55, 0), farm], 6)
        for (const [offset, use, salt] of [[55, 'barn', 300], [-45, 'farmhouse', 310]] as const) {
          const site = point(0, offset, a, farm.x, farm.z)
          lot(site.x, site.z, a, use, 'rural', salt + i * 20)
          layout.lots.at(-1)!.farm = i
        }
        layout.spaces.push(...fields)
        break
      }
    }
    if (rand(400) < .72 || plan.anchor) {
      const heading = phase + Math.PI
      const service = point(core * 1.3, 0, heading)
      // This arterial is a preferred regional gateway. The station stands
      // beside its dry approach, not on a disconnected decorative spur.
      addRoad([{ x: 0, z: 0 }, service, point(core * 1.5, 0, heading)], 10, true)
      const store = point(0, 60, heading, service.x, service.z)
      lot(store.x, store.z, heading, 'gas-station', 'rural', 410)
      const forecourt = point(0, 24, heading, service.x, service.z)
      layout.spaces.push({ ...forecourt, width: 52, depth: 36, yaw: heading, use: 'forecourt', color: 0x85867f, service: true })
    }
    // A small street-facing common complements the paved centre square.
    const common = point(core * .55, 65, phase)
    layout.spaces.push({ ...common, width: 56, depth: 38, yaw: phase, use: 'park', color: 0x65754e })
  }

  const districtCount = city ? 13 + Math.floor(rand(42) * 4) : 1
  const centres: Point[] = []
  if (city) {
    const centreLoop: Point[] = []
    for (let i = 0; i <= 16; i++) centreLoop.push(point(110, 0, phase + i / 16 * Math.PI * 2))
    addRoad(centreLoop, 13)
  }
  const paths: { a: Point; b: Point; width: number; district: District; core: boolean }[] = []
  for (let d = 0; d < districtCount; d++) {
    const a = phase + d * 2.399963 + (rand(500 + d) - .5) * .3
    const distance = d === 0 ? 0 : plan.radius * (d < 4 ? .08 + (d - 1) * .045
      : d < 10 ? .2 + (d - 4) * .045 : .58 + .27 * (d - 10) / Math.max(1, districtCount - 11))
    const centre = city ? point(distance, 0, a) : { x: 0, z: 0 }
    centres.push(centre)
    const heading = city ? a + rand(540 + d) * .5 : phase
    const district: District = !city ? 'residential' : d < 3 ? 'centre'
      : d % 5 === 1 ? 'industrial' : d % 4 === 2 ? 'commercial' : 'residential'
    const reach = city ? (d < 4 ? 650 : 430) + rand(560 + d) * 260 : Math.max(200, Math.min(520, plan.radius * .15))
    if (d > 0) {
      const parent = centres[Math.floor((d - 1) / 3)]!
      const direction = Math.atan2(-(centre.z - parent.z), centre.x - parent.x)
      const start = parent === centres[0] ? point(110, 0, direction) : parent
      addRoad([start, { x: (start.x + centre.x) / 2 + Math.sin(a) * 80,
        z: (start.z + centre.z) / 2 }, centre], d < 4 ? 15 : 12)
      // A few neighbour ties form loops instead of a star with every district
      // running an independent highway to one impossible central junction.
      const previous = centres[d - 1]!
      if (d > 3 && d % 3 === 0 && Math.hypot(centre.x - previous.x, centre.z - previous.z) < plan.radius * .55) {
        addRoad([previous, { x: (previous.x + centre.x) / 2, z: (previous.z + centre.z) / 2 + 70 }, centre], 10)
      }
    }
    // Short, bent streets around each centre, rather than scattering individual
    // houses over a multi-kilometre disk. Unequal branches avoid repeated grids.
    const branches = city ? d < 4 ? 5 : 4 : 3 + Math.floor(rand(600) * 3)
    for (let branch = 0; branch < branches; branch++) {
      const direction = heading + branch / branches * Math.PI * 2 + (rand(620 + d * 13 + branch) - .5) * .35
      const start = city && d === 0 ? point(110, 0, direction) : centre
      const end = point(reach * (.75 + rand(850 + d * 13 + branch) * .4), 0, direction, centre.x, centre.z)
      const mid = { x: (start.x + end.x) / 2 + Math.sin(direction) * reach * .08,
        z: (start.z + end.z) / 2 + Math.cos(direction) * reach * .08 }
      const width = city ? district === 'industrial' ? 11 : 9 : 6.5
      addRoad([start, mid, end], width)
      paths.push({ a: start, b: mid, width, district: city ? district : 'centre', core: d < 3 },
        { a: mid, b: end, width, district: city ? district : branch === branches - 1 ? 'industrial' : 'residential', core: d < 3 })
      if (city && branch % 3 === 0) {
        const spur = point(0, reach * .5, direction, mid.x, mid.z)
        addRoad([mid, spur], 8)
        paths.push({ a: mid, b: spur, width: 8, district, core: d < 3 })
      }
    }
    if (city && d > 0 && d % 3 === 0) {
      const park = point(0, -120, heading, centre.x, centre.z)
      layout.spaces.push({ ...park, width: 100 + rand(1000 + d) * 90, depth: 90 + rand(1050 + d) * 75,
        yaw: heading, use: 'park', color: 0x62764e })
    }
  }

  // Interleave frontage attempts across districts. Invalid steep/wet lots do
  // not starve later neighbourhoods, and a target count cannot fill only one arm.
  const passes = city ? 90 : 100
  for (let pass = 0; pass < passes; pass++) for (let s = 0; s < paths.length; s++) {
    const street = paths[s]!, n = 2000 + pass * paths.length * 11 + s * 11
    const dx = street.b.x - street.a.x, dz = street.b.z - street.a.z, length = Math.hypot(dx, dz)
    const yaw = -Math.atan2(dz, dx)
    const t = rand(n)
    let use: BuildingUse = !city ? street.district === 'centre'
      ? rand(n + 1) < .38 ? 'shop' : rand(n + 2) < .25 ? 'inn' : 'house'
      : street.district === 'industrial' ? rand(n + 1) < .45 ? 'depot' : 'workshop'
        : rand(n + 1) < .28 ? 'rowhouse' : 'house'
      : street.district === 'centre' ? rand(n + 1) < .68 ? 'office' : 'apartment'
        : street.district === 'industrial' ? rand(n + 1) < .5 ? 'warehouse' : rand(n + 2) < .4 ? 'depot' : 'workshop'
          : street.district === 'commercial' ? rand(n + 1) < .75 ? 'shop' : 'apartment'
            : rand(n + 1) < .23 ? 'apartment' : rand(n + 2) < .3 ? 'rowhouse' : 'house'
    if (pass === 0 && s === 0 || rand(n + 8) < .018) use = 'civic'
    const count = layout.lots.length
    lot(street.a.x + dx * t, street.a.z + dz * t, yaw, use, street.district, n + 3)
    const proposal = layout.lots[count]!
    const side = rand(n + 9) < .5 ? -1 : 1
    const frontage = Math.hypot(proposal.width, proposal.depth) / 2 + street.width / 2 + 10 + rand(n + 10) * 10
    proposal.x += -dz / length * frontage * side
    proposal.z += dx / length * frontage * side
  }
  return layout
}
