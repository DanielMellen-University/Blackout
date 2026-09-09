import { afterEach, describe, expect, it } from 'vitest'
import { Aircraft } from '../src/aircraft/Aircraft'
import { flightConfig } from '../src/aircraft/flightConfig'
import { evaluateWarnings } from '../src/systems/FlightWarnings'
import { sampleGroundHeight, setContactHeightSampler } from '../src/world/ground'

describe('flight cautions', () => {
  afterEach(() => setContactHeightSampler(null))

  it('raises stall before other caution labels', () => {
    const aircraft = new Aircraft()
    aircraft.position.set(0, 10000, 0)
    aircraft.velocity.set(0, 0, flightConfig.minSpeed * 0.5)
    aircraft.controls.gearDown = false

    const warning = evaluateWarnings(aircraft, 9000)
    expect(warning.text).toBe('STALL')
    expect(warning.level).toBe('warning')
    expect(warning.stall).toBe(true)
  })

  it('raises low-altitude caution only while descending quickly', () => {
    const aircraft = new Aircraft()
    const ground = sampleGroundHeight(0, 0)
    aircraft.position.set(0, ground + 31 + flightConfig.bellyHeight, 0)
    aircraft.velocity.set(0, -10, 52)
    aircraft.controls.gearDown = false

    const warning = evaluateWarnings(aircraft, 31)
    expect(warning.text).toBe('LOW ALT')
    expect(warning.level).toBe('caution')
    expect(warning.lowAlt).toBe(true)

    aircraft.velocity.y = 0
    expect(evaluateWarnings(aircraft, 31).text).toBeNull()
  })
})
