import { Scene } from 'three'
import { describe, expect, it, vi } from 'vitest'
import {
  gateProximityEmphasis,
  gateProximityEmphasisSquared,
  gateBeaconDistanceOpacity,
  missionPassFlashOpacity,
  missionPassFlashScale,
  buildMissionRoute,
  routeProfileForBiome,
  routeProfileForSpawn,
  routeProfileLabel,
  normalizeMissionRouteProfile,
  normalizeMissionRouteModifier,
  missionChallengeForProfile,
  routeModifierForSpawn,
  routeModifierLabel,
  routeCorridorMinClearance,
  scoringFocusForModifier,
  scoringFocusLabel,
  summarizeMissionRoute,
  validateMissionRoute,
  resolveMissionRouteWithFallback,
  MissionSystem,
  gateQualityLabel,
  type MissionRouteProfile,
  type MissionRoutePoint,
} from '../src/systems/Mission'
import { clearOpsPad, findPlayableSpawn, sampleTerrainHeight, setOpsPad } from '../src/world/terrainSample'
import { setWorldSeed } from '../src/world/noise'
import { thermalLiftIntensity } from '../src/systems/ThermalLift'

describe('MissionSystem gate crossing', () => {
  it('fails closed on malformed route profile and modifier values', () => {
    expect(normalizeMissionRouteProfile('ridge')).toBe('ridge')
    expect(normalizeMissionRouteProfile('not-a-route')).toBe('orbit')
    expect(normalizeMissionRouteProfile('not-a-route', 'free')).toBe('free')
    expect(normalizeMissionRouteProfile('not-a-route', 'not-a-route' as never)).toBe('orbit')
    expect(normalizeMissionRouteModifier('tempo')).toBe('tempo')
    expect(normalizeMissionRouteModifier('not-a-modifier')).toBe('steady')
    expect(normalizeMissionRouteModifier('not-a-modifier', 'altitude')).toBe('altitude')
  })

  it('keeps malformed mission requests inside the authored route catalog', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0, 'not-a-route' as never, 'not-a-modifier' as never)

    expect(mission.routeProfile).toBe('orbit')
    expect(mission.routeModifier).toBe('steady')
    expect(mission.routeSummary.profile).toBe('orbit')
    expect(mission.routeSummary.modifier).toBe('steady')
    expect(mission.totalGates).toBe(5)
    expect(mission.activeGatePos()).not.toBeNull()
    mission.dispose()
  })

  it('falls back to a playable orbit when an authored route fails validation', () => {
    const invalidRoute: MissionRoutePoint[] = [{ x: 0, y: 20, z: 0, fwdX: 0, fwdZ: 0 }]
    const orbitRoute = buildMissionRoute(0, 20, 0, 0, 'orbit', 'steady')
    const routeBuilder: typeof buildMissionRoute = vi.fn((_x, _y, _z, _yaw, profile) =>
      profile === 'orbit' ? orbitRoute : invalidRoute)

    const resolution = resolveMissionRouteWithFallback(
      0,
      20,
      0,
      0,
      'canyon',
      'tempo',
      routeBuilder,
    )

    expect(routeBuilder).toHaveBeenCalledTimes(2)
    expect(resolution.fallbackUsed).toBe(true)
    expect(resolution.profile).toBe('orbit')
    expect(resolution.modifier).toBe('steady')
    expect(resolution.validation.valid).toBe(true)
    expect(resolution.route).toBe(orbitRoute)
    expect(resolution.summary.profile).toBe('orbit')
  })

  it('maps finite gate quality into readable event labels', () => {
    expect(gateQualityLabel(1)).toBe('PERFECT')
    expect(gateQualityLabel(0.6)).toBe('CLEAN')
    expect(gateQualityLabel(0.2)).toBe('EDGE')
    expect(gateQualityLabel(0)).toBe('MISS')
    expect(gateQualityLabel(Number.NaN)).toBe('MISS')
  })

  it('does not award a gate that the jet spawned beyond', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0)
    const gate = mission.activeGatePos()
    expect(gate).not.toBeNull()
    const pos = gate!
    // First sample arms the previous-position latch.
    expect(mission.update(pos.x, pos.y, pos.z)).toBe('none')
    // Sitting 10 m past the plane without a prior crossing must not count.
    const aheadX = pos.x + 10
    expect(mission.update(aheadX, pos.y, pos.z)).toBe('none')
  })

  it('awards a forward plane crossing inside the ring', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0)
    const gate = mission.activeGatePos()!
    const ring = mission.root.getObjectByName('gate_0')!
    const fwdX = Math.sin(ring.rotation.y)
    const fwdZ = Math.cos(ring.rotation.y)
    const behindX = gate.x - fwdX * 20
    const behindZ = gate.z - fwdZ * 20
    const aheadX = gate.x + fwdX * 20
    const aheadZ = gate.z + fwdZ * 20
    expect(mission.update(behindX, gate.y, behindZ)).toBe('none')
    expect(mission.update(aheadX, gate.y, aheadZ)).toBe('pass')
  })

  it('reports a forward crossing outside the ring so the pilot can re-align', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0)
    const gate = mission.activeGatePos()!
    const ring = mission.root.getObjectByName('gate_0')!
    const fwdX = Math.sin(ring.rotation.y)
    const fwdZ = Math.cos(ring.rotation.y)
    const behindX = gate.x - fwdX * 20
    const behindZ = gate.z - fwdZ * 20
    const missY = gate.y + 80
    const aheadX = gate.x + fwdX * 20
    const aheadZ = gate.z + fwdZ * 20
    expect(mission.update(behindX, missY, behindZ)).toBe('none')
    expect(mission.update(aheadX, missY, aheadZ)).toBe('miss')
    expect(mission.activeGatePos()).toBe(gate)
    expect(mission.lastPassQuality).toBe(0)
    mission.dispose()
  })

  it('reuses the HUD telemetry snapshot between frames', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0)

    const first = mission.hud(0, 20, 0)
    const second = mission.hud(4, 24, 8)

    expect(second).toBe(first)
    expect(second.status).toBe('live')
    expect(second.dist).toBeGreaterThan(0)
  })

  it('keeps the live beacon aligned without a per-frame reposition', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0)
    const gate = mission.activeGatePos()!
    const beacon = mission.root.getObjectByName('GateBeacon')!

    expect(beacon.position.x).toBe(gate.x)
    expect(beacon.position.y).toBe(gate.y)
    expect(beacon.position.z).toBe(gate.z)

    mission.tick()

    expect(beacon.position.x).toBe(gate.x)
    expect(beacon.position.y).toBe(gate.y)
    expect(beacon.position.z).toBe(gate.z)
    mission.dispose()
  })

  it('uses a deterministic frame clock for gate presentation', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0)
    const ring = mission.root.getObjectByName('gate_0')!

    mission.tick()
    const firstScale = ring.scale.x
    mission.tick()

    expect(ring.scale.x).not.toBe(firstScale)
    mission.dispose()
  })

  it('freezes gate presentation while the sortie is paused', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0)
    const ring = mission.root.getObjectByName('gate_0')!

    mission.tick(1000, 0, 20, 0, true)
    const firstScale = ring.scale.x
    mission.tick(5000, 0, 20, 0, false)

    expect(ring.scale.x).toBe(firstScale)
    mission.tick(5000, 0, 20, 0, true)
    expect(ring.scale.x).not.toBe(firstScale)
    mission.dispose()
  })

  it('reuses the fixed gate scene footprint across retries', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0)
    const childCount = mission.root.children.length
    const firstGate = mission.root.getObjectByName('gate_0')

    mission.start(120, 24, -80, 0.7)

    expect(mission.root.children).toHaveLength(childCount)
    expect(mission.root.getObjectByName('gate_0')).toBe(firstGate)
    expect(mission.activeGatePos()?.x).not.toBe(0)
    mission.dispose()
  })

  it('keeps the intended route corridor in one bounded trace', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0)
    const trace = mission.root.getObjectByName('RouteTrace') as { visible: boolean; geometry: { drawRange: { count: number } } }
    expect(trace.visible).toBe(true)
    expect(trace.geometry.drawRange.count).toBe(5)
    mission.setRouteTraceVisible(false)
    expect(trace.visible).toBe(false)
    mission.setRouteTraceVisible(true)
    expect(trace.visible).toBe(true)

    mission.start(0, 20, 0, 0, 'free')
    expect(trace.visible).toBe(false)
    expect(trace.geometry.drawRange.count).toBe(0)
    mission.dispose()
  })

  it('keeps the gate pass flash bounded and monotonic', () => {
    expect(missionPassFlashScale(0)).toBe(1)
    expect(missionPassFlashScale(0.5)).toBeGreaterThan(1)
    expect(missionPassFlashScale(1)).toBeCloseTo(3.2)
    expect(missionPassFlashOpacity(0)).toBeCloseTo(0.86)
    expect(missionPassFlashOpacity(0.5)).toBeGreaterThan(missionPassFlashOpacity(1))
    expect(missionPassFlashOpacity(2)).toBe(0)
  })

  it('ramps soft gate proximity emphasis inside a few ring radii', () => {
    expect(gateProximityEmphasis(400, 36)).toBe(0)
    expect(gateProximityEmphasis(36, 36)).toBe(1)
    expect(gateProximityEmphasis(90, 36)).toBeGreaterThan(0)
    expect(gateProximityEmphasis(90, 36)).toBeLessThan(1)
    expect(gateProximityEmphasis(Number.NaN, 36)).toBe(0)
    expect(gateProximityEmphasisSquared(400 ** 2, 36)).toBe(0)
    expect(gateProximityEmphasisSquared(36 ** 2, 36)).toBe(1)
    expect(gateProximityEmphasisSquared(Number.NaN, 36)).toBe(0)
  })

  it('dims the tall beacon at close range without losing distant guidance', () => {
    expect(gateBeaconDistanceOpacity(0)).toBeCloseTo(0.24)
    expect(gateBeaconDistanceOpacity(420)).toBeCloseTo(1)
    expect(gateBeaconDistanceOpacity(1000)).toBeCloseTo(1)
    expect(gateBeaconDistanceOpacity(Number.NaN)).toBe(1)
  })

  it('contains malformed telemetry without poisoning the mission state', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN)
    const gate = mission.activeGatePos()!

    expect(Number.isFinite(gate.x)).toBe(true)
    expect(Number.isFinite(gate.y)).toBe(true)
    expect(Number.isFinite(gate.z)).toBe(true)

    const nav = mission.hud(Number.NaN, Number.POSITIVE_INFINITY, Number.NaN, Number.NaN)
    expect(Number.isFinite(nav.dist)).toBe(true)
    expect(Number.isFinite(nav.bearing!)).toBe(true)
    expect(Number.isFinite(nav.altDelta)).toBe(true)

    expect(mission.update(Number.NaN, gate.y, gate.z)).toBe('none')
    const ring = mission.root.getObjectByName('gate_0')!
    const fwdX = Math.sin(ring.rotation.y)
    const fwdZ = Math.cos(ring.rotation.y)
    expect(mission.update(gate.x - fwdX * 20, gate.y, gate.z - fwdZ * 20)).toBe('none')
    expect(mission.update(gate.x + fwdX * 20, gate.y, gate.z + fwdZ * 20)).toBe('pass')
    expect(Number.isFinite(missionPassFlashScale(Number.NaN))).toBe(true)
    mission.dispose()
  })

  it('builds a varied route with a forward first leg and finite gate poses', () => {
    const routeA = buildMissionRoute(0, 20, 0, 0)
    const routeB = buildMissionRoute(1400, 20, -900, 0.8)
    expect(routeA).toHaveLength(5)
    expect(routeB).toHaveLength(5)
    expect(routeA[0]!.z).toBeGreaterThan(0)
    expect(routeA[0]!.fwdZ).toBeGreaterThan(0.9)
    expect(routeA.map((point) => `${point.x.toFixed(2)}:${point.z.toFixed(2)}`))
      .not.toEqual(routeB.map((point) => `${point.x.toFixed(2)}:${point.z.toFixed(2)}`))
    for (const point of [...routeA, ...routeB]) {
      expect(Number.isFinite(point.x)).toBe(true)
      expect(Number.isFinite(point.y)).toBe(true)
      expect(Number.isFinite(point.z)).toBe(true)
      expect(Math.hypot(point.fwdX, point.fwdZ)).toBeCloseTo(1)
    }

    const routeC = buildMissionRoute(0, 20, 0, 0, 'ridge')
    for (const [route, start] of [
      [routeA, { x: 0, y: 20, z: 0 }],
      [routeB, { x: 1400, y: 20, z: -900 }],
      [routeC, { x: 0, y: 20, z: 0 }],
    ] as const) {
      let previous = start
      for (const point of route) {
        for (const t of [0.2, 0.4, 0.6, 0.8]) {
          const x = previous.x + (point.x - previous.x) * t
          const y = previous.y + (point.y - previous.y) * t
          const z = previous.z + (point.z - previous.z) * t
          expect(y - sampleTerrainHeight(x, z)).toBeGreaterThanOrEqual(119.9)
        }
        previous = point
      }
    }

    const summary = summarizeMissionRoute(0, 20, 0, routeA, 'orbit')
    expect(summary.profile).toBe('orbit')
    expect(summary.challenge).toBe('approach')
    expect(summary.challengeLabel).toBe('APPROACH')
    expect(summary.lengthMeters).toBeGreaterThan(0)
    expect(summary.minClearanceMeters).toBeGreaterThanOrEqual(119.9)
    expect(summary.maxSlopeDegrees).toBeGreaterThanOrEqual(0)
    expect(['relaxed', 'standard', 'technical']).toContain(summary.difficulty)
  })

  it('preserves authored descent on the approach profile', () => {
    // Start well above the generated terrain so this isolates route shaping
    // from clearance promotion and makes the intended base-to-final profile
    // explicit.
    const route = buildMissionRoute(0, 100_000, 0, 0, 'approach', 'steady')
    expect(route[1]!.y).toBeGreaterThan(route[0]!.y)
    expect(route[2]!.y).toBeLessThan(route[1]!.y)
    expect(route[3]!.y).toBeLessThan(route[2]!.y)
    expect(route[4]!.y).toBeLessThan(route[3]!.y)
  })

  it('validates the bounded route contract before pooled gate placement', () => {
    const route = buildMissionRoute(0, 20, 0, 0, 'orbit')
    const summary = summarizeMissionRoute(0, 20, 0, route, 'orbit')
    expect(validateMissionRoute(route, summary.minClearanceMeters)).toMatchObject({
      valid: true,
      issue: 'ok',
      pointCount: 5,
    })
    expect(validateMissionRoute([], 0)).toMatchObject({ valid: true, issue: 'empty' })
    expect(validateMissionRoute([
      { x: Number.NaN, y: 20, z: 1, fwdX: 0, fwdZ: 1 },
    ] as unknown as readonly MissionRoutePoint[])).toMatchObject({
      valid: false,
      issue: 'non-finite-point',
    })
    expect(validateMissionRoute([
      { x: 0, y: 20, z: 1, fwdX: 0, fwdZ: 0 },
    ])).toMatchObject({ valid: false, issue: 'invalid-forward' })
    expect(validateMissionRoute(route, 100)).toMatchObject({
      valid: false,
      issue: 'insufficient-clearance',
    })
  })

  it('measures wing-corridor clearance instead of only the route centreline', () => {
    const route: MissionRoutePoint[] = [{ x: 0, y: 100, z: 960, fwdX: 0, fwdZ: 1 }]
    const clearance = routeCorridorMinClearance(
      0,
      100,
      0,
      route,
      0,
      (x, _z) => Math.abs(x) > 20 ? 80 : 0,
    )
    expect(clearance).toBe(20)
  })

  it('keeps every generated route leg above terrain between gates', () => {
    const profiles = ['orbit', 'sweep', 'slalom', 'ridge', 'canyon', 'coast', 'fjord', 'river', 'volcanic', 'desert', 'alpine', 'storm', 'night', 'mesa', 'badlands', 'saltflat', 'savanna', 'tundra', 'swamp', 'archipelago', 'thermal', 'approach'] as const
    const starts = [
      { x: 0, y: 20, z: 0, yaw: 0 },
      { x: 1_400, y: 20, z: -900, yaw: 0.8 },
    ]

    try {
      for (const start of starts) {
        setOpsPad(start.x, start.z, start.y, start.yaw)
        for (const profile of profiles) {
          const route = buildMissionRoute(
            start.x,
            start.y,
            start.z,
            start.yaw,
            profile,
          )
          let previous = start
          for (const point of route) {
            const dx = point.x - previous.x
            const dz = point.z - previous.z
            const samples = Math.max(12, Math.ceil(Math.hypot(dx, dz) / 80))
            for (let sample = 1; sample <= samples; sample++) {
              const t = sample / samples
              const x = previous.x + dx * t
              const y = previous.y + (point.y - previous.y) * t
              const z = previous.z + dz * t
              const rightX = Math.cos(start.yaw)
              const rightZ = -Math.sin(start.yaw)
              for (const lateral of [-34, 0, 34]) {
                const clearance = y - sampleTerrainHeight(x + rightX * lateral, z + rightZ * lateral)
                expect(
                  clearance,
                  `${profile} corridor ${lateral}m from ${start.x},${start.z} leg ${point.x.toFixed(0)},${point.z.toFixed(0)} sample ${sample}/${samples}`,
                ).toBeGreaterThanOrEqual(119.5)
              }
            }
            previous = point
          }
        }
      }
    } finally {
      clearOpsPad()
    }
  })

  it('supports distinct readable route profiles without changing gate count', () => {
    const orbit = buildMissionRoute(0, 20, 0, 0, 'orbit')
    const sweep = buildMissionRoute(0, 20, 0, 0, 'sweep')
    const slalom = buildMissionRoute(0, 20, 0, 0, 'slalom')
    const ridge = buildMissionRoute(0, 20, 0, 0, 'ridge')
    const canyon = buildMissionRoute(0, 20, 0, 0, 'canyon')
    const coast = buildMissionRoute(0, 20, 0, 0, 'coast')
    const fjord = buildMissionRoute(0, 20, 0, 0, 'fjord')
    const river = buildMissionRoute(0, 20, 0, 0, 'river')
    const volcanic = buildMissionRoute(0, 20, 0, 0, 'volcanic')
    const desert = buildMissionRoute(0, 20, 0, 0, 'desert')
    const alpine = buildMissionRoute(0, 20, 0, 0, 'alpine')
    const storm = buildMissionRoute(0, 20, 0, 0, 'storm')
    const night = buildMissionRoute(0, 20, 0, 0, 'night')
    const timber = buildMissionRoute(0, 20, 0, 0, 'timber')
    const glacier = buildMissionRoute(0, 20, 0, 0, 'glacier')
    const rainforest = buildMissionRoute(0, 20, 0, 0, 'rainforest')
    const mesa = buildMissionRoute(0, 20, 0, 0, 'mesa')
    const badlands = buildMissionRoute(0, 20, 0, 0, 'badlands')
    const saltflat = buildMissionRoute(0, 20, 0, 0, 'saltflat')
    const savanna = buildMissionRoute(0, 20, 0, 0, 'savanna')
    const tundra = buildMissionRoute(0, 20, 0, 0, 'tundra')
    const swamp = buildMissionRoute(0, 20, 0, 0, 'swamp')
    const archipelago = buildMissionRoute(0, 20, 0, 0, 'archipelago')
    const thermal = buildMissionRoute(0, 20, 0, 0, 'thermal')
    const approach = buildMissionRoute(0, 20, 0, 0, 'approach')
    expect(orbit).toHaveLength(5)
    expect(sweep).toHaveLength(5)
    expect(slalom).toHaveLength(5)
    expect(ridge).toHaveLength(5)
    expect(canyon).toHaveLength(5)
    expect(coast).toHaveLength(5)
    expect(fjord).toHaveLength(5)
    expect(river).toHaveLength(5)
    expect(volcanic).toHaveLength(5)
    expect(desert).toHaveLength(5)
    expect(alpine).toHaveLength(5)
    expect(storm).toHaveLength(5)
    expect(night).toHaveLength(5)
    expect(timber).toHaveLength(5)
    expect(glacier).toHaveLength(5)
    expect(rainforest).toHaveLength(5)
    expect(mesa).toHaveLength(5)
    expect(badlands).toHaveLength(5)
    expect(saltflat).toHaveLength(5)
    expect(savanna).toHaveLength(5)
    expect(tundra).toHaveLength(5)
    expect(swamp).toHaveLength(5)
    expect(archipelago).toHaveLength(5)
    expect(thermal).toHaveLength(5)
    expect(approach).toHaveLength(5)
    expect(thermal[1]!.z).not.toBeCloseTo(archipelago[1]!.z)
    expect(sweep[1]!.x).not.toBeCloseTo(orbit[1]!.x)
    expect(slalom[1]!.x).not.toBeCloseTo(orbit[1]!.x)
    expect(fjord.map((point) => `${point.x.toFixed(2)}:${point.z.toFixed(2)}`))
      .not.toEqual(coast.map((point) => `${point.x.toFixed(2)}:${point.z.toFixed(2)}`))
    expect(summarizeMissionRoute(0, 20, 0, ridge, 'ridge').maxAltitudeMeters).toBeGreaterThan(400)
    expect(summarizeMissionRoute(0, 20, 0, coast, 'coast').challenge).toBe('range')
    expect(summarizeMissionRoute(0, 20, 0, fjord, 'fjord').challenge).toBe('range')
    expect(summarizeMissionRoute(0, 20, 0, fjord, 'fjord').maxAltitudeMeters).toBeGreaterThan(200)
    expect(summarizeMissionRoute(0, 20, 0, river, 'river').challenge).toBe('range')
    expect(summarizeMissionRoute(0, 20, 0, volcanic, 'volcanic').challenge).toBe('altitude')
    expect(summarizeMissionRoute(0, 20, 0, volcanic, 'volcanic').maxAltitudeMeters).toBeGreaterThan(700)
    expect(summarizeMissionRoute(0, 20, 0, desert, 'desert').challenge).toBe('range')
    expect(summarizeMissionRoute(0, 20, 0, desert, 'desert').lengthMeters).toBeGreaterThan(3_500)
    expect(summarizeMissionRoute(0, 20, 0, alpine, 'alpine').challenge).toBe('altitude')
    expect(summarizeMissionRoute(0, 20, 0, alpine, 'alpine').maxAltitudeMeters).toBeGreaterThan(650)
    expect(summarizeMissionRoute(0, 20, 0, storm, 'storm').challenge).toBe('precision')
    expect(summarizeMissionRoute(0, 20, 0, night, 'night').challenge).toBe('precision')
    expect(summarizeMissionRoute(0, 20, 0, timber, 'timber').challenge).toBe('range')
    expect(summarizeMissionRoute(0, 20, 0, timber, 'timber').lengthMeters).toBeGreaterThan(3_000)
    expect(summarizeMissionRoute(0, 20, 0, glacier, 'glacier').challenge).toBe('altitude')
    expect(summarizeMissionRoute(0, 20, 0, glacier, 'glacier').maxAltitudeMeters).toBeGreaterThan(550)
    expect(summarizeMissionRoute(0, 20, 0, rainforest, 'rainforest').challenge).toBe('range')
    expect(summarizeMissionRoute(0, 20, 0, rainforest, 'rainforest').lengthMeters).toBeGreaterThan(2_800)
    expect(summarizeMissionRoute(0, 20, 0, mesa, 'mesa').challenge).toBe('range')
    expect(summarizeMissionRoute(0, 20, 0, mesa, 'mesa').lengthMeters).toBeGreaterThan(3_500)
    expect(summarizeMissionRoute(0, 20, 0, badlands, 'badlands').challenge).toBe('precision')
    expect(summarizeMissionRoute(0, 20, 0, badlands, 'badlands').lengthMeters).toBeGreaterThan(3_000)
    expect(summarizeMissionRoute(0, 20, 0, saltflat, 'saltflat').challenge).toBe('range')
    expect(summarizeMissionRoute(0, 20, 0, saltflat, 'saltflat').lengthMeters).toBeGreaterThan(4_000)
    expect(summarizeMissionRoute(0, 20, 0, savanna, 'savanna').challenge).toBe('range')
    expect(summarizeMissionRoute(0, 20, 0, savanna, 'savanna').lengthMeters).toBeGreaterThan(3_500)
    expect(summarizeMissionRoute(0, 20, 0, tundra, 'tundra').challenge).toBe('range')
    expect(summarizeMissionRoute(0, 20, 0, tundra, 'tundra').lengthMeters).toBeGreaterThan(3_500)
    expect(summarizeMissionRoute(0, 20, 0, swamp, 'swamp').challenge).toBe('range')
    expect(summarizeMissionRoute(0, 20, 0, swamp, 'swamp').lengthMeters).toBeGreaterThan(3_000)
    expect(summarizeMissionRoute(0, 20, 0, archipelago, 'archipelago').challenge).toBe('range')
    expect(summarizeMissionRoute(0, 20, 0, archipelago, 'archipelago').lengthMeters).toBeGreaterThan(3_500)
    expect(summarizeMissionRoute(0, 20, 0, thermal, 'thermal').challenge).toBe('altitude')
    expect(summarizeMissionRoute(0, 20, 0, approach, 'approach').challenge).toBe('approach')
    expect(summarizeMissionRoute(0, 20, 0, approach, 'approach').lengthMeters).toBeGreaterThan(1_800)
    expect(approach[4]!.z).toBeGreaterThan(100)
    expect(canyon[1]!.z).toBeGreaterThan(0)
    expect(sweep[0]!.z).toBeGreaterThan(0)
    expect(slalom[0]!.z).toBeGreaterThan(0)
    expect(routeProfileForSpawn(0, 0, 0)).toBe('orbit')
    expect(routeProfileForSpawn(0, 0, 1.2)).toBe('ridge')
    expect(routeProfileLabel('sweep')).toBe('SWEEP')
    expect(routeProfileLabel('slalom')).toBe('SLALOM')
    expect(routeProfileLabel('ridge')).toBe('RIDGE RUN')
    expect(routeProfileLabel('canyon')).toBe('CANYON RUN')
    expect(routeProfileLabel('coast')).toBe('COASTAL RUN')
    expect(routeProfileLabel('fjord')).toBe('FJORD RUN')
    expect(routeProfileLabel('river')).toBe('RIVER RUN')
    expect(routeProfileLabel('volcanic')).toBe('VOLCANIC RUN')
    expect(routeProfileLabel('desert')).toBe('DESERT DASH')
    expect(routeProfileLabel('alpine')).toBe('ALPINE PASS')
    expect(routeProfileLabel('storm')).toBe('STORM RUN')
    expect(routeProfileLabel('night')).toBe('NIGHT OPS')
    expect(routeProfileLabel('timber')).toBe('TIMBERLINE RUN')
    expect(routeProfileLabel('glacier')).toBe('GLACIER RUN')
    expect(routeProfileLabel('rainforest')).toBe('RAINFOREST RUN')
    expect(routeProfileLabel('mesa')).toBe('MESA RUN')
    expect(routeProfileLabel('badlands')).toBe('BADLANDS RUN')
    expect(routeProfileLabel('saltflat')).toBe('SALTFLAT RUN')
    expect(routeProfileLabel('savanna')).toBe('SAVANNA RUN')
    expect(routeProfileLabel('tundra')).toBe('TUNDRA RUN')
    expect(routeProfileLabel('swamp')).toBe('SWAMP RUN')
    expect(routeProfileLabel('monsoon')).toBe('MONSOON RUN')
    expect(routeProfileLabel('archipelago')).toBe('ARCHIPELAGO RUN')
    expect(routeProfileLabel('thermal')).toBe('THERMAL RUN')
    expect(routeProfileLabel('approach')).toBe('PATTERN APPROACH')
  })

  it('anchors Thermal Run gates inside the seeded lift corridor', () => {
    setWorldSeed(27)
    clearOpsPad()
    const pad = findPlayableSpawn()
    expect(pad).not.toBeNull()
    if (!pad) return
    const thermal = buildMissionRoute(pad.x, pad.y, pad.z, pad.yaw, 'thermal', 'steady')
    const liftSamples = thermal.slice(1, 4).map((point) =>
      thermalLiftIntensity(27, point.x, point.y - pad.y, point.z, 1, 0, 0),
    )
    expect(Math.max(...liftSamples)).toBeGreaterThan(0.45)
    const forwardDistance = (thermal[2]!.x - pad.x) * Math.sin(pad.yaw) +
      (thermal[2]!.z - pad.z) * Math.cos(pad.yaw)
    expect(forwardDistance).toBeGreaterThan(700)
    setWorldSeed(1337.9182)
    clearOpsPad()
  })

  it('exposes the validated coastal and river profiles to random sorties', () => {
    const profiles = new Set<MissionRouteProfile>()
    for (let x = 0; x <= 10_000; x += 25) {
      profiles.add(routeProfileForSpawn(x, 0, 0))
    }
    expect(profiles.has('coast')).toBe(true)
    expect(profiles.has('fjord')).toBe(true)
    expect(profiles.has('river')).toBe(true)
    expect(profiles.has('volcanic')).toBe(true)
    expect(profiles.has('desert')).toBe(true)
    expect(profiles.has('alpine')).toBe(true)
    expect(profiles.has('timber')).toBe(true)
    expect(profiles.has('glacier')).toBe(true)
    expect(profiles.has('rainforest')).toBe(true)
    expect(profiles.has('mesa')).toBe(true)
    expect(profiles.has('badlands')).toBe(true)
    expect(profiles.has('saltflat')).toBe(true)
    expect(profiles.has('savanna')).toBe(true)
    expect(profiles.has('tundra')).toBe(true)
    expect(profiles.has('swamp')).toBe(true)
    expect(profiles.has('archipelago')).toBe(true)
    expect(profiles.has('thermal')).toBe(true)
  })

  it('keeps random routes coherent with recognized biome families', () => {
    expect(routeProfileForBiome('snow', 0, 0, 0)).toBe('glacier')
    expect(routeProfileForBiome('tundra', 0, 0, 0)).toBe('tundra')
    expect(routeProfileForBiome('swamp', 0, 0, 0)).toBe('swamp')
    expect(routeProfileForBiome('swamp', 1_000, 0, 0)).toBe('monsoon')
    expect(routeProfileForBiome('rainforest', 0, 0, 0)).toBe('rainforest')
    expect(routeProfileForBiome('volcanic', 0, 0, 0)).toBe('volcanic')
    expect(routeProfileForBiome('desert', 0, 0, 0)).toBe('desert')
    expect(routeProfileForBiome('mesa', 0, 0, 0)).toBe('mesa')
    expect(routeProfileForBiome('unknown', 0, 0, 0)).toBe(routeProfileForSpawn(0, 0, 0))
    expect(routeProfileForBiome(Number.NaN, 0, 0, 0)).toBe(routeProfileForSpawn(0, 0, 0))
  })

  it('keeps Monsoon Run distinct from the standard wetland route', () => {
    const swamp = buildMissionRoute(0, 20, 0, 0, 'swamp', 'steady')
    const monsoon = buildMissionRoute(0, 20, 0, 0, 'monsoon', 'steady')
    expect(monsoon).toHaveLength(swamp.length)
    expect(monsoon.map((point) => [point.x, point.y, point.z])).not.toEqual(
      swamp.map((point) => [point.x, point.y, point.z]),
    )
    expect(missionChallengeForProfile('monsoon')).toBe('range')
  })

  it('supports a no-gate free-flight profile', () => {
    expect(buildMissionRoute(0, 20, 0, 0, 'free')).toHaveLength(0)
    expect(routeProfileLabel('free')).toBe('FREE FLIGHT')
    const summary = summarizeMissionRoute(0, 20, 0, [], 'free')
    expect(summary.lengthMeters).toBe(0)
    expect(summary.label).toBe('FREE FLIGHT')

    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0, 'free')
    expect(mission.totalGates).toBe(0)
    expect(mission.routeBriefing).toContain('FREE FLIGHT')
    expect(mission.activeGatePos()).toBeNull()
    expect(mission.update(0, 20, 0)).toBe('none')
    mission.dispose()
  })

  it('adds deterministic route rhythm modifiers without changing the pooled gate count', () => {
    const steady = buildMissionRoute(0, 100_000, 0, 0, 'orbit', 'steady')
    const tempo = buildMissionRoute(0, 100_000, 0, 0, 'orbit', 'tempo')
    const altitude = buildMissionRoute(0, 100_000, 0, 0, 'orbit', 'altitude')
    expect(steady).toHaveLength(5)
    expect(tempo).toHaveLength(5)
    expect(altitude).toHaveLength(5)
    expect(tempo[1]!.x).not.toBeCloseTo(steady[1]!.x)
    expect(altitude[2]!.y).toBeGreaterThan(steady[2]!.y)
    expect(routeModifierForSpawn(0, 0, 0, 'orbit')).toBe('steady')
    expect(routeModifierLabel('tempo')).toBe('TEMPO')
    expect(scoringFocusForModifier('altitude')).toBe('landing')
    expect(scoringFocusLabel('pace')).toBe('PACE')
  })

  it('exposes cached route feedback after mission start', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0.8)
    expect(mission.routeSummary.label).toBe(mission.routeProfileLabel)
    expect(mission.routeBriefing).toContain('MIN CLR')
    expect(mission.routeBriefing).toContain('TURN ')
    expect(mission.routeBriefing).toContain('SLOPE ')
    expect(mission.routeBriefing).toContain('TOP ')
    expect(mission.routeBriefing).toContain(mission.routeProfileLabel)
    expect(mission.routeBriefing).toContain(mission.routeModifierLabel)
    expect(mission.routeBriefing).toContain(mission.routeSummary.scoringFocusLabel)
    expect(mission.routeSummary.minClearanceMeters).toBeGreaterThanOrEqual(119.9)
    mission.dispose()
  })

  it('turns slalom routes into a tighter precision challenge', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0.8)
    const ring = mission.root.getObjectByName('gate_0')!
    expect(mission.routeProfile).toBe('slalom')
    expect(mission.routeSummary.challenge).toBe('precision')
    expect(mission.routeBriefing).toContain('PRECISION')
    expect(ring.scale.x).toBeCloseTo(0.82)
    mission.dispose()
  })

  it('turns ridge routes into a high-altitude challenge', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0.8, 'ridge')
    expect(mission.routeProfile).toBe('ridge')
    expect(mission.routeSummary.challenge).toBe('altitude')
    expect(mission.routeSummary.challengeLabel).toBe('CLIMB')
    expect(mission.routeSummary.maxAltitudeMeters).toBeGreaterThan(500)
    expect(mission.routeSummary.maxSlopeDegrees).toBeGreaterThan(0)
    expect(mission.routeBriefing).toContain('CLIMB')
    mission.dispose()
  })

  it('turns canyon routes into a low-weave precision challenge', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0.8, 'canyon')
    expect(mission.routeProfile).toBe('canyon')
    expect(mission.routeSummary.challenge).toBe('precision')
    expect(mission.routeSummary.challengeLabel).toBe('PRECISION')
    expect(mission.routeSummary.lengthMeters).toBeGreaterThan(2_000)
    expect(mission.routeBriefing).toContain('CANYON RUN')
    mission.dispose()
  })

  it('preserves an explicitly selected course profile across route rebuilds', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0.8, 'orbit')
    expect(mission.routeProfile).toBe('orbit')
    expect(mission.routeSummary.challenge).toBe('approach')
    mission.start(0, 20, 0, 0.8, 'slalom')
    expect(mission.routeProfile).toBe('slalom')
    expect(mission.routeSummary.challenge).toBe('precision')
    mission.dispose()
  })

  it('ignores late mission calls after idempotent teardown', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0)
    mission.dispose()
    mission.dispose()
    mission.start(100, 20, 100, 0)
    expect(mission.update(0, 0, 0)).toBe('none')
    expect(() => mission.tick()).not.toThrow()
  })
})
