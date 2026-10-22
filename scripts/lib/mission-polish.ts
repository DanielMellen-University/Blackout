import { Scene } from 'three'
import { generateLegacyMission } from '../../src/systems/LegacyMissionGenerator'
import type { CourseDefinition } from '../../src/systems/CourseLibrary'
import { MissionSystem, buildMissionRoute, missionLegClearance, missionChallengeForProfile } from '../../src/systems/Mission'
import { setTerrainProfile } from '../../src/world/TerrainProfile'
import { setWorldSeed } from '../../src/world/noise'
import { clearOpsPad, setOpsPad, sampleTerrainSurface, sampleTerrainSurfaceHeightFast } from '../../src/world/terrainSample'
import { AIRFIELD_COLLIDERS, AIRFIELD_COLLISION_PADDING } from '../../src/world/Airfield'
import { SETTLEMENT_CELL_SIZE, settlementForCell } from '../../src/world/SettlementPlan'
import { hitsSettlement } from '../../src/world/SettlementSystem'
import { flightConfig } from '../../src/aircraft/flightConfig'

const require = (condition: boolean, message: string) => { if (!condition) throw Error(message) }

/** Offline proof only. Uses production terrain, obstacle boxes and gate evaluator. */
export function auditMissionGeometry(course: CourseDefinition, seed: number) {
  const adapted = generateLegacyMission(course, seed)!
  const { spec } = adapted, pad = spec.landingRunway
  setWorldSeed(seed); setTerrainProfile(spec.terrain); setOpsPad(pad.x, pad.z, pad.y, pad.yaw)
  const mission = new MissionSystem(new Scene())
  try {
    mission.start(spec.start.x, spec.start.y, spec.start.z, spec.start.yaw, course.profile!, adapted.modifier)
    const route = buildMissionRoute(spec.start.x, spec.start.y, spec.start.z, spec.start.yaw, course.profile!, adapted.modifier)
    require(!mission.routeFallbackUsed && route.length === 5, 'route fallback or wrong gate count')
    const radius = missionChallengeForProfile(course.profile!) === 'precision' ? 38 * .78 - 2 : 36
    const halfWidth = ['coastal-island-run', 'volcanic-run'].includes(spec.theme) ? 52 : 34
    // Each cell owns sites in its core. Include adjacent cells so a site whose
    // footprint crosses a cell edge is included even outside the flown cells.
    const cells = new Set<string>()
    for (const p of [spec.start, ...route]) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++)
      cells.add(`${Math.floor(p.x / SETTLEMENT_CELL_SIZE) + dx},${Math.floor(p.z / SETTLEMENT_CELL_SIZE) + dz}`)
    const plans = [...cells].flatMap(key => {
      const [x, z] = key.split(',').map(Number)
      const plan = settlementForCell(x!, z!)
      return plan ? [plan] : []
    })
    const obstacle = (x: number, y: number, z: number) => {
      const dx = x - pad.x, dz = z - pad.z
      const lx = dx * Math.cos(pad.yaw) - dz * Math.sin(pad.yaw)
      const lz = dx * Math.sin(pad.yaw) + dz * Math.cos(pad.yaw)
      const p = AIRFIELD_COLLISION_PADDING
      if (AIRFIELD_COLLIDERS.some(b => Math.abs(lx - b.cx) <= b.hx + p.x && Math.abs(y - pad.y - b.cy) <= b.hy + p.y && Math.abs(lz - b.cz) <= b.hz + p.z)) return true
      return plans.some(plan => hitsSettlement(plan, x, y, z, p))
    }
    const startSurface = sampleTerrainSurface(spec.start.x, spec.start.z)
    require(startSurface.kind === 'land', 'wet spawn')
    require(Math.abs(spec.start.y - startSurface.height - flightConfig.gearHeight) < .01, 'spawn gear clearance')
    require(!obstacle(spec.start.x, spec.start.y, spec.start.z), 'spawn obstacle')
    require(Math.abs(spec.start.yaw - pad.yaw) < 1e-9, 'spawn heading')
    let previous = spec.start, minMargin = Infinity, minGateClearance = Infinity, minLeg = Infinity, maxLeg = 0, maxSlope = 0
    const gates = []
    for (const [index, point] of route.entries()) {
      require(Object.values(point).every(Number.isFinite), 'nonfinite gate')
      const dx = point.x - previous.x, dz = point.z - previous.z, length = Math.hypot(dx, dz)
      minLeg = Math.min(minLeg, length); maxLeg = Math.max(maxLeg, length)
      maxSlope = Math.max(maxSlope, Math.atan2(Math.abs(point.y - previous.y), length) * 180 / Math.PI)
      require(length > 900 && length < 6500 && maxSlope < 25, 'unreachable gate spacing or slope')
      require(Math.abs(Math.hypot(point.fwdX, point.fwdZ) - 1) < 1e-9 && dx * point.fwdX + dz * point.fwdZ > 0, 'gate faces wrong direction')
      // The world is unbounded. Bound this proof to the generated circuit's
      // existing local envelope, not an invented world boundary.
      require(Math.hypot(point.x - pad.x, point.z - pad.z) < 6500, 'gate outside circuit envelope')
      const steps = Math.ceil(length / 25)
      for (let i = 1; i <= steps; i++) for (const side of [-halfWidth, -halfWidth / 2, 0, halfWidth / 2, halfWidth]) {
        // Departure starts on an 18 m runway beside real airfield buildings.
        // Widen the maneuver corridor with the existing departure climb ramp;
        // the production body padding still applies at every sampled point.
        const t = i / steps, lateral = side * (index === 0 ? Math.min(1, length * t / 800) : 1)
        const x = previous.x + dx * t + dz / length * lateral, z = previous.z + dz * t - dx / length * lateral
        const y = previous.y + (point.y - previous.y) * t
        const margin = y - sampleTerrainSurfaceHeightFast(x, z) - missionLegClearance(index, length * t, length)
        minMargin = Math.min(minMargin, margin)
        require(margin >= -.5, `leg ${index + 1} terrain clearance ${margin}`)
        // The first gate can be a dogleg. A jet rolls straight along the
        // runway before turning, rather than taxiing diagonally toward it.
        // The headless controls flight checks that departure with collision.
        if (index > 0 || length * t >= 800) require(!obstacle(x, y, z), `leg ${index + 1} obstacle`)
      }
      // Probe the complete trigger disk plus aircraft body clearance. Water
      // below a gate is allowed; the gate opening must be above its surface.
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 16) {
        const side = Math.cos(angle) * radius, y = point.y + Math.sin(angle) * radius
        const x = point.x + point.fwdZ * side, z = point.z - point.fwdX * side
        const clearance = y - sampleTerrainSurfaceHeightFast(x, z)
        minGateClearance = Math.min(minGateClearance, clearance)
        require(clearance > AIRFIELD_COLLISION_PADDING.y && !obstacle(x, y, z), `gate ${index + 1} obstructed disk`)
      }
      gates.push({ ...point, radius })
      previous = { ...point, yaw: pad.yaw }
    }
    // Exercise real ordered swept-plane triggers at cruise speed and both
    // sides of their radius. No radius, gate state or next-index writes.
    mission.update(spec.start.x, spec.start.y, spec.start.z)
    for (const [index, point] of route.entries()) {
      const cross = (along: number, radial: number) => mission.update(point.x + point.fwdX * along + point.fwdZ * radial, point.y, point.z + point.fwdZ * along - point.fwdX * radial)
      cross(-10, radius + .1)
      require(cross(10, radius + .1) === 'miss' && mission.next === index, 'outside radius accepted')
      require(cross(-10, 0) === 'none' && mission.next === index, 'reverse crossing accepted')
      require(cross(10, radius - .1) === (index === 4 ? 'complete' : 'pass'), 'inside radius rejected')
      require(mission.next === index + 1, 'gate order')
    }
    return { mission: course.id, seed, theme: spec.theme, gates: gates.length, radius, minMargin, minGateClearance, minLeg, maxLeg, maxSlope, buildings: plans.reduce((count, plan) => count + plan.buildings.length, 0), spawn: 'dry, flat, aligned, stationary', routeLabel: mission.routeSummary.label, briefing: mission.routeBriefing }
  } finally { mission.dispose(); setTerrainProfile(null); clearOpsPad() }
}
