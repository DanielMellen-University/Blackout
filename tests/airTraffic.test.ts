import { Group, InstancedMesh } from 'three'
import { describe, expect, it } from 'vitest'
import {
  AIR_TRAFFIC_COUNT,
  AIR_TRAFFIC_UPDATE_INTERVAL_SEC,
  AirTrafficSystem,
  trafficCellFor,
  trafficAlertSide,
  trafficAlertVertical,
  trafficInRange,
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
    traffic.setRenderQuality('low')
    expect(traffic.count).toBe(3)
    traffic.setRenderQuality('high')
    expect(traffic.count).toBe(AIR_TRAFFIC_COUNT)
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
    expect(traffic.getRadarLandmarks(5_000, 5_000, 8_000)).toHaveLength(3)
    traffic.dispose()
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
})
