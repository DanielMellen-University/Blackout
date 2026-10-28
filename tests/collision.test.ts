import { Quaternion, Vector3 } from 'three'
import { afterEach, describe, expect, it } from 'vitest'
import { Aircraft, type AircraftImpact } from '../src/aircraft/Aircraft'
import {
  attitudeInto,
  classifyContact,
  classifyContactOutcome,
  classifyContactOutcomeInto,
  contactFailureLabel,
} from '../src/systems/Collision'
import { CollisionSystem } from '../src/systems/Collision'
import {
  setContactHeightSampler,
  setGroundHeightSampler,
  setGroundSurfaceSampler,
} from '../src/world/ground'
import { flightConfig } from '../src/aircraft/flightConfig'
import { setTerrainProfile } from '../src/world/TerrainProfile'
import { setWorldSeed } from '../src/world/noise'
import { clearOpsPad, findPlayableSpawn, setOpsPad } from '../src/world/terrainSample'

afterEach(() => {
  setContactHeightSampler(null)
  setGroundHeightSampler(null)
  setGroundSurfaceSampler(null)
  setTerrainProfile(null)
  clearOpsPad()
})

function impact(partial: Partial<AircraftImpact>): AircraftImpact {
  return {
    point: new Vector3(),
    surfacePoint: new Vector3(),
    surfaceNormal: new Vector3(0, 1, 0),
    preImpactVelocity: new Vector3(),
    normalVelocity: -2,
    verticalVelocity: -2,
    tangentialSpeed: 40,
    surface: 'land',
    gearDown: true,
    startedAirborne: true,
    ...partial,
  }
}

describe('classifyContact', () => {
  it('lands a firm touchdown that ends inside the grounded envelope', () => {
    const base = { impact: null, onPad: true, gearDown: true, groundSpeed: 50, pitch: 0.05, roll: 0, upY: 1,
      obstacle: false, surface: 'land' as const, surfaceNormalY: 1 }
    // Before 11.023 a step ending 0 to 0.18 m above the gear floor read as a rollout.
    for (const vy of [-0.8, -2, -4, -5.8]) {
      expect(classifyContact({ ...base, airborne: false, vy, touchdown: true })).toBe('landed')
      expect(classifyContact({ ...base, airborne: false, vy, touchdown: false })).toBe('roll')
    }
    // Past the soft-landing limit it stays a rollout, and gentle settles stay rollouts.
    expect(classifyContact({ ...base, airborne: false, vy: -7, touchdown: true })).toBe('roll')
    expect(classifyContact({ ...base, airborne: false, vy: -0.3, touchdown: true })).toBe('roll')
    // Gear up never lands.
    expect(classifyContact({ ...base, gearDown: false, airborne: false, vy: -2, touchdown: true })).toBe('roll')
  })

  it('reports LANDED for every sink rate inside the soft-landing limit on a real runway', () => {
    setWorldSeed(42); setTerrainProfile(null); clearOpsPad()
    const pad = findPlayableSpawn()!
    setOpsPad(pad.x, pad.z, pad.y, pad.yaw)
    for (const sink of [0.8, 2, 4, 5.8]) {
      for (let k = 0; k < 8; k++) {
        const aircraft = new Aircraft(), collision = new CollisionSystem()
        aircraft.reset({ x: pad.x, y: pad.y + flightConfig.gearHeight + 0.6 + k * 0.0137, z: pad.z, yaw: pad.yaw })
        aircraft.controls.gearDown = true
        aircraft.controls.throttle = 0
        aircraft.velocity.set(Math.sin(pad.yaw) * 50, -sink, Math.cos(pad.yaw) * 50)
        let touch = 'air'
        for (let step = 0; step < 300 && touch === 'air'; step++) {
          aircraft.velocity.y = Math.min(aircraft.velocity.y, -sink)
          aircraft.step(1 / 60, step * 1000 / 60)
          touch = collision.check(aircraft)
        }
        expect(`${sink}:${touch}`).toBe(`${sink}:landed`)
        aircraft.dispose()
      }
    }
  })

  it('rejects an inverted touchdown as a crash', () => {
    const result = classifyContact({
      airborne: true,
      impact: impact({ verticalVelocity: -2, tangentialSpeed: 40 }),
      onPad: true,
      gearDown: true,
      vy: -2,
      groundSpeed: 40,
      pitch: Math.PI,
      roll: 0,
      upY: -1,
      obstacle: false,
      surface: 'land',
      surfaceNormalY: 1,
    })
    expect(result).toBe('crash')
  })

  it('treats water contact from the air as a ditching crash', () => {
    const result = classifyContact({
      airborne: true,
      impact: impact({ surface: 'water', verticalVelocity: -1, tangentialSpeed: 10 }),
      onPad: true,
      gearDown: true,
      vy: -1,
      groundSpeed: 10,
      pitch: 0,
      roll: 0,
      upY: 1,
      obstacle: false,
      surface: 'water',
    })
    expect(result).toBe('ditch')
  })

  it('fails closed when impact airborne state is malformed', () => {
    const result = classifyContact({
      airborne: true,
      impact: impact({
        surface: 'water',
        startedAirborne: 'true' as unknown as boolean,
        verticalVelocity: -1,
        tangentialSpeed: 10,
      }),
      onPad: true,
      gearDown: true,
      vy: -1,
      groundSpeed: 10,
      pitch: 0,
      roll: 0,
      upY: 1,
      obstacle: false,
      surface: 'water',
    })
    expect(result).toBe('roll')
  })

  it('crashes a gear-up high-speed contact', () => {
    const result = classifyContact({
      airborne: true,
      impact: impact({
        gearDown: false,
        tangentialSpeed: 500,
        verticalVelocity: -1,
        normalVelocity: -1,
      }),
      onPad: true,
      gearDown: false,
      vy: -1,
      groundSpeed: 500,
      pitch: 0,
      roll: 0,
      upY: 1,
      obstacle: false,
      surface: 'land',
    })
    expect(result).toBe('crash')
  })

  it('accepts a gentle geared landing', () => {
    const result = classifyContact({
      airborne: true,
      impact: impact({
        verticalVelocity: -2,
        tangentialSpeed: 40,
        normalVelocity: -2,
      }),
      onPad: true,
      gearDown: true,
      vy: -2,
      groundSpeed: 40,
      pitch: 0.05,
      roll: 0.02,
      upY: 0.98,
      obstacle: false,
      surface: 'land',
    })
    expect(result).toBe('landed')
  })

  it('rejects a grounded roll on a slope beyond the landing envelope', () => {
    const result = classifyContact({
      airborne: false,
      impact: null,
      onPad: true,
      gearDown: true,
      vy: 0,
      groundSpeed: 18,
      pitch: 0,
      roll: 0,
      upY: 1,
      obstacle: false,
      surface: 'land',
      surfaceNormalY: Math.cos(0.8),
    })
    expect(result).toBe('crash')
  })

  it('crashes airfield obstacle hits', () => {
    const result = classifyContact({
      airborne: true,
      impact: null,
      onPad: false,
      gearDown: true,
      vy: 0,
      groundSpeed: 30,
      pitch: 0,
      roll: 0,
      upY: 1,
      obstacle: true,
      surface: 'land',
    })
    expect(result).toBe('crash')
    expect(classifyContactOutcome({
      airborne: true,
      impact: null,
      onPad: false,
      gearDown: true,
      vy: 0,
      groundSpeed: 30,
      pitch: 0,
      roll: 0,
      upY: 1,
      obstacle: true,
      surface: 'land',
    })).toEqual({ result: 'crash', reason: 'obstacle' })
  })

  it('fills a caller-owned outcome record without allocating a replacement', () => {
    const input = {
      airborne: false,
      impact: null,
      onPad: false,
      gearDown: true,
      vy: 0,
      groundSpeed: 0,
      pitch: 0,
      roll: 0,
      upY: 1,
      obstacle: false,
      surface: 'land' as const,
      surfaceNormalY: 1,
    }
    const outcome = { result: 'crash' as const, reason: 'obstacle' as const }
    expect(classifyContactOutcomeInto(input, outcome)).toBe(outcome)
    expect(outcome).toEqual({ result: 'air', reason: null })
  })

  it('reports finite impact reasons instead of collapsing every failure to crash', () => {
    const base = {
      airborne: true,
      impact: impact({}),
      onPad: true,
      gearDown: true,
      vy: -2,
      groundSpeed: 40,
      pitch: 0,
      roll: 0,
      upY: 1,
      obstacle: false,
      surface: 'land' as const,
    }
    expect(classifyContactOutcome({ ...base, pitch: Math.PI / 3 }).reason).toBe('pitch')
    expect(classifyContactOutcome({ ...base, roll: Math.PI / 3 }).reason).toBe('bank')
    expect(classifyContactOutcome({
      ...base,
      impact: impact({ surfaceNormal: new Vector3(0, 0.8, 0.6) }),
    }).reason).toBe('slope')
    expect(classifyContactOutcome({ ...base, vy: -30, impact: impact({ verticalVelocity: -30 }) }).reason)
      .toBe('vertical-speed')
    expect(contactFailureLabel('gear')).toBe('GEAR UP')
    expect(contactFailureLabel('overspeed')).toBe('OVERSPEED')
    expect(contactFailureLabel(null)).toBe('IMPACT')
  })

  it('fails closed on malformed impact scalars and normals', () => {
    const result = classifyContactOutcome({
      airborne: true,
      impact: impact({
        surface: 'land',
        surfaceNormal: { x: Number.NaN, y: Number.NaN, z: Number.NaN } as Vector3,
        normalVelocity: Number.NaN,
        verticalVelocity: Number.NaN,
        tangentialSpeed: Number.NaN,
        gearDown: 'yes' as unknown as boolean,
      }),
      onPad: true,
      gearDown: true,
      vy: -2,
      groundSpeed: 40,
      pitch: 0,
      roll: 0,
      upY: 1,
      obstacle: false,
      surface: 'land',
      surfaceNormalY: 1,
    })
    expect(result).toEqual({ result: 'crash', reason: 'gear' })
  })

  it('fails closed on malformed contact attitude and pad state', () => {
    const base = {
      airborne: true,
      impact: null,
      onPad: true,
      gearDown: true,
      vy: -1,
      groundSpeed: 18,
      pitch: 0,
      roll: 0,
      upY: 1,
      obstacle: false,
      surface: 'land' as const,
      surfaceNormalY: 1,
    }

    expect(classifyContactOutcome({ ...base, pitch: Number.NaN })).toEqual({
      result: 'crash', reason: 'pitch',
    })
    expect(classifyContactOutcome({ ...base, roll: Number.POSITIVE_INFINITY })).toEqual({
      result: 'crash', reason: 'bank',
    })
    expect(classifyContactOutcome({ ...base, upY: 2 })).toEqual({
      result: 'crash', reason: 'attitude',
    })
    expect(classifyContactOutcome({ ...base, onPad: 'yes' as unknown as boolean })).toEqual({
      result: 'air', reason: null,
    })
  })
})

describe('impact quaternion helper sanity', () => {
  it('keeps identity upright', () => {
    const q = new Quaternion()
    expect(q.w).toBeCloseTo(1)
  })

  it('fills the collision attitude record in place', () => {
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4)
    const state = { pitch: 0, roll: 0, upY: 0 }
    expect(attitudeInto(state, q)).toBe(state)
    expect(state.upY).toBeCloseTo(1)
  })
})

describe('collision query budget', () => {
  it('skips the rich surface query for a high airborne jet', () => {
    let surfaceSamples = 0
    let heightSamples = 0
    setGroundHeightSampler((_x, _z) => {
      heightSamples++
      return 0
    })
    setGroundSurfaceSampler((_x, _z, out) => {
      surfaceSamples++
      out.height = 0
      out.kind = 'land'
      return true
    })
    const aircraft = new Aircraft()
    aircraft.position.set(0, 1000, 0)
    aircraft.velocity.set(0, 0, 120)
    heightSamples = 0

    expect(new CollisionSystem().check(aircraft)).toBe('air')
    expect(surfaceSamples).toBe(0)
    // FlightModel's grounded probe is reused by CollisionSystem's near-ground
    // envelope check instead of sampling the same point twice.
    expect(heightSamples).toBe(1)
  })

  it('skips horizontal-speed math for a high airborne jet', () => {
    setGroundHeightSampler(() => 0)
    const aircraft = new Aircraft()
    aircraft.position.set(0, 1000, 0)
    aircraft.velocity.set(120, 40, 260)

    const originalHypot = Math.hypot
    let hypotCalls = 0
    Math.hypot = ((...values: number[]) => {
      hypotCalls++
      return originalHypot(...values)
    }) as typeof Math.hypot
    try {
      expect(new CollisionSystem().check(aircraft)).toBe('air')
      expect(hypotCalls).toBe(0)
    } finally {
      Math.hypot = originalHypot
    }
  })

  it('trusts the resolved impact surface without sampling it again', () => {
    let surfaceSamples = 0
    setGroundSurfaceSampler((_x, _z, out) => {
      surfaceSamples++
      out.height = 0
      out.kind = 'land'
      return true
    })
    const aircraft = new Aircraft()
    aircraft.position.set(0, 1.4, 0)
    aircraft.impact = impact({ surface: 'water' })

    const collision = new CollisionSystem()
    expect(collision.check(aircraft)).toBe('ditch')
    expect(collision.failureReason).toBe('water')
    expect(surfaceSamples).toBe(0)
  })

  it('short-circuits collision checks after a crash', () => {
    let heightSamples = 0
    setGroundHeightSampler(() => {
      heightSamples++
      return 0
    })
    const aircraft = new Aircraft()
    aircraft.crash()
    const afterCrash = heightSamples

    expect(new CollisionSystem().check(aircraft)).toBe('crash')
    expect(heightSamples).toBe(afterCrash)
  })
})
