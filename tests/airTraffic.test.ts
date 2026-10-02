import { Group, InstancedMesh } from 'three'
import { describe, expect, it, vi } from 'vitest'
import {
  AIR_TRAFFIC_BEACON_COUNT,
  AIR_TRAFFIC_COUNT,
  AIR_TRAFFIC_UPDATE_INTERVAL_SEC,
  AirTrafficSystem,
  trafficCellFor,
  trafficAlertSide,
  trafficAlertVertical,
  trafficBeaconVisible,
  trafficConflictDistance,
  trafficInRange,
  trafficRadarInRange,
} from '../src/world/AirTrafficSystem'

function trafficMatrices(seed: number): number[] {
  const parent = new Group()
  const traffic = new AirTrafficSystem(parent)
  traffic.reset(seed, 5_000, 0, 5_000)
  traffic.update(5_000, 5_000, AIR_TRAFFIC_UPDATE_INTERVAL_SEC)
  const mesh = parent.getObjectByName('AirTrafficSilhouettes') as InstancedMesh
  const matrices = Array.from(mesh.instanceMatrix.array)
  traffic.dispose()
  return matrices
}

describe('bounded air traffic', () => {
  it('uses finite cell and visibility helpers', () => {
    expect(trafficCellFor(Number.NaN)).toBe(0)
    expect(trafficCellFor(-1)).toBe(-1)
    expect(trafficCellFor(10_000)).toBe(1)
    expect(trafficInRange(900)).toBe(true)
    expect(trafficInRange(8_000)).toBe(true)
    expect(trafficInRange(899)).toBe(false)
    expect(trafficInRange(Number.POSITIVE_INFINITY)).toBe(false)
  })

  it('keeps seeded silhouettes deterministic and quality bounded', () => {
    const first = trafficMatrices(1234)
    const second = trafficMatrices(1234)
    const different = trafficMatrices(9876)
    expect(first).toEqual(second)
    expect(different).not.toEqual(first)

    const parent = new Group()
    const traffic = new AirTrafficSystem(parent)
    expect(traffic.count).toBe(AIR_TRAFFIC_COUNT)
    const contrails = parent.getObjectByName('AirTrafficContrails') as InstancedMesh
    expect(contrails.count).toBe(AIR_TRAFFIC_COUNT)
    const beacons = parent.getObjectByName('AirTrafficBeacons') as InstancedMesh
    expect(beacons.count).toBe(AIR_TRAFFIC_BEACON_COUNT)
    traffic.setRenderQuality('low')
    expect(traffic.count).toBe(3)
    expect(contrails.count).toBe(0)
    expect(beacons.count).toBe(0)
    traffic.setRenderQuality('balanced')
    expect(contrails.count).toBe(5)
    expect(beacons.count).toBe(5)
    traffic.setRenderQuality('high')
    expect(traffic.count).toBe(AIR_TRAFFIC_COUNT)
    expect(contrails.count).toBe(AIR_TRAFFIC_COUNT)
    expect(beacons.count).toBe(AIR_TRAFFIC_BEACON_COUNT)
    traffic.dispose()
  })

  it('fails closed to Balanced for malformed quality requests', () => {
    const parent = new Group()
    const traffic = new AirTrafficSystem(parent)
    const contrails = parent.getObjectByName('AirTrafficContrails') as InstancedMesh
    const beacons = parent.getObjectByName('AirTrafficBeacons') as InstancedMesh
    traffic.setRenderQuality('ultra' as never)
    expect(traffic.count).toBe(5)
    expect(contrails.count).toBe(5)
    expect(beacons.count).toBe(5)
    traffic.setRenderQuality('invalid' as never)
    expect(traffic.count).toBe(5)
    traffic.dispose()
  })

  it('exposes nearby traffic through a pooled radar snapshot', () => {
    const parent = new Group()
    const traffic = new AirTrafficSystem(parent)
    traffic.reset(1234, 5_000, 0, 5_000)
    const contacts = traffic.getRadarLandmarks(5_000, 5_000, 8_000)
    expect(contacts).toHaveLength(AIR_TRAFFIC_COUNT)
    expect(contacts.every(contact => contact.kind === 'traffic')).toBe(true)
    expect(new Set(contacts.map(contact => contact.id)).size).toBe(AIR_TRAFFIC_COUNT)
    traffic.setRenderQuality('low')
    // Low quality trims only visual instances. Radar and traffic contracts
    // retain the same deterministic contact pool for gameplay parity.
    expect(traffic.getRadarLandmarks(5_000, 5_000, 8_000)).toHaveLength(AIR_TRAFFIC_COUNT)
    traffic.dispose()
  })

  it('keeps close traffic on radar while the visual silhouette fades out', () => {
    expect(trafficRadarInRange(0, 8_000)).toBe(true)
    expect(trafficRadarInRange(899, 8_000)).toBe(true)
    expect(trafficRadarInRange(8_001, 8_000)).toBe(false)

    const parent = new Group()
    const traffic = new AirTrafficSystem(parent)
    traffic.reset(1234, 5_000, 0, 5_000)
    const contact = traffic.getRadarLandmarks(5_000, 5_000, 8_000)[0]!
    expect(traffic.getRadarLandmarks(contact.x, contact.z, 32)).toContain(contact)
    traffic.dispose()
  })

  it('ranks traffic conflicts by bounded three-dimensional separation', () => {
    expect(trafficConflictDistance(200, 50)).toBeCloseTo(Math.hypot(200, 50))
    expect(trafficConflictDistance(100, 500)).toBeGreaterThan(trafficConflictDistance(200, 50))
    expect(trafficConflictDistance(Number.NaN, Number.NaN)).toBe(0)
  })

  it('returns a finite nearest-flight alert and safe direction cue', () => {
    const parent = new Group()
    const traffic = new AirTrafficSystem(parent)
    traffic.reset(1234, 5_000, 0, 5_000)
    const contact = traffic.getRadarLandmarks(5_000, 5_000, 8_000)[0]!
    const alert = traffic.closestAlert(contact.x, contact.y, contact.z, 0)
    expect(alert?.id).toBe(contact.id)
    expect(alert?.distance).toBe(0)
    expect(alert?.verticalOffset).toBe(0)
    expect(alert?.verticalSeparation).toBe(0)
    expect(Number.isFinite(alert?.bearing)).toBe(true)
    expect(trafficAlertSide(Number.NaN)).toBe('AHEAD')
    expect(trafficAlertVertical(240)).toBe('ABOVE')
    expect(trafficAlertVertical(-240)).toBe('BELOW')
    expect(trafficAlertVertical(80)).toBe('LEVEL')
    expect(trafficAlertVertical(Number.NaN)).toBe('LEVEL')
    expect(traffic.closestAlert(contact.x, contact.y + 2_000, contact.z, 0)).toBeNull()
    traffic.dispose()
  })

  it('updates on a fixed cadence and recycles at cell boundaries', () => {
    const parent = new Group()
    const traffic = new AirTrafficSystem(parent)
    const initialRevision = traffic.updateRevision
    traffic.update(0, 0, AIR_TRAFFIC_UPDATE_INTERVAL_SEC / 2)
    expect(traffic.updateRevision).toBe(initialRevision)
    traffic.update(0, 0, AIR_TRAFFIC_UPDATE_INTERVAL_SEC / 2)
    expect(traffic.updateRevision).toBeGreaterThan(initialRevision)
    const cellRevision = traffic.updateRevision
    traffic.update(10_001, 0, 0)
    expect(traffic.updateRevision).toBeGreaterThan(cellRevision)
    expect(() => traffic.update(Number.NaN, Number.NaN, Number.NaN)).not.toThrow()
    traffic.dispose()
  })

  it('suspends hidden traffic work and refreshes when shown again', () => {
    const parent = new Group()
    const traffic = new AirTrafficSystem(parent)
    traffic.setVisible(false)
    const pausedRevision = traffic.updateRevision
    traffic.update(8_000, 8_000, AIR_TRAFFIC_UPDATE_INTERVAL_SEC * 4)
    expect(traffic.updateRevision).toBe(pausedRevision)

    traffic.setVisible(true)
    expect(traffic.updateRevision).toBeGreaterThan(pausedRevision)
    traffic.dispose()
  })

  it('keeps beacon blinking deterministic and finite', () => {
    expect(trafficBeaconVisible(1.25, 2)).toBe(trafficBeaconVisible(1.25, 2))
    expect(trafficBeaconVisible(Number.NaN, 2)).toBe(false)
    expect(trafficBeaconVisible(1.25, -1)).toBe(false)
  })

  it('makes traffic teardown idempotent and ignores late stream updates', () => {
    const parent = new Group()
    const traffic = new AirTrafficSystem(parent)
    const mesh = parent.getObjectByName('AirTrafficSilhouettes') as InstancedMesh
    const geometryDispose = vi.spyOn(mesh.geometry, 'dispose')
    traffic.dispose()
    expect(parent.getObjectByName('AirTraffic')).toBeUndefined()
    expect(() => traffic.dispose()).not.toThrow()
    expect(() => traffic.reset(42, 0, 0, 0)).not.toThrow()
    expect(() => traffic.update(0, 0, 1)).not.toThrow()
    expect(traffic.getRadarLandmarks(0, 0, 10_000)).toHaveLength(0)
    expect(traffic.closestAlert(0, 0, 0, 0)).toBeNull()
    expect(traffic.count).toBe(0)
    expect(geometryDispose).toHaveBeenCalledOnce()
  })
})
