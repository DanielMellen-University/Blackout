import { afterEach, describe, expect, it } from 'vitest'
import { getWorldSeed, setWorldSeed } from '../src/world/noise'
import { getTerrainProfile, setTerrainProfile } from '../src/world/TerrainProfile'
import { clearOpsPad, getOpsPad, setOpsPad } from '../src/world/terrainSample'
import {
  chooseOperationEnergy,
  chooseOperationRoute,
  closeOperationFlight,
  holdOperationPresentation,
  openOperationFlight,
  operationFlightPose,
  operationFlightTranscript,
  stepOperationFlight,
  type OperationFlight,
} from '../src/systems/operation/flight'
import { lateralForSeed } from '../src/systems/operation/gates'
import { stageAltitude } from '../src/systems/operation/bands'
import { OPERATION_TERRAIN } from '../src/systems/operation/terrain'
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
  holdOperationPresentation(null)
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

  it('reports the live pose and drops it when the flight closes', () => {
    const flight = open(42)
    const pose = operationFlightPose(flight)
    expect(pose).not.toBeNull()
    expect(pose!.x).toBeCloseTo(lateralForSeed(42))
    expect(pose!.y).toBeCloseTo(stageAltitude('ingress', null, null))
    expect(pose!.z).toBeCloseTo(-200)
    stepOperationFlight(flight, 1)
    const moved = operationFlightPose(flight)
    expect(moved!.z).toBeGreaterThan(pose!.z)
    expect(moved!.z).toBeCloseTo(flight.live!.z)
    closeOperationFlight(flight)
    expect(operationFlightPose(flight)).toBeNull()
  })

  it('keeps the operation world while a presentation is held', () => {
    const seed = getWorldSeed()
    const profile = getTerrainProfile()
    setWorldSeed(99)
    setOpsPad(4, 5, 6, 0.2)
    try {
      holdOperationPresentation(42)
      const flight = open(42)
      stepOperationFlight(flight, 2)
      expect(getWorldSeed()).toBe(42)
      expect(getTerrainProfile()).toBe(OPERATION_TERRAIN)
      expect(getOpsPad()).toBeNull()
      holdOperationPresentation(null)
      expect(getWorldSeed()).toBe(99)
      expect(getTerrainProfile()).toBe(profile)
      expect(getOpsPad()).toEqual({ x: 4, z: 5, y: 6, yaw: 0.2 })
    } finally {
      holdOperationPresentation(null)
      setWorldSeed(seed)
      setTerrainProfile(profile)
      clearOpsPad()
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

  it('enters egress after conserve', () => {
    const flight = open()
    stepOperationFlight(flight, 100_000)
    chooseOperationRoute(flight, 'valley')
    stepOperationFlight(flight, 100_000)
    expect(chooseOperationEnergy(flight, 'conserve').ok).toBe(true)
    expect(flight.attempt.phase).toBe('egress')
  })

  it('enters egress after commit', () => {
    const flight = open()
    stepOperationFlight(flight, 100_000)
    chooseOperationRoute(flight, 'ridge')
    stepOperationFlight(flight, 100_000)
    expect(chooseOperationEnergy(flight, 'commit').ok).toBe(true)
    expect(flight.attempt.energy).toBe('commit')
  })

  it('stops a flight that runs out of steps without calling it a landing', () => {
    const flight = open(42, 2)
    stepOperationFlight(flight, 10)
    expect(flight.attempt.phase).toBe('failed')
    expect(flight.attempt.failure).not.toBe('complete')
    expect(operationFlightTranscript(flight)).toBeNull()
  })

  it('ignores steps and choices after close', () => {
    const flight = open()
    stepOperationFlight(flight, 1)
    closeOperationFlight(flight)
    closeOperationFlight(flight)
    stepOperationFlight(flight, 5)
    expect(flight.samples.ingress).toHaveLength(1)
    expect(chooseOperationRoute(flight, 'valley').ok).toBe(false)
  })

  it('matches the valley then conserve harness flight', () => {
    const measured = flyOperation(42, 'valley', 'conserve')
    const flight = flyChoices('valley', 'conserve')
    expect(flight.attempt.phase).toBe('complete')
    expect(flight.attempt.score).toBe(measured.score)
    expect(flight.samples).toEqual(measured.samples)
  })

  it('matches the valley then commit harness flight', () => {
    const measured = flyOperation(42, 'valley', 'commit')
    const flight = flyChoices('valley', 'commit')
    expect(flight.attempt.score).toBe(measured.score)
    expect(flight.samples.egress.at(-1)?.speed).toBe(measured.samples.egress.at(-1)?.speed)
  })

  it('matches the ridge then conserve harness flight', () => {
    const measured = flyOperation(42, 'ridge', 'conserve')
    const flight = flyChoices('ridge', 'conserve')
    expect(flight.attempt.score).toBe(measured.score)
    expect(flight.attempt.phase).toBe('complete')
  })

  it('matches the ridge then commit harness flight', () => {
    const measured = flyOperation(42, 'ridge', 'commit')
    const flight = flyChoices('ridge', 'commit')
    expect(flight.attempt.score).toBe(measured.score)
    expect(flight.samples.transit.some(sample => sample.clearance > 160)).toBe(true)
  })

  it('builds a transcript that replays to the same score', () => {
    const flight = flyChoices('valley', 'commit')
    const transcript = operationFlightTranscript(flight)
    expect(transcript).not.toBeNull()
    const replayed = replayOperation(transcript!)
    expect(replayed.ok).toBe(true)
    expect(replayed.attempt.score).toBe(flight.attempt.score)
    expect(replayed.attempt.phase).toBe('complete')
  })

  it('keeps captured sample time increasing across all three stages', () => {
    const transcript = operationFlightTranscript(flyChoices('valley', 'commit'))!
    const samples = [...transcript.samples.ingress, ...transcript.samples.transit, ...transcript.samples.egress]
    expect(samples.length).toBeGreaterThan(3)
    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index]!.t).toBeGreaterThan(samples[index - 1]!.t)
    }
    expect(transcript.samples.ingress.at(-1)!.t).toBeLessThan(transcript.samples.transit[0]!.t)
    expect(transcript.samples.transit.at(-1)!.t).toBeLessThan(transcript.samples.egress[0]!.t)
  })

  it('withholds a transcript until the run is complete', () => {
    const flight = open()
    stepOperationFlight(flight, 100_000)
    expect(operationFlightTranscript(flight)).toBeNull()
  })

  it('flies the valley lower than the ridge', () => {
    const valley = flyChoices('valley', 'conserve')
    const ridge = flyChoices('ridge', 'conserve')
    const low = Math.min(...valley.samples.transit.map(sample => sample.clearance))
    const high = Math.min(...ridge.samples.transit.map(sample => sample.clearance))
    expect(low).toBeLessThan(high)
    expect(valley.attempt.phase).toBe('complete')
    expect(ridge.attempt.phase).toBe('complete')
  })

  it('follows the stick instead of the model pilot', () => {
    const flown = open()
    const model = open()
    const noseUp = { pitch: 1, roll: 0, yaw: 0, throttle: 0.9, boost: false, airbrake: false }
    stepOperationFlight(flown, 40, noseUp)
    stepOperationFlight(model, 40)
    expect(flown.live!.y).toBeGreaterThan(model.live!.y + 5)
    expect(flown.samples.ingress[0]?.fuel).toBeLessThan(100)
    expect(flown.samples.ingress.every(sample => sample.airborne)).toBe(true)
  })
})
