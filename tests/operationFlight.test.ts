import { afterEach, describe, expect, it } from 'vitest'
import { getWorldSeed, setWorldSeed } from '../src/world/noise'
import { getTerrainProfile } from '../src/world/TerrainProfile'
import { clearOpsPad, getOpsPad, setOpsPad } from '../src/world/terrainSample'
import {
  chooseOperationEnergy,
  chooseOperationRoute,
  closeOperationFlight,
  openOperationFlight,
  operationFlightTranscript,
  stepOperationFlight,
  type OperationFlight,
} from '../src/systems/operation/flight'
import { flyOperation } from '../src/systems/operation/harness'
import { replayOperation } from '../src/systems/operation/replay'
import type { EnergyChoice, RouteChoice } from '../src/systems/operation/choices'

const openFlights: OperationFlight[] = []

function open(seed = 42, maxSteps?: number): OperationFlight {
  const flight = openOperationFlight(seed, maxSteps)
  openFlights.push(flight)
  return flight
}

afterEach(() => {
  for (const flight of openFlights) closeOperationFlight(flight)
  openFlights.length = 0
  clearOpsPad()
})

function flyChoices(route: RouteChoice, energy: EnergyChoice, seed = 42): OperationFlight {
  const flight = open(seed)
  stepOperationFlight(flight, 100_000)
  chooseOperationRoute(flight, route)
  stepOperationFlight(flight, 100_000)
  chooseOperationEnergy(flight, energy)
  stepOperationFlight(flight, 100_000)
  return flight
}

describe('operation flight', () => {
  it('restores the world seed, profile and pad after a step', () => {
    const seed = getWorldSeed()
    const profile = getTerrainProfile()
    setWorldSeed(99)
    setOpsPad(4, 5, 6, 0.2)
    try {
      const flight = open(42)
      stepOperationFlight(flight, 3)
      expect(getWorldSeed()).toBe(99)
      expect(getTerrainProfile()).toBe(profile)
      expect(getOpsPad()).toEqual({ x: 4, z: 5, y: 6, yaw: 0.2 })
    } finally {
      setWorldSeed(seed)
    }
  })

  it('records an airborne sample on the first step', () => {
    const flight = open()
    stepOperationFlight(flight, 1)
    expect(flight.samples.ingress).toHaveLength(1)
    expect(flight.live?.airborne).toBe(true)
    expect(flight.live?.t).toBeCloseTo(1 / 60)
    expect(flight.attempt.phase).toBe('ingress')
  })

  it('ignores an empty step budget', () => {
    const flight = open()
    stepOperationFlight(flight, 0)
    stepOperationFlight(flight, Number.NaN)
    expect(flight.samples.ingress).toHaveLength(0)
  })

  it('pauses after ingress for valley or ridge', () => {
    const flight = open()
    stepOperationFlight(flight, 100_000)
    expect(flight.attempt.phase).toBe('route-choice')
    expect(flight.samples.transit).toHaveLength(0)
    const before = flight.samples.ingress.length
    stepOperationFlight(flight, 10)
    expect(flight.samples.ingress).toHaveLength(before)
  })

  it('rejects a route before the choice is open', () => {
    const flight = open()
    stepOperationFlight(flight, 1)
    expect(chooseOperationRoute(flight, 'valley').ok).toBe(false)
    expect(flight.attempt.phase).toBe('ingress')
  })

  it('rejects an unknown route', () => {
    const flight = open()
    stepOperationFlight(flight, 100_000)
    expect(chooseOperationRoute(flight, 'coast').ok).toBe(false)
    expect(flight.attempt.route).toBeNull()
  })

  it('enters transit after valley', () => {
    const flight = open()
    stepOperationFlight(flight, 100_000)
    expect(chooseOperationRoute(flight, 'valley').ok).toBe(true)
    expect(flight.attempt.phase).toBe('transit')
    expect(flight.attempt.route).toBe('valley')
  })

  it('enters transit after ridge', () => {
    const flight = open()
    stepOperationFlight(flight, 100_000)
    expect(chooseOperationRoute(flight, 'ridge').ok).toBe(true)
    expect(flight.attempt.route).toBe('ridge')
  })

  it('pauses after transit for conserve or commit', () => {
    const flight = open()
    stepOperationFlight(flight, 100_000)
    chooseOperationRoute(flight, 'valley')
    stepOperationFlight(flight, 100_000)
    expect(flight.attempt.phase).toBe('energy-choice')
    expect(flight.samples.egress).toHaveLength(0)
    stepOperationFlight(flight, 5)
    expect(flight.attempt.phase).toBe('energy-choice')
  })

  it('rejects an unknown energy choice', () => {
    const flight = open()
    stepOperationFlight(flight, 100_000)
    chooseOperationRoute(flight, 'ridge')
    stepOperationFlight(flight, 100_000)
    expect(chooseOperationEnergy(flight, 'boost').ok).toBe(false)
    expect(flight.attempt.energy).toBeNull()
  })

})
