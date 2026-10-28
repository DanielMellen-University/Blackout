import { afterEach, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { generateLegacyTerrain } from '../src/systems/LegacyMissionGenerator'
import { generateMission } from '../src/systems/MissionGenerator'
import { buildMissionRoute } from '../src/systems/Mission'
import { MAX_GATE_SPACING_M, MAX_ROUTE_BEND_M, MIN_GATE_SPACING_M } from '../src/systems/MissionGates'
import { MISSION_THEMES, setTerrainProfile } from '../src/world/TerrainProfile'
import { setWorldSeed } from '../src/world/noise'
import { clearOpsPad, setOpsPad, waterBodyFromClimate } from '../src/world/terrainSample'
import { sampleGeography } from '../src/world/Geography'

// r9 route proof: the routes players actually fly (after terrain bending), not
// only the generator's seeded gates, across many seeds per theme.
afterEach(() => { setTerrainProfile(null); clearOpsPad() })
const SEEDS = Array.from({ length: 60 }, (_, i) => i * 101 + 11)

function flownRoute(theme: typeof MISSION_THEMES[number], seed: number) {
  const spec = generateMission(seed, theme), p = spec.start, pad = spec.landingRunway
  setWorldSeed(seed); setTerrainProfile(spec.terrain); setOpsPad(pad.x, pad.z, pad.y, pad.yaw)
  return { spec, route: buildMissionRoute(p.x, p.y, p.z, p.yaw, spec.profile) }
}

describe('r9 proof: flown routes keep spacing, turn limit, width and gentle bending', () => {
  for (const theme of MISSION_THEMES) it(`${theme} holds on ${SEEDS.length} seeds`, () => {
    let bentRoutes = 0
    for (const seed of SEEDS) {
      const { spec, route } = flownRoute(theme, seed), p = spec.start
      expect(route).toHaveLength(spec.course.length)
      expect(route.length).toBeGreaterThanOrEqual(8); expect(route.length).toBeLessThanOrEqual(20)
      let x = p.x, z = p.z, hx = Math.sin(p.yaw), hz = Math.cos(p.yaw), bent = false
      const rights: number[] = []
      for (const [index, gate] of route.entries()) {
        const dx = gate.x - x, dz = gate.z - z, leg = Math.hypot(dx, dz)
        if (index > 0) {
          expect(leg).toBeGreaterThanOrEqual(MIN_GATE_SPACING_M)
          expect(leg).toBeLessThanOrEqual(MAX_GATE_SPACING_M)
        }
        expect(Math.acos(Math.min(1, (dx * hx + dz * hz) / leg)) * 180 / Math.PI).toBeLessThan(75)
        hx = dx / leg; hz = dz / leg; x = gate.x; z = gate.z
        const seeded = spec.course[index]!, shift = Math.hypot(gate.x - seeded.x, gate.z - seeded.z)
        expect(shift).toBeLessThanOrEqual(MAX_ROUTE_BEND_M + 1e-6)
        if (shift > 1) bent = true
        rights.push((gate.x - p.x) * Math.cos(p.yaw) - (gate.z - p.z) * Math.sin(p.yaw))
      }
      // The last two gates stay on the runway axis for the airborne finish.
      for (const gate of route.slice(-2)) expect(Math.abs(rights[route.indexOf(gate)]!)).toBeLessThan(1e-6)
      // Narrow seeded loops widen to keep 800 m spacing under the turn limit.
      expect(Math.max(...rights) - Math.min(...rights)).toBeGreaterThan(1400)
      if (bent) bentRoutes++
      if (theme === 'waterway-run') {
        // River and lake gates stay on the seeded line: never bent away.
        expect(bent).toBe(false)
        const bodies = route.map(g => waterBodyFromClimate(sampleGeography(g.x, g.z)))
        expect(bodies).toContain('river'); expect(bodies).toContain('lake')
      }
    }
    // Bending remains active across the four terrain-following themes.
    if (theme !== 'waterway-run') expect(bentRoutes).toBeGreaterThan(SEEDS.length / 2)
  }, 120_000)
})

// Compare the actual terrain-cleared Training orbit route with the pre-tuning baseline.
it('preserves flown Training orbit routes on 200 seeds', () => {
  const routes = Array.from({ length: 200 }, (_, i) => {
    const seed = i * 101 + 11, spec = generateLegacyTerrain(seed, 'desert-run', true)
    const p = spec.start, pad = spec.landingRunway
    setWorldSeed(seed); setTerrainProfile(spec.terrain); setOpsPad(pad.x, pad.z, pad.y, pad.yaw)
    return buildMissionRoute(p.x, p.y, p.z, p.yaw, 'orbit')
  })
  expect(createHash('sha256').update(JSON.stringify(routes)).digest('hex'))
    .toBe('bc5d18df3c7c520ef9f3b5707b4ae76ebe3f15f939fa492a250e992c96c0a6e4')
}, 120_000)
