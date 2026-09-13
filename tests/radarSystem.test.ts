import { describe, expect, it } from 'vitest'
import {
  MAX_RADAR_CONTACTS,
  RADAR_RANGE_METERS,
  RadarSystem,
  radarBearingArrow,
  radarDistanceLabel,
} from '../src/systems/RadarSystem'

describe('arcade radar sweep', () => {
  it('keeps the gate first and sorts landmark contacts by tier and range', () => {
    const radar = new RadarSystem()
    const contacts = radar.update(0, 0, 0, { x: 0, y: 100, z: 1000 }, [
      { x: 500, y: 0, z: 200, kind: 'village' },
      { x: 300, y: 0, z: 300, kind: 'city' },
    ])
    expect(contacts.map(contact => contact.kind)).toEqual(['gate', 'city', 'village'])
    expect(contacts[0]!.distance).toBe(1000)
    expect(contacts[0]!.bearing).toBe(0)
  })

  it('caps contacts and ignores distant or malformed positions', () => {
    const radar = new RadarSystem()
    const landmarks = Array.from({ length: MAX_RADAR_CONTACTS + 3 }, (_, index) => ({
      x: index * 100,
      y: 0,
      z: 100,
      kind: 'village' as const,
    }))
    landmarks.push({ x: Number.NaN, y: 0, z: Number.POSITIVE_INFINITY, kind: 'city' })
    const contacts = radar.update(Number.NaN, Number.NaN, Number.NaN, null, landmarks)
    expect(contacts).toHaveLength(MAX_RADAR_CONTACTS)
    expect(contacts.every(contact => contact.distance <= RADAR_RANGE_METERS)).toBe(true)
    expect(contacts.every(contact => Number.isFinite(contact.bearing))).toBe(true)
  })

  it('keeps compact direction and range labels', () => {
    expect(radarBearingArrow(0)).toBe('↑')
    expect(radarBearingArrow(Math.PI / 2)).toBe('→')
    expect(radarBearingArrow(-Math.PI / 2)).toBe('←')
    expect(radarDistanceLabel(420)).toBe('420M')
    expect(radarDistanceLabel(4200)).toBe('4.2K')
  })
})
