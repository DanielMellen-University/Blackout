import { afterEach, describe, expect, it } from 'vitest'
import { setWorldSeed } from '../src/world/noise'
import { biomeColor, clearOpsPad, INLAND_WATER_LEVEL, sampleClimate } from '../src/world/terrainSample'

describe('continuous terrain generation', () => {
  afterEach(clearOpsPad)

  it('only labels submerged basins as inland water across seeds and distant coordinates', () => {
    clearOpsPad()
    let water = 0
    for (const seed of [1, 2, 1337]) {
      setWorldSeed(seed)
      for (let i = -40; i <= 40; i++) for (let j = -20; j <= 20; j++) {
        const climate = sampleClimate(i * 427, j * 619)
        expect(Number.isFinite(climate.height)).toBe(true)
        if (climate.biome === 'water') {
          water++
          expect(climate.height).toBeLessThanOrEqual(climate.waterLevel ?? INLAND_WATER_LEVEL)
        }
      }
    }
    expect(water).toBeGreaterThan(0)
  })

  it('remains deterministic when returning to a seed at far coordinates', () => {
    clearOpsPad()
    setWorldSeed(73)
    const before = sampleClimate(-120032.5, 308467.25)
    setWorldSeed(92)
    sampleClimate(-120032.5, 308467.25)
    setWorldSeed(73)
    expect(sampleClimate(-120032.5, 308467.25)).toEqual(before)
  })

  it('keeps exposed alpine rock darker than the surrounding snowfield', () => {
    const clean = biomeColor('snow', 3200, .2, 240, -480, undefined, 0, 1, 'snow', 0,
      undefined, { ridge: 0, alpineValley: 0, plateau: 0, caldera: 0 })
    const exposed = biomeColor('snow', 3200, .2, 240, -480, undefined, 0, 1, 'snow', 0,
      undefined, { ridge: 1, alpineValley: 0, plateau: 0, caldera: 1 })
    expect(exposed[0]).toBeLessThan(clean[0])
    expect(exposed[1]).toBeLessThan(clean[1])
    expect(exposed.every(channel => channel >= 0 && channel <= 1)).toBe(true)
  })

  it('keeps alpine valleys cool and visibly deeper than flat snow', () => {
    const flat = biomeColor('snow', 3200, .2, 240, -480, undefined, 0, 1, 'snow', 0,
      undefined, { ridge: 0, alpineValley: 0, plateau: 0, caldera: 0 })
    const valley = biomeColor('snow', 3200, .2, 240, -480, undefined, 0, 1, 'snow', 0,
      undefined, { ridge: 0, alpineValley: 1, plateau: 0, caldera: 0 })
    expect(valley[0]).toBeLessThan(flat[0])
    expect(valley[2] - valley[0]).toBeGreaterThan(flat[2] - flat[0])
  })

  it('keeps volcanic rock darker and warmer than a generic mountain face', () => {
    const volcanic = biomeColor('volcanic', 2200, .2, -92800, -13600, undefined, 0, 1, 'volcanic', 0,
      undefined, { ridge: .4, alpineValley: 0, plateau: 0, caldera: .25 })
    const mountain = biomeColor('mountain', 2200, .2, -92800, -13600, undefined, 0, 1, 'mountain', 0,
      undefined, { ridge: .4, alpineValley: 0, plateau: 0, caldera: 0 })
    expect(volcanic[0] + volcanic[1] + volcanic[2]).toBeLessThan(mountain[0] + mountain[1] + mountain[2])
    expect(volcanic[0] - volcanic[2]).toBeGreaterThan(mountain[0] - mountain[2])
  })

  it('adds deterministic multi-scale breakup to prop-free lowlands', () => {
    const samples = [-1200, -480, 0, 520, 1200].map(x => biomeColor(
      'plains', 120, .48, x, 640, undefined, 0, 1, 'plains', 0,
    ))
    const replay = biomeColor('plains', 120, .48, 520, 640, undefined, 0, 1, 'plains', 0)
    expect(replay).toEqual(samples[3])
    const green = samples.map(color => color[1])
    expect(Math.max(...green) - Math.min(...green)).toBeGreaterThan(.01)
  })

  it('adds bounded ash and fissure variation to volcanic ground', () => {
    const samples = [-1200, -480, 0, 520, 1200].map(x => biomeColor(
      'volcanic', 900, .3, x, 640, undefined, 0, 1, 'volcanic', 0,
      undefined, { ridge: .4, alpineValley: .1, plateau: 0, caldera: .15 },
    ))
    expect(new Set(samples.map(color => color.map(channel => channel.toFixed(4)).join(','))).size)
      .toBeGreaterThan(2)
    expect(samples.flat().every(channel => channel >= 0 && channel <= 1)).toBe(true)
  })

  it('keeps volcanic caldera accents visibly warmer than cooled ash', () => {
    const ash = biomeColor('volcanic', 900, .3, 240, -480, undefined, 0, 1, 'volcanic', 0,
      undefined, { ridge: .4, alpineValley: .1, plateau: 0, caldera: 0 })
    const caldera = biomeColor('volcanic', 900, .3, 240, -480, undefined, 0, 1, 'volcanic', 0,
      undefined, { ridge: .4, alpineValley: .1, plateau: 0, caldera: 1 })
    expect(caldera[0] - caldera[1]).toBeGreaterThan(ash[0] - ash[1])
  })

  it('gives exposed water beds feature-aware sediment variation', () => {
    const river = biomeColor('water', 40, .6, 240, -480,
      { river: 1, lake: 0, ravine: 0, pond: 0, stream: 1 }, 0, .2)
    const pond = biomeColor('water', 40, .6, 240, -480,
      { river: 0, lake: 0, ravine: 0, pond: 1, stream: 0 }, 0, .2)
    const delta = biomeColor('water', 40, .6, 240, -480,
      { river: 1, lake: 0, ravine: 0, pond: 0, stream: 0 }, 1, .2)
    expect(river).not.toEqual(pond)
    expect(delta[0]).toBeGreaterThan(river[0])
    expect([...river, ...pond].every(channel => channel >= 0 && channel <= 1)).toBe(true)
  })

  it('adds a soft wet-silt tint around inland shore features', () => {
    const dry = biomeColor('plains', 40, .6, 240, -480,
      { river: 0, lake: 0, ravine: 0, pond: 0, stream: 0 }, 0, 1)
    const shore = biomeColor('plains', 40, .6, 240, -480,
      { river: 0, lake: .72, ravine: 0, pond: 0, stream: 0 }, 0, 1)
    expect(shore[0]).toBeGreaterThan(dry[0])
    expect(shore[2]).toBeGreaterThan(dry[2])
    expect(shore.every(channel => channel >= 0 && channel <= 1)).toBe(true)
  })
})
