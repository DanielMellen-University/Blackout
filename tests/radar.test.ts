import { describe, expect, it } from 'vitest'
import {
  radarContactLabel,
  radarDiscoveryLabel,
  radarDistanceLabel,
  rememberRadarDiscovery,
  radarTargetArrivalLabel,
  radarTargetArrivalRadius,
  RadarSystem,
} from '../src/systems/RadarSystem'

describe('radar exploration cues', () => {
  it('describes generated settlement contacts with their biome', () => {
    expect(radarDiscoveryLabel('city', 'rainforest')).toBe('CITY CONTACT · RAINFOREST TERRAIN')
    expect(radarDiscoveryLabel('village', 'saltflat')).toBe('VILLAGE CONTACT · SALTFLAT TERRAIN')
    expect(radarDiscoveryLabel('city', '<script>')).toBe('CITY CONTACT · UNKNOWN TERRAIN')
    expect(radarDiscoveryLabel('city', 'desert', 'Dune Reach')).toBe('CITY CONTACT · DUNE REACH · DESERT TERRAIN')
    expect(radarDiscoveryLabel('gate', 'plains')).toBe('')
  })

  it('carries stable landmark identity through pooled contacts', () => {
    const radar = new RadarSystem()
    const first = radar.update(0, 0, 0, null, [
      { x: 500, y: 0, z: 0, kind: 'city', id: 'city-1', biome: 'desert' },
    ])
    expect(first[0]?.id).toBe('city-1')
    expect(first[0]?.biome).toBe('desert')
    expect(first[0]?.name).toBe('')
    expect(radarContactLabel('city', 'Dune Reach')).toBe('DUNE REACH')
    expect(radarContactLabel('city', '<script>')).toBe('SCRIPT')
    expect(first[0]?.distance).toBeCloseTo(500)

    const second = radar.update(0, 0, 0, null, [
      { x: 900, y: 0, z: 0, kind: 'village', id: 'village-2', biome: 'tundra' },
    ])
    expect(second[0]?.id).toBe('village-2')
    expect(second[0]?.biome).toBe('tundra')
    expect(radarDistanceLabel(second[0]?.distance ?? Number.NaN)).toBe('900M')
  })

  it('refreshes pooled normalized names when a streamed landmark changes', () => {
    const radar = new RadarSystem()
    const first = radar.update(0, 0, 0, null, [
      { x: 500, y: 0, z: 0, kind: 'city', id: 'city-1', name: 'Dune Reach' },
    ])
    expect(first[0]?.name).toBe('DUNE REACH')
    expect(first[0]?.label).toBe('DUNE REACH')
    const second = radar.update(0, 0, 0, null, [
      { x: 500, y: 0, z: 0, kind: 'city', id: 'city-1', name: 'Ash Port' },
    ])
    expect(second[0]?.name).toBe('ASH PORT')
    expect(second[0]?.label).toBe('ASH PORT')
  })

  it('gives settlement locks a bounded arrival envelope', () => {
    expect(radarTargetArrivalRadius('city')).toBeGreaterThan(radarTargetArrivalRadius('village'))
    expect(radarTargetArrivalRadius('village')).toBeGreaterThan(0)
    expect(radarTargetArrivalRadius('gate')).toBe(0)
    expect(radarTargetArrivalLabel('city')).toBe('CITY DESTINATION REACHED')
    expect(radarTargetArrivalLabel('village')).toBe('VILLAGE DESTINATION REACHED')
    expect(radarTargetArrivalLabel('gate')).toBe('')
  })

  it('bounds the discovery ledger for effectively unbounded worlds', () => {
    const seen = new Set<string>()
    const order: string[] = []
    expect(rememberRadarDiscovery(seen, order, 'village-1', 2)).toBe(true)
    expect(rememberRadarDiscovery(seen, order, 'village-1', 2)).toBe(false)
    expect(rememberRadarDiscovery(seen, order, 'city-2', 2)).toBe(true)
    expect(rememberRadarDiscovery(seen, order, 'village-3', 2)).toBe(true)
    expect(order).toEqual(['city-2', 'village-3'])
    expect(seen.has('village-1')).toBe(false)
    expect(rememberRadarDiscovery(seen, order, 'village-1', 2)).toBe(true)
    expect(rememberRadarDiscovery(seen, order, '', 2)).toBe(false)
    expect(rememberRadarDiscovery(seen, order, null, 2)).toBe(false)
  })

  it('fails closed when reduced-motion input is malformed', () => {
    const radar = new RadarSystem()
    radar.setRenderQuality('high')
    radar.setReducedMotion('true' as never)
    const contacts = radar.update(0, 0, 0, null, Array.from({ length: 6 }, (_, index) => ({
      x: 100 + index * 100,
      y: 0,
      z: 0,
      kind: 'village' as const,
      id: `village-${index}`,
    })))
    expect(contacts).toHaveLength(6)
  })
})
