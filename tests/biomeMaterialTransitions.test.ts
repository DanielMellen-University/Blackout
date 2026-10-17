import { readFileSync } from 'node:fs'
import { beforeEach, expect, it } from 'vitest'
import { biomeColor, biomeColorInto, type Biome } from '../src/world/terrainSample'
import { setWorldSeed } from '../src/world/noise'

const landform = { ridge: .6, alpineValley: .4, plateau: .7, caldera: .5, dunes: .8,
  badlands: .9, karst: .7, alluvial: .8, glacial: .7, foothills: .8 }
const features = { river: .6, lake: 0, pond: 0, stream: .7, ravine: .3 }
const pairs: [Biome, Biome][] = [['plains', 'snow'], ['mountain', 'snow'], ['plains', 'volcanic'],
  ['tundra', 'plains'], ['saltflat', 'desert'], ['savanna', 'swamp'], ['mesa', 'desert']]
beforeEach(() => setWorldSeed(1))

it.each(pairs)('fades %s/%s material effects through a dominant-biome switch', (a, b) => {
  const colors = [-.000001, .000001].map(d => biomeColor(d < 0 ? a : b, 1400, .5, 520, 640,
    features, 0, 1, d < 0 ? b : a, .499999, [[a, .5 - d], [b, .5 + d]], landform))
  expect(Math.max(...colors[0]!.map((v, i) => Math.abs(v - colors[1]![i]!)))).toBeLessThan(.00001)
  // The categorical label cannot alter a palette with identical full weights.
  const weights: [Biome, number][] = [[a, .5], [b, .5]]
  expect(biomeColor(a, 1400, .5, 520, 640, features, 0, 1, b, .5, weights, landform))
    .toEqual(biomeColor(b, 1400, .5, 520, 640, features, 0, 1, a, .5, weights, landform))
})

it.each(pairs)('also fades the two-biome %s/%s fallback without full weights', (a, b) => {
  const left = biomeColor(a, 1400, .5, 520, 640, features, 0, 1, b, .499999, undefined, landform)
  const right = biomeColor(b, 1400, .5, 520, 640, features, 0, 1, a, .499999, undefined, landform)
  expect(Math.max(...left.map((v, i) => Math.abs(v - right[i]!)))).toBeLessThan(.00001)
})

const pure = JSON.parse(readFileSync(new URL('./fixtures/biome-materials-10.919.json', import.meta.url), 'utf8')) as
  { biome: Biome; colors: number[][] }[]
it.each(pure)('preserves the independent 10.919 pure $biome material', ({ biome, colors }) => {
  for (const [i, x] of [-1600, 0, 520, 1500].entries()) {
    // Interleave an unrelated mixed sample to catch retained shared weights.
    biomeColor('snow', 2400, .2, 1, 2, features, 0, 1, 'volcanic', .2)
    const actual = biomeColor(biome, 1400, .5, x, 640, features, 0, 1, biome, 0, undefined, landform)
    for (let c = 0; c < 3; c++) expect(actual[c]).toBeCloseTo(colors[i]![c]!, 12)
    const out: [number, number, number] = [0, 0, 0]
    expect(biomeColorInto(out, biome, 1400, .5, x, 640, features, 0, 1, biome, 0,
      [[biome, 1]], landform)).toBe(out)
    for (let c = 0; c < 3; c++) expect(out[c]).toBeCloseTo(colors[i]![c]!, 12)
  }
})
