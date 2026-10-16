import type { SettlementPlan, SettlementBuilding } from './SettlementPlan'

export type BuildingUse = 'house' | 'apartment' | 'office' | 'shop' | 'warehouse' | 'workshop' | 'civic' | 'barn' | 'gas-station'
export type District = 'centre' | 'residential' | 'commercial' | 'industrial' | 'rural'
export type GroundUse = 'park' | 'plaza' | 'field' | 'forecourt' | 'path'
type Point = { x: number; z: number }
export interface LocalLot extends Point {
  width: number; depth: number; height: number; yaw: number
  use: BuildingUse; district: District; shape: SettlementBuilding['shape']
}
export interface LocalSpace extends Point {
  width: number; depth: number; yaw: number; use: GroundUse; color: number
}
export interface SettlementLayout {
  roads: { points: Point[]; width: number }[]
  lots: LocalLot[]
  spaces: LocalSpace[]
  target: number
}

/** Metre-scale, road-led neighbourhoods. All proposals still pass the shared
 * water, slope, foundation and overlap validator before entering the world. */
export function settlementLayout(plan: SettlementPlan, rand: (n: number) => number): SettlementLayout {
  const city = plan.kind === 'city'
  const phase = rand(40) * Math.PI * 2
  const layout: SettlementLayout = { roads: [], lots: [], spaces: [],
    target: city ? 660 + Math.floor(rand(200) * 620) : 12 + Math.floor(rand(201) ** 1.3 * 53) }
  const point = (x: number, z: number, yaw: number, ox = 0, oz = 0): Point =>
    ({ x: ox + Math.cos(yaw) * x + Math.sin(yaw) * z,
      z: oz - Math.sin(yaw) * x + Math.cos(yaw) * z })
  const addRoad = (points: Point[], width: number) => layout.roads.push({ points, width })
  const green: LocalSpace = { x: 0, z: city ? 95 : 48, width: city ? 120 : 72,
    depth: city ? 95 : 48, yaw: 0, use: city ? 'plaza' : 'park', color: city ? 0x9b9688 : 0x65754e }
  layout.spaces.push(green)

  function lot(x: number, z: number, yaw: number, use: BuildingUse, district: District, n: number) {
    const r = rand(n), s = rand(n + 1)
    const h = rand(n + 2)
    let width: number, depth: number, height: number
    switch (use) {
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
      : use === 'warehouse' || use === 'barn' || use === 'workshop' ? 'hangar'
        : use === 'civic' ? 'stepped' : use === 'apartment' ? 'slab' : 'block'
    layout.lots.push({ x, z, yaw, use, district, width, depth, height, shape })
  }

  // Country services and farmsteads get first refusal on their reserved lots.
  // No simulated traffic, vegetation, interiors or new dynamic lights.
  if (!city) {
    const farmCount = 1 + Math.floor(rand(250) * 3)
    const core = Math.max(200, Math.min(520, plan.radius * .15))
    for (let i = 0; i < farmCount; i++) {
      const a = phase + i / farmCount * Math.PI * 2 + .45
      const farm = point(core * (1.8 + rand(251 + i) * .8), 0, a)
      addRoad([{ x: 0, z: 0 }, point(farm.x * .55, farm.z * .55, 0), farm], 6)
      const barn = point(0, 55, a, farm.x, farm.z), house = point(0, -45, a, farm.x, farm.z)
      lot(barn.x, barn.z, a, 'barn', 'rural', 300 + i * 20)
      lot(house.x, house.z, a, 'house', 'rural', 310 + i * 20)
      if (!['snow', 'mountain', 'volcanic', 'swamp', 'saltflat'].includes(plan.biome)) {
        for (let j = 0; j < 2; j++) {
          const field = point(j ? 150 : -150, 145, a, farm.x, farm.z)
          layout.spaces.push({ ...field, width: 135 + rand(360 + i * 4 + j) * 70,
            depth: 100 + rand(380 + i * 4 + j) * 65, yaw: a, use: 'field',
            color: j ? 0x98875a : 0x75704a })
        }
      }
    }
    if (rand(400) < .72 || plan.anchor) {
      const heading = phase + Math.PI
      const service = point(core * 1.3, 0, heading)
      addRoad([{ x: 0, z: 0 }, service, point(core * 1.7, 0, heading)], 9)
      const store = point(0, 60, heading, service.x, service.z)
      lot(store.x, store.z, heading, 'gas-station', 'rural', 410)
      const forecourt = point(0, 24, heading, service.x, service.z)
      layout.spaces.push({ ...forecourt, width: 52, depth: 36, yaw: heading, use: 'forecourt', color: 0x85867f })
    }
  }

  const districtCount = city ? 13 + Math.floor(rand(42) * 4) : 1
  const paths: { a: Point; b: Point; width: number; district: District; core: boolean }[] = []
  for (let d = 0; d < districtCount; d++) {
    const a = phase + d / Math.max(1, districtCount - 1) * Math.PI * 2 + (rand(500 + d) - .5) * .35
    const distance = d === 0 ? 0 : plan.radius * (.27 + .58 * ((d - 1) / Math.max(1, districtCount - 2)))
    const centre = city ? point(distance, 0, a) : { x: 0, z: 0 }
    const heading = city ? a + rand(540 + d) * .5 : phase
    const district: District = !city ? 'residential' : d === 0 ? 'centre'
      : d % 5 === 1 ? 'industrial' : d % 4 === 2 ? 'commercial' : 'residential'
    const reach = city ? 430 + rand(560 + d) * 260 : Math.max(200, Math.min(520, plan.radius * .15))
    if (d > 0) addRoad([{ x: 0, z: 0 },
      point(centre.x * .5 + Math.sin(a) * distance * .08, centre.z * .5, 0), centre], 15)
    // Short, bent streets around each centre, rather than scattering individual
    // houses over a multi-kilometre disk. Unequal branches avoid repeated grids.
    const branches = city ? 5 : 3 + Math.floor(rand(600) * 3)
    for (let branch = 0; branch < branches; branch++) {
      const direction = heading + branch / branches * Math.PI * 2 + (rand(620 + d * 13 + branch) - .5) * .35
      const end = point(reach * (.75 + rand(850 + d * 13 + branch) * .4), 0, direction, centre.x, centre.z)
      const mid = { x: (centre.x + end.x) / 2 + Math.sin(direction) * reach * .08,
        z: (centre.z + end.z) / 2 + Math.cos(direction) * reach * .08 }
      const width = city ? district === 'industrial' ? 11 : 9 : 6.5
      addRoad([centre, mid, end], width)
      paths.push({ a: centre, b: mid, width, district, core: d === 0 },
        { a: mid, b: end, width, district, core: d === 0 })
      if (city && branch % 3 === 0) {
        const spur = point(0, reach * .5, direction, mid.x, mid.z)
        addRoad([mid, spur], 8)
        paths.push({ a: mid, b: spur, width: 8, district, core: d === 0 })
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
    let use: BuildingUse = !city ? rand(n + 1) < .11 ? 'workshop' : rand(n + 2) < .12 ? 'shop' : 'house'
      : street.district === 'centre' ? rand(n + 1) < .68 ? 'office' : 'apartment'
        : street.district === 'industrial' ? rand(n + 1) < .64 ? 'warehouse' : 'workshop'
          : street.district === 'commercial' ? rand(n + 1) < .75 ? 'shop' : 'apartment'
            : rand(n + 1) < .23 ? 'apartment' : 'house'
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
