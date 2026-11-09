import { Aircraft } from '../../aircraft/Aircraft'
import { sampleTerrainSurfaceHeightFast } from '../../world/terrainSample'
import type { FlightSample } from './samples'

/** One recorded point from the live aircraft, including the fuel and nitro it still holds. */
export function captureFlightSample(aircraft: Aircraft, time: number): FlightSample {
  const clearance = aircraft.position.y - sampleTerrainSurfaceHeightFast(aircraft.position.x, aircraft.position.z)
  return {
    t: time,
    x: aircraft.position.x,
    y: aircraft.position.y,
    z: aircraft.position.z,
    speed: aircraft.speed,
    clearance,
    airborne: aircraft.status === 'ok' && !aircraft.onGround,
    fuel: aircraft.fuel.remaining,
    nitro: aircraft.nitro.fraction,
  }
}
