import { smoothstep } from './noise'
import { sampleLandforms } from './Landforms'
import { sampleHydrology } from './Hydrology'
import type { Biome, Climate } from './terrainSample'

/** Landform and drainage fields meet here; water rendering is independent. */
export function sampleGeography(x: number, z: number): Climate {
  const landform = sampleLandforms(x, z)
  const { height, waterLevel, river, lake, pond, stream, coastal } = sampleHydrology(x, z, landform.height)
  const { moisture, temperature, cold, hot, dunes, badlands, volcanic, salt } = landform
  const alpine = smoothstep(650, 1900, height)
  const snow = smoothstep(2600 - cold * 1100 + hot * 700, 3600 - cold * 900 + hot * 700, height)
  const low = 1 - alpine
  const biomeWeights: [Biome, number][] = [
    ['plains', .65 * low * (1 - cold * .8)],
    ['hills', smoothstep(200, 450, height) * low * .65],
    ['forest', smoothstep(.35, .66, moisture) * low * (1 - hot * .55)],
    ['rainforest', smoothstep(.48, .76, moisture) * hot * low * 1.8],
    ['swamp', smoothstep(.55, .8, moisture) * Math.max(lake, river, coastal) * low * 1.6],
    ['desert', dunes * low * 2],
    ['mesa', badlands * (1 - alpine * .85) * 2],
    ['savanna', hot * (1 - smoothstep(.3, .58, moisture)) * low * 1.4],
    ['tundra', cold * low * 1.5],
    ['mountain', alpine * (1 - snow) * 2],
    ['snow', snow * 3],
    ['volcanic', volcanic * 4],
    ['saltflat', salt * 4],
  ]
  let biome: Biome = 'plains', biomeB: Biome = 'plains', best = 0, second = 0
  for (const [candidate, weight] of biomeWeights) {
    if (weight > best) { second = best; biomeB = biome; best = weight; biome = candidate }
    else if (weight > second) { second = weight; biomeB = candidate }
  }
  if (height < waterLevel) biome = biomeB = waterLevel <= 0 ? 'ocean' : 'water'
  return {
    height, waterLevel, moisture, temperature, biome, biomeB,
    biomeMix: second / Math.max(.00001, best + second), biomeWeights,
    land: height < waterLevel ? .2 : 1 - coastal * .35,
    river, coastal, features: { river, lake, ravine: landform.ravine, pond, stream },
    landform: {
      ridge: landform.ridge,
      alpineValley: landform.alpineValley,
      plateau: landform.plateau,
      caldera: landform.caldera,
    },
  }
}
