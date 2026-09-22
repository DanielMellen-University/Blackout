import { describe, expect, it } from 'vitest'
import {
  MAX_RADAR_CONTACTS,
  RADAR_RANGE_METERS,
  RADAR_UPDATE_INTERVAL_MS,
  RadarSystem,
  radarUpdateDue,
  type RadarLandmark,
  radarBearingArrow,
  radarDistanceLabel,
} from '../src/systems/RadarSystem'

describe('arcade radar sweep', () => {
  it('keeps the sweep cadence finite and immediately due after reset', () => {
    expect(RADAR_UPDATE_INTERVAL_MS).toBe(100)
    expect(radarUpdateDue(0, Number.NaN)).toBe(true)
    expect(radarUpdateDue(99, 100)).toBe(false)
    expect(radarUpdateDue(100, 100)).toBe(true)
    expect(radarUpdateDue(Number.NaN, 100)).toBe(true)
  })

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

  it('keeps traffic below settlements and out of destination cycling', () => {
    const radar = new RadarSystem()
    const contacts = radar.update(0, 0, 0, null, [
      { x: 300, y: 0, z: 0, kind: 'city', id: 'city-1' },
    ], [
      { x: 100, y: 600, z: 0, kind: 'traffic', id: 'traffic-1' },
    ])
    expect(contacts.map(contact => contact.kind)).toEqual(['city', 'traffic'])
    expect(contacts[1]!.label).toBe('TRAFFIC')
    expect(radar.cycleTarget()?.id).toBe('city-1')
    expect(radar.cycleTarget()?.id).toBe('city-1')
  })

  it('carries signed vertical separation for traffic markers', () => {
    const radar = new RadarSystem()
    const contacts = radar.update(0, 0, 0, null, [], [
      { x: 100, y: 600, z: 0, kind: 'traffic', id: 'traffic-high' },
    ], 200)
    expect(contacts[0]?.vertical).toBe(400)
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

  it('keeps higher-tier and nearer contacts when source order is noisy', () => {
    const radar = new RadarSystem()
    const landmarks: RadarLandmark[] = Array.from({ length: MAX_RADAR_CONTACTS }, (_, index) => ({
      x: 7_000 + index * 20,
      y: 0,
      z: 0,
      kind: 'village' as const,
    }))
    landmarks.push({ x: 140, y: 0, z: 0, kind: 'city' as const })
    landmarks.push({ x: 80, y: 0, z: 0, kind: 'village' as const })
    const contacts = radar.update(0, 0, 0, null, landmarks)
    expect(contacts.some(contact => contact.kind === 'city' && contact.distance === 140)).toBe(true)
    expect(contacts.some(contact => contact.kind === 'village' && contact.distance === 80)).toBe(true)
    expect(contacts).toHaveLength(MAX_RADAR_CONTACTS)
  })

  it('trims the sweep on low quality and reduced-motion displays', () => {
    const radar = new RadarSystem()
    const landmarks = Array.from({ length: MAX_RADAR_CONTACTS }, (_, index) => ({
      x: index * 100,
      y: 0,
      z: 100,
      kind: 'village' as const,
    }))
    radar.setRenderQuality('low')
    expect(radar.update(0, 0, 0, null, landmarks)).toHaveLength(3)
    radar.setRenderQuality('balanced')
    radar.setReducedMotion(true)
    expect(radar.update(0, 0, 0, null, landmarks)).toHaveLength(4)
    radar.setReducedMotion(false)
    expect(radar.update(0, 0, 0, null, landmarks)).toHaveLength(MAX_RADAR_CONTACTS)
  })

  it('rejects malformed source positions instead of pinning a fake contact to the jet', () => {
    const radar = new RadarSystem()
    const contacts = radar.update(0, 0, 0, { x: Number.NaN, y: 100, z: Number.POSITIVE_INFINITY }, [
      { x: Number.NaN, y: 0, z: 100, kind: 'city' },
      { x: 0, y: 0, z: 500, kind: 'village' },
    ])
    expect(contacts).toHaveLength(1)
    expect(contacts[0]!.kind).toBe('village')
    expect(contacts[0]!.distance).toBe(500)
  })

  it('keeps compact direction and range labels', () => {
    expect(radarBearingArrow(0)).toBe('↑')
    expect(radarBearingArrow(Math.PI / 2)).toBe('→')
    expect(radarBearingArrow(-Math.PI / 2)).toBe('←')
    expect(radarBearingArrow(Math.PI)).toBe('↓')
    expect(radarBearingArrow(-Math.PI)).toBe('↓')
    expect(radarBearingArrow(Math.PI * .75)).toBe('↘')
    expect(radarBearingArrow(-Math.PI * .75)).toBe('↙')
    expect(radarDistanceLabel(420)).toBe('420M')
    expect(radarDistanceLabel(4200)).toBe('4.2K')
  })

  it('cycles only identified settlement contacts and retains world positions', () => {
    const radar = new RadarSystem()
    radar.update(0, 0, 0, { x: 0, y: 0, z: 600 }, [
      { x: 100, y: 40, z: 0, kind: 'city', id: 'city-1' },
      { x: 200, y: 80, z: 0, kind: 'village', id: 'village-1' },
    ])
    const first = radar.cycleTarget()
    expect(first?.id).toBe('city-1')
    expect(first?.x).toBe(100)
    expect(first?.y).toBe(40)
    expect(first?.z).toBe(0)
    expect(first?.selected).toBe(true)
    expect(radar.selectedTarget()?.id).toBe('city-1')

    const second = radar.cycleTarget()
    expect(second?.id).toBe('village-1')
    expect(radar.selectedTarget()?.kind).toBe('village')
    expect(radar.cycleTarget()?.id).toBe('city-1')
    radar.clearTarget()
    expect(radar.selectedTarget()).toBeNull()
  })

  it('clears a selected contact and emits one cue when it leaves range', () => {
    const radar = new RadarSystem()
    radar.update(0, 0, 0, null, [{ x: 0, y: 20, z: 600, kind: 'city', id: 'city-1' }])
    expect(radar.cycleTarget()?.id).toBe('city-1')
    radar.update(0, 0, 0, null, [])
    expect(radar.selectedTarget()).toBeNull()
    expect(radar.consumeLockLost()).toBe(true)
    expect(radar.consumeLockLost()).toBe(false)
  })

  it('retains the selected contact when crowded radar would otherwise evict it', () => {
    const radar = new RadarSystem()
    radar.setRenderQuality('low')
    radar.update(0, 0, 0, null, [{ x: 7_600, y: 20, z: 0, kind: 'city', id: 'city-target' }])
    expect(radar.cycleTarget()?.id).toBe('city-target')
    const crowded = Array.from({ length: 8 }, (_, index) => ({
      x: 100 + index * 40,
      y: 20,
      z: 0,
      kind: 'city' as const,
      id: `city-${index}`,
    }))
    crowded.push({ x: 7_600, y: 20, z: 0, kind: 'city', id: 'city-target' })
    radar.update(0, 0, 0, null, crowded)
    expect(radar.selectedTarget()?.id).toBe('city-target')
    expect(radar.consumeLockLost()).toBe(false)
  })
})
