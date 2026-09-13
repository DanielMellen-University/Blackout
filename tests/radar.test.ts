import { describe, expect, it } from 'vitest'
import {
  radarDiscoveryLabel,
  radarDistanceLabel,
  RadarSystem,
} from '../src/systems/RadarSystem'

describe('radar exploration cues', () => {
  it('describes generated settlement contacts with their biome', () => {
    expect(radarDiscoveryLabel('city', 'rainforest')).toBe('CITY CONTACT · RAINFOREST TERRAIN')
    expect(radarDiscoveryLabel('village', 'saltflat')).toBe('VILLAGE CONTACT · SALTFLAT TERRAIN')
    expect(radarDiscoveryLabel('city', '<script>')).toBe('CITY CONTACT · UNKNOWN TERRAIN')
    expect(radarDiscoveryLabel('gate', 'plains')).toBe('')
  })

  it('carries stable landmark identity through pooled contacts', () => {
    const radar = new RadarSystem()
    const first = radar.update(0, 0, 0, null, [
      { x: 500, y: 0, z: 0, kind: 'city', id: 'city-1', biome: 'desert' },
    ])
    expect(first[0]?.id).toBe('city-1')
    expect(first[0]?.biome).toBe('desert')
    expect(first[0]?.distance).toBeCloseTo(500)

    const second = radar.update(0, 0, 0, null, [
      { x: 900, y: 0, z: 0, kind: 'village', id: 'village-2', biome: 'tundra' },
    ])
    expect(second[0]?.id).toBe('village-2')
    expect(second[0]?.biome).toBe('tundra')
    expect(radarDistanceLabel(second[0]?.distance ?? Number.NaN)).toBe('900M')
  })
})
