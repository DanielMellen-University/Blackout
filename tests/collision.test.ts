import { Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import type { AircraftImpact } from '../src/aircraft/Aircraft'
import { classifyContact } from '../src/systems/Collision'

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
    expect(result).toBe('crash')
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
  })
})

describe('impact quaternion helper sanity', () => {
  it('keeps identity upright', () => {
    const q = new Quaternion()
    expect(q.w).toBeCloseTo(1)
  })
})
