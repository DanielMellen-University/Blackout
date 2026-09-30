import { Quaternion, Vector3 } from 'three'
import { afterEach, describe, expect, it } from 'vitest'
import { Aircraft, type AircraftImpact } from '../src/aircraft/Aircraft'
import {
  attitudeInto,
  classifyContact,
  classifyContactOutcome,
  contactFailureLabel,
} from '../src/systems/Collision'
import { CollisionSystem } from '../src/systems/Collision'
import {
  setContactHeightSampler,
  setGroundHeightSampler,
  setGroundSurfaceSampler,
} from '../src/world/ground'

afterEach(() => {
  setContactHeightSampler(null)
  setGroundHeightSampler(null)
  setGroundSurfaceSampler(null)
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
