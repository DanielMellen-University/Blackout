import { hash2 } from '../../src/world/noise'
import { settlementLayout } from '../../src/world/SettlementLayout'
import type { SettlementPlan, SettlementRoad } from '../../src/world/SettlementPlan'
import { sampleClimate } from '../../src/world/terrainSample'
import { bridgeSupportPoints, groundRoadJunction } from '../../src/world/RoadSurface'

/** Offline audit only. Recompute terrain independently of cached profile heights. */
export function auditRoad(road: SettlementRoad, endpoints: readonly SettlementPlan[] = []) {
  const failures: string[] = [], supports = bridgeSupportPoints(road)
  let groundSections = 0, engineeredSections = 0, maxGroundError = 0, maxStep = 0, maxGrade = 0
  let worst = { x: road.points[0]!.x, z: road.points[0]!.z, score: 0, index: 0 }
  for (let i = 0; i < road.points.length; i++) {
    const p = road.points[i]!, a = road.points[Math.max(0, i - 1)]!
    const step = Math.hypot(p.x - a.x, p.z - a.z)
    maxStep = Math.max(maxStep, step)
    if (i && (step <= 1e-7 || step > 24.00001)) failures.push(`gap:${i}:${step}`)
    if (![p.x, p.y, p.z].every(Number.isFinite)) failures.push(`nonfinite:${i}`)
    if (step) maxGrade = Math.max(maxGrade, Math.abs(p.y - a.y) / step)
    const ground = !p.bridge && (p.structure === undefined || p.structure === 'ground')
    const center = sampleClimate(p.x, p.z)
    if (ground) {
      groundSections++
      for (const [x, y, z] of [[p.x, p.y, p.z], [p.leftX, p.leftY, p.leftZ], [p.rightX, p.rightY, p.rightZ]]) {
        if (x === undefined || y === undefined || z === undefined) continue
        const error = Math.abs(y - sampleClimate(x, z).height - .45)
        maxGroundError = Math.max(maxGroundError, error)
        if (error > .00001) failures.push(`ground-contact:${i}:${error}`)
      }
    } else {
      engineeredSections++
      if (p.y < Math.max(center.height, p.leftX === undefined ? center.height : sampleClimate(p.leftX, p.leftZ!).height, p.rightX === undefined ? center.height : sampleClimate(p.rightX, p.rightZ!).height) + .44999) failures.push(`buried-deck:${i}`)
      if ((p.bridge || p.structure === 'viaduct') && !supports.some(s => Math.hypot(s.x - p.x, s.z - p.z) <= 144.00001)) failures.push(`unsupported:${i}`)
      if (!p.bridge && !['embankment', 'viaduct'].includes(p.structure!)) failures.push(`unknown-structure:${i}`)
    }
    const score = (p.y - center.height) + (step ? Math.abs(p.y - a.y) / step * 100 : 0)
    if (score > worst.score) worst = { x: p.x, z: p.z, score, index: i }
  }
  let joins = 0
  for (const [i, endpoint] of endpoints.entries()) {
    const p = i === 0 ? road.points[0]! : road.points.at(-1)!
    const matches = endpoint.roads.flatMap(r => r.points).filter(q => Math.hypot(q.x - p.x, q.z - p.z) < .00001)
    if (!matches.some(q => Math.abs(q.y - p.y) < .00001)) failures.push(`street-join:${endpoint.id}`)
    if (!groundRoadJunction(p, road.width, sampleClimate)) failures.push(`junction-apron:${endpoint.id}`)
    joins++
  }
  return { points: road.points.length, segments: road.points.length - 1, groundSections, engineeredSections,
    supports: supports.length, maxGroundError, maxStep, maxGrade, joins, worst, failures }
}

export function auditStreetEnds(plan: SettlementPlan) {
  const [cx, cz] = plan.id.split(',').map(Number)
  const rand = (n: number) => hash2(cx! * 673 + n * 97 + 2843, cz! * 701 - n * 131 - 9571)
  const angle = rand(30) * Math.PI * 2, cos = Math.cos(angle), sin = Math.sin(angle)
  const world = (p: { x: number; z: number }) => ({ x: plan.x + cos * p.x + sin * p.z, z: plan.z - sin * p.x + cos * p.z })
  const layout = settlementLayout(plan, rand, (x,z) => { const p = world({x,z}); return sampleClimate(p.x,p.z) })
  const planned = layout.roads.map(r => ({ start: world(r.points[0]!), end: world(r.points.at(-1)!) }))
  const unexpected: number[] = []
  for (const [i, road] of plan.roads.entries()) {
    const a = road.points[0]!, b = road.points.at(-1)!
    if (!planned.some(r => Math.hypot(r.start.x-a.x,r.start.z-a.z) < .00001 && Math.hypot(r.end.x-b.x,r.end.z-b.z) < .00001)) unexpected.push(i)
  }
  const ends = plan.roads.flatMap((road, index) => [road.points[0]!, road.points.at(-1)!].map(p => {
    let nearest = Infinity
    for (const [j, other] of plan.roads.entries()) {
      if (j === index) continue
      for (let i = 1; i < other.points.length; i++) {
        const a = other.points[i-1]!, b = other.points[i]!, dx = b.x-a.x, dz = b.z-a.z
        const t = Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz)))
        nearest = Math.min(nearest,Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t))
      }
    }
    return { road: index, x: p.x, z: p.z, nearestStreet: Number.isFinite(nearest) ? nearest : null,
      kind: nearest <= road.width ? 'junction' : road.gateway ? 'service-arterial-terminus' : 'layout-terminus' }
  }))
  return { streets: plan.roads.length, plannedStreets: planned.length, rejectedWholeStreets: planned.length - plan.roads.length, unexpectedTruncations: unexpected, ends }
}
